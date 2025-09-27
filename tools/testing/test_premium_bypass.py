#!/usr/bin/env python3
"""
Test script to verify that premium users can bypass rate limiting
"""
import asyncio
import httpx
import json

BASE_URL = "https://2truths-1lie-production.up.railway.app"

async def test_premium_bypass():
    """Test that premium users can bypass rate limiting"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        print("🔐 Testing premium user rate limiting bypass...")
        
        # The user should have a valid JWT token that shows is_premium: false (stale)
        # But the database should now show is_premium: true 
        # And our API should check the database, not the JWT token
        
        # For testing, let's use the existing JWT from the logs
        # From the logs: JWT payload shows 'is_premium': False but user ID is 10
        # Our debug endpoint confirmed user 10 now has is_premium: true in database
        
        # Let's simulate what would happen if we had the JWT token
        # Since we don't have the exact token, let's test the auth/validate endpoint first
        
        print("📊 Testing user authentication flow...")
        
        # Try to login (we might not have the right credentials but let's see)
        login_response = await client.post(f"{BASE_URL}/api/v1/auth/login", json={
            "email": "fake1@gmail.com", 
            "password": "fake1password"  # This might not work
        })
        
        print(f"Login attempt status: {login_response.status_code}")
        if login_response.status_code == 200:
            token_data = login_response.json()
            access_token = token_data.get('access_token')
            print(f"✅ Login successful, got token")
            
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Test challenge creation (this should now work for premium users)
            print("🎯 Testing challenge creation with premium user...")
            
            challenge_data = {
                "statements": [
                    {"text": "Premium Test Statement 1", "media_file_id": "test1"},
                    {"text": "Premium Test Statement 2", "media_file_id": "test2"}, 
                    {"text": "Premium Test Statement 3", "media_file_id": "test3"}
                ],
                "lie_statement_index": 1,
                "challenge_title": "Premium User Test Challenge"
            }
            
            challenge_response = await client.post(
                f"{BASE_URL}/api/v1/challenges/",
                headers=headers,
                json=challenge_data
            )
            
            print(f"Challenge creation status: {challenge_response.status_code}")
            print(f"Response: {challenge_response.text}")
            
            if challenge_response.status_code == 201:
                print("✅ SUCCESS: Premium user can create challenges without rate limiting!")
            elif challenge_response.status_code == 500:
                response_data = challenge_response.json()
                if "Rate limit exceeded" in response_data.get("detail", ""):
                    print("❌ FAILED: Premium user still hit rate limit")
                else:
                    print(f"❌ FAILED: Other error: {response_data}")
            else:
                print(f"❌ FAILED: Unexpected status code: {challenge_response.status_code}")
                
        else:
            print(f"❌ Login failed: {login_response.text}")
            print("This is expected if we don't have the right password")
            print("The real test will be with the mobile app using the existing JWT token")

if __name__ == "__main__":
    asyncio.run(test_premium_bypass())