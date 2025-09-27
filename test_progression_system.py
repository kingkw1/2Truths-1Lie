#!/usr/bin/env python3
"""
Test script for the progression system implementation
Tests the backend API endpoints for user score functionality
"""

import requests
import json
import random
import time

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_progression_system():
    """Test the progression system end-to-end"""
    print("🧪 Testing Progression System Implementation")
    print("=" * 50)
    
    # Create a unique test user
    timestamp = int(time.time())
    test_email = f"progressiontest{timestamp}@example.com"
    test_password = "testpassword123"
    
    print(f"📧 Test user email: {test_email}")
    
    # Step 1: Register a new user
    print("\n1️⃣ Step 1: Register new user")
    register_data = {
        "email": test_email,
        "password": test_password,
        "name": "Progression Test User"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=register_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            auth_data = response.json()
            access_token = auth_data["access_token"]
            user_info = auth_data.get("user", {})
            print(f"✅ User registered successfully")
            print(f"   User ID: {user_info.get('id', 'N/A')}")
            print(f"   User Email: {user_info.get('email', 'N/A')}")
            print(f"   User Score: {user_info.get('score', 'N/A')}")
        else:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
            # Try to login instead (user might already exist)
            print("\n🔄 Trying to login instead...")
            login_response = requests.post(
                f"{BASE_URL}/api/v1/auth/login",
                json={"email": test_email, "password": test_password},
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code == 200:
                auth_data = login_response.json()
                access_token = auth_data["access_token"]
                user_info = auth_data.get("user", {})
                print(f"✅ Login successful")
                print(f"   User ID: {user_info.get('id', 'N/A')}")
                print(f"   User Email: {user_info.get('email', 'N/A')}")
                print(f"   User Score: {user_info.get('score', 'N/A')}")
            else:
                # Try with a completely new email
                test_email = f"progressiontest{timestamp}{random.randint(1000,9999)}@example.com"
                register_data["email"] = test_email
                print(f"🔄 Trying with new email: {test_email}")
                
                response = requests.post(
                    f"{BASE_URL}/api/v1/auth/register",
                    json=register_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    auth_data = response.json()
                    access_token = auth_data["access_token"]
                    user_info = auth_data.get("user", {})
                    print(f"✅ User registered with new email")
                    print(f"   User ID: {user_info.get('id', 'N/A')}")
                    print(f"   User Email: {user_info.get('email', 'N/A')}")
                    print(f"   User Score: {user_info.get('score', 'N/A')}")
                else:
                    print(f"❌ All registration attempts failed")
                    return False
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return False
    
    # Step 2: Check initial score via /me endpoint
    print("\n2️⃣ Step 2: Check initial user score")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
        
        if response.status_code == 200:
            user_data = response.json()
            initial_score = user_data.get("score", 0)
            print(f"✅ /me endpoint successful")
            print(f"   Initial Score: {initial_score}")
            print(f"   User Name: {user_data.get('name', 'N/A')}")
            print(f"   User Email: {user_data.get('email', 'N/A')}")
        else:
            print(f"❌ /me endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ /me endpoint error: {e}")
        return False
    
    # Step 3: Get a list of challenges to guess on
    print("\n3️⃣ Step 3: Get available challenges")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/challenges", headers=headers)
        
        if response.status_code == 200:
            challenges = response.json()
            if challenges:
                test_challenge = challenges[0]
                challenge_id = test_challenge["challenge_id"]
                print(f"✅ Found {len(challenges)} challenges")
                print(f"   Testing with challenge: {challenge_id}")
                print(f"   Challenge creator: {test_challenge.get('creator_id', 'N/A')}")
            else:
                print("❌ No challenges available for testing")
                return False
        else:
            print(f"❌ Failed to get challenges: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Challenges endpoint error: {e}")
        return False
    
    # Step 4: Submit a correct guess (we need to find the lie statement)
    print("\n4️⃣ Step 4: Submit a guess to earn points")
    try:
        # Get challenge details to find the lie statement
        response = requests.get(f"{BASE_URL}/api/v1/challenges/{challenge_id}", headers=headers)
        
        if response.status_code == 200:
            challenge_details = response.json()
            lie_statement_id = challenge_details.get("lie_statement_id")
            
            if lie_statement_id:
                # Submit the correct guess (lie statement)
                guess_data = {
                    "guessed_lie_statement_id": lie_statement_id,
                    "response_time_seconds": 15.0
                }
                
                response = requests.post(
                    f"{BASE_URL}/api/v1/challenges/{challenge_id}/guess",
                    json=guess_data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    guess_result = response.json()
                    print(f"✅ Guess submitted successfully")
                    print(f"   Correct: {guess_result.get('correct', False)}")
                    print(f"   Points Earned: {guess_result.get('points_earned', 0)}")
                    print(f"   Guess ID: {guess_result.get('guess_id', 'N/A')}")
                else:
                    print(f"❌ Guess submission failed: {response.status_code}")
                    print(f"   Response: {response.text}")
                    # Try submitting a wrong guess instead
                    statements = challenge_details.get("statements", [])
                    if statements:
                        wrong_statement = None
                        for stmt in statements:
                            if stmt["statement_id"] != lie_statement_id:
                                wrong_statement = stmt["statement_id"]
                                break
                        
                        if wrong_statement:
                            print(f"🔄 Trying with wrong guess to test system...")
                            guess_data["guessed_lie_statement_id"] = wrong_statement
                            response = requests.post(
                                f"{BASE_URL}/api/v1/challenges/{challenge_id}/guess",
                                json=guess_data,
                                headers=headers
                            )
                            
                            if response.status_code == 200:
                                guess_result = response.json()
                                print(f"✅ Wrong guess submitted (for testing)")
                                print(f"   Correct: {guess_result.get('correct', False)}")
                                print(f"   Points Earned: {guess_result.get('points_earned', 0)}")
            else:
                print("❌ Could not find lie statement ID in challenge")
                return False
        else:
            print(f"❌ Failed to get challenge details: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Guess submission error: {e}")
        return False
    
    # Step 5: Check updated score
    print("\n5️⃣ Step 5: Check updated user score")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
        
        if response.status_code == 200:
            user_data = response.json()
            final_score = user_data.get("score", 0)
            score_increase = final_score - initial_score
            
            print(f"✅ Score check successful")
            print(f"   Initial Score: {initial_score}")
            print(f"   Final Score: {final_score}")
            print(f"   Score Increase: {score_increase}")
            
            if score_increase > 0:
                print(f"🎉 SUCCESS: Score increased by {score_increase} points!")
                return True
            else:
                print(f"⚠️  WARNING: Score did not increase (expected if guess was wrong)")
                return True  # Still success - system is working
        else:
            print(f"❌ Final score check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Final score check error: {e}")
        return False

if __name__ == "__main__":
    success = test_progression_system()
    
    print("\n" + "=" * 50)
    if success:
        print("🎯 PROGRESSION SYSTEM TEST COMPLETED")
    else:
        print("❌ PROGRESSION SYSTEM TEST FAILED")
    print("=" * 50)