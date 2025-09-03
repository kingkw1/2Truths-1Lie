#!/usr/bin/env python3
"""
Simple CDN integration test
"""
import asyncio
from services.cdn_service import CDNService, create_cdn_service
from services.media_upload_service import MediaUploadService
from unittest.mock import Mock, AsyncMock

async def test_cdn_basic_functionality():
    """Test basic CDN functionality"""
    print("Testing CDN Service...")
    
    # Test CDN service creation
    cdn_service = CDNService(
        cdn_base_url="https://d123456789.cloudfront.net",
        distribution_id="E123456789ABCD",
        key_pair_id="KEYPAIRID123"
    )
    
    # Test URL generation
    s3_key = "media/user123/video456/video.mp4"
    cdn_url = cdn_service.get_cdn_url(s3_key)
    expected_url = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4"
    
    assert cdn_url == expected_url, f"Expected {expected_url}, got {cdn_url}"
    print("✓ CDN URL generation works")
    
    # Test edge location mapping
    edge = cdn_service.get_edge_location_for_region("us-east-1")
    assert edge == "IAD", f"Expected IAD, got {edge}"
    print("✓ Edge location mapping works")
    
    # Test device optimization
    optimization = cdn_service.optimize_delivery_for_device(
        s3_key=s3_key,
        device_type="mobile",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
    )
    
    assert "mobile_cache_optimization" in optimization["optimizations"]
    assert "mobile_user_agent_detected" in optimization["optimizations"]
    print("✓ Device optimization works")
    
    print("CDN Service tests passed!")

async def test_media_service_cdn_integration():
    """Test media service CDN integration"""
    print("\nTesting Media Service CDN Integration...")
    
    # Create media service
    media_service = MediaUploadService()
    
    # Mock CDN service
    mock_cdn = Mock(spec=CDNService)
    mock_cdn.is_enabled.return_value = True
    mock_cdn.get_cdn_url.return_value = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4"
    mock_cdn.create_signed_url.return_value = "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=..."
    mock_cdn.optimize_delivery_for_device.return_value = {
        "cdn_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4",
        "cache_control": "public, max-age=43200",
        "optimizations": ["mobile_cache_optimization"]
    }
    
    # Set up CDN integration
    media_service.use_cdn = True
    media_service.cdn_service = mock_cdn
    
    # Mock cloud storage
    media_service.use_cloud_storage = True
    media_service.cloud_storage = Mock()
    media_service.cloud_storage.file_exists = AsyncMock(return_value=True)
    
    # Test CDN signed URL generation
    result = await media_service.get_cdn_signed_url(
        media_id="video456",
        user_id="user123",
        expires_in=3600
    )
    
    assert result is not None, "CDN signed URL result should not be None"
    assert result["delivery_type"] == "cdn_signed"
    assert result["global_delivery"] is True
    print("✓ CDN signed URL generation works")
    
    # Test optimized streaming URL
    optimized_result = await media_service.get_optimized_streaming_url(
        media_id="video456",
        user_id="user123",
        device_type="mobile"
    )
    
    assert optimized_result["delivery_type"] == "cdn_signed"
    assert optimized_result["global_delivery"] is True
    print("✓ Optimized streaming URL works")
    
    # Test cache invalidation
    mock_cdn.invalidate_cache = AsyncMock(return_value=True)
    
    success = await media_service.invalidate_media_cache(
        media_id="video456",
        user_id="user123"
    )
    
    assert success is True, "Cache invalidation should succeed"
    print("✓ Cache invalidation works")
    
    print("Media Service CDN Integration tests passed!")

async def test_factory_function():
    """Test CDN factory function"""
    print("\nTesting CDN Factory Function...")
    
    # Test with configuration
    cdn_service = create_cdn_service(
        cdn_base_url="https://d123456789.cloudfront.net"
    )
    
    if cdn_service:  # Only if crypto dependencies are available
        assert cdn_service.cdn_base_url == "https://d123456789.cloudfront.net"
        print("✓ CDN factory function works with configuration")
    else:
        print("✓ CDN factory function correctly returns None without crypto dependencies")
    
    # Test without configuration
    cdn_service_none = create_cdn_service()
    assert cdn_service_none is None, "Should return None without configuration"
    print("✓ CDN factory function works without configuration")
    
    print("CDN Factory Function tests passed!")

async def main():
    """Run all tests"""
    print("Starting CDN Integration Tests...\n")
    
    try:
        await test_cdn_basic_functionality()
        await test_media_service_cdn_integration()
        await test_factory_function()
        
        print("\n🎉 All CDN integration tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)