#!/usr/bin/env python3
"""
Test progression system with guest authentication
"""
import requests
import json

def test_guest_progression():
    """Test progression system using guest authentication that works"""
    base_url = "https://2truths-1lie-production.up.railway.app"
    
    print("🎮 Testing Progression System with Guest Authentication")
    print("=" * 60)
    
    # Step 1: Create guest session (we know this works)
    print("\n1. Creating Guest Session")
    try:
        response = requests.post(f"{base_url}/api/v1/auth/guest", timeout=10)
        if response.status_code == 200:
            guest_data = response.json()
            token = guest_data.get('access_token')
            print(f"   ✅ Guest token: {token[:30]}...")
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
        else:
            print(f"   ❌ Guest session failed: {response.text}")
            return
    except Exception as e:
        print(f"   ❌ Guest session error: {e}")
        return
    
    # Step 2: Test user data endpoint for guest
    print("\n2. Testing Guest User Data (/api/v1/auth/validate)")
    try:
        response = requests.get(
            f"{base_url}/api/v1/auth/validate",
            headers=headers,
            timeout=10
        )
        print(f"   Validate Status: {response.status_code}")
        if response.status_code == 200:
            user_data = response.json()
            print("   ✅ Guest validation successful:")
            print(f"      User ID: {user_data.get('user_id')}")
            print(f"      Type: {user_data.get('type')}")
            print(f"      Valid: {user_data.get('valid')}")
            print(f"      Permissions: {user_data.get('permissions', [])}")
            
            # Check if user field exists (might contain score)
            if 'user' in user_data:
                user_info = user_data['user']
                print(f"      User Score: {user_info.get('score', 'N/A')}")
        else:
            print(f"   ❌ Guest validation failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Guest validation error: {e}")
    
    # Step 3: Test /me endpoint for guest (might not work)
    print("\n3. Testing Guest /me Endpoint")
    try:
        response = requests.get(
            f"{base_url}/api/v1/auth/me",
            headers=headers,
            timeout=10
        )
        print(f"   /me Status: {response.status_code}")
        if response.status_code == 200:
            user_data = response.json()
            print("   ✅ Guest /me successful:")
            print(f"      ID: {user_data.get('id')}")
            print(f"      Score: {user_data.get('score', 'MISSING!')}")
        else:
            print(f"   ⚠️ Guest /me not accessible: {response.text}")
            print("   (This is expected - /me requires authenticated users)")
    except Exception as e:
        print(f"   ❌ Guest /me error: {e}")
    
    # Step 4: Test challenge-related endpoints
    print("\n4. Testing Challenge Endpoints")
    try:
        response = requests.get(
            f"{base_url}/api/v1/challenges",
            headers=headers,
            timeout=10
        )
        print(f"   Challenges Status: {response.status_code}")
        if response.status_code == 200:
            challenges_data = response.json()
            print(f"   ✅ Challenges accessible: {len(challenges_data.get('challenges', []))} challenges found")
            
            # If we have challenges, try to submit a guess
            challenges = challenges_data.get('challenges', [])
            if challenges:
                challenge = challenges[0]
                challenge_id = challenge.get('challenge_id')
                print(f"   Testing guess submission for challenge: {challenge_id}")
                
                # Make a guess (assuming statement 1 is the lie)
                guess_data = {
                    "guessed_lie_statement_id": challenge.get('statements', [{}])[0].get('statement_id', 'statement_1'),
                    "response_time": 5.2
                }
                
                guess_response = requests.post(
                    f"{base_url}/api/v1/challenges/{challenge_id}/guess",
                    headers=headers,
                    json=guess_data,
                    timeout=10
                )
                print(f"   Guess Status: {guess_response.status_code}")
                if guess_response.status_code == 200:
                    guess_result = guess_response.json()
                    print("   ✅ Guess submitted successfully:")
                    print(f"      Correct: {guess_result.get('is_correct')}")
                    print(f"      Score Award: {guess_result.get('score_awarded', 'N/A')}")
                    print(f"      Total Score: {guess_result.get('total_score', 'N/A')}")
                else:
                    print(f"   ❌ Guess failed: {guess_response.text}")
            else:
                print("   ⚠️ No challenges available to test guess submission")
        else:
            print(f"   ❌ Challenges not accessible: {response.text}")
    except Exception as e:
        print(f"   ❌ Challenge test error: {e}")
    
    print("\n" + "=" * 60)
    print("Progression test completed!")

if __name__ == "__main__":
    test_guest_progression()