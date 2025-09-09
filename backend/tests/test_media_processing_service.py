"""
Unit tests for MediaUploadService - Media processing and upload functionality
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
import mimetypes
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.media_upload_service import MediaUploadService
from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from services.cloud_storage_service import CloudStorageError
from models import UploadSession, UploadStatus
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
    settings.USE_CLOUD_STORAGE = False
    settings.ENABLE_GLOBAL_CDN = False
    settings.MAX_FILE_SIZE = 50_000_000
    settings.MAX_VIDEO_DURATION_SECONDS = 300
    settings.ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
    settings.SIGNED_URL_EXPIRY = 3600
    
    yield settings
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def mock_upload_service():
    """Mock chunked upload service"""
    service = Mock(spec=ChunkedUploadService)
    return service

@pytest.fixture
def mock_cloud_storage():
    """Mock cloud storage service"""
    storage = Mock()
    storage.upload_file_stream = AsyncMock(return_value="https://s3.example.com/test-file.mp4")
    storage.get_file_url = AsyncMock(return_value="https://s3.example.com/signed-url")
    storage.get_file_metadata = AsyncMock(return_value={
        "content_length": 1000000,
        "content_type": "video/mp4",
        "last_modified": "2023-01-01T00:00:00Z",
        "metadata": {"user_id": "test_user"}
    })
    storage.file_exists = AsyncMock(return_value=True)
    storage.delete_file = AsyncMock(return_value=True)
    storage.list_files = AsyncMock(return_value=[])
    return storage

@pytest.fixture
def mock_cdn_service():
    """Mock CDN service"""
    cdn = Mock()
    cdn.is_enabled.return_value = True
    cdn.get_cdn_url.return_value = "https://cdn.example.com/test-file.mp4"
    cdn.create_signed_url.return_value = "https://cdn.example.com/signed-url"
    cdn.optimize_delivery_for_device.return_value = {
        "recommended_quality": "720p",
        "supports_hls": True
    }
    return cdn

@pytest.fixture
def media_upload_service(temp_settings, monkeypatch, mock_upload_service):
    """Create media upload service with mocked dependencies"""
    monkeypatch.setattr('config.settings', temp_settings)
    
    with patch('services.media_upload_service.ChunkedUploadService', return_value=mock_upload_service):
        service = MediaUploadService()
        return service

@pytest.fixture
def sample_video_data():
    """Create sample video data"""
    return b"MOCK_VIDEO_DATA" * 1000  # ~15KB

@pytest.fixture
def mock_upload_session():
    """Create mock upload session"""
    session = Mock(spec=UploadSession)
    session.session_id = "test_session_id"
    session.user_id = "test_user"
    session.filename = "test_video.mp4"
    session.file_size = 15000
    session.mime_type = "video/mp4"
    session.status = UploadStatus.COMPLETED
    session.created_at = datetime.utcnow()
    session.metadata = {
        "duration_seconds": 30.0,
        "upload_timestamp": datetime.utcnow().isoformat()
    }
    return session

class TestMediaUploadService:
    """Test cases for MediaUploadService"""
    
    def test_init_without_cloud_storage(self, temp_settings, monkeypatch):
        """Test initialization without cloud storage"""
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            service = MediaUploadService()
            
            assert service.use_cloud_storage is False
            assert service.cloud_storage is None
            assert service.use_cdn is False
            assert service.cdn_service is None
    
    def test_init_with_cloud_storage_enabled(self, temp_settings, monkeypatch, mock_cloud_storage):
        """Test initialization with cloud storage enabled"""
        temp_settings.USE_CLOUD_STORAGE = True
        temp_settings.CLOUD_STORAGE_PROVIDER = "aws_s3"
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                assert service.use_cloud_storage is True
                assert service.cloud_storage is not None
    
    def test_init_cloud_storage_failure(self, temp_settings, monkeypatch):
        """Test initialization when cloud storage setup fails"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', side_effect=Exception("Cloud setup failed")):
                service = MediaUploadService()
                
                # Should fallback to local storage
                assert service.use_cloud_storage is False
                assert service.cloud_storage is None
    
    @pytest.mark.asyncio
    async def test_initiate_video_upload_success(self, media_upload_service, mock_upload_service):
        """Test successful video upload initiation"""
        # Mock upload service response
        mock_session = Mock()
        mock_session.session_id = "test_session"
        mock_session.chunk_size = 1048576
        mock_session.total_chunks = 5
        mock_session.created_at = datetime.utcnow()
        
        mock_upload_service.initiate_upload = AsyncMock(return_value=mock_session)
        
        result = await media_upload_service.initiate_video_upload(
            user_id="test_user",
            filename="test_video.mp4",
            file_size=5000000,
            duration_seconds=30.0
        )
        
        assert result["session_id"] == "test_session"
        assert "upload_url" in result
        assert result["chunk_size"] == 1048576
        assert result["total_chunks"] == 5
        
        # Verify upload service was called with correct parameters
        mock_upload_service.initiate_upload.assert_called_once()
        call_args = mock_upload_service.initiate_upload.call_args
        assert call_args[1]["user_id"] == "test_user"
        assert call_args[1]["filename"] == "test_video.mp4"
        assert call_args[1]["metadata"]["media_type"] == "video"
        assert call_args[1]["metadata"]["duration_seconds"] == 30.0
    
    @pytest.mark.asyncio
    async def test_initiate_video_upload_invalid_mime_type(self, media_upload_service):
        """Test video upload initiation with invalid MIME type"""
        with pytest.raises(UploadServiceError, match="Invalid video format"):
            await media_upload_service.initiate_video_upload(
                user_id="test_user",
                filename="test_file.txt",
                file_size=1000,
                duration_seconds=30.0
            )
    
    @pytest.mark.asyncio
    async def test_initiate_video_upload_duration_too_long(self, media_upload_service):
        """Test video upload initiation with duration too long"""
        with pytest.raises(UploadServiceError, match="duration.*exceeds maximum"):
            await media_upload_service.initiate_video_upload(
                user_id="test_user",
                filename="test_video.mp4",
                file_size=5000000,
                duration_seconds=600.0  # 10 minutes, exceeds 5 minute limit
            )
    
    @pytest.mark.asyncio
    async def test_complete_video_upload_local_storage(self, media_upload_service, mock_upload_service, mock_upload_session, temp_settings):
        """Test video upload completion with local storage"""
        # Create a temporary file to simulate completed upload
        temp_file = temp_settings.UPLOAD_DIR / "completed_upload.mp4"
        with open(temp_file, 'wb') as f:
            f.write(b"test video content")
        
        # Mock upload service responses
        mock_upload_service.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service.complete_upload = AsyncMock(return_value=temp_file)
        
        result = await media_upload_service.complete_video_upload(
            session_id="test_session_id",
            user_id="test_user"
        )
        
        assert result["storage_type"] == "local"
        assert "media_id" in result
        assert "streaming_url" in result
        assert result["file_size"] == 15000
        assert result["duration_seconds"] == 30.0
        assert result["mime_type"] == "video/mp4"
    
    @pytest.mark.asyncio
    async def test_complete_video_upload_cloud_storage(self, temp_settings, monkeypatch, mock_upload_service, mock_upload_session, mock_cloud_storage):
        """Test video upload completion with cloud storage"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        # Create temporary file
        temp_file = temp_settings.UPLOAD_DIR / "completed_upload.mp4"
        with open(temp_file, 'wb') as f:
            f.write(b"test video content")
        
        # Setup service with cloud storage
        with patch('services.media_upload_service.ChunkedUploadService', return_value=mock_upload_service):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                # Mock upload service responses
                mock_upload_service.get_upload_status = AsyncMock(return_value=mock_upload_session)
                mock_upload_service.complete_upload = AsyncMock(return_value=temp_file)
                
                result = await service.complete_video_upload(
                    session_id="test_session_id",
                    user_id="test_user"
                )
                
                assert result["storage_type"] == "cloud"
                assert "cloud_key" in result
                assert result["streaming_url"] == "https://s3.example.com/test-file.mp4"
                
                # Verify cloud storage was called
                mock_cloud_storage.upload_file_stream.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_complete_video_upload_cloud_failure_fallback(self, temp_settings, monkeypatch, mock_upload_service, mock_upload_session, mock_cloud_storage):
        """Test video upload completion with cloud storage failure and local fallback"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        # Create temporary file
        temp_file = temp_settings.UPLOAD_DIR / "completed_upload.mp4"
        with open(temp_file, 'wb') as f:
            f.write(b"test video content")
        
        # Mock cloud storage failure
        mock_cloud_storage.upload_file_stream = AsyncMock(side_effect=CloudStorageError("Upload failed"))
        
        with patch('services.media_upload_service.ChunkedUploadService', return_value=mock_upload_service):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                mock_upload_service.get_upload_status = AsyncMock(return_value=mock_upload_session)
                mock_upload_service.complete_upload = AsyncMock(return_value=temp_file)
                
                result = await service.complete_video_upload(
                    session_id="test_session_id",
                    user_id="test_user"
                )
                
                assert result["storage_type"] == "local_fallback"
                assert "warning" in result
                assert "Cloud storage failed" in result["warning"]
    
    @pytest.mark.asyncio
    async def test_complete_video_upload_session_not_found(self, media_upload_service, mock_upload_service):
        """Test video upload completion with non-existent session"""
        mock_upload_service.get_upload_status = AsyncMock(return_value=None)
        
        with pytest.raises(UploadServiceError, match="Upload session not found"):
            await media_upload_service.complete_video_upload(
                session_id="nonexistent_session",
                user_id="test_user"
            )
    
    @pytest.mark.asyncio
    async def test_complete_video_upload_access_denied(self, media_upload_service, mock_upload_service, mock_upload_session):
        """Test video upload completion with access denied"""
        mock_upload_session.user_id = "other_user"  # Different user
        mock_upload_service.get_upload_status = AsyncMock(return_value=mock_upload_session)
        
        with pytest.raises(UploadServiceError, match="access denied"):
            await media_upload_service.complete_video_upload(
                session_id="test_session_id",
                user_id="test_user"
            )
    
    @pytest.mark.asyncio
    async def test_get_media_info_local_storage(self, media_upload_service, temp_settings):
        """Test getting media info from local storage"""
        # Create test media file
        media_id = "test_media_id"
        media_file = temp_settings.UPLOAD_DIR / "media" / f"{media_id}_test_video.mp4"
        media_file.parent.mkdir(exist_ok=True)
        with open(media_file, 'wb') as f:
            f.write(b"test video content")
        
        result = await media_upload_service.get_media_info(media_id)
        
        assert result is not None
        assert result["media_id"] == media_id
        assert result["storage_type"] == "local"
        assert result["file_size"] > 0
        assert "mime_type" in result
    
    @pytest.mark.asyncio
    async def test_get_media_info_not_found(self, media_upload_service):
        """Test getting media info for non-existent media"""
        result = await media_upload_service.get_media_info("nonexistent_media_id")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_media_info_cloud_storage(self, temp_settings, monkeypatch, mock_cloud_storage):
        """Test getting media info from cloud storage"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                result = await service.get_media_info("test_media_id", "test_user")
                
                assert result is not None
                assert result["storage_type"] == "cloud"
                assert result["file_size"] == 1000000
                assert result["mime_type"] == "video/mp4"
    
    @pytest.mark.asyncio
    async def test_stream_media_local_storage(self, media_upload_service, temp_settings):
        """Test streaming media from local storage"""
        # Create test media file
        media_id = "test_media_id"
        media_file = temp_settings.UPLOAD_DIR / "media" / f"{media_id}_test_video.mp4"
        media_file.parent.mkdir(exist_ok=True)
        test_content = b"test video content for streaming"
        with open(media_file, 'wb') as f:
            f.write(test_content)
        
        result = await media_upload_service.stream_media(media_id)
        
        assert result["streaming_type"] == "local"
        assert result["file_path"] == media_file
        assert result["file_size"] == len(test_content)
        assert result["supports_range"] is True
        assert result["start"] == 0
        assert result["end"] == len(test_content) - 1
    
    @pytest.mark.asyncio
    async def test_stream_media_with_range_header(self, media_upload_service, temp_settings):
        """Test streaming media with range header"""
        # Create test media file
        media_id = "test_media_id"
        media_file = temp_settings.UPLOAD_DIR / "media" / f"{media_id}_test_video.mp4"
        media_file.parent.mkdir(exist_ok=True)
        test_content = b"test video content for streaming"
        with open(media_file, 'wb') as f:
            f.write(test_content)
        
        result = await media_upload_service.stream_media(media_id, range_header="bytes=5-15")
        
        assert result["start"] == 5
        assert result["end"] == 15
        assert result["content_length"] == 11  # 15 - 5 + 1
    
    @pytest.mark.asyncio
    async def test_stream_media_cloud_storage(self, temp_settings, monkeypatch, mock_cloud_storage):
        """Test streaming media from cloud storage"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                result = await service.stream_media("test_media_id", "test_user")
                
                assert result["streaming_type"] == "redirect"
                assert result["signed_url"] == "https://s3.example.com/signed-url"
                assert result["storage_type"] == "cloud"
                assert result["supports_range"] is True
    
    @pytest.mark.asyncio
    async def test_stream_media_not_found(self, media_upload_service):
        """Test streaming non-existent media"""
        with pytest.raises(FileNotFoundError, match="Media .* not found"):
            await media_upload_service.stream_media("nonexistent_media_id")
    
    @pytest.mark.asyncio
    async def test_delete_media_local_storage(self, media_upload_service, temp_settings):
        """Test deleting media from local storage"""
        # Create test media file
        media_id = "test_media_id"
        media_file = temp_settings.UPLOAD_DIR / "media" / f"{media_id}_test_video.mp4"
        media_file.parent.mkdir(exist_ok=True)
        with open(media_file, 'wb') as f:
            f.write(b"test video content")
        
        result = await media_upload_service.delete_media(media_id, "test_user")
        
        assert result is True
        assert not media_file.exists()
    
    @pytest.mark.asyncio
    async def test_delete_media_cloud_storage(self, temp_settings, monkeypatch, mock_cloud_storage):
        """Test deleting media from cloud storage"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                result = await service.delete_media("test_media_id", "test_user")
                
                assert result is True
                mock_cloud_storage.delete_file.assert_called()
    
    @pytest.mark.asyncio
    async def test_delete_media_not_found(self, media_upload_service):
        """Test deleting non-existent media"""
        result = await media_upload_service.delete_media("nonexistent_media_id", "test_user")
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_user_media_library_local_storage(self, media_upload_service, temp_settings):
        """Test getting user media library from local storage"""
        # Create test media files
        media_dir = temp_settings.UPLOAD_DIR / "media"
        media_dir.mkdir(exist_ok=True)
        
        for i in range(3):
            media_file = media_dir / f"media_{i}_test_video_{i}.mp4"
            with open(media_file, 'wb') as f:
                f.write(b"test video content " + str(i).encode())
        
        result = await media_upload_service.get_user_media_library("test_user")
        
        assert "media" in result
        assert result["totalCount"] >= 0
        assert "hasMore" in result
    
    @pytest.mark.asyncio
    async def test_get_user_media_library_cloud_storage(self, temp_settings, monkeypatch, mock_cloud_storage):
        """Test getting user media library from cloud storage"""
        temp_settings.USE_CLOUD_STORAGE = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        # Mock cloud storage file list
        mock_cloud_files = [
            {
                "key": "media/test_user/media_1/video.mp4",
                "size": 1000000,
                "content_type": "video/mp4",
                "metadata": {
                    "original_filename": "test_video.mp4",
                    "duration_seconds": "30.0",
                    "uploaded_at": "2023-01-01T00:00:00Z"
                }
            }
        ]
        mock_cloud_storage.list_files = AsyncMock(return_value=mock_cloud_files)
        mock_cloud_storage.get_file_url = AsyncMock(return_value="https://s3.example.com/signed-url")
        
        with patch('services.media_upload_service.ChunkedUploadService'):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                service = MediaUploadService()
                
                result = await service.get_user_media_library("test_user")
                
                assert len(result["media"]) == 1
                assert result["media"][0]["mediaId"] == "media_1"
                assert result["media"][0]["storageType"] == "cloud"
    
    @pytest.mark.asyncio
    async def test_verify_media_access_success(self, media_upload_service, temp_settings):
        """Test verifying media access"""
        # Create test media file
        media_id = "test_media_id"
        media_file = temp_settings.UPLOAD_DIR / "media" / f"{media_id}_test_video.mp4"
        media_file.parent.mkdir(exist_ok=True)
        with open(media_file, 'wb') as f:
            f.write(b"test video content")
        
        result = await media_upload_service.verify_media_access(media_id, "test_user")
        
        assert result["accessible"] is True
        assert result["deviceCompatible"] is True
        assert result["requiresAuth"] is True
        assert "streamingUrl" in result
    
    @pytest.mark.asyncio
    async def test_verify_media_access_not_found(self, media_upload_service):
        """Test verifying access to non-existent media"""
        result = await media_upload_service.verify_media_access("nonexistent_media_id", "test_user")
        
        assert result["accessible"] is False
        assert result["deviceCompatible"] is False
        assert "Media not found" in result["error"]
    
    def test_is_mime_type_compatible(self, media_upload_service):
        """Test MIME type compatibility check"""
        assert media_upload_service._is_mime_type_compatible("video/mp4") is True
        assert media_upload_service._is_mime_type_compatible("video/webm") is True
        assert media_upload_service._is_mime_type_compatible("video/quicktime") is True
        assert media_upload_service._is_mime_type_compatible("video/avi") is False
        assert media_upload_service._is_mime_type_compatible("text/plain") is False
    
    @pytest.mark.asyncio
    async def test_sync_media_state(self, media_upload_service):
        """Test syncing media state across devices"""
        # Mock get_user_media_library
        mock_library = {
            "media": [
                {"mediaId": "media_1", "streamingUrl": "url1", "uploadedAt": "2023-01-01T00:00:00Z", "filename": "video1.mp4", "fileSize": 1000, "duration": 30.0},
                {"mediaId": "media_2", "streamingUrl": "url2", "uploadedAt": "2023-01-01T01:00:00Z", "filename": "video2.mp4", "fileSize": 2000, "duration": 45.0},
                {"mediaId": "media_3", "streamingUrl": "url3", "uploadedAt": "2023-01-01T02:00:00Z", "filename": "video3.mp4", "fileSize": 1500, "duration": 25.0}
            ]
        }
        
        with patch.object(media_upload_service, 'get_user_media_library', return_value=mock_library):
            local_media_ids = ["media_1", "media_4"]  # media_1 exists, media_4 doesn't exist on server
            device_info = {"device_type": "mobile", "os": "iOS"}
            
            result = await media_upload_service.sync_media_state("test_user", local_media_ids, device_info)
            
            assert len(result["newMedia"]) == 2  # media_2 and media_3 are new
            assert len(result["deletedMedia"]) == 1  # media_4 was deleted
            assert result["deletedMedia"][0] == "media_4"
            assert len(result["syncedMedia"]) == 1  # media_1 is synced
            assert result["syncedMedia"][0]["mediaId"] == "media_1"

class TestMediaUploadServiceWithCDN:
    """Test MediaUploadService with CDN functionality"""
    
    @pytest.fixture
    def media_service_with_cdn(self, temp_settings, monkeypatch, mock_upload_service, mock_cloud_storage, mock_cdn_service):
        """Create media service with CDN enabled"""
        temp_settings.USE_CLOUD_STORAGE = True
        temp_settings.ENABLE_GLOBAL_CDN = True
        monkeypatch.setattr('config.settings', temp_settings)
        
        with patch('services.media_upload_service.ChunkedUploadService', return_value=mock_upload_service):
            with patch('services.media_upload_service.create_cloud_storage_service', return_value=mock_cloud_storage):
                with patch('services.media_upload_service.create_cdn_service', return_value=mock_cdn_service):
                    service = MediaUploadService()
                    return service
    
    @pytest.mark.asyncio
    async def test_get_cdn_signed_url_success(self, media_service_with_cdn, mock_cloud_storage, mock_cdn_service):
        """Test getting CDN signed URL"""
        mock_cloud_storage.file_exists = AsyncMock(return_value=True)
        mock_cdn_service.create_signed_url.return_value = "https://cdn.example.com/signed-url"
        mock_cdn_service.optimize_delivery_for_device.return_value = {"quality": "720p"}
        
        result = await media_service_with_cdn.get_cdn_signed_url(
            media_id="test_media_id",
            user_id="test_user",
            expires_in=3600,
            client_ip="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        assert result is not None
        assert result["signed_url"] == "https://cdn.example.com/signed-url"
        assert result["delivery_type"] == "cdn_signed"
        assert result["global_delivery"] is True
    
    @pytest.mark.asyncio
    async def test_get_cdn_signed_url_file_not_found(self, media_service_with_cdn, mock_cloud_storage):
        """Test getting CDN signed URL when file doesn't exist"""
        mock_cloud_storage.file_exists = AsyncMock(return_value=False)
        
        result = await media_service_with_cdn.get_cdn_signed_url(
            media_id="nonexistent_media_id",
            user_id="test_user"
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_optimized_streaming_url_with_cdn(self, media_service_with_cdn, mock_cloud_storage, mock_cdn_service):
        """Test getting optimized streaming URL with CDN"""
        mock_cloud_storage.file_exists = AsyncMock(return_value=True)
        mock_cdn_service.create_signed_url.return_value = "https://cdn.example.com/signed-url"
        mock_cdn_service.optimize_delivery_for_device.return_value = {"quality": "1080p"}
        
        result = await media_service_with_cdn.get_optimized_streaming_url(
            media_id="test_media_id",
            user_id="test_user",
            client_ip="192.168.1.1",
            user_agent="Mozilla/5.0",
            device_type="desktop",
            prefer_signed=True
        )
        
        assert result["delivery_type"] == "cdn_signed"
        assert result["signed_url"] == "https://cdn.example.com/signed-url"
        assert result["optimization"]["quality"] == "1080p"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])