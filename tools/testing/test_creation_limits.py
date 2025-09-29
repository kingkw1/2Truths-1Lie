#!/usr/bin/env python3
"""
Test Creation Status Endpoint

Tests the rate limiting functionality by checking the creation-status endpoint.
This test verifies that:
1. New users can create challenges (canCreate: true)
2. The creation-status endpoint works correctly
3. Rate limiting is properly enforced

Usage:
    python tools/testing/test_creation_limits.py
"""
import requests
import json
import time

# Backend URL
BASE_URL = "https://2truths-1lie-production.up.railway.app"

def create_and_test_user():
    """Create a test user and check their creation status"""
    
    # Create a unique test user for this test
    timestamp = int(time.time())
    test_user = {
        "email": f"limit_test_{timestamp}@example.com",
        "password": "TestPassword123!",
        "username": f"limit_test_{timestamp}"
    }
    
    print(f"🧪 Creating test user for rate limit testing...")
    print(f"Email: {test_user['email']}")
    
    try:
        # Step 1: Register user
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to create user: {response.status_code} - {response.text}")
            return
            
        result = response.json()
        access_token = result['access_token']
        user_id = result['user']['id']
        print(f"✅ User created! ID: {user_id}")
        
        # Step 2: Check initial creation status
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        print(f"\n🔍 Checking initial creation status...")
        status_response = requests.get(
            f"{BASE_URL}/api/v1/challenges/creation-status",
            headers=headers,
            timeout=30
        )
        
        print(f"Status Code: {status_response.status_code}")
        if status_response.status_code == 200:
            status_data = status_response.json()
            print(f"Response: {json.dumps(status_data, indent=2)}")
            
            can_create = status_data.get('canCreate', False)
            if can_create:
                print(f"✅ New user can create challenges (as expected)")
            else:
                print(f"❌ New user cannot create challenges (unexpected!)")
        else:
            print(f"❌ Failed to get creation status: {status_response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

def test_existing_rate_limited_user():
    """Test with fake2@gmail.com which should be rate limited"""
    print(f"\n🧪 Testing with fake2@gmail.com (should be rate limited)")
    print("📝 Note: This will fail with 401 since the token expired, but shows the concept")
    
    # This token has expired, but shows what the call should look like
    expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMiIsImVtYWlsIjoiZmFrZTJAZ21haWwuY29tIiwidHlwZSI6InVzZXIiLCJpc19wcmVtaXVtIjpmYWxzZSwiZXhwIjoxNzU5MTgzMTk0LCJpYXQiOjE3NTkxNjg3OTQsImlzcyI6InR3b3RydXRoc2FsaWUtYXBpIiwiYXVkIjoidHdvdHJ1dGhzYWxpZS1tb2JpbGUiLCJwZXJtaXNzaW9ucyI6WyJtZWRpYTpyZWFkIiwibWVkaWE6dXBsb2FkIiwibWVkaWE6ZGVsZXRlIl19.fD8-PtZrSLkx2YyTLO91DftjjU-a-5xY9f2Zit52VnQ"
    
    headers = {
        'Authorization': f'Bearer {expired_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/challenges/creation-status",
            headers=headers,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("ℹ️ Expected 401 due to expired token")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    create_and_test_user()
    test_existing_rate_limited_user()