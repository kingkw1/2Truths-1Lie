"""
Tests for enhanced error handling in chunked upload service
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
from unittest.mock import patch, AsyncMock

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from models import UploadStatus
from config import Settings

@pytest.fixture
def temp_settings():
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.MAX_USER_UPLOADS = 3  # For quota testing
    settings.UPLOAD_SESSION_TIMEOUT = 3600  # 1 hour
    
    yield settings
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def upload_service(temp_settings, monkeypatch):
    """Create upload service with temporary settings"""
    monkeypatch.setattr('config.settings', temp_settings)
    service = ChunkedUploadService()
    return service

@pytest.fixture
def sample_file_data():
    """Create sample file data for testing"""
    data = b"Hello, World! " * 1000  # ~13KB
    return data

class TestUploadServiceErrorHandling:
    """Test cases for enhanced error handling in ChunkedUploadService"""
    
    @pytest.mark.asyncio
    async def test_initiate_upload_invalid_file_size(self, upload_service):
        """Test upload initiation with invalid file size"""
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="test.txt",
                file_size=0,
                mime_type="text/plain"
            )
        
        assert exc_info.value.error_type == UploadErrorType.VALIDATION_ERROR
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_initiate_upload_file_too_large(self, upload_service, temp_settings):
        """Test upload initiation with file too large"""
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="large.txt",
                file_size=temp_settings.MAX_FILE_SIZE + 1,
                mime_type="text/plain"
            )
        
        assert exc_info.value.error_type == UploadErrorType.FILE_TOO_LARGE
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_initiate_upload_unsupported_format(self, upload_service):
        """Test upload initiation with unsupported MIME type"""
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="test.exe",
                file_size=1000,
                mime_type="application/x-executable"
            )
        
        assert exc_info.value.error_type == UploadErrorType.UNSUPPORTED_FORMAT
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_initiate_upload_quota_exceeded(self, upload_service, sample_file_data, temp_settings):
        """Test upload initiation when user quota is exceeded"""
        user_id = "test_user"
        
        # Create maximum allowed concurrent uploads
        for i in range(temp_settings.MAX_USER_UPLOADS):
            await upload_service.initiate_upload(
                user_id=user_id,
                filename=f"test{i}.txt",
                file_size=len(sample_file_data),
                mime_type="text/plain"
            )
        
        # Try to create one more upload
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.initiate_upload(
                user_id=user_id,
                filename="test_extra.txt",
                file_size=len(sample_file_data),
                mime_type="text/plain"
            )
        
        assert exc_info.value.error_type == UploadErrorType.QUOTA_EXCEEDED
        assert exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_session_not_found(self, upload_service):
        """Test chunk upload with non-existent session"""
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.upload_chunk(
                session_id="non-existent",
                chunk_number=0,
                chunk_data=b"test data"
            )
        
        assert exc_info.value.error_type == UploadErrorType.SESSION_NOT_FOUND
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_session_expired(self, upload_service, sample_file_data, temp_settings):
        """Test chunk upload with expired session"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain"
        )
        
        # Manually set session as expired
        from datetime import datetime, timedelta
        session.updated_at = datetime.utcnow() - timedelta(seconds=temp_settings.UPLOAD_SESSION_TIMEOUT + 1)
        upload_service.sessions[session.session_id] = session
        
        # Try to upload chunk
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,
                chunk_data=sample_file_data[:1024]
            )
        
        assert exc_info.value.error_type == UploadErrorType.SESSION_EXPIRED
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_invalid_chunk_number(self, upload_service, sample_file_data):
        """Test chunk upload with invalid chunk number"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Try to upload chunk with invalid number
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=session.total_chunks + 1,  # Invalid chunk number
                chunk_data=sample_file_data[:1024]
            )
        
        assert exc_info.value.error_type == UploadErrorType.VALIDATION_ERROR
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_hash_mismatch(self, upload_service, sample_file_data):
        """Test chunk upload with hash mismatch"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Try to upload chunk with wrong hash
        chunk_data = sample_file_data[:1024]
        wrong_hash = "wrong_hash"
        
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,
                chunk_data=chunk_data,
                chunk_hash=wrong_hash
            )
        
        assert exc_info.value.error_type == UploadErrorType.HASH_MISMATCH
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_size_mismatch(self, upload_service, sample_file_data):
        """Test chunk upload with size mismatch"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Try to upload chunk with wrong size
        wrong_size_chunk = sample_file_data[:512]  # Half the expected size
        
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,
                chunk_data=wrong_size_chunk
            )
        
        assert exc_info.value.error_type == UploadErrorType.CHUNK_MISMATCH
        assert not exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_storage_error(self, upload_service, sample_file_data):
        """Test chunk upload with storage error"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Mock aiofiles.open to raise OSError
        with patch('aiofiles.open', side_effect=OSError("Disk full")):
            with pytest.raises(UploadServiceError) as exc_info:
                await upload_service.upload_chunk(
                    session_id=session.session_id,
                    chunk_number=0,
                    chunk_data=sample_file_data[:1024]
                )
            
            assert exc_info.value.error_type == UploadErrorType.STORAGE_ERROR
            assert exc_info.value.retryable
    
    @pytest.mark.asyncio
    async def test_upload_chunk_duplicate_handling(self, upload_service, sample_file_data):
        """Test that duplicate chunks are handled gracefully"""
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        chunk_data = sample_file_data[:1024]
        
        # Upload chunk first time
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        assert was_uploaded is True
        assert 0 in updated_session.uploaded_chunks
        
        # Upload same chunk again
        updated_session2, was_uploaded2 = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        assert was_uploaded2 is False  # Should indicate it was already uploaded
        assert 0 in updated_session2.uploaded_chunks
    
    @pytest.mark.asyncio
    async def test_error_logging(self, upload_service, sample_file_data, caplog):
        """Test that errors are properly logged"""
        import logging
        
        # Set logging level to capture debug messages
        caplog.set_level(logging.DEBUG)
        
        # Create session
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain"
        )
        
        # Check that initiation was logged
        assert "Upload session" in caplog.text
        assert "initiated for user test_user" in caplog.text
        
        # Upload a chunk successfully
        chunk_data = sample_file_data[:1024]
        await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Check that chunk upload was logged
        assert "Chunk 0 uploaded successfully" in caplog.text
        
        # Try to upload with storage error
        with patch('aiofiles.open', side_effect=OSError("Disk full")):
            with pytest.raises(UploadServiceError):
                await upload_service.upload_chunk(
                    session_id=session.session_id,
                    chunk_number=1,
                    chunk_data=chunk_data
                )
        
        # Check that error was logged
        assert "Failed to write chunk 1" in caplog.text
    
    @pytest.mark.asyncio
    async def test_error_details_preservation(self, upload_service):
        """Test that error details are preserved in exceptions"""
        with pytest.raises(UploadServiceError) as exc_info:
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="test.txt",
                file_size=0,  # Invalid size
                mime_type="text/plain"
            )
        
        error = exc_info.value
        assert error.error_type == UploadErrorType.VALIDATION_ERROR
        assert not error.retryable
        assert "File size must be greater than 0" in str(error)
        
        # Check that error details can be accessed
        assert hasattr(error, 'details')

if __name__ == "__main__":
    pytest.main([__file__])