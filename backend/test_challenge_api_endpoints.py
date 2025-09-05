#!/usr/bin/env python3
"""
Test script to verify challenge API endpoints are working correctly
"""
import asyncio
import sys
import os
sys.path.append('.')

import httpx
from services.auth_service import create_test_token

def test_challenge_endpoints():
    """Test the challenge API endpoints"""
    # We'll test against a running server
    base_url = "http://localhost:8000"
    
    # Create a test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    print("Testing Challenge API Endpoints")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Testing health check...")
    response = client.get("/health")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Response: {response.json()}")
    else:
        print(f"   Error: {response.text}")
    
    # Test 2: List challenges (GET /api/v1/challenges)
    print("\n2. Testing challenge listing...")
    response = client.get("/api/v1/challenges", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Found {len(data.get('challenges', []))} challenges")
        print(f"   Total count: {data.get('total_count', 0)}")
        if data.get('challenges'):
            first_challenge = data['challenges'][0]
            print(f"   First challenge ID: {first_challenge.get('challenge_id')}")
            print(f"   First challenge status: {first_challenge.get('status')}")
            return first_challenge.get('challenge_id')
    else:
        print(f"   Error: {response.text}")
        return None
    
    return None

def test_challenge_detail(challenge_id):
    """Test getting a specific challenge"""
    if not challenge_id:
        print("\n3. Skipping challenge detail test (no challenge ID)")
        return
    
    client = TestClient(app)
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    print(f"\n3. Testing challenge detail for ID: {challenge_id}")
    response = client.get(f"/api/v1/challenges/{challenge_id}", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Challenge ID: {data.get('challenge_id')}")
        print(f"   Status: {data.get('status')}")
        print(f"   Creator ID: {data.get('creator_id')}")
        print(f"   Statements count: {len(data.get('statements', []))}")
        print(f"   View count: {data.get('view_count', 0)}")
    else:
        print(f"   Error: {response.text}")

def test_challenge_endpoints_without_auth():
    """Test endpoints that should work without authentication"""
    client = TestClient(app)
    
    print("\n4. Testing endpoints without authentication...")
    
    # Test listing challenges without auth (should still work for public challenges)
    response = client.get("/api/v1/challenges")
    print(f"   List challenges without auth - Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Found {len(data.get('challenges', []))} public challenges")
    
    # Test getting specific challenge without auth
    response = client.get("/api/v1/challenges/integration-test-challenge")
    print(f"   Get specific challenge without auth - Status: {response.status_code}")

def test_error_cases():
    """Test error cases"""
    client = TestClient(app)
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    print("\n5. Testing error cases...")
    
    # Test getting non-existent challenge
    response = client.get("/api/v1/challenges/non-existent-id", headers=headers)
    print(f"   Non-existent challenge - Status: {response.status_code}")
    if response.status_code == 404:
        print("   ✓ Correctly returns 404 for non-existent challenge")
    else:
        print(f"   ✗ Expected 404, got {response.status_code}")

def main():
    """Run all tests"""
    try:
        # Test basic endpoints
        challenge_id = test_challenge_endpoints()
        
        # Test challenge detail if we have an ID
        test_challenge_detail(challenge_id)
        
        # Test without authentication
        test_challenge_endpoints_without_auth()
        
        # Test error cases
        test_error_cases()
        
        print("\n" + "=" * 50)
        print("Challenge API endpoint tests completed!")
        
    except Exception as e:
        print(f"Error running tests: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()