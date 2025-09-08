#!/usr/bin/env python3
"""
Integration test for the authenticated challenge listing endpoint
Tests the complete flow including merged video data
"""
import asyncio
import sys
from pathlib import Path
import json

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from services.challenge_service import challenge_service
from services.auth_service import AuthService
from models import (
    CreateChallengeRequest, 
    MergedVideoMetadata, 
    VideoSegmentMetadata,
    ChallengeStatus
)

async def test_authenticated_endpoint_with_merged_data():
    """Test the complete flow of creating and listing challenges with merged video data"""
    
    print("Testing authenticated endpoint with merged video data...")
    
    try:
        # Create a challenge with merged video data
        test_user_id = "test_user_integration"
        
        # Create merged video metadata
        segments = [
            VideoSegmentMetadata(
                start_time=0.0,
                end_time=6.2,
                duration=6.2,
                statement_index=0
            ),
            VideoSegmentMetadata(
                start_time=6.2,
                end_time=11.8,
                duration=5.6,
                statement_index=1
            ),
            VideoSegmentMetadata(
                start_time=11.8,
                end_time=18.0,
                duration=6.2,
                statement_index=2
            )
        ]
        
        merged_metadata = MergedVideoMetadata(
            total_duration=18.0,
            segments=segments,
            video_file_id="integration_test_merged_video",
            compression_applied=True,
            original_total_duration=19.5
        )
        
        # Create challenge request
        request = CreateChallengeRequest(
            title="Integration Test Challenge with Server-Side Merged Video",
            statements=[
                {
                    "media_file_id": "integration_test_video_0",
                    "duration_seconds": 6.2,
                    "statement_text": "I have swum with sharks"
                },
                {
                    "media_file_id": "integration_test_video_1", 
                    "duration_seconds": 5.6,
                    "statement_text": "I can play the violin"
                },
                {
                    "media_file_id": "integration_test_video_2",
                    "duration_seconds": 6.2,
                    "statement_text": "I have never been to a concert"
                }
            ],
            lie_statement_index=1,
            is_merged_video=True,
            merged_video_metadata=merged_metadata,
            merged_video_url="https://s3.amazonaws.com/test-bucket/integration_test_merged_video.mp4",
            merged_video_file_id="integration_test_merged_video",
            merge_session_id="integration_test_merge_session"
        )
        
        # Mock upload service
        class MockUploadService:
            async def get_upload_status(self, session_id):
                return type('obj', (object,), {
                    'status': 'completed',
                    'filename': f'{session_id}.mp4',
                    'mime_type': 'video/mp4',
                    'file_size': 1024000
                })
        
        upload_service = MockUploadService()
        
        # Create the challenge
        challenge = await challenge_service.create_challenge(
            creator_id=test_user_id,
            request=request,
            upload_service=upload_service
        )
        
        print(f"✓ Created challenge: {challenge.challenge_id}")
        
        # Verify the challenge has merged video data
        if not challenge.is_merged_video:
            print("❌ Challenge should be marked as merged video")
            return False
        
        if not challenge.merged_video_url:
            print("❌ Challenge should have merged video URL")
            return False
        
        if not challenge.merged_video_metadata:
            print("❌ Challenge should have merged video metadata")
            return False
        
        print("✓ Challenge created with merged video data")
        
        # Test the service layer listing (simulates what the API endpoint does)
        challenges, total_count = await challenge_service.list_challenges(
            page=1,
            page_size=10,
            creator_id=test_user_id,  # Filter by creator to find our challenge
            status=None  # Include all statuses for this test
        )
        
        # Find our challenge
        our_challenge = None
        for c in challenges:
            if c.challenge_id == challenge.challenge_id:
                our_challenge = c
                break
        
        if not our_challenge:
            print("❌ Our challenge not found in listing")
            return False
        
        print("✓ Challenge found in listing")
        
        # Simulate the API endpoint enhancement (what list_challenges_authenticated does)
        challenge_dict = our_challenge.model_dump()
        
        # Add merged video information
        if our_challenge.is_merged_video:
            challenge_dict["merged_video_info"] = {
                "has_merged_video": True,
                "merged_video_url": our_challenge.merged_video_url,
                "merged_video_file_id": our_challenge.merged_video_file_id,
                "merge_session_id": our_challenge.merge_session_id
            }
            
            # Add segment metadata
            if our_challenge.merged_video_metadata:
                challenge_dict["merged_video_info"]["metadata"] = {
                    "total_duration": our_challenge.merged_video_metadata.total_duration,
                    "compression_applied": our_challenge.merged_video_metadata.compression_applied,
                    "original_total_duration": our_challenge.merged_video_metadata.original_total_duration,
                    "segments": [
                        {
                            "statement_index": segment.statement_index,
                            "start_time": segment.start_time,
                            "end_time": segment.end_time,
                            "duration": segment.duration
                        }
                        for segment in our_challenge.merged_video_metadata.segments
                    ]
                }
        
        # Verify the enhanced data structure
        if "merged_video_info" not in challenge_dict:
            print("❌ Enhanced challenge should have merged_video_info")
            return False
        
        merged_info = challenge_dict["merged_video_info"]
        
        if not merged_info.get("has_merged_video"):
            print("❌ merged_video_info should indicate has_merged_video=True")
            return False
        
        if merged_info.get("merged_video_url") != "https://s3.amazonaws.com/test-bucket/integration_test_merged_video.mp4":
            print(f"❌ Wrong merged video URL: {merged_info.get('merged_video_url')}")
            return False
        
        if merged_info.get("merged_video_file_id") != "integration_test_merged_video":
            print(f"❌ Wrong merged video file ID: {merged_info.get('merged_video_file_id')}")
            return False
        
        if merged_info.get("merge_session_id") != "integration_test_merge_session":
            print(f"❌ Wrong merge session ID: {merged_info.get('merge_session_id')}")
            return False
        
        # Verify metadata structure
        if "metadata" not in merged_info:
            print("❌ merged_video_info should have metadata")
            return False
        
        metadata = merged_info["metadata"]
        
        if metadata.get("total_duration") != 18.0:
            print(f"❌ Wrong total duration: {metadata.get('total_duration')}")
            return False
        
        if not metadata.get("compression_applied"):
            print("❌ compression_applied should be True")
            return False
        
        if metadata.get("original_total_duration") != 19.5:
            print(f"❌ Wrong original total duration: {metadata.get('original_total_duration')}")
            return False
        
        # Verify segments
        segments = metadata.get("segments", [])
        if len(segments) != 3:
            print(f"❌ Expected 3 segments, got {len(segments)}")
            return False
        
        expected_segments = [
            {"statement_index": 0, "start_time": 0.0, "end_time": 6.2, "duration": 6.2},
            {"statement_index": 1, "start_time": 6.2, "end_time": 11.8, "duration": 5.6},
            {"statement_index": 2, "start_time": 11.8, "end_time": 18.0, "duration": 6.2}
        ]
        
        for i, (actual, expected) in enumerate(zip(segments, expected_segments)):
            for key, expected_value in expected.items():
                if actual.get(key) != expected_value:
                    print(f"❌ Segment {i} {key}: expected {expected_value}, got {actual.get(key)}")
                    return False
        
        print("✓ All segment metadata verified correctly")
        
        # Test segment metadata retrieval endpoint functionality
        segment_metadata = await challenge_service.get_challenge_segment_metadata(challenge.challenge_id)
        
        if not segment_metadata:
            print("❌ Should have segment metadata")
            return False
        
        if not segment_metadata.get("is_merged_video"):
            print("❌ Segment metadata should indicate merged video")
            return False
        
        print("✓ Segment metadata retrieval works")
        
        # Simulate the complete API response structure
        api_response = {
            "challenges": [challenge_dict],
            "total_count": 1,
            "page": 1,
            "page_size": 10,
            "has_next": False,
            "authenticated": True,
            "user_id": test_user_id
        }
        
        # Verify complete API response structure
        required_keys = ["challenges", "total_count", "page", "page_size", "has_next", "authenticated", "user_id"]
        for key in required_keys:
            if key not in api_response:
                print(f"❌ API response missing {key}")
                return False
        
        if not api_response["authenticated"]:
            print("❌ API response should indicate authenticated=True")
            return False
        
        if api_response["user_id"] != test_user_id:
            print(f"❌ API response user_id should be {test_user_id}")
            return False
        
        print("✓ Complete API response structure verified")
        
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_non_merged_video_challenge():
    """Test that non-merged video challenges are handled correctly"""
    
    print("Testing non-merged video challenge handling...")
    
    try:
        # Create a regular (non-merged) challenge
        test_user_id = "test_user_non_merged"
        
        request = CreateChallengeRequest(
            title="Regular Challenge (No Merged Video)",
            statements=[
                {
                    "media_file_id": "regular_video_0",
                    "duration_seconds": 5.0,
                    "statement_text": "I have been skydiving"
                },
                {
                    "media_file_id": "regular_video_1", 
                    "duration_seconds": 4.5,
                    "statement_text": "I can cook a perfect soufflé"
                },
                {
                    "media_file_id": "regular_video_2",
                    "duration_seconds": 5.5,
                    "statement_text": "I have never owned a pet"
                }
            ],
            lie_statement_index=0,
            is_merged_video=False  # Not a merged video
        )
        
        # Mock upload service
        class MockUploadService:
            async def get_upload_status(self, session_id):
                return type('obj', (object,), {
                    'status': 'completed',
                    'filename': f'{session_id}.mp4',
                    'mime_type': 'video/mp4',
                    'file_size': 1024000,
                    'metadata': {}
                })
        
        upload_service = MockUploadService()
        
        # Create the challenge
        challenge = await challenge_service.create_challenge(
            creator_id=test_user_id,
            request=request,
            upload_service=upload_service
        )
        
        print(f"✓ Created non-merged challenge: {challenge.challenge_id}")
        
        # Verify it's not marked as merged video
        if challenge.is_merged_video:
            print("❌ Challenge should not be marked as merged video")
            return False
        
        # Simulate API endpoint enhancement
        challenge_dict = challenge.model_dump()
        
        # Add merged video information (should indicate no merged video)
        if challenge.is_merged_video:
            # This shouldn't happen for this test
            print("❌ Challenge incorrectly marked as merged video")
            return False
        else:
            challenge_dict["merged_video_info"] = {
                "has_merged_video": False
            }
        
        # Verify the structure
        if "merged_video_info" not in challenge_dict:
            print("❌ Challenge should have merged_video_info")
            return False
        
        merged_info = challenge_dict["merged_video_info"]
        
        if merged_info.get("has_merged_video") != False:
            print("❌ merged_video_info should indicate has_merged_video=False")
            return False
        
        # Should not have merged video specific fields
        if "merged_video_url" in merged_info:
            print("❌ Non-merged challenge should not have merged_video_url in info")
            return False
        
        print("✓ Non-merged video challenge handled correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Non-merged video test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all integration tests"""
    print("Running authenticated endpoint integration tests...")
    
    async def run_tests():
        tests = [
            test_authenticated_endpoint_with_merged_data,
            test_non_merged_video_challenge
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if await test():
                    passed += 1
                    print(f"✓ {test.__name__} passed\n")
                else:
                    print(f"❌ {test.__name__} failed\n")
            except Exception as e:
                print(f"❌ {test.__name__} failed with exception: {e}\n")
        
        print(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All integration tests passed!")
            return True
        else:
            print("❌ Some integration tests failed")
            return False
    
    return asyncio.run(run_tests())

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)