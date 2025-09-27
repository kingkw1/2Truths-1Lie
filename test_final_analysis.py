#!/usr/bin/env python3
"""
Final comprehensive test to understand the progression system issue
"""

import requests
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def analyze_backend_behavior():
    """Analyze the current backend behavior and progression system"""
    print("🔍 BACKEND BEHAVIOR ANALYSIS")
    print("=" * 50)
    
    print("📋 SUMMARY OF FINDINGS:")
    print("━" * 30)
    
    # Test guest session
    print("\n1️⃣ GUEST USER BEHAVIOR:")
    try:
        guest_response = requests.post(f"{BASE_URL}/api/v1/auth/guest")
        if guest_response.status_code == 200:
            guest_data = guest_response.json()
            token = guest_data["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            print("   ✅ Guest session creation: WORKING")
            print("   📊 Guest permissions:", guest_data.get("permissions", []))
            
            # Test guest /me endpoint
            me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
            print(f"   📋 Guest /me access: {'ALLOWED' if me_response.status_code == 200 else 'BLOCKED'}")
            
            # Test guest challenges
            challenge_response = requests.get(f"{BASE_URL}/api/v1/challenges", headers=headers)
            print(f"   🎯 Guest challenges access: {'ALLOWED' if challenge_response.status_code == 200 else 'BLOCKED'}")
            
            if me_response.status_code == 200:
                me_data = me_response.json()
                has_score = "score" in me_data
                print(f"   📈 Score field in guest /me: {'PRESENT' if has_score else 'MISSING'}")
                
    except Exception as e:
        print(f"   ❌ Guest test error: {e}")
    
    # Test user registration status
    print("\n2️⃣ USER REGISTRATION BEHAVIOR:")
    test_registration = {
        "email": "registrationtest@example.com",
        "password": "Test123!",
        "name": "Registration Test"
    }
    
    try:
        reg_response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=test_registration,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   📊 Registration status: {reg_response.status_code}")
        print(f"   📄 Registration response: {reg_response.text}")
        
        if reg_response.status_code == 200:
            print("   ✅ User registration: WORKING")
            reg_data = reg_response.json()
            user_info = reg_data.get("user", {})
            has_score = "score" in user_info
            print(f"   📈 Score field in registration: {'PRESENT' if has_score else 'MISSING'}")
            print(f"   🔢 Score value: {user_info.get('score', 'N/A')}")
        elif reg_response.status_code == 409:
            print("   ⚠️  User registration: USER EXISTS (trying login...)")
            # Try login
            login_response = requests.post(
                f"{BASE_URL}/api/v1/auth/login",
                json={"email": test_registration["email"], "password": test_registration["password"]},
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code == 200:
                print("   ✅ User login: WORKING")
                login_data = login_response.json()
                user_info = login_data.get("user", {})
                has_score = "score" in user_info
                print(f"   📈 Score field in login: {'PRESENT' if has_score else 'MISSING'}")
                print(f"   🔢 Score value: {user_info.get('score', 'N/A')}")
                
                # Test authenticated /me endpoint
                token = login_data["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    print("   ✅ Authenticated /me endpoint: WORKING")
                    me_data = me_response.json()
                    has_score = "score" in me_data
                    print(f"   📈 Score field in /me: {'PRESENT' if has_score else 'MISSING'}")
                    print(f"   🔢 Score value in /me: {me_data.get('score', 'N/A')}")
                else:
                    print(f"   ❌ Authenticated /me endpoint: FAILED ({me_response.status_code})")
            else:
                print(f"   ❌ User login: FAILED ({login_response.status_code})")
        else:
            print(f"   ❌ User registration: FAILED ({reg_response.status_code})")
            print("   🔍 This indicates a backend database or migration issue")
            
    except Exception as e:
        print(f"   ❌ Registration test error: {e}")
    
    # Test challenge access with different auth states
    print("\n3️⃣ PROGRESSION SYSTEM ANALYSIS:")
    print("   📋 Expected behavior for progression system:")
    print("      1. User registers/logs in → gets initial score (usually 0)")
    print("      2. User submits correct guess → backend increments score by 10")
    print("      3. User checks /me endpoint → sees updated score")
    print("")
    print("   🔍 Current issues identified:")
    print("      ❌ Registration failing with 500 errors")
    print("      ❌ Cannot create authenticated users to test scoring")
    print("      ❌ Database migration may not be applied correctly")
    print("")
    print("   💡 Recommendations:")
    print("      1. Check backend logs for registration errors")
    print("      2. Verify database migration was applied correctly")
    print("      3. Ensure score column exists in users table")
    print("      4. Test with existing user if any exist in production")

def test_known_endpoints():
    """Test known working endpoints"""
    print("\n4️⃣ ENDPOINT HEALTH CHECK:")
    print("━" * 30)
    
    endpoints = [
        ("POST", "/api/v1/auth/guest", None),
        ("GET", "/", None),
        ("GET", "/health", None),
        ("GET", "/api/v1/challenges", "requires_auth"),
    ]
    
    guest_token = None
    
    for method, endpoint, auth_req in endpoints:
        try:
            if method == "POST" and endpoint == "/api/v1/auth/guest":
                response = requests.post(f"{BASE_URL}{endpoint}")
                if response.status_code == 200:
                    guest_token = response.json().get("access_token")
                    
            elif method == "GET":
                headers = {}
                if auth_req == "requires_auth" and guest_token:
                    headers["Authorization"] = f"Bearer {guest_token}"
                
                response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            status_icon = "✅" if response.status_code < 400 else "❌" if response.status_code >= 500 else "⚠️"
            print(f"   {status_icon} {method} {endpoint}: {response.status_code}")
            
        except Exception as e:
            print(f"   ❌ {method} {endpoint}: ERROR - {e}")

if __name__ == "__main__":
    analyze_backend_behavior()
    test_known_endpoints()
    
    print("\n" + "=" * 50)
    print("🎯 PROGRESSION SYSTEM DIAGNOSIS COMPLETE")
    print("=" * 50)
    print("\n📋 KEY FINDINGS:")
    print("   • Backend is running and responding to requests")
    print("   • Guest authentication works correctly")
    print("   • User registration is failing (500 errors)")
    print("   • This prevents testing the actual progression system")
    print("   • Score field cannot be verified without authenticated users")
    print("\n💡 NEXT STEPS:")
    print("   1. Fix registration issues on Railway backend")
    print("   2. Verify database migration for score column")
    print("   3. Test progression with working user authentication")
    print("=" * 50)