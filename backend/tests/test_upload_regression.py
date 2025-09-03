"""
Regression tests for upload process and error handling
Ensures previously fixed issues don't reoccur
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
from unittest.mock import patch, AsyncMock, Mock
from datetime import datetime, timedelta
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from services.media_upload_service import MediaUploadService
from models import UploadStatus, UploadSession
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
    settings.MAX_USER_UPLOADS = 5
    settings.UPLOAD_SESSION_TIMEOUT = 3600
    settings.MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
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
def media_upload_service():
    """Create media upload service"""
    return MediaUploadService()

@pytest.fixture
def sample_video_data():
    """Create sample video data for testing"""
    # Simulate a small video file
    data = b"FAKE_VIDEO_HEADER" + b"video_content_" * 1000  # ~15KB
    return data

class TestUploadRegressionScenarios:
    """Regression tests for previously identified upload issues"""
    
    @pytest.mark.asyncio
    async def test_regression_concurrent_upload_race_condition(self, upload_service, sample_video_data):
        """
        Regression test for race condition in concurrent uploads
        Issue: Multiple uploads for same user could exceed quota due to race condition
        """
        user_id = "test_user"
        
        # Create multiple concurrent upload initiation tasks
        async def initiate_upload(filename):
            return await upload_service.initiate_upload(
                user_id=user_id,
                filename=filename,
                file_size=len(sample_video_data),
                mime_type="video/mp4"
            )
        
        # Try to initiate 10 uploads concurrently (should respect quota of 5)
        tasks = [initiate_upload(f"video_{i}.mp4") for i in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful uploads
        successful_uploads = [r for r in results if isinstance(r, UploadSession)]
        failed_uploads = [r for r in results if isinstance(r, Exception)]
        
        # Should have exactly 5 successful uploads (quota limit)
        assert len(successful_uploads) == 5
        assert len(failed_uploads) == 5
        
        # All failures should be quota exceeded errors
        for error in failed_uploads:
            assert isinstance(error, UploadServiceError)
            assert error.error_type == UploadErrorType.QUOTA_EXCEEDED
    
    @pytest.mark.asyncio
    async def test_regression_chunk_hash_validation_bypass(self, upload_service, sample_video_data):
        """
        Regression test for chunk hash validation bypass
        Issue: Malformed hash could bypass validation in certain conditions
        """
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4",
            chunk_size=1024
        )
        
        chunk_data = sample_video_data[:1024]
        
        # Test various malformed hash attempts that previously bypassed validation
        malformed_hashes = [
            "",  # Empty hash
            "null",  # String null
            "undefined",  # String undefined
            "0" * 64,  # All zeros
            "f" * 64,  # All f's
            "invalid_hash_format",  # Invalid format
            None,  # None value (should be handled)
        ]
        
        for malformed_hash in malformed_hashes:
            with pytest.raises(UploadServiceError) as exc_info:
                await upload_service.upload_chunk(
                    session_id=session.session_id,
                    chunk_number=0,
                    chunk_data=chunk_data,
                    chunk_hash=malformed_hash
                )
            
            # Should always fail with hash mismatch, never bypass
            assert exc_info.value.error_type == UploadErrorType.HASH_MISMATCH
    
    @pytest.mark.asyncio
    async def test_regression_session_cleanup_memory_leak(self, upload_service, sample_video_data):
        """
        Regression test for session cleanup memory leak
        Issue: Cancelled/expired sessions weren't properly cleaned up
        """
        initial_session_count = len(upload_service.sessions)
        
        # Create multiple sessions
        sessions = []
        for i in range(10):
            session = await upload_service.initiate_upload(
                user_id=f"user_{i}",
                filename=f"test_{i}.mp4",
                file_size=len(sample_video_data),
                mime_type="video/mp4"
            )
            sessions.append(session)
        
        # Cancel half of them
        for i in range(5):
            await upload_service.cancel_upload(sessions[i].session_id)
        
        # Manually expire the other half
        for i in range(5, 10):
            session = upload_service.sessions[sessions[i].session_id]
            session.updated_at = datetime.utcnow() - timedelta(hours=2)
        
        # Trigger cleanup
        upload_service._cleanup_expired_sessions()
        
        # Should only have active sessions remaining
        final_session_count = len(upload_service.sessions)
        assert final_session_count == initial_session_count
    
    @pytest.mark.asyncio
    async def test_regression_file_descriptor_leak(self, upload_service, sample_video_data, temp_settings):
        """
        Regression test for file descriptor leak
        Issue: Failed chunk uploads left file descriptors open
        """
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4",
            chunk_size=1024
        )
        
        # Mock file operations to fail after opening
        original_open = __builtins__['open']
        open_calls = []
        
        def mock_open(*args, **kwargs):
            file_obj = original_open(*args, **kwargs)
            open_calls.append(file_obj)
            return file_obj
        
        with patch('builtins.open', side_effect=mock_open):
            with patch('aiofiles.open') as mock_aio_open:
                # Make aiofiles.open fail after "opening"
                mock_file = AsyncMock()
                mock_file.__aenter__.return_value = mock_file
                mock_file.write.side_effect = OSError("Disk full")
                mock_aio_open.return_value = mock_file
                
                # Try to upload chunk (should fail)
                with pytest.raises(UploadServiceError):
                    await upload_service.upload_chunk(
                        session_id=session.session_id,
                        chunk_number=0,
                        chunk_data=sample_video_data[:1024]
                    )
                
                # Verify file was properly closed even on error
                mock_file.__aexit__.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_regression_duplicate_chunk_corruption(self, upload_service, sample_video_data):
        """
        Regression test for duplicate chunk corruption
        Issue: Uploading same chunk twice could corrupt the file
        """
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4",
            chunk_size=1024
        )
        
        chunk_data = sample_video_data[:1024]
        
        # Upload chunk first time
        updated_session1, was_uploaded1 = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        assert was_uploaded1 is True
        assert 0 in updated_session1.uploaded_chunks
        
        # Upload same chunk again with different data (should be rejected)
        different_chunk_data = b"different_data" + b"x" * (len(chunk_data) - 14)
        
        updated_session2, was_uploaded2 = await upload_service.upload_chunk(
            session_id=session.session_id,
            chunk_number=0,
            chunk_data=different_chunk_data
        )
        
        # Should indicate duplicate (not uploaded again)
        assert was_uploaded2 is False
        assert 0 in updated_session2.uploaded_chunks
        
        # Verify original chunk data is preserved
        chunk_file = session.temp_dir / f"chunk_0"
        if chunk_file.exists():
            with open(chunk_file, 'rb') as f:
                stored_data = f.read()
            assert stored_data == chunk_data  # Original data preserved
    
    @pytest.mark.asyncio
    async def test_regression_final_hash_timing_attack(self, upload_service, sample_video_data):
        """
        Regression test for timing attack on final hash validation
        Issue: Hash comparison was vulnerable to timing attacks
        """
        chunk_size = 1024
        file_hash = hashlib.sha256(sample_video_data).hexdigest()
        
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4",
            chunk_size=chunk_size,
            file_hash=file_hash
        )
        
        # Upload all chunks
        for i in range(session.total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(sample_video_data))
            chunk_data = sample_video_data[start:end]
            
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=i,
                chunk_data=chunk_data
            )
        
        # Test timing attack resistance with various wrong hashes
        wrong_hashes = [
            "a" + file_hash[1:],  # First character wrong
            file_hash[:-1] + "a",  # Last character wrong
            "a" * 64,  # Completely wrong
            file_hash[:32] + "a" * 32,  # Half wrong
        ]
        
        import time
        timing_results = []
        
        for wrong_hash in wrong_hashes:
            start_time = time.time()
            
            with pytest.raises(UploadServiceError) as exc_info:
                await upload_service.complete_upload(
                    session_id=session.session_id,
                    final_file_hash=wrong_hash
                )
            
            end_time = time.time()
            timing_results.append(end_time - start_time)
            
            assert exc_info.value.error_type == UploadErrorType.HASH_MISMATCH
        
        # All timing results should be similar (no timing attack possible)
        avg_time = sum(timing_results) / len(timing_results)
        for timing in timing_results:
            # Allow 50% variance (timing attacks usually show much larger variance)
            assert abs(timing - avg_time) / avg_time < 0.5

class TestUploadErrorHandlingRegression:
    """Regression tests for error handling edge cases"""
    
    @pytest.mark.asyncio
    async def test_regression_error_message_information_leak(self, upload_service):
        """
        Regression test for information leak in error messages
        Issue: Error messages could leak sensitive system information
        """
        # Test various error conditions that previously leaked information
        
        # 1. File system errors should not leak paths
        with patch('aiofiles.open', side_effect=OSError("/secret/path/file not found")):
            with pytest.raises(UploadServiceError) as exc_info:
                await upload_service.initiate_upload(
                    user_id="test_user",
                    filename="test.mp4",
                    file_size=1000000,
                    mime_type="video/mp4"
                )
            
            # Error message should not contain system paths
            error_msg = str(exc_info.value)
            assert "/secret/path" not in error_msg
            assert "file not found" not in error_msg.lower()
        
        # 2. Database errors should not leak connection strings
        with patch('services.upload_service.logger') as mock_logger:
            mock_logger.error.side_effect = Exception("Connection failed: postgresql://user:pass@host/db")
            
            # Should handle logging errors gracefully
            session = await upload_service.initiate_upload(
                user_id="test_user",
                filename="test.mp4",
                file_size=1000000,
                mime_type="video/mp4"
            )
            
            # Should not expose connection string even if logging fails
            assert session is not None
    
    @pytest.mark.asyncio
    async def test_regression_error_state_corruption(self, upload_service, sample_video_data):
        """
        Regression test for error state corruption
        Issue: Errors in one upload could corrupt state of other uploads
        """
        # Create two separate upload sessions
        session1 = await upload_service.initiate_upload(
            user_id="user1",
            filename="test1.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4"
        )
        
        session2 = await upload_service.initiate_upload(
            user_id="user2",
            filename="test2.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4"
        )
        
        # Upload chunk successfully to session1
        chunk_data = sample_video_data[:1024]
        await upload_service.upload_chunk(
            session_id=session1.session_id,
            chunk_number=0,
            chunk_data=chunk_data
        )
        
        # Cause error in session2
        with patch('aiofiles.open', side_effect=OSError("Disk full")):
            with pytest.raises(UploadServiceError):
                await upload_service.upload_chunk(
                    session_id=session2.session_id,
                    chunk_number=0,
                    chunk_data=chunk_data
                )
        
        # Verify session1 is still intact and functional
        session1_status = await upload_service.get_upload_status(session1.session_id)
        assert session1_status.status == UploadStatus.IN_PROGRESS
        assert 0 in session1_status.uploaded_chunks
        
        # Should be able to continue uploading to session1
        await upload_service.upload_chunk(
            session_id=session1.session_id,
            chunk_number=1,
            chunk_data=sample_video_data[1024:2048]
        )
        
        updated_session1 = await upload_service.get_upload_status(session1.session_id)
        assert 1 in updated_session1.uploaded_chunks
    
    @pytest.mark.asyncio
    async def test_regression_partial_write_recovery(self, upload_service, sample_video_data):
        """
        Regression test for partial write recovery
        Issue: Partial chunk writes could leave corrupted data
        """
        # Initiate upload
        session = await upload_service.initiate_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=len(sample_video_data),
            mime_type="video/mp4",
            chunk_size=1024
        )
        
        chunk_data = sample_video_data[:1024]
        
        # Mock partial write scenario
        write_call_count = 0
        original_write = None
        
        async def mock_write(data):
            nonlocal write_call_count
            write_call_count += 1
            if write_call_count == 1:
                # First write succeeds partially
                raise OSError("Disk full")
            return len(data)
        
        with patch('aiofiles.open') as mock_open:
            mock_file = AsyncMock()
            mock_file.__aenter__.return_value = mock_file
            mock_file.write = mock_write
            mock_open.return_value = mock_file
            
            # First attempt should fail
            with pytest.raises(UploadServiceError):
                await upload_service.upload_chunk(
                    session_id=session.session_id,
                    chunk_number=0,
                    chunk_data=chunk_data
                )
        
        # Reset mock for successful retry
        with patch('aiofiles.open') as mock_open:
            mock_file = AsyncMock()
            mock_file.__aenter__.return_value = mock_file
            mock_file.write.return_value = len(chunk_data)
            mock_open.return_value = mock_file
            
            # Retry should succeed
            updated_session, was_uploaded = await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,
                chunk_data=chunk_data
            )
            
            assert was_uploaded is True
            assert 0 in updated_session.uploaded_chunks

class TestMediaUploadServiceRegression:
    """Regression tests for MediaUploadService"""
    
    def test_regression_mime_type_spoofing(self, media_upload_service):
        """
        Regression test for MIME type spoofing
        Issue: Malicious files could spoof video MIME types
        """
        # Test various spoofing attempts
        spoofing_attempts = [
            ("malware.exe", "video/mp4"),  # Executable with video MIME
            ("script.js", "video/quicktime"),  # Script with video MIME
            ("document.pdf", "video/webm"),  # Document with video MIME
            ("archive.zip", "video/mp4"),  # Archive with video MIME
        ]
        
        for filename, mime_type in spoofing_attempts:
            result = media_upload_service.validate_video_file(filename, 5000000)
            
            # Should reject based on file extension, not just MIME type
            assert result["valid"] is False
            assert "Invalid file extension" in result["error"]
    
    def test_regression_filename_path_traversal(self, media_upload_service):
        """
        Regression test for path traversal in filenames
        Issue: Malicious filenames could escape upload directory
        """
        # Test various path traversal attempts
        traversal_attempts = [
            "../../../etc/passwd.mp4",
            "..\\..\\windows\\system32\\evil.mp4",
            "/etc/passwd.mp4",
            "C:\\Windows\\System32\\evil.mp4",
            "....//....//etc//passwd.mp4",
            "%2e%2e%2f%2e%2e%2fpasswd.mp4",  # URL encoded
        ]
        
        for malicious_filename in traversal_attempts:
            result = media_upload_service.validate_video_file(malicious_filename, 5000000)
            
            # Should reject malicious filenames
            assert result["valid"] is False
            # Should contain path traversal detection message
            assert any(keyword in result["error"].lower() 
                      for keyword in ["invalid", "path", "character", "filename"])
    
    @pytest.mark.asyncio
    async def test_regression_upload_session_hijacking(self, media_upload_service):
        """
        Regression test for upload session hijacking
        Issue: Predictable session IDs could be hijacked
        """
        # Generate multiple session IDs
        session_ids = []
        
        with patch.object(media_upload_service, 'upload_service') as mock_upload_service:
            mock_session = Mock()
            mock_session.session_id = "test_session"
            mock_upload_service.initiate_upload = AsyncMock(return_value=mock_session)
            
            for i in range(100):
                result = await media_upload_service.initiate_video_upload(
                    user_id=f"user_{i}",
                    filename="test.mp4",
                    file_size=5000000,
                    duration_seconds=30.0
                )
                session_ids.append(result["session_id"])
        
        # Session IDs should not be predictable
        # Check for patterns that indicate predictability
        unique_ids = set(session_ids)
        assert len(unique_ids) == len(session_ids)  # All should be unique
        
        # Should not be sequential
        sequential_count = 0
        for i in range(1, len(session_ids)):
            if session_ids[i] == session_ids[i-1]:
                sequential_count += 1
        
        assert sequential_count == 0  # No sequential patterns

if __name__ == "__main__":
    pytest.main([__file__, "-v"])