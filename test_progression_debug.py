#!/usr/bin/env python3
"""
Simplified test script to diagnose progression system issues
"""

import requests
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_guest_flow():
    """Test with guest user first"""
    print("🧪 Testing Guest User Flow")
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
            print(f"   Token type: {auth_data.get('token_type', 'N/A')}")
            print(f"   Permissions: {auth_data.get('permissions', [])}")
        else:
            print(f"❌ Guest session failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Guest session error: {e}")
        return False
    
    # Step 2: Try /me endpoint with guest token (should fail)
    print("\n2️⃣ Testing /me endpoint with guest token...")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Expected behavior: Guest users can't access /me endpoint")
        elif response.status_code == 200:
            print("⚠️  Unexpected: Guest user can access /me endpoint")
            user_data = response.json()
            print(f"   User data: {json.dumps(user_data, indent=2)}")
        else:
            print(f"❓ Unexpected status code: {response.status_code}")
    except Exception as e:
        print(f"❌ /me endpoint error: {e}")
    
    # Step 3: List challenges
    print("\n3️⃣ Testing challenges endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/challenges", headers=headers)
        
        if response.status_code == 200:
            challenges = response.json()
            print(f"✅ Found {len(challenges)} challenges")
            if challenges:
                print(f"   First challenge ID: {challenges[0].get('challenge_id', 'N/A')}")
                return challenges[0]  # Return first challenge for testing
        else:
            print(f"❌ Challenges failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Challenges error: {e}")
    
    return None

def test_registration_debug():
    """Debug registration issues"""
    print("\n🔍 Debugging Registration Issues")
    print("=" * 35)
    
    # Test different registration scenarios
    test_cases = [
        {
            "email": "simpletest@example.com",
            "password": "password123",
            "name": "Simple Test"
        },
        {
            "email": "debug1@test.com", 
            "password": "testpass123",
            "name": "Debug User 1"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}️⃣ Testing registration case {i}:")
        print(f"   Email: {test_case['email']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/auth/register",
                json=test_case,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            
            if response.status_code == 200:
                print("✅ Registration successful!")
                return response.json()
            elif response.status_code == 409:
                print("ℹ️  User already exists, try login...")
                # Try login
                login_response = requests.post(
                    f"{BASE_URL}/api/v1/auth/login",
                    json={"email": test_case["email"], "password": test_case["password"]},
                    headers={"Content-Type": "application/json"}
                )
                
                print(f"   Login Status: {login_response.status_code}")
                print(f"   Login Response: {login_response.text}")
                
                if login_response.status_code == 200:
                    print("✅ Login successful!")
                    return login_response.json()
        except Exception as e:
            print(f"❌ Error: {e}")
    
    return None

def test_existing_user_scenarios():
    """Test with potentially existing users"""
    print("\n👤 Testing Existing User Scenarios")
    print("=" * 35)
    
    # Common test credentials that might exist
    test_users = [
        {"email": "test@example.com", "password": "password123"},
        {"email": "admin@example.com", "password": "admin123"},
        {"email": "demo@example.com", "password": "demo123"},
    ]
    
    for user in test_users:
        print(f"\n🔑 Trying login: {user['email']}")
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/auth/login",
                json=user,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                print("✅ Login successful!")
                auth_data = response.json()
                user_info = auth_data.get("user", {})
                print(f"   User ID: {user_info.get('id', 'N/A')}")
                print(f"   User Score: {user_info.get('score', 'N/A')}")
                return auth_data
            else:
                print(f"   Response: {response.text}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    return None

if __name__ == "__main__":
    print("🧪 PROGRESSION SYSTEM DIAGNOSTIC")
    print("=" * 40)
    
    # Test guest flow
    first_challenge = test_guest_flow()
    
    # Debug registration
    auth_data = test_registration_debug()
    
    if not auth_data:
        # Try existing users
        auth_data = test_existing_user_scenarios()
    
    if auth_data:
        print(f"\n🎯 SUCCESS: Got authentication data")
        print(f"   Access token: {auth_data.get('access_token', 'N/A')[:50]}...")
        user_info = auth_data.get("user", {})
        if user_info:
            print(f"   User: {json.dumps(user_info, indent=2)}")
    else:
        print(f"\n❌ FAILED: Could not authenticate any user")
    
    print("\n" + "=" * 40)