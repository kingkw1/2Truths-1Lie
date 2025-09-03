"""
Tests for strict server/client validation implementation
Tests the enhanced validation requirements for file format, size, and duration
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock

from services.validation_service import GameplayValidationService, ValidationResult
from services.media_upload_service import MediaUploadService
from models import UploadSession, UploadStatus

@pytest.fixture
def validation_service():
    """Create validation service instance"""
    return GameplayValidationService()

@pytest.fixture
def media_service():
    """Create media upload service instance"""
    return MediaUploadService()

class TestStrictFileValidation:
    """Test strict file validation requirements"""
    
    @pytest.mark.asyncio
    async def test_filename_security_validation(self, validation_service):
        """Test filename security validation"""
        
        # Test valid filename
        result = validation_service._validate_filename_security("video.mp4")
        assert result.is_valid is True
        
        # Test filename too long
        long_filename = "a" * 300 + ".mp4"
        result = validation_service._validate_filename_security(long_filename)
        assert result.is_valid is False
        assert "too long" in result.message
        
        # Test forbidden characters
        forbidden_filenames = [
            "video<test>.mp4",
            "video|test.mp4", 
            'video"test.mp4',
            "video?test.mp4",
            "video*test.mp4"
        ]
        
        for filename in forbidden_filenames:
            result = validation_service._validate_filename_security(filename)
            assert result.is_valid is False
            assert "forbidden characters" in result.message
        
        # Test dangerous extensions
        dangerous_files = [
            "malware.exe",
            "script.bat",
            "command.cmd",
            "virus.scr"
        ]
        
        for filename in dangerous_files:
            result = validation_service._validate_filename_security(filename)
            assert result.is_valid is False
            assert "Dangerous file extension" in result.message
        
        # Test path traversal
        traversal_files = [
            "../../../etc/passwd",
            "..\\windows\\system32\\cmd.exe",
            "/etc/shadow",
            "video..mp4"
        ]
        
        for filename in traversal_files:
            result = validation_service._validate_filename_security(filename)
            assert result.is_valid is False
            assert "path traversal" in result.message
    
    @pytest.mark.asyncio
    async def test_file_size_validation(self, validation_service):
        """Test file size validation bounds"""
        
        # Test file too small
        result = await validation_service.validate_file_before_upload(
            filename="tiny.mp4",
            file_size=50 * 1024,  # 50KB - too small
            mime_type="video/mp4",
            duration_seconds=10.0
        )
        assert result.is_valid is False
        assert "too small" in result.message
        
        # Test file too large
        result = await validation_service.validate_file_before_upload(
            filename="huge.mp4",
            file_size=100 * 1024 * 1024,  # 100MB - too large
            mime_type="video/mp4",
            duration_seconds=10.0
        )
        assert result.is_valid is False
        assert "too large" in result.message
        
        # Test valid file size
        result = await validation_service.validate_file_before_upload(
            filename="valid.mp4",
            file_size=5 * 1024 * 1024,  # 5MB - valid
            mime_type="video/mp4",
            duration_seconds=10.0
        )
        assert result.is_valid is True
    
    @pytest.mark.asyncio
    async def test_duration_validation(self, validation_service):
        """Test video duration validation"""
        
        # Test duration too short
        result = await validation_service.validate_file_before_upload(
            filename="short.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=1.0  # Too short
        )
        assert result.is_valid is False
        assert "too short" in result.message
        
        # Test duration too long
        result = await validation_service.validate_file_before_upload(
            filename="long.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=120.0  # Too long
        )
        assert result.is_valid is False
        assert "too long" in result.message
        
        # Test valid duration
        result = await validation_service.validate_file_before_upload(
            filename="valid.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=15.0  # Valid
        )
        assert result.is_valid is True
    
    @pytest.mark.asyncio
    async def test_mime_type_validation(self, validation_service):
        """Test MIME type validation"""
        
        # Test non-video MIME type
        result = await validation_service.validate_file_before_upload(
            filename="audio.mp3",
            file_size=5 * 1024 * 1024,
            mime_type="audio/mp3",  # Not video
            duration_seconds=10.0
        )
        assert result.is_valid is False
        assert "Only video files are allowed" in result.message
        
        # Test unsupported video format
        result = await validation_service.validate_file_before_upload(
            filename="video.avi",
            file_size=5 * 1024 * 1024,
            mime_type="video/avi",  # Unsupported
            duration_seconds=10.0
        )
        assert result.is_valid is False
        assert "Unsupported video format" in result.message
        
        # Test supported video formats
        supported_formats = ["video/mp4", "video/webm", "video/quicktime", "video/mov"]
        
        for mime_type in supported_formats:
            result = await validation_service.validate_file_before_upload(
                filename=f"video.{mime_type.split('/')[-1]}",
                file_size=5 * 1024 * 1024,
                mime_type=mime_type,
                duration_seconds=10.0
            )
            assert result.is_valid is True, f"Format {mime_type} should be valid"
    
    @pytest.mark.asyncio
    async def test_metadata_validation(self, validation_service):
        """Test additional metadata validation"""
        
        # Test suspicious metadata
        suspicious_metadata = {
            "script_command": "rm -rf /",
            "executable_path": "/bin/bash",
            "shell_code": "malicious_code"
        }
        
        result = await validation_service.validate_file_before_upload(
            filename="video.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=10.0,
            additional_metadata=suspicious_metadata
        )
        assert result.is_valid is False
        assert "Suspicious metadata keys" in result.message
        
        # Test oversized metadata
        large_metadata = {"data": "x" * 20000}  # 20KB metadata
        
        result = await validation_service.validate_file_before_upload(
            filename="video.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=10.0,
            additional_metadata=large_metadata
        )
        assert result.is_valid is False
        assert "Metadata too large" in result.message
        
        # Test valid metadata
        valid_metadata = {
            "user_agent": "TwoTruthsLie-Mobile/iOS",
            "device_type": "iPhone",
            "app_version": "1.0.0"
        }
        
        result = await validation_service.validate_file_before_upload(
            filename="video.mp4",
            file_size=5 * 1024 * 1024,
            mime_type="video/mp4",
            duration_seconds=10.0,
            additional_metadata=valid_metadata
        )
        assert result.is_valid is True

class TestVideoMetadataValidation:
    """Test video metadata and technical specification validation"""
    
    def test_video_dimensions_validation(self, validation_service):
        """Test video resolution validation"""
        
        # Create upload session with low resolution
        low_res_session = UploadSession(
            session_id="low-res",
            user_id="test-user",
            filename="lowres.mp4",
            file_size=1_000_000,
            chunk_size=1024,
            total_chunks=1000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(1000)),
            metadata={
                "video_width": 160,  # Too low
                "video_height": 120   # Too low
            }
        )
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_metadata(low_res_session, statement_data)
        assert result.is_valid is False
        assert "resolution too low" in result.message
        
        # Test high resolution
        high_res_session = UploadSession(
            session_id="high-res",
            user_id="test-user",
            filename="highres.mp4",
            file_size=50_000_000,
            chunk_size=1024,
            total_chunks=50000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(50000)),
            metadata={
                "video_width": 4000,  # Too high
                "video_height": 3000  # Too high
            }
        )
        
        result = validation_service._validate_video_metadata(high_res_session, statement_data)
        assert result.is_valid is False
        assert "resolution too high" in result.message
        
        # Test valid resolution
        valid_res_session = UploadSession(
            session_id="valid-res",
            user_id="test-user",
            filename="validres.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "video_width": 1280,  # Valid
                "video_height": 720   # Valid
            }
        )
        
        result = validation_service._validate_video_metadata(valid_res_session, statement_data)
        assert result.is_valid is True
    
    def test_codec_validation(self, validation_service):
        """Test video and audio codec validation"""
        
        # Test unsupported video codec
        unsupported_video_session = UploadSession(
            session_id="unsupported-video",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "video_codec": "xvid",  # Unsupported
                "audio_codec": "aac"
            }
        )
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_metadata(unsupported_video_session, statement_data)
        assert result.is_valid is False
        assert "Unsupported video codec" in result.message
        
        # Test unsupported audio codec
        unsupported_audio_session = UploadSession(
            session_id="unsupported-audio",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "video_codec": "h264",
                "audio_codec": "mp3"  # Unsupported
            }
        )
        
        result = validation_service._validate_video_metadata(unsupported_audio_session, statement_data)
        assert result.is_valid is False
        assert "Unsupported audio codec" in result.message
        
        # Test supported codecs
        supported_session = UploadSession(
            session_id="supported",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "video_codec": "h264",  # Supported
                "audio_codec": "aac"    # Supported
            }
        )
        
        result = validation_service._validate_video_metadata(supported_session, statement_data)
        assert result.is_valid is True
    
    def test_bitrate_validation(self, validation_service):
        """Test video bitrate validation"""
        
        # Test bitrate too low
        low_bitrate_session = UploadSession(
            session_id="low-bitrate",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "bitrate": 50_000  # Too low
            }
        )
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_metadata(low_bitrate_session, statement_data)
        assert result.is_valid is False
        assert "bitrate too low" in result.message
        
        # Test bitrate too high
        high_bitrate_session = UploadSession(
            session_id="high-bitrate",
            user_id="test-user",
            filename="video.mp4",
            file_size=50_000_000,
            chunk_size=1024,
            total_chunks=50000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(50000)),
            metadata={
                "bitrate": 20_000_000  # Too high
            }
        )
        
        result = validation_service._validate_video_metadata(high_bitrate_session, statement_data)
        assert result.is_valid is False
        assert "bitrate too high" in result.message
        
        # Test valid bitrate
        valid_bitrate_session = UploadSession(
            session_id="valid-bitrate",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000)),
            metadata={
                "bitrate": 2_000_000  # Valid
            }
        )
        
        result = validation_service._validate_video_metadata(valid_bitrate_session, statement_data)
        assert result.is_valid is True

class TestMediaUploadServiceValidation:
    """Test media upload service validation integration"""
    
    def test_enhanced_video_validation(self, media_service):
        """Test enhanced video file validation in media service"""
        
        # Test valid file
        result = media_service.validate_video_file(
            filename="test.mp4",
            file_size=5 * 1024 * 1024,
            duration_seconds=15.0
        )
        assert result["valid"] is True
        assert "validation_details" in result
        
        # Test invalid extension
        result = media_service.validate_video_file(
            filename="test.exe",
            file_size=5 * 1024 * 1024,
            duration_seconds=15.0
        )
        assert result["valid"] is False
        assert result["error_code"] == "INVALID_EXTENSION"
        
        # Test file too large
        result = media_service.validate_video_file(
            filename="test.mp4",
            file_size=200 * 1024 * 1024,  # 200MB
            duration_seconds=15.0
        )
        assert result["valid"] is False
        assert result["error_code"] == "FILE_TOO_LARGE"
        
        # Test file too small
        result = media_service.validate_video_file(
            filename="test.mp4",
            file_size=50 * 1024,  # 50KB
            duration_seconds=15.0
        )
        assert result["valid"] is False
        assert result["error_code"] == "FILE_TOO_SMALL"

class TestEndToEndValidation:
    """Test end-to-end validation flow"""
    
    @pytest.mark.asyncio
    async def test_complete_validation_flow(self, validation_service):
        """Test complete validation from client to server"""
        
        # Simulate a complete validation flow
        test_cases = [
            {
                "filename": "valid_video.mp4",
                "file_size": 5 * 1024 * 1024,
                "mime_type": "video/mp4",
                "duration": 15.0,
                "should_pass": True
            },
            {
                "filename": "invalid_extension.txt",
                "file_size": 5 * 1024 * 1024,
                "mime_type": "text/plain",
                "duration": 15.0,
                "should_pass": False
            },
            {
                "filename": "too_short.mp4",
                "file_size": 5 * 1024 * 1024,
                "mime_type": "video/mp4",
                "duration": 1.0,
                "should_pass": False
            },
            {
                "filename": "too_long.mp4",
                "file_size": 5 * 1024 * 1024,
                "mime_type": "video/mp4",
                "duration": 120.0,
                "should_pass": False
            },
            {
                "filename": "malicious<script>.mp4",
                "file_size": 5 * 1024 * 1024,
                "mime_type": "video/mp4",
                "duration": 15.0,
                "should_pass": False
            }
        ]
        
        for test_case in test_cases:
            result = await validation_service.validate_file_before_upload(
                filename=test_case["filename"],
                file_size=test_case["file_size"],
                mime_type=test_case["mime_type"],
                duration_seconds=test_case["duration"]
            )
            
            if test_case["should_pass"]:
                assert result.is_valid is True, f"Test case should pass: {test_case['filename']}"
            else:
                assert result.is_valid is False, f"Test case should fail: {test_case['filename']}"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])