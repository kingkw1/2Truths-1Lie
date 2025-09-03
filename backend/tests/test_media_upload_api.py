"""
Tests for Media Upload API endpoints
"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import tempfile
import os
from pathlib import Path

from main import app
from services.media_upload_service import MediaUploadService
from services.upload_service import UploadServiceError, UploadErrorType

client = TestClient(app)

class TestMediaUploadAPI:
    """Test media upload API endpoints"""
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'validate_video_file')
    @patch.object(MediaUploadService, 'initiate_video_upload')
    def test_initiate_video_upload_success(self, mock_initiate, mock_validate, mock_auth):
        """Test successful video upload initiation"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_validate.return_value = {"valid": True, "mime_type": "video/mp4"}
        mock_initiate.return_value = {
            "session_id": "test_session",
            "upload_url": "/api/v1/media/upload/test_session",
            "chunk_size": 1048576,
            "total_chunks": 5
        }
        
        # Make request
        response = client.post(
            "/api/v1/media/upload/initiate",
            data={
                "filename": "test_video.mp4",
                "file_size": 5000000,
                "duration_seconds": 30.0,
                "mime_type": "video/mp4"
            }
        )
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test_session"
        assert "X-Upload-Session-ID" in response.headers
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'validate_video_file')
    def test_initiate_video_upload_invalid_file(self, mock_validate, mock_auth):
        """Test video upload initiation with invalid file"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_validate.return_value = {
            "valid": False, 
            "error": "Invalid file extension .txt"
        }
        
        # Make request
        response = client.post(
            "/api/v1/media/upload/initiate",
            data={
                "filename": "test_file.txt",
                "file_size": 1000,
                "duration_seconds": 30.0,
                "mime_type": "text/plain"
            }
        )
        
        # Verify response
        assert response.status_code == 400
        assert "Invalid file extension" in response.json()["detail"]
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'stream_media')
    def test_stream_video_success(self, mock_stream, mock_auth):
        """Test successful video streaming"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        
        # Create temporary test file
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(b"test video content")
            temp_path = Path(temp_file.name)
        
        try:
            mock_stream.return_value = {
                "file_path": temp_path,
                "mime_type": "video/mp4",
                "file_size": 18,
                "start": 0,
                "end": 17,
                "content_length": 18,
                "supports_range": True
            }
            
            # Make request
            response = client.get("/api/v1/media/stream/test_media_id")
            
            # Verify response
            assert response.status_code == 200
            assert response.headers["content-type"] == "video/mp4"
            assert "Accept-Ranges" in response.headers
            
        finally:
            # Cleanup
            temp_path.unlink(missing_ok=True)
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'stream_media')
    def test_stream_video_not_found(self, mock_stream, mock_auth):
        """Test video streaming with non-existent media"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_stream.side_effect = FileNotFoundError("Media not found")
        
        # Make request
        response = client.get("/api/v1/media/stream/nonexistent_id")
        
        # Verify response
        assert response.status_code == 404
        assert "Media not found" in response.json()["detail"]   
 
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'get_media_info')
    def test_get_media_info_success(self, mock_get_info, mock_auth):
        """Test successful media info retrieval"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_get_info.return_value = {
            "media_id": "test_media_id",
            "filename": "test_video.mp4",
            "file_size": 5000000,
            "mime_type": "video/mp4",
            "created_at": "2023-01-01T00:00:00",
            "modified_at": "2023-01-01T00:00:00"
        }
        
        # Make request
        response = client.get("/api/v1/media/info/test_media_id")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["media_id"] == "test_media_id"
        assert data["mime_type"] == "video/mp4"
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'delete_media')
    def test_delete_media_success(self, mock_delete, mock_auth):
        """Test successful media deletion"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_delete.return_value = True
        
        # Make request
        response = client.delete("/api/v1/media/delete/test_media_id")
        
        # Verify response
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
    
    @patch('api.media_endpoints.get_current_user')
    @patch.object(MediaUploadService, 'validate_video_file')
    def test_validate_video_file(self, mock_validate, mock_auth):
        """Test video file validation endpoint"""
        # Setup mocks
        mock_auth.return_value = "test_user"
        mock_validate.return_value = {
            "valid": True,
            "mime_type": "video/mp4",
            "file_extension": ".mp4"
        }
        
        # Make request
        response = client.post(
            "/api/v1/media/validate",
            data={
                "filename": "test_video.mp4",
                "file_size": 5000000
            }
        )
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["mime_type"] == "video/mp4"

class TestMediaUploadService:
    """Test MediaUploadService class"""
    
    def setup_method(self):
        """Setup test environment"""
        self.service = MediaUploadService()
    
    def test_validate_video_file_valid(self):
        """Test video file validation with valid file"""
        result = self.service.validate_video_file("test.mp4", 5000000)
        
        assert result["valid"] is True
        assert result["mime_type"] == "video/mp4"
        assert result["file_extension"] == ".mp4"
    
    def test_validate_video_file_invalid_extension(self):
        """Test video file validation with invalid extension"""
        result = self.service.validate_video_file("test.txt", 1000)
        
        assert result["valid"] is False
        assert "Invalid file extension" in result["error"]
    
    def test_validate_video_file_too_large(self):
        """Test video file validation with file too large"""
        large_size = 200_000_000  # 200MB
        result = self.service.validate_video_file("test.mp4", large_size)
        
        assert result["valid"] is False
        assert "exceeds maximum" in result["error"]
    
    @pytest.mark.asyncio
    @patch.object(MediaUploadService, 'upload_service')
    async def test_initiate_video_upload(self, mock_upload_service):
        """Test video upload initiation"""
        # Setup mock
        mock_session = Mock()
        mock_session.session_id = "test_session"
        mock_session.chunk_size = 1048576
        mock_session.total_chunks = 5
        mock_session.created_at = "2023-01-01T00:00:00"
        
        mock_upload_service.initiate_upload = AsyncMock(return_value=mock_session)
        
        # Test initiation
        result = await self.service.initiate_video_upload(
            user_id="test_user",
            filename="test.mp4",
            file_size=5000000,
            duration_seconds=30.0
        )
        
        # Verify result
        assert result["session_id"] == "test_session"
        assert "upload_url" in result
        assert result["chunk_size"] == 1048576
    
    @pytest.mark.asyncio
    async def test_initiate_video_upload_invalid_duration(self):
        """Test video upload initiation with invalid duration"""
        with pytest.raises(UploadServiceError) as exc_info:
            await self.service.initiate_video_upload(
                user_id="test_user",
                filename="test.mp4",
                file_size=5000000,
                duration_seconds=600.0  # 10 minutes, exceeds 5 minute limit
            )
        
        assert exc_info.value.error_type == UploadErrorType.VALIDATION_ERROR
        assert "duration" in str(exc_info.value).lower()

if __name__ == "__main__":
    pytest.main([__file__])