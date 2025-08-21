"""
Tests for chunked upload service
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.upload_service import ChunkedUploadService
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

@pytest.fixture
def sample_file_hash(sample_file_data):
    """Calculate hash of sample file"""
    return hashlib.sha256(sample_file_data).hexdigest()

class TestChunkedUploadService:
    """Test cases for ChunkedUploadService"""
    
    @pytest.mark.asyncio
    async def test_initiate_upload_success(self, upload_service, sample_file_data):
        """Test successful upload initiation"""
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        assert session.user_id == "test_user"
        assert session.filename == "test.txt"
        assert session.file_size == len(sample_file_data)
        assert session.chunk_size == 1024
        assert session.status == UploadStatus.PENDING
        assert session.total_chunks == (len(sample_file_data) + 1023) // 1024
    
    @pytest.mark.asyncio
    async def test_initiate_upload_invalid_mime_type(self, upload_service):
        """Test upload initiation with invalid MIME type"""
        with pytest.raises(ValueError, match="MIME type .* is not allowed"):
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="test.exe",
                file_size=1000,
                mime_type="application/x-executable"
            )
    
    @pytest.mark.asyncio
    async def test_initiate_upload_file_too_large(self, upload_service, temp_settings):
        """Test upload initiation with file too large"""
        with pytest.raises(ValueError, match="File size exceeds maximum"):
            await upload_service.initiate_upload(
                user_id="test_user",
                filename="large.txt",
                file_size=temp_settings.MAX_FILE_SIZE + 1,
                mime_type="text/plain"
            )
    
    @pytest.mark.asyncio
    async def test_upload_chunk_success(self, upload_service, sample_file_data):
        """Test successful chunk upload"""
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Upload first chunk
        chunk_data = sample_file_data[:1024]
        chunk_hash = hashlib.sha256(chunk_data).hexdigest()
        
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data,
            chunk_hash=chunk_hash
        )
        
        assert was_uploaded is True
        assert 0 in updated_session.uploaded_chunks
        assert updated_session.status == UploadStatus.IN_PROGRESS
    
    @pytest.mark.asyncio
    async def test_upload_chunk_duplicate(self, upload_service, sample_file_data):
        """Test uploading the same chunk twice"""
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Upload chunk twice
        chunk_data = sample_file_data[:1024]
        
        # First upload
        await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Second upload (duplicate)
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        assert was_uploaded is False
        assert 0 in updated_session.uploaded_chunks
    
    @pytest.mark.asyncio
    async def test_upload_chunk_invalid_hash(self, upload_service, sample_file_data):
        """Test chunk upload with invalid hash"""
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Upload chunk with wrong hash
        chunk_data = sample_file_data[:1024]
        wrong_hash = "invalid_hash"
        
        with pytest.raises(ValueError, match="Chunk hash mismatch"):
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,
                chunk_data=chunk_data,
                chunk_hash=wrong_hash
            )
    
    @pytest.mark.asyncio
    async def test_complete_upload_success(self, upload_service, sample_file_data, sample_file_hash):
        """Test successful upload completion"""
        chunk_size = 1024
        
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=chunk_size,
            file_hash=sample_file_hash
        )
        
        # Upload all chunks
        for i in range(session.total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(sample_file_data))
            chunk_data = sample_file_data[start:end]
            
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=i,
                chunk_data=chunk_data
            )
        
        # Complete upload
        final_path = await upload_service.complete_upload(
            session_id=session.session_id,
            final_file_hash=sample_file_hash
        )
        
        # Verify file exists and content matches
        assert final_path.exists()
        with open(final_path, 'rb') as f:
            file_content = f.read()
        assert file_content == sample_file_data
        
        # Verify session status
        completed_session = await upload_service.get_upload_status(session.session_id)
        assert completed_session.status == UploadStatus.COMPLETED
        assert completed_session.completed_at is not None
    
    @pytest.mark.asyncio
    async def test_complete_upload_missing_chunks(self, upload_service, sample_file_data):
        """Test upload completion with missing chunks"""
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Upload only first chunk (missing others)
        chunk_data = sample_file_data[:1024]
        await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Try to complete upload
        with pytest.raises(ValueError, match="Missing chunks"):
            await upload_service.complete_upload(session_id=session.session_id)
    
    @pytest.mark.asyncio
    async def test_complete_upload_hash_mismatch(self, upload_service, sample_file_data):
        """Test upload completion with hash mismatch"""
        chunk_size = 1024
        
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=chunk_size
        )
        
        # Upload all chunks
        for i in range(session.total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(sample_file_data))
            chunk_data = sample_file_data[start:end]
            
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=i,
                chunk_data=chunk_data
            )
        
        # Try to complete with wrong hash
        wrong_hash = "wrong_hash"
        with pytest.raises(ValueError, match="Final file hash mismatch"):
            await upload_service.complete_upload(
                session_id=session.session_id,
                final_file_hash=wrong_hash
            )
    
    @pytest.mark.asyncio
    async def test_cancel_upload(self, upload_service, sample_file_data):
        """Test upload cancellation"""
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain"
        )
        
        # Upload a chunk
        chunk_data = sample_file_data[:1024]
        await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Cancel upload
        success = await upload_service.cancel_upload(session.session_id)
        assert success is True
        
        # Verify session status
        cancelled_session = await upload_service.get_upload_status(session.session_id)
        assert cancelled_session.status == UploadStatus.CANCELLED
    
    @pytest.mark.asyncio
    async def test_get_remaining_chunks(self, upload_service, sample_file_data):
        """Test getting remaining chunks"""
        # Initiate upload with multiple chunks
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=1024
        )
        
        # Upload some chunks
        chunk_data = sample_file_data[:1024]
        await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Check remaining chunks
        remaining = upload_service.get_remaining_chunks(session.session_id)
        expected_remaining = list(range(1, session.total_chunks))
        assert remaining == expected_remaining
    
    @pytest.mark.asyncio
    async def test_get_progress_percent(self, upload_service, sample_file_data):
        """Test progress percentage calculation"""
        # Initiate upload with 4 chunks
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(sample_file_data),
            mime_type="text/plain",
            chunk_size=len(sample_file_data) // 4
        )
        
        # Upload 2 chunks (50%)
        for i in range(2):
            start = i * session.chunk_size
            end = min(start + session.chunk_size, len(sample_file_data))
            chunk_data = sample_file_data[start:end]
            
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=i,
                chunk_data=chunk_data
            )
        
        # Check progress
        progress = upload_service.get_progress_percent(session.session_id)
        assert progress == 50.0

if __name__ == "__main__":
    pytest.main([__file__])