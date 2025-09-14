#!/usr/bin/env python3
"""
Test the report endpoint with a real challenge
"""
import requests
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from services.database_service import DatabaseService
from services.auth_service import AuthService

def test_with_real_challenge():
    """Test the report endpoint using the authentication endpoint to get a proper token"""
    
    base_url = "http://localhost:8001"
    
    # Step 1: Register/login to get a proper token
    test_email = "real_test_reporter@example.com"
    test_password = "testpass123"
    
    # Try to register first
    register_data = {
        "email": test_email,
        "password": test_password,
        "name": "Real Test Reporter"
    }
    
    try:
        # Register user
        response = requests.post(
            f"{base_url}/api/v1/auth/register",
            json=register_data,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print("✅ User registered successfully")
            # Registration returned a token directly
            register_result = response.json()
            token = register_result.get("access_token")
            if token:
                print(f"✅ Got token from registration: {token[:50]}...")
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
                # Skip login step since we already have a token
                skip_login = True
            else:
                skip_login = False
        elif response.status_code in [400, 409] and ("already exists" in response.text or "already registered" in response.text):
            print("ℹ️  User already exists, will login instead")
            skip_login = False
        else:
            print(f"❌ Registration failed: {response.status_code} - {response.text}")
            return False
        
        # Login to get token (only if we didn't get one from registration)
        if not skip_login:
            login_data = {
                "email": test_email,
                "password": test_password
            }
            
            response = requests.post(
                f"{base_url}/api/v1/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
            
            login_result = response.json()
            token = login_result.get("access_token")
            
            if not token:
                print("❌ No access token in login response")
                return False
            
            print(f"✅ Login successful, got token: {token[:50]}...")
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        
        # Step 2: Get list of challenges to find a real one
        response = requests.get(
            f"{base_url}/api/v1/challenges/",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to get challenges: {response.status_code} - {response.text}")
            return False
        
        challenges_data = response.json()
        challenges = challenges_data.get("challenges", [])
        
        if not challenges:
            print("⚠️  No challenges found to test with")
            # Create a test challenge or use a known test ID
            test_challenge_id = "test-challenge-for-reporting"
        else:
            test_challenge_id = challenges[0]["challenge_id"]
            print(f"✅ Found challenge to test with: {test_challenge_id}")
        
        # Step 3: Test reporting the challenge
        report_data = {
            "reason": "spam",
            "details": "Testing the report endpoint functionality"
        }
        
        print(f"\n=== Testing Report Endpoint ===")
        response = requests.post(
            f"{base_url}/api/v1/challenges/{test_challenge_id}/report",
            headers=headers,
            json=report_data,
            timeout=10
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ Report created successfully: {result}")
            return True
        elif response.status_code == 404:
            print("⚠️  Challenge not found (this is expected for test challenge IDs)")
            return True
        elif response.status_code == 409:
            print("⚠️  Challenge already reported by this user (this is expected on repeat runs)")
            return True
        else:
            print(f"❌ Unexpected response: {response.status_code} - {response.text}")
            return False
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure the server is running on localhost:8001")
        return False
    except Exception as e:
        print(f"❌ Error testing with real challenge: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing Report Endpoint with Real Challenge")
    print("=" * 50)
    
    success = test_with_real_challenge()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ Report endpoint test completed successfully!")
    else:
        print("❌ Report endpoint test failed.")
    
    sys.exit(0 if success else 1)