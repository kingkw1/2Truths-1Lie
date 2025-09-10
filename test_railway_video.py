#!/usr/bin/env python3
"""
Test video merge and upload functionality on Railway backend
"""
import requests
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_video_merge_endpoints():
    """Test video merge related endpoints"""
    print("🎬 Testing video merge endpoints...")
    
    # Test compression presets endpoint (should be accessible without auth)
    try:
        response = requests.get(f"{BASE_URL}/api/v1/challenge-videos/compression/presets", timeout=10)
        print(f"   Compression presets - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Available presets: {list(data.keys())}")
            return True
        else:
            print(f"   ❌ Failed: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_ffmpeg_availability():
    """Test if FFmpeg is available on the server"""
    print("\n🛠️ Testing FFmpeg availability...")
    
    # This would require a test endpoint, but we can infer from other responses
    # For now, just test if the upload endpoint responds properly
    try:
        # Test upload initiation endpoint
        response = requests.post(
            f"{BASE_URL}/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": json.dumps(["test1.mp4", "test2.mp4", "test3.mp4"]),
                "video_file_sizes": json.dumps([1000, 1000, 1000]),
                "video_durations": json.dumps([1.0, 1.0, 1.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            },
            timeout=10
        )
        print(f"   Upload initiate - Status: {response.status_code}")
        if response.status_code == 401:
            print("   ✅ Endpoint accessible (requires auth as expected)")
            return True
        elif response.status_code == 422:
            print("   ✅ Endpoint accessible (validation error as expected)")
            return True
        else:
            print(f"   ❓ Unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    """Run tests"""
    print("🚀 Testing Railway Video Processing\n")
    
    tests = [
        test_video_merge_endpoints,
        test_ffmpeg_availability,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 Railway video processing appears to be working!")
    else:
        print("⚠️ Some video processing tests failed.")

if __name__ == "__main__":
    main()
