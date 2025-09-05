#!/usr/bin/env python3
"""
Test script to verify challenge persistence in the database
"""
import requests
import json

BASE_URL = "http://localhost:8001"

def test_create_and_list_challenges():
    """Test creating a challenge and then listing challenges"""
    
    # 1. First, check current challenges
    print("🔍 Step 1: Checking current challenges...")
    response = requests.get(f"{BASE_URL}/api/v1/challenges/?skip=0&limit=20&public_only=true")
    print(f"GET /challenges/ status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Current challenges count: {len(data.get('challenges', []))}")
        print(f"Total count: {data.get('total_count', 0)}")
    else:
        print(f"Error: {response.text}")
        return
    
    # 2. Create a test challenge
    print("\n🧪 Step 2: Creating a test challenge...")
    test_challenge = {
        "statements": [
            {"text": "I have been to Paris", "media_file_id": "test-media-1"},
            {"text": "I can speak 5 languages", "media_file_id": "test-media-2"},
            {"text": "I once met a celebrity", "media_file_id": "test-media-3"}
        ],
        "lie_statement_index": 1
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/test/challenge", json=test_challenge)
    print(f"POST /test/challenge status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Created challenge ID: {data.get('id')}")
        print(f"Message: {data.get('message')}")
    else:
        print(f"Error: {response.text}")
        return
    
    # 3. Check challenges again to see if it was stored
    print("\n✅ Step 3: Checking challenges after creation...")
    response = requests.get(f"{BASE_URL}/api/v1/challenges/?skip=0&limit=20&public_only=true")
    print(f"GET /challenges/ status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        challenges = data.get('challenges', [])
        print(f"New challenges count: {len(challenges)}")
        print(f"Total count: {data.get('total_count', 0)}")
        
        if challenges:
            print("\n📋 Challenge details:")
            for i, challenge in enumerate(challenges):
                print(f"  {i+1}. ID: {challenge.get('challenge_id', 'N/A')}")
                print(f"     Creator: {challenge.get('creator_id', 'N/A')}")
                print(f"     Statements: {len(challenge.get('statements', []))}")
                print(f"     Status: {challenge.get('status', 'N/A')}")
        else:
            print("❌ No challenges found - something may be wrong with persistence")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    try:
        test_create_and_list_challenges()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend. Make sure it's running on localhost:8001")
    except Exception as e:
        print(f"❌ Error: {e}")
