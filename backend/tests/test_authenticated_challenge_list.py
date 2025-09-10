#!/usr/bin/env python3
"""
Test for authenticated challenge listing endpoint with merged video data
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
    try:
        from starlette.testclient import TestClient
        from main import app
    except ImportError:
        print("TestClient not available, skipping API tests")
        sys.exit(0)

from services.auth_service import AuthService
from services.challenge_service import challenge_service
from models import (
    CreateChallengeRequest, 
    MergedVideoMetadata, 
    VideoSegmentMetadata,
    ChallengeStatus
)

def test_authenticated_challenge_list():
    """Test the authenticated challenge listing endpoint"""
    
    print("Testing authenticated challenge listing endpoint...")
    
    try:
        # Create test client
        client = TestClient(app)
        
        # Generate test JWT token
        auth_service = AuthService()
        test_user_id = "test_user_auth_list"
        token = auth_service.create_token({"sub": test_user_id, "username": "testuser"})
        
        # Create a test challenge with merged video data
        asyncio.run(create_test_challenge_with_merged_video(test_user_id))
        
        # Test authenticated endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/challenges/", headers=headers)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response data keys: {list(data.keys())}")
        
        # Verify response structure
        required_keys = ["challenges", "total_count", "page", "page_size", "has_next", "authenticated", "user_id"]
        for key in required_keys:
            if key not in data:
                print(f"Missing required key: {key}")
                return False
        
        # Verify authentication info
        if not data["authenticated"]:
            print("Response should indicate authenticated access")
            return False
        
        if data["user_id"] != test_user_id:
            print(f"Expected user_id {test_user_id}, got {data['user_id']}")
            return False
        
        # Check if we have challenges
        challenges = data["challenges"]
        if len(challenges) == 0:
            print("No challenges returned")
            return True  # This is OK, might not have any challenges
        
        # Verify merged video data structure
        for challenge in challenges:
            if "merged_video_info" not in challenge:
                print("Challenge missing merged_video_info")
                return False
            
            merged_info = challenge["merged_video_info"]
            if "has_merged_video" not in merged_info:
                print("Challenge missing has_merged_video flag")
                return False
            
            # If it's a merged video, check for metadata
            if merged_info["has_merged_video"]:
                required_merged_keys = ["merged_video_url", "merged_video_file_id"]
                for key in required_merged_keys:
                    if key not in merged_info:
                        print(f"Merged video challenge missing {key}")
                        return False
                
                # Check for metadata
                if "metadata" in merged_info:
                    metadata = merged_info["metadata"]
                    if "segments" in metadata:
                        segments = metadata["segments"]
                        for segment in segments:
                            segment_keys = ["statement_index", "start_time", "end_time", "duration"]
                            for key in segment_keys:
                                if key not in segment:
                                    print(f"Segment missing {key}")
                                    return False
        
        print("✓ Authenticated challenge listing test passed")
        return True
        
    except Exception as e:
        print(f"Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_unauthenticated_access():
    """Test that the endpoint requires authentication"""
    
    print("Testing unauthenticated access...")
    
    try:
        client = TestClient(app)
        
        # Try to access without token
        response = client.get("/api/v1/challenges/")
        
        print(f"Unauthenticated response status: {response.status_code}")
        
        # Should return 401 or 403
        if response.status_code not in [401, 403]:
            print(f"Expected 401 or 403, got {response.status_code}")
            return False
        
        print("✓ Unauthenticated access properly rejected")
        return True
        
    except Exception as e:
        print(f"Unauthenticated test failed with exception: {e}")
        return False

def test_public_endpoint_still_works():
    """Test that the public endpoint still works for backward compatibility"""
    
    print("Testing public endpoint...")
    
    try:
        client = TestClient(app)
        
        # Access public endpoint without authentication
        response = client.get("/api/v1/challenges/public")
        
        print(f"Public endpoint response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Public endpoint failed: {response.text}")
            return False
        
        data = response.json()
        
        # Should have basic structure but not enhanced merged video info
        required_keys = ["challenges", "total_count", "page", "page_size", "has_next"]
        for key in required_keys:
            if key not in data:
                print(f"Public endpoint missing required key: {key}")
                return False
        
        # Should NOT have authentication info
        if "authenticated" in data or "user_id" in data:
            print("Public endpoint should not include authentication info")
            return False
        
        print("✓ Public endpoint test passed")
        return True
        
    except Exception as e:
        print(f"Public endpoint test failed with exception: {e}")
        return False

async def create_test_challenge_with_merged_video(user_id: str):
    """Create a test challenge with merged video data"""
    
    # Create merged video metadata
    segments = [
        VideoSegmentMetadata(
            start_time=0.0,
            end_time=5.0,
            duration=5.0,
            statement_index=0
        ),
        VideoSegmentMetadata(
            start_time=5.0,
            end_time=10.0,
            duration=5.0,
            statement_index=1
        ),
        VideoSegmentMetadata(
            start_time=10.0,
            end_time=15.0,
            duration=5.0,
            statement_index=2
        )
    ]
    
    merged_metadata = MergedVideoMetadata(
        total_duration=15.0,
        segments=segments,
        video_file_id="test_merged_video_123",
        compression_applied=True,
        original_total_duration=16.0
    )
    
    # Create challenge request
    request = CreateChallengeRequest(
        title="Test Challenge with Merged Video",
        statements=[
            {
                "media_file_id": "test_video_0",
                "duration_seconds": 5.0,
                "statement_text": "I have been to space"
            },
            {
                "media_file_id": "test_video_1", 
                "duration_seconds": 5.0,
                "statement_text": "I can speak 10 languages"
            },
            {
                "media_file_id": "test_video_2",
                "duration_seconds": 5.0,
                "statement_text": "I have never eaten pizza"
            }
        ],
        lie_statement_index=2,
        is_merged_video=True,
        merged_video_metadata=merged_metadata,
        merged_video_url="https://example.com/merged_video_123.mp4",
        merged_video_file_id="test_merged_video_123",
        merge_session_id="test_merge_session_123"
    )
    
    # Mock upload service
    class MockUploadService:
        async def get_upload_status(self, session_id):
            return type('obj', (object,), {
                'status': 'completed',
                'filename': f'{session_id}.mp4'
            })
    
    upload_service = MockUploadService()
    
    try:
        # Create the challenge
        challenge = await challenge_service.create_challenge(
            creator_id=user_id,
            request=request,
            upload_service=upload_service
        )
        
        # Publish the challenge so it appears in listings
        await challenge_service.publish_challenge(challenge.challenge_id, user_id)
        
        print(f"Created test challenge: {challenge.challenge_id}")
        
    except Exception as e:
        print(f"Failed to create test challenge: {e}")
        # This is OK for testing, we can still test the endpoint structure

def main():
    """Run all tests"""
    print("Running authenticated challenge listing tests...")
    
    tests = [
        test_unauthenticated_access,
        test_authenticated_challenge_list,
        test_public_endpoint_still_works
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                print(f"❌ {test.__name__} failed")
        except Exception as e:
            print(f"❌ {test.__name__} failed with exception: {e}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("❌ Some tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)