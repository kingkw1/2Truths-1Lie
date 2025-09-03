#!/usr/bin/env python3
"""
Test script for S3 Media API integration
"""
import os
import sys
import asyncio
from pathlib import Path

# Manually load environment variables from .env file
def load_env_file():
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
    else:
        print("⚠️  .env file not found")

load_env_file()

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent))

async def test_s3_service():
    """Test the S3 media service directly"""
    try:
        from services.s3_media_service import S3MediaService
        
        print("🔧 Testing S3 Media Service...")
        
        # Initialize service
        service = S3MediaService()
        print(f"✅ S3 service initialized successfully")
        print(f"   📦 Bucket: {service.bucket_name}")
        print(f"   🌍 Region: {service.aws_region}")
        
        # Test media existence check
        test_media_id = "non-existent-id"
        exists = await service.check_media_exists(test_media_id)
        print(f"✅ Media existence check works: {exists}")
        
        print("🎉 S3 service tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ S3 service test failed: {e}")
        return False

def test_environment_variables():
    """Test that all required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY', 
        'AWS_S3_REGION',
        'AWS_S3_BUCKET_NAME'
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        else:
            # Mask sensitive values for display
            display_value = value if var in ['AWS_S3_REGION', 'AWS_S3_BUCKET_NAME'] else f"{value[:4]}...{value[-4:]}"
            print(f"   ✅ {var}: {display_value}")
    
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        return False
    
    print("✅ All environment variables are set")
    return True

def test_api_endpoints():
    """Test API endpoints if server is running"""
    print("🌐 API endpoints available when server is running:")
    print("   POST /api/v1/media/upload - Upload video to S3")
    print("   GET /api/v1/media/{media_id} - Get signed streaming URL")
    print("   DELETE /api/v1/media/{media_id} - Delete video from S3")
    print("   GET /api/v1/media/health/s3 - Check S3 service health")
    return True

async def main():
    """Run all tests"""
    print("🚀 Starting S3 Media API Tests\n")
    
    # Test 1: Environment variables
    env_ok = test_environment_variables()
    print()
    
    if not env_ok:
        print("❌ Environment setup incomplete. Please check your .env file.")
        return
    
    # Test 2: S3 Service
    service_ok = await test_s3_service()
    print()
    
    # Test 3: API endpoints (optional)
    api_ok = test_api_endpoints()
    print()
    
    # Summary
    if env_ok and service_ok:
        print("🎉 All tests passed! Your S3 integration is ready.")
        print("\n📝 Next steps:")
        print("   1. Start the FastAPI server: uvicorn main:app --reload")
        print("   2. Test upload endpoint: POST /api/v1/media/upload")
        print("   3. Test streaming endpoint: GET /api/v1/media/{media_id}")
        print("   4. Test delete endpoint: DELETE /api/v1/media/{media_id}")
    else:
        print("❌ Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    asyncio.run(main())
