#!/usr/bin/env python3
"""
Test the actual /me endpoint vs /validate endpoint behavior
"""

import requests
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_endpoint_behavior():
    """Test different auth endpoints"""
    print("🧪 Testing Auth Endpoints")
    print("=" * 30)
    
    # Step 1: Create guest session
    print("1️⃣ Creating guest session...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/guest",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            auth_data = response.json()
            access_token = auth_data["access_token"]
            print(f"✅ Guest session created")
        else:
            print(f"❌ Guest session failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Guest session error: {e}")
        return
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Test all auth endpoints
    endpoints = [
        "/api/v1/auth/validate",
        "/api/v1/auth/me", 
        "/api/v1/auth/permissions"
    ]
    
    for endpoint in endpoints:
        print(f"\n2️⃣ Testing {endpoint}...")
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}{'...' if len(response.text) > 200 else ''}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'score' in data:
                        print(f"   ⭐ SCORE FIELD FOUND: {data['score']}")
                except:
                    pass
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test challenge endpoints with more detail
    print(f"\n3️⃣ Testing challenge endpoints...")
    challenge_endpoints = [
        "/api/v1/challenges",
        "/api/v1/challenges?limit=1"
    ]
    
    for endpoint in challenge_endpoints:
        print(f"\n   Testing {endpoint}...")
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}{'...' if len(response.text) > 200 else ''}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

def check_database_migration():
    """Check if the score migration was applied"""
    print("\n4️⃣ Checking Database Migration Status...")
    
    # Try to create a user that might work (simpler approach)
    print("   Attempting simple user creation test...")
    
    simple_user = {
        "email": f"migrationtest{int(requests.get(f'{BASE_URL}/api/v1/auth/guest').json().get('created_at', 0))}@test.com",
        "password": "Test123!",
        "name": "Migration Test User"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=simple_user,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Registration Status: {response.status_code}")
        print(f"   Registration Response: {response.text}")
        
        if response.status_code == 200:
            auth_data = response.json()
            user_info = auth_data.get("user", {})
            print(f"   ✅ User created successfully!")
            print(f"   Score in response: {user_info.get('score', 'MISSING')}")
            
            # Test the /me endpoint with this user
            if auth_data.get("access_token"):
                headers = {
                    "Authorization": f"Bearer {auth_data['access_token']}",
                    "Content-Type": "application/json"
                }
                
                me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
                print(f"   /me Status: {me_response.status_code}")
                print(f"   /me Response: {me_response.text}")
                
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    print(f"   Score in /me: {me_data.get('score', 'MISSING')}")
        else:
            print(f"   ❌ Registration failed")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    test_endpoint_behavior()
    check_database_migration()