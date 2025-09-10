#!/usr/bin/env python3
"""
Example client for testing S3 Media API endpoints
"""
import requests
import json
import os
from pathlib import Path

# API Configuration
BASE_URL = "http://127.0.0.1:8001"
S3_MEDIA_PREFIX = "/api/v1/s3-media"

def test_health_endpoint():
    """Test S3 health check endpoint"""
    print("🏥 Testing S3 Health Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}{S3_MEDIA_PREFIX}/health/s3")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ S3 Health: {data['status']}")
            print(f"   📦 Bucket: {data['bucket']}")
            print(f"   🌍 Region: {data['region']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return False

def create_dummy_video_file():
    """Create a small dummy video file for testing"""
    dummy_content = b"DUMMY_VIDEO_CONTENT_FOR_TESTING_PURPOSES_" * 100
    
    test_file = Path("/tmp/test_video.mp4")
    with open(test_file, "wb") as f:
        f.write(dummy_content)
    
    return test_file

def test_upload_endpoint():
    """Test video upload to S3"""
    print("\n📤 Testing S3 Upload Endpoint...")
    
    # Create dummy video file
    test_file = create_dummy_video_file()
    
    try:
        # For testing without authentication, we would need a token
        # This will fail with 401/403 due to authentication requirement
        with open(test_file, "rb") as f:
            files = {
                "file": ("test_video.mp4", f, "video/mp4")
            }
            
            response = requests.post(
                f"{BASE_URL}{S3_MEDIA_PREFIX}/upload",
                files=files
            )
        
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Upload successful!")
            print(f"   📱 Media ID: {data['media_id']}")
            print(f"   🔗 Storage URL: {data['storage_url']}")
            return data['media_id']
        else:
            print(f"⚠️  Upload failed: {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Upload error: {e}")
        return None
    finally:
        # Clean up test file
        if test_file.exists():
            test_file.unlink()

def test_streaming_endpoint(media_id):
    """Test signed URL generation for streaming"""
    if not media_id:
        print("\n⚠️  Skipping streaming test (no media_id)")
        return False
        
    print(f"\n🎬 Testing S3 Streaming Endpoint for media: {media_id}")
    
    try:
        response = requests.get(f"{BASE_URL}{S3_MEDIA_PREFIX}/{media_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Signed URL generated!")
            print(f"   🔗 URL: {data['signed_url'][:50]}...")
            print(f"   ⏰ Expires in: {data['expires_in']} seconds")
            return True
        else:
            print(f"⚠️  Streaming URL failed: {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Streaming error: {e}")
        return False

def test_delete_endpoint(media_id):
    """Test video deletion from S3"""
    if not media_id:
        print("\n⚠️  Skipping delete test (no media_id)")
        return False
        
    print(f"\n🗑️  Testing S3 Delete Endpoint for media: {media_id}")
    
    try:
        response = requests.delete(f"{BASE_URL}{S3_MEDIA_PREFIX}/{media_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Video deleted successfully!")
            print(f"   📱 Media ID: {data['media_id']}")
            return True
        else:
            print(f"⚠️  Delete failed: {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Delete error: {e}")
        return False

def main():
    """Run all endpoint tests"""
    print("🚀 S3 Media API Client Tests\n")
    
    # Test 1: Health Check
    health_ok = test_health_endpoint()
    
    if not health_ok:
        print("❌ S3 service is not healthy. Cannot proceed with upload/streaming tests.")
        return
    
    # Test 2: Upload (will fail without auth, but shows endpoint structure)
    media_id = test_upload_endpoint()
    
    # Test 3: Streaming (will fail without valid media_id and auth)
    test_streaming_endpoint(media_id)
    
    # Test 4: Delete (will fail without valid media_id and auth)
    test_delete_endpoint(media_id)
    
    print("\n📝 Note: Upload, streaming, and delete endpoints require authentication.")
    print("   These tests show the API structure. To test with authentication:")
    print("   1. Implement proper JWT token authentication")
    print("   2. Include Authorization header: 'Bearer <token>'")
    print("   3. Ensure user has required permissions")

if __name__ == "__main__":
    main()
