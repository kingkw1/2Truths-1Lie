#!/usr/bin/env python3
"""
Test User Creation Tool

Creates test users with known credentials for:
- RevenueCat integration testing
- QA testing scenarios
- Development and debugging

Usage:
    python tools/testing/create_test_user.py
"""
import requests
import json
import time

# Backend URL
BASE_URL = "https://2truths-1lie-production.up.railway.app"

def create_test_user():
    """Create a test user with a known email for RevenueCat testing"""
    
    # Use a predictable email for testing
    test_user = {
        "email": "revenuecat_test@example.com",
        "password": "TestPassword123!",
        "username": "revenuecat_test_user"
    }
    
    print(f"🧪 Creating RevenueCat test user...")
    print(f"Email: {test_user['email']}")
    print(f"Username: {test_user['username']}")
    
    try:
        # Make registration request
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\n📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Test user created successfully!")
            print(f"🔑 User ID: {result['user']['id']}")
            print(f"📧 Email: {result['user']['email']}")
            print(f"💰 Premium status: {result['user']['is_premium']}")
            
            # Test the user login
            login_data = {
                "username": test_user["email"],
                "password": test_user["password"]
            }
            
            login_response = requests.post(
                f"{BASE_URL}/api/v1/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if login_response.status_code == 200:
                print(f"✅ Login test successful!")
            else:
                print(f"⚠️ Login test failed: {login_response.status_code}")
            
            return True
        elif response.status_code == 400:
            try:
                error = response.json()
                if "User already exists" in error.get("detail", ""):
                    print(f"ℹ️ User already exists, that's fine for testing")
                    return True
                else:
                    print(f"❌ Registration failed: {error}")
                    return False
            except:
                print(f"❌ Registration failed: {response.text}")
                return False
        else:
            print(f"❌ Registration failed with status {response.status_code}")
            try:
                error = response.json()
                print(f"📦 Error response: {json.dumps(error, indent=2)}")
            except:
                print(f"📦 Raw response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Creating RevenueCat Test User")
    print("=" * 50)
    
    success = create_test_user()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ RevenueCat test user ready!")
        print("\n📋 You can now:")
        print("1. Use email: revenuecat_test@example.com")
        print("2. Password: TestPassword123!")
        print("3. Test RevenueCat webhook with this user")
    else:
        print("❌ Failed to create test user!")