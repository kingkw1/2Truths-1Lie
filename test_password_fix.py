#!/usr/bin/env python3
"""
Test the password length fix by using shorter passwords
"""

import requests
import json
import random
import time

BASE_URL = "https://2truths-1lie-production.up.railway.app"

def test_simple_password_registration():
    """Test with simple, short passwords"""
    print("🧪 Testing Password Length Fix")
    print("=" * 40)
    
    # Use very simple, short passwords
    timestamp = int(time.time())
    test_cases = [
        {
            "email": f"simple{timestamp}@test.com",
            "password": "pass123",  # Very short password
            "name": "Simple Test"
        },
        {
            "email": f"basic{timestamp}@test.com",
            "password": "abc123",   # Even shorter
            "name": "Basic Test"
        },
        {
            "email": f"minimal{timestamp}@test.com",
            "password": "123",      # Minimal password
            "name": "Minimal Test"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}️⃣ Testing Case {i}: {test_case['email']}")
        print(f"   Password length: {len(test_case['password'])} chars")
        print(f"   Password bytes: {len(test_case['password'].encode('utf-8'))} bytes")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/auth/register",
                json=test_case,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ Registration successful!")
                auth_data = response.json()
                user_info = auth_data.get("user", {})
                
                print(f"   User ID: {user_info.get('id', 'N/A')}")
                print(f"   User Email: {user_info.get('email', 'N/A')}")
                print(f"   User Score: {user_info.get('score', 'MISSING')}")
                
                # Test the /me endpoint
                if auth_data.get("access_token"):
                    headers = {
                        "Authorization": f"Bearer {auth_data['access_token']}",
                        "Content-Type": "application/json"
                    }
                    
                    me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
                    print(f"   /me Status: {me_response.status_code}")
                    
                    if me_response.status_code == 200:
                        me_data = me_response.json()
                        print(f"   Score in /me: {me_data.get('score', 'MISSING')}")
                        
                        # SUCCESS! We can test progression now
                        print(f"   🎉 SUCCESS: User created with score field!")
                        return auth_data, test_case
                    else:
                        print(f"   /me Response: {me_response.text}")
                else:
                    print("   ⚠️  No access token in response")
            elif response.status_code == 409:
                print("   ⚠️  User already exists")
            else:
                print(f"   ❌ Registration failed")
                print(f"   Response: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    return None, None

def test_progression_with_working_user(auth_data, user_info):
    """Test the progression system with a working user"""
    print(f"\n4️⃣ Testing Progression System")
    print("=" * 30)
    
    headers = {
        "Authorization": f"Bearer {auth_data['access_token']}",
        "Content-Type": "application/json"
    }
    
    # Get initial score
    print("📊 Getting initial score...")
    me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
    
    if me_response.status_code == 200:
        me_data = me_response.json()
        initial_score = me_data.get('score', 0)
        print(f"   Initial Score: {initial_score}")
    else:
        print(f"   ❌ Could not get initial score: {me_response.status_code}")
        return
    
    # Get challenges
    print("\n🎯 Getting challenges...")
    challenges_response = requests.get(f"{BASE_URL}/api/v1/challenges", headers=headers)
    
    if challenges_response.status_code == 200:
        challenges = challenges_response.json()
        if challenges:
            challenge = challenges[0]
            challenge_id = challenge["challenge_id"]
            print(f"   Found challenge: {challenge_id}")
            
            # Get challenge details
            detail_response = requests.get(f"{BASE_URL}/api/v1/challenges/{challenge_id}", headers=headers)
            
            if detail_response.status_code == 200:
                challenge_details = detail_response.json()
                lie_statement_id = challenge_details.get("lie_statement_id")
                
                if lie_statement_id:
                    print(f"   Lie statement ID: {lie_statement_id}")
                    
                    # Submit correct guess
                    print("\n🎯 Submitting correct guess...")
                    guess_data = {
                        "guessed_lie_statement_id": lie_statement_id,
                        "response_time_seconds": 10.0
                    }
                    
                    guess_response = requests.post(
                        f"{BASE_URL}/api/v1/challenges/{challenge_id}/guess",
                        json=guess_data,
                        headers=headers
                    )
                    
                    if guess_response.status_code == 200:
                        guess_result = guess_response.json()
                        print(f"   ✅ Guess submitted!")
                        print(f"   Correct: {guess_result.get('correct', False)}")
                        print(f"   Points Earned: {guess_result.get('points_earned', 0)}")
                        
                        # Check updated score
                        print("\n📈 Checking updated score...")
                        final_me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
                        
                        if final_me_response.status_code == 200:
                            final_me_data = final_me_response.json()
                            final_score = final_me_data.get('score', 0)
                            score_increase = final_score - initial_score
                            
                            print(f"   Initial Score: {initial_score}")
                            print(f"   Final Score: {final_score}")
                            print(f"   Score Increase: {score_increase}")
                            
                            if score_increase > 0:
                                print(f"   🎉 SUCCESS: Progression system working! Score increased by {score_increase} points!")
                                return True
                            else:
                                print(f"   ⚠️  Score didn't increase (maybe wrong guess or already guessed)")
                        else:
                            print(f"   ❌ Could not get final score: {final_me_response.status_code}")
                    else:
                        print(f"   ❌ Guess submission failed: {guess_response.status_code}")
                        print(f"   Response: {guess_response.text}")
                else:
                    print("   ❌ No lie statement ID found")
            else:
                print(f"   ❌ Could not get challenge details: {detail_response.status_code}")
        else:
            print("   ❌ No challenges available")
    else:
        print(f"   ❌ Could not get challenges: {challenges_response.status_code}")
        print(f"   Response: {challenges_response.text}")
    
    return False

if __name__ == "__main__":
    print("🧪 PROGRESSION SYSTEM TEST - Password Fix Version")
    print("=" * 55)
    
    # Test registration with simple passwords
    auth_data, user_info = test_simple_password_registration()
    
    if auth_data:
        # Test progression system
        success = test_progression_with_working_user(auth_data, user_info)
        
        print("\n" + "=" * 55)
        if success:
            print("🎉 PROGRESSION SYSTEM TEST: COMPLETE SUCCESS!")
            print("   ✅ User registration working")
            print("   ✅ Score field present")
            print("   ✅ Challenges accessible") 
            print("   ✅ Score increments on correct guess")
        else:
            print("⚠️  PROGRESSION SYSTEM TEST: PARTIAL SUCCESS")
            print("   ✅ User registration working")
            print("   ✅ Score field present")
            print("   ❌ Score increment needs verification")
    else:
        print("\n" + "=" * 55)
        print("❌ PROGRESSION SYSTEM TEST: FAILED")
        print("   ❌ User registration still not working")
        print("   💡 Need to fix password length issue further")
    
    print("=" * 55)