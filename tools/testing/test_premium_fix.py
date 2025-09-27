#!/usr/bin/env python3
"""
Test script to verify premium user rate limiting fix
"""
import asyncio
import httpx
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

async def test_premium_fix():
    """Test the premium user rate limiting fix"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # First, let's try to login as the user to get a fresh token
        print("🔐 Attempting to login as fake1@gmail.com...")
        login_response = await client.post(f"{BASE_URL}/api/v1/auth/login", json={
            "email": "fake1@gmail.com",
            "password": "fake1password"
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        print("✅ Login successful!")
        token_data = login_response.json()
        access_token = token_data.get('access_token')
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Check if user has premium status via a user profile endpoint
        print("👤 Checking user profile...")
        profile_response = await client.get(f"{BASE_URL}/api/v1/auth/validate", headers=headers)
        if profile_response.status_code == 200:
            profile_data = profile_response.json()
            print(f"User profile: {json.dumps(profile_data, indent=2)}")
        
        # Now let's try to create a challenge to see if rate limiting is bypassed
        print("🎯 Testing challenge creation...")
        challenge_data = {
            "statements": [
                {"text": "Statement 1", "media_file_id": "test1"},
                {"text": "Statement 2", "media_file_id": "test2"},
                {"text": "Statement 3", "media_file_id": "test3"}
            ],
            "lie_statement_index": 1,
            "challenge_title": "Test Premium Challenge"
        }
        
        challenge_response = await client.post(
            f"{BASE_URL}/api/v1/challenges/", 
            headers=headers,
            json=challenge_data
        )
        
        print(f"Challenge creation response: {challenge_response.status_code}")
        print(f"Response body: {challenge_response.text}")

if __name__ == "__main__":
    asyncio.run(test_premium_fix())