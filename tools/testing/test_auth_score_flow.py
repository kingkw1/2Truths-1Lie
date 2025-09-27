#!/usr/bin/env python3
"""
Test user authentication and score retrieval flow
"""
import requests
import json

def test_auth_and_score():
    """Test the complete authentication and score retrieval workflow"""
    base_url = "https://2truths-1lie-production.up.railway.app"
    
    print("🚀 Testing Authentication and Score Flow")
    print("=" * 50)
    
    # Test 1: Try to register a test user
    print("\n1. Testing User Registration")
    registration_data = {
        "email": "testuser@example.com", 
        "password": "testpass123",
        "name": "Test User"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/v1/auth/register",
            json=registration_data,
            timeout=10
        )
        print(f"   Registration Status: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✅ Registration successful")
            auth_data = response.json()
            token = auth_data.get("access_token")
            print(f"   Token received: {token[:30]}...")
        else:
            print(f"   ❌ Registration failed: {response.text}")
            print("   Attempting to login with existing credentials...")
            
            # Try login instead
            login_response = requests.post(
                f"{base_url}/api/v1/auth/login",
                json={"email": registration_data["email"], "password": registration_data["password"]},
                timeout=10
            )
            print(f"   Login Status: {login_response.status_code}")
            if login_response.status_code == 200:
                auth_data = login_response.json()
                token = auth_data.get("access_token")
                print(f"   ✅ Login successful, token: {token[:30]}...")
            else:
                print(f"   ❌ Login also failed: {login_response.text}")
                return
                
    except Exception as e:
        print(f"   ❌ Authentication error: {e}")
        return
    
    # Test 2: Get user profile from /me endpoint
    print("\n2. Testing /api/v1/auth/me endpoint")
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        me_response = requests.get(
            f"{base_url}/api/v1/auth/me",
            headers=headers,
            timeout=10
        )
        
        print(f"   /me Status: {me_response.status_code}")
        if me_response.status_code == 200:
            user_data = me_response.json()
            print("   ✅ User data retrieved:")
            print(f"      ID: {user_data.get('id')}")
            print(f"      Email: {user_data.get('email')}")
            print(f"      Name: {user_data.get('name')}")
            print(f"      Score: {user_data.get('score', 'MISSING!')}")
            print(f"      Created: {user_data.get('created_at')}")
            
            if 'score' in user_data:
                print("   ✅ Score field is present in API response")
            else:
                print("   ❌ Score field is MISSING from API response")
                print(f"   Available fields: {list(user_data.keys())}")
        else:
            print(f"   ❌ Failed to get user data: {me_response.text}")
            
    except Exception as e:
        print(f"   ❌ /me endpoint error: {e}")
    
    # Test 3: Check database structure
    print("\n3. Testing user validation endpoint")
    try:
        validate_response = requests.get(
            f"{base_url}/api/v1/auth/validate",
            headers=headers,
            timeout=10
        )
        
        print(f"   Validation Status: {validate_response.status_code}")
        if validate_response.status_code == 200:
            validation_data = validate_response.json()
            print("   ✅ Token validation successful:")
            print(f"      User ID: {validation_data.get('user_id')}")
            print(f"      Type: {validation_data.get('type')}")
            print(f"      Valid: {validation_data.get('valid')}")
            if 'user' in validation_data:
                user_info = validation_data['user']
                print(f"      User Score: {user_info.get('score', 'MISSING!')}")
        else:
            print(f"   ❌ Token validation failed: {validate_response.text}")
            
    except Exception as e:
        print(f"   ❌ Validation endpoint error: {e}")
    
    print("\n" + "=" * 50)
    print("Test completed!")

if __name__ == "__main__":
    test_auth_and_score()