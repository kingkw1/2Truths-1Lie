#!/usr/bin/env python3
"""
Test script to verify Railway backend is working with updated configuration
"""
import requests
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_health():
    """Test basic health endpoint"""
    print("🏥 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_docs():
    """Test documentation endpoint"""
    print("\n📚 Testing docs endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=10)
        if response.status_code == 200:
            print("✅ Swagger docs accessible")
            return True
        else:
            print(f"❌ Swagger docs failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Swagger docs error: {e}")
        return False

def test_challenges_public():
    """Test public challenges endpoint"""
    print("\n🎯 Testing public challenges endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/challenges/public", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Public challenges: Found {len(data.get('challenges', []))} challenges")
            
            # Check if challenges have proper URLs
            for challenge in data.get('challenges', [])[:3]:  # Check first 3
                challenge_id = challenge.get('challenge_id') or challenge.get('id')
                statements = challenge.get('statements', [])
                print(f"  Challenge {challenge_id}: {len(statements)} statements")
                
                for i, stmt in enumerate(statements):
                    media_url = stmt.get('media_url', '')
                    media_file_id = stmt.get('media_file_id', '')
                    
                    if media_url.startswith('file://'):
                        print(f"    ⚠️ Statement {i}: Has local file URL: {media_url[:50]}...")
                    elif media_url.startswith('https://'):
                        print(f"    ✅ Statement {i}: Has proper S3 URL")
                    else:
                        print(f"    ❓ Statement {i}: Unknown URL format: {media_url[:50]}...")
            
            return True
        else:
            print(f"❌ Public challenges failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Public challenges error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Railway Backend Configuration\n")
    
    tests = [
        test_health,
        test_docs, 
        test_challenges_public,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Railway backend is working correctly.")
    else:
        print("⚠️ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()
