"""
Tests for cloud storage integration
"""
import pytest
import asyncio
import os
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

from services.cloud_storage_service import S3CloudStorageService, CloudStorageError, create_cloud_storage_service
from services.media_upload_service import MediaUploadService
from config import settings

class TestS3CloudStorageService:
    """Test S3 cloud storage service"""
    
    @pytest.fixture
    def mock_s3_client(self):
        """Mock S3 client"""
        client = Mock()
        client.head_bucket = Mock()
        client.create_bucket = Mock()
        client.put_bucket_cors = Mock()
        client.put_object = Mock()
        client.generate_presigned_url = Mock(return_value="https://signed-url.com")
        client.delete_object = Mock()
        client.head_object = Mock()
        return client
    
    @pytest.fixture
    def s3_service(self, mock_s3_client):
        """Create S3 service with mocked client"""
        with patch('boto3.Session') as mock_session:
            mock_session.return_value.client.return_value = mock_s3_client
            service = S3CloudStorageService(
                bucket_name="test-bucket",
                region_name="us-east-1"
            )
            service.s3_client = mock_s3_client
            return service
    
    @pytest.mark.asyncio
    async def test_upload_file(self, s3_service, mock_s3_client):
        """Test file upload to S3"""
        # Setup
        file_data = b"test video content"
        key = "test/video.mp4"
        content_type = "video/mp4"
        
        # Execute
        url = await s3_service.upload_file(file_data, key, content_type)
        
        # Verify
        assert url == "https://test-bucket.s3.us-east-1.amazonaws.com/test/video.mp4"
        mock_s3_client.put_object.assert_called_once()
        call_args = mock_s3_client.put_object.call_args[0][0]
        assert call_args['Bucket'] == 'test-bucket'
        assert call_args['Key'] == key
        assert call_args['Body'] == file_data
        assert call_args['ContentType'] == content_type
    
    @pytest.mark.asyncio
    async def test_get_file_url(self, s3_service, mock_s3_client):
        """Test signed URL generation"""
        # Execute
        url = await s3_service.get_file_url("test/video.mp4", expires_in=3600)
        
        # Verify
        assert url == "https://signed-url.com"
        mock_s3_client.generate_presigned_url.assert_called_once_with(
            'get_object',
            {'Bucket': 'test-bucket', 'Key': 'test/video.mp4'},
            3600
        )
    
    @pytest.mark.asyncio
    async def test_delete_file(self, s3_service, mock_s3_client):
        """Test file deletion"""
        # Execute
        result = await s3_service.delete_file("test/video.mp4")
        
        # Verify
        assert result is True
        mock_s3_client.delete_object.assert_called_once_with({
            'Bucket': 'test-bucket',
            'Key': 'test/video.mp4'
        })
    
    @pytest.mark.asyncio
    async def test_file_exists_true(self, s3_service, mock_s3_client):
        """Test file existence check - file exists"""
        # Setup
        mock_s3_client.head_object.return_value = {"ContentLength": 1024}
        
        # Execute
        exists = await s3_service.file_exists("test/video.mp4")
        
        # Verify
        assert exists is True
        mock_s3_client.head_object.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_file_exists_false(self, s3_service, mock_s3_client):
        """Test file existence check - file doesn't exist"""
        # Setup
        from botocore.exceptions import ClientError
        mock_s3_client.head_object.side_effect = ClientError(
            {'Error': {'Code': '404'}}, 'HeadObject'
        )
        
        # Execute
        exists = await s3_service.file_exists("test/video.mp4")
        
        # Verify
        assert exists is False
    
    @pytest.mark.asyncio
    async def test_get_file_metadata(self, s3_service, mock_s3_client):
        """Test getting file metadata"""
        # Setup
        mock_response = {
            'ContentType': 'video/mp4',
            'ContentLength': 1024,
            'LastModified': '2023-01-01T00:00:00Z',
            'ETag': '"abc123"',
            'Metadata': {'user_id': 'test-user'},
            'CacheControl': 'public, max-age=31536000'
        }
        mock_s3_client.head_object.return_value = mock_response
        
        # Execute
        metadata = await s3_service.get_file_metadata("test/video.mp4")
        
        # Verify
        assert metadata is not None
        assert metadata['content_type'] == 'video/mp4'
        assert metadata['content_length'] == 1024
        assert metadata['metadata']['user_id'] == 'test-user'

class TestCloudStorageFactory:
    """Test cloud storage factory function"""
    
    def test_create_s3_service(self):
        """Test creating S3 service"""
        with patch('services.cloud_storage_service.S3CloudStorageService') as mock_s3:
            service = create_cloud_storage_service(
                provider="s3",
                bucket_name="test-bucket"
            )
            mock_s3.assert_called_once_with(bucket_name="test-bucket")
    
    def test_unsupported_provider(self):
        """Test unsupported provider raises error"""
        with pytest.raises(ValueError, match="Unsupported cloud storage provider"):
            create_cloud_storage_service(provider="unsupported")

class TestMediaUploadServiceCloudIntegration:
    """Test media upload service with cloud storage"""
    
    @pytest.fixture
    def mock_cloud_storage(self):
        """Mock cloud storage service"""
        storage = AsyncMock()
        storage.upload_file_stream = AsyncMock(return_value="https://cloud-url.com/video.mp4")
        storage.get_file_url = AsyncMock(return_value="https://signed-url.com")
        storage.file_exists = AsyncMock(return_value=True)
        storage.delete_file = AsyncMock(return_value=True)
        storage.get_file_metadata = AsyncMock(return_value={
            'content_type': 'video/mp4',
            'content_length': 1024,
            'metadata': {'user_id': 'test-user'}
        })
        return storage
    
    @pytest.fixture
    def media_service_with_cloud(self, mock_cloud_storage):
        """Create media service with mocked cloud storage"""
        with patch('services.media_upload_service.create_cloud_storage_service') as mock_factory:
            mock_factory.return_value = mock_cloud_storage
            
            # Mock settings to enable cloud storage
            with patch.object(settings, 'USE_CLOUD_STORAGE', True):
                service = MediaUploadService()
                service.cloud_storage = mock_cloud_storage
                service.use_cloud_storage = True
                return service
    
    @pytest.mark.asyncio
    async def test_complete_upload_with_cloud_storage(self, media_service_with_cloud, mock_cloud_storage):
        """Test completing upload with cloud storage"""
        # Setup
        with patch.object(media_service_with_cloud.upload_service, 'get_upload_status') as mock_get_status:
            with patch.object(media_service_with_cloud.upload_service, 'complete_upload') as mock_complete:
                # Mock upload session
                mock_session = Mock()
                mock_session.user_id = "test-user"
                mock_session.filename = "video.mp4"
                mock_session.mime_type = "video/mp4"
                mock_session.file_size = 1024
                mock_session.metadata = {"duration_seconds": 30}
                mock_get_status.return_value = mock_session
                
                # Mock completed file path
                mock_file_path = Mock()
                mock_file_path.unlink = Mock()
                mock_complete.return_value = mock_file_path
                
                # Mock file operations
                with patch('builtins.open', create=True) as mock_open:
                    mock_file = Mock()
                    mock_open.return_value.__enter__.return_value = mock_file
                    
                    # Execute
                    result = await media_service_with_cloud.complete_video_upload(
                        session_id="test-session",
                        user_id="test-user"
                    )
        
        # Verify
        assert result["storage_type"] == "cloud"
        assert result["streaming_url"] == "https://cloud-url.com/video.mp4"
        assert "cloud_key" in result
        mock_cloud_storage.upload_file_stream.assert_called_once()
        mock_file_path.unlink.assert_called_once()  # Local file cleaned up
    
    @pytest.mark.asyncio
    async def test_stream_media_cloud_redirect(self, media_service_with_cloud, mock_cloud_storage):
        """Test streaming media with cloud storage redirect"""
        # Execute
        result = await media_service_with_cloud.stream_media("test-media", "test-user")
        
        # Verify
        assert result["streaming_type"] == "redirect"
        assert result["signed_url"] == "https://signed-url.com"
        assert result["storage_type"] == "cloud"
        mock_cloud_storage.file_exists.assert_called()
        mock_cloud_storage.get_file_url.assert_called()
    
    @pytest.mark.asyncio
    async def test_delete_media_cloud_storage(self, media_service_with_cloud, mock_cloud_storage):
        """Test deleting media from cloud storage"""
        # Execute
        result = await media_service_with_cloud.delete_media("test-media", "test-user")
        
        # Verify
        assert result is True
        mock_cloud_storage.file_exists.assert_called()
        mock_cloud_storage.delete_file.assert_called()

if __name__ == "__main__":
    pytest.main([__file__])