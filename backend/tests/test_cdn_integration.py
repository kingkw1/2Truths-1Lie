"""
CDN Integration Tests - Test CDN and signed URL functionality
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from services.cdn_service import CDNService, create_cdn_service
from services.media_upload_service import MediaUploadService
from config import settings

class TestCDNService:
    """Test CDN service functionality"""
    
    def setup_method(self):
        """Setup test environment"""
        self.cdn_service = CDNService(
            cdn_base_url="https://d123456789.cloudfront.net",
            distribution_id="E123456789ABCD",
            key_pair_id="KEYPAIRID123",
            cache_control="public, max-age=86400"
        )
    
    def test_cdn_url_generation(self):
        """Test CDN URL generation from S3 keys"""
        s3_key = "media/user123/video456/video.mp4"
        cdn_url = self.cdn_service.get_cdn_url(s3_key)
        
        expected_url = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4"
        assert cdn_url == expected_url
    
    def test_cdn_url_with_bucket_name(self):
        """Test CDN URL generation with bucket name removal"""
        s3_key = "mybucket/media/user123/video456/video.mp4"
        cdn_url = self.cdn_service.get_cdn_url(s3_key, bucket_name="mybucket")
        
        expected_url = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4"
        assert cdn_url == expected_url
    
    def test_edge_location_mapping(self):
        """Test edge location mapping for different regions"""
        assert self.cdn_service.get_edge_location_for_region("us-east-1") == "IAD"
        assert self.cdn_service.get_edge_location_for_region("eu-west-1") == "DUB"
        assert self.cdn_service.get_edge_location_for_region("ap-southeast-1") == "SIN"
        assert self.cdn_service.get_edge_location_for_region("unknown-region") == "IAD"
    
    def test_device_optimization(self):
        """Test device-specific optimization"""
        s3_key = "media/user123/video456/video.mp4"
        
        # Mobile optimization
        mobile_opt = self.cdn_service.optimize_delivery_for_device(
            s3_key=s3_key,
            device_type="mobile",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
        )
        
        assert "mobile_cache_optimization" in mobile_opt["optimizations"]
        assert "mobile_user_agent_detected" in mobile_opt["optimizations"]
        assert mobile_opt["cache_control"] == "public, max-age=43200"
        
        # Desktop optimization
        desktop_opt = self.cdn_service.optimize_delivery_for_device(
            s3_key=s3_key,
            device_type="desktop",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        
        assert "desktop_cache_optimization" in desktop_opt["optimizations"]
        assert desktop_opt["cache_control"] == "public, max-age=86400"

class TestCDNIntegration:
    """Test CDN integration with media upload service"""
    
    def setup_method(self):
        """Setup test environment"""
        self.media_service = MediaUploadService()
        
        # Mock CDN service
        self.mock_cdn = Mock(spec=CDNService)
        self.mock_cdn.is_enabled.return_value = True
        self.mock_cdn.get_cdn_url.return_value = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4"
        self.mock_cdn.create_signed_url.return_value = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=..."
        
        self.media_service.use_cdn = True
        self.media_service.cdn_service = self.mock_cdn
    
    @pytest.mark.asyncio
    async def test_cdn_signed_url_generation(self):
        """Test CDN signed URL generation"""
        # Mock cloud storage
        self.media_service.use_cloud_storage = True
        self.media_service.cloud_storage = Mock()
        self.media_service.cloud_storage.file_exists = AsyncMock(return_value=True)
        
        result = await self.media_service.get_cdn_signed_url(
            media_id="video456",
            user_id="user123",
            expires_in=3600,
            client_ip="192.168.1.1"
        )
        
        assert result is not None
        assert result["delivery_type"] == "cdn_signed"
        assert result["global_delivery"] is True
        assert "signed_url" in result
        assert "optimization" in result
        
        # Verify CDN service was called
        self.mock_cdn.create_signed_url.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_optimized_streaming_url(self):
        """Test optimized streaming URL selection"""
        # Mock cloud storage
        self.media_service.use_cloud_storage = True
        self.media_service.cloud_storage = Mock()
        self.media_service.cloud_storage.file_exists = AsyncMock(return_value=True)
        
        result = await self.media_service.get_optimized_streaming_url(
            media_id="video456",
            user_id="user123",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
            device_type="mobile"
        )
        
        assert result["delivery_type"] == "cdn_signed"
        assert result["global_delivery"] is True
        
        # Verify optimization was called
        self.mock_cdn.optimize_delivery_for_device.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self):
        """Test CDN cache invalidation"""
        self.mock_cdn.invalidate_cache = AsyncMock(return_value=True)
        
        success = await self.media_service.invalidate_media_cache(
            media_id="video456",
            user_id="user123"
        )
        
        assert success is True
        self.mock_cdn.invalidate_cache.assert_called_once()
        
        # Check that correct paths were passed
        call_args = self.mock_cdn.invalidate_cache.call_args[0][0]
        assert "media/user123/video456/*" in call_args
        assert "media/user123/video456/video.mp4" in call_args

@pytest.mark.asyncio
async def test_cdn_factory_function():
    """Test CDN service factory function"""
    # Test with minimal configuration
    cdn_service = create_cdn_service(
        cdn_base_url="https://d123456789.cloudfront.net"
    )
    
    if cdn_service:  # Only if crypto dependencies are available
        assert cdn_service.cdn_base_url == "https://d123456789.cloudfront.net"
        assert cdn_service.is_enabled() is True
    
    # Test with no configuration
    cdn_service_none = create_cdn_service()
    assert cdn_service_none is None

@pytest.mark.asyncio
async def test_cdn_health_check():
    """Test CDN health check functionality"""
    from api.media_endpoints import check_cdn_health
    
    # Mock settings
    with patch('api.media_endpoints.settings') as mock_settings:
        mock_settings.CDN_BASE_URL = "https://d123456789.cloudfront.net"
        mock_settings.ENABLE_GLOBAL_CDN = True
        mock_settings.CDN_DISTRIBUTION_ID = "E123456789ABCD"
        mock_settings.CDN_PRIVATE_KEY_PATH = "/path/to/key.pem"
        mock_settings.CDN_KEY_PAIR_ID = "KEYPAIRID123"
        mock_settings.USE_CLOUD_STORAGE = True
        
        health = await check_cdn_health()
        
        assert health["cdn_configured"] is True
        assert health["cdn_enabled"] is True
        assert health["distribution_id"] is True
        assert health["cloud_storage_enabled"] is True
        assert "timestamp" in health

if __name__ == "__main__":
    pytest.main([__file__])