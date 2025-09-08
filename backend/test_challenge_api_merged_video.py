#!/usr/bin/env python3
"""
API test for challenge creation endpoint with merged video support
"""
import asyncio
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from fastapi.testclient import TestClient
    from main import app
except ImportError:
    print("FastAPI TestClient not available, skipping API tests")
    sys.exit(0)
from services.auth_service import AuthService

def test_challenge_creation_api_with_merged_video():
    """Test the challenge creation API endpoint with merged video data"""
    
    print("Testing challenge creation API with merged video...")
    
    try:
        # Create test client
        client = TestClient(app)
        
        # Generate test JWT token
        auth_service = AuthService()
        test_user_id = "test_user_api"
        token = auth_service.create_token({"sub": test_user_id, "username": "testuser"})
    
    # Prepare challenge creation request with merged video
    challenge_data = {
        "title": "API Test Challenge with Merged Video",
        "statements": [
            {
                "media_file_id": "api_test_video_0",
                "duration_seconds": 4.8,
                "statement_text": "I have visited all 50 US states"
            },
            {
                "media_file_id": "api_test_video_1",
                "duration_seconds": 5.2,
                "statement_text": "I can solve a Rubik's cube in under 30 seconds"
            },
            {
                "media_file_id": "api_test_video_2",
                "duration_seconds": 4.5,
                "statement_text": "I have never eaten sushi"
            }
        ],
        "lie_statement_index": 0,
        "tags": ["travel", "skills", "food"],
        "is_merged_video": True,
        "merged_video_metadata": {
            "total_duration": 14.5,
            "segments": [
                {
                    "start_time": 0.0,
                    "end_time": 4.8,
                    "duration": 4.8,
                    "statement_index": 0
                },
                {
                    "start_time": 4.8,
                    "end_time": 10.0,
                    "duration": 5.2,
                    "statement_index": 1
                },
                {
                    "start_time": 10.0,
                    "end_time": 14.5,
                    "duration": 4.5,
                    "statement_index": 2
                }
            ],
            "video_file_id": "api_merged_video_123",
            "compression_applied": True
        },
        "merged_video_url": "https://cdn.example.com/api_test/merged_video_123.mp4",
        "merged_video_file_id": "api_merged_video_123",
        "merge_session_id": "api_merge_session_456"
    }
    
    # Make API request
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = client.post(
            "/api/v1/challenges/",
            json=challenge_data,
            headers=headers
        )
        
        print(f"API Response Status: {response.status_code}")
        
        if response.status_code == 201:
            challenge = response.json()
            print("✓ Challenge created successfully via API")
            print(f"  - Challenge ID: {challenge['challenge_id']}")
            print(f"  - Title: {challenge['title']}")
            print(f"  - Is merged video: {challenge['is_merged_video']}")
            print(f"  - Merged video URL: {challenge.get('merged_video_url')}")
            print(f"  - Statements: {len(challenge['statements'])}")
            
            # Verify merged video metadata is preserved
            if challenge.get('merged_video_metadata'):
                metadata = challenge['merged_video_metadata']
                print(f"  - Total duration: {metadata['total_duration']}s")
                print(f"  - Segments: {len(metadata['segments'])}")
            
            # Test retrieving the challenge
            challenge_id = challenge['challenge_id']
            get_response = client.get(f"/api/v1/challenges/{challenge_id}")
            
            if get_response.status_code == 200:
                retrieved_challenge = get_response.json()
                print("✓ Challenge retrieved successfully")
                
                # Verify merged video data is preserved
                if (retrieved_challenge.get('is_merged_video') and 
                    retrieved_challenge.get('merged_video_url') == challenge_data['merged_video_url']):
                    print("✓ Merged video data preserved in retrieval")
                else:
                    print("✗ Merged video data not preserved")
                    return False
            else:
                print(f"✗ Failed to retrieve challenge: {get_response.status_code}")
                return False
            
            # Test segment metadata endpoint
            segment_response = client.get(
                f"/api/v1/challenges/{challenge_id}/segments",
                headers=headers
            )
            
            if segment_response.status_code == 200:
                segment_data = segment_response.json()
                print("✓ Segment metadata endpoint works")
                print(f"  - Total duration: {segment_data.get('total_duration')}s")
                print(f"  - Segments: {len(segment_data.get('segments', []))}")
            else:
                print(f"✗ Segment metadata endpoint failed: {segment_response.status_code}")
                return False
            
            return True
            
        else:
            print(f"✗ API request failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ API test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_challenge_creation_api_validation():
    """Test API validation for merged video challenges"""
    
    print("\nTesting API validation for merged video challenges...")
    
    client = TestClient(app)
    auth_service = AuthService()
    token = auth_service.create_token({"sub": "test_user_validation", "username": "testuser"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test missing merged video URL
    invalid_data = {
        "title": "Invalid Challenge",
        "statements": [
            {"media_file_id": "test1", "duration_seconds": 5.0},
            {"media_file_id": "test2", "duration_seconds": 5.0},
            {"media_file_id": "test3", "duration_seconds": 5.0}
        ],
        "lie_statement_index": 0,
        "is_merged_video": True,
        # Missing merged_video_url and merged_video_metadata
    }
    
    response = client.post("/api/v1/challenges/", json=invalid_data, headers=headers)
    
    if response.status_code == 400:
        print("✓ API correctly rejects invalid merged video request")
    else:
        print(f"✗ API should have rejected invalid request, got {response.status_code}")
        return False
    
    return True

def main():
    """Run API tests"""
    print("=" * 60)
    print("Challenge Creation API Test - Merged Video Support")
    print("=" * 60)
    
    success = True
    
    # Test successful creation
    if not test_challenge_creation_api_with_merged_video():
        success = False
    
    # Test validation
    if not test_challenge_creation_api_validation():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✓ All API tests passed!")
        print("Challenge creation endpoint successfully supports merged video URL and segment metadata.")
    else:
        print("✗ Some API tests failed!")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)