#!/usr/bin/env python3
"""
Test for authenticated challenge listing service functionality
"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from services.challenge_service import challenge_service
from models import (
    CreateChallengeRequest, 
    MergedVideoMetadata, 
    VideoSegmentMetadata,
    ChallengeStatus
)

async def test_challenge_service_with_merged_video():
    """Test the challenge service with merged video data"""
    
    print("Testing challenge service with merged video data...")
    
    try:
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
            video_file_id="test_merged_video_456",
            compression_applied=True,
            original_total_duration=16.0
        )
        
        # Create challenge request
        request = CreateChallengeRequest(
            title="Service Test Challenge with Merged Video",
            statements=[
                {
                    "media_file_id": "test_video_0",
                    "duration_seconds": 5.0,
                    "statement_text": "I have climbed Mount Everest"
                },
                {
                    "media_file_id": "test_video_1", 
                    "duration_seconds": 5.0,
                    "statement_text": "I can juggle 5 balls"
                },
                {
                    "media_file_id": "test_video_2",
                    "duration_seconds": 5.0,
                    "statement_text": "I have never seen snow"
                }
            ],
            lie_statement_index=2,
            is_merged_video=True,
            merged_video_metadata=merged_metadata,
            merged_video_url="https://example.com/merged_video_456.mp4",
            merged_video_file_id="test_merged_video_456",
            merge_session_id="test_merge_session_456"
        )
        
        # Mock upload service
        class MockUploadService:
            async def get_upload_status(self, session_id):
                return type('obj', (object,), {
                    'status': 'completed',
                    'filename': f'{session_id}.mp4'
                })
        
        upload_service = MockUploadService()
        
        # Create the challenge
        test_user_id = "test_user_service"
        challenge = await challenge_service.create_challenge(
            creator_id=test_user_id,
            request=request,
            upload_service=upload_service
        )
        
        print(f"✓ Created challenge: {challenge.challenge_id}")
        
        # Verify merged video data
        if not challenge.is_merged_video:
            print("❌ Challenge should be marked as merged video")
            return False
        
        if not challenge.merged_video_url:
            print("❌ Challenge should have merged video URL")
            return False
        
        if not challenge.merged_video_metadata:
            print("❌ Challenge should have merged video metadata")
            return False
        
        # Verify segment metadata
        if len(challenge.merged_video_metadata.segments) != 3:
            print(f"❌ Expected 3 segments, got {len(challenge.merged_video_metadata.segments)}")
            return False
        
        # Publish the challenge
        published_challenge = await challenge_service.publish_challenge(challenge.challenge_id, test_user_id)
        print(f"✓ Published challenge: {published_challenge.status}")
        
        # Test listing challenges
        challenges, total_count = await challenge_service.list_challenges(
            page=1,
            page_size=10,
            status=ChallengeStatus.PUBLISHED
        )
        
        print(f"✓ Listed {len(challenges)} challenges (total: {total_count})")
        
        # Find our challenge in the list
        our_challenge = None
        for c in challenges:
            if c.challenge_id == challenge.challenge_id:
                our_challenge = c
                break
        
        if not our_challenge:
            print("❌ Our challenge not found in listing")
            return False
        
        # Verify merged video data in listing
        if not our_challenge.is_merged_video:
            print("❌ Listed challenge should be marked as merged video")
            return False
        
        if not our_challenge.merged_video_url:
            print("❌ Listed challenge should have merged video URL")
            return False
        
        if not our_challenge.merged_video_metadata:
            print("❌ Listed challenge should have merged video metadata")
            return False
        
        print("✓ Challenge listing includes merged video data")
        
        # Test segment metadata retrieval
        segment_metadata = await challenge_service.get_challenge_segment_metadata(challenge.challenge_id)
        
        if not segment_metadata:
            print("❌ Should have segment metadata")
            return False
        
        if not segment_metadata.get("is_merged_video"):
            print("❌ Segment metadata should indicate merged video")
            return False
        
        segments = segment_metadata.get("segments", [])
        if len(segments) != 3:
            print(f"❌ Expected 3 segments in metadata, got {len(segments)}")
            return False
        
        # Verify segment structure
        for i, segment in enumerate(segments):
            required_keys = ["statement_id", "statement_index", "start_time", "end_time", "duration"]
            for key in required_keys:
                if key not in segment:
                    print(f"❌ Segment {i} missing {key}")
                    return False
        
        print("✓ Segment metadata retrieval works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_challenge_listing_filters():
    """Test challenge listing with different filters"""
    
    print("Testing challenge listing filters...")
    
    try:
        # Test listing with different statuses
        published_challenges, published_count = await challenge_service.list_challenges(
            page=1,
            page_size=10,
            status=ChallengeStatus.PUBLISHED
        )
        
        print(f"✓ Found {published_count} published challenges")
        
        # Test listing all challenges (no status filter)
        all_challenges, all_count = await challenge_service.list_challenges(
            page=1,
            page_size=10
        )
        
        print(f"✓ Found {all_count} total challenges")
        
        # Verify that published count <= all count
        if published_count > all_count:
            print("❌ Published count should not exceed total count")
            return False
        
        # Test pagination
        if all_count > 5:
            page1_challenges, _ = await challenge_service.list_challenges(
                page=1,
                page_size=5
            )
            
            page2_challenges, _ = await challenge_service.list_challenges(
                page=2,
                page_size=5
            )
            
            if len(page1_challenges) > 5:
                print("❌ Page 1 should have at most 5 challenges")
                return False
            
            # Verify no overlap between pages
            page1_ids = {c.challenge_id for c in page1_challenges}
            page2_ids = {c.challenge_id for c in page2_challenges}
            
            if page1_ids & page2_ids:
                print("❌ Pages should not have overlapping challenges")
                return False
            
            print("✓ Pagination works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Filter test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("Running challenge service tests for merged video functionality...")
    
    async def run_tests():
        tests = [
            test_challenge_service_with_merged_video,
            test_challenge_listing_filters
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if await test():
                    passed += 1
                    print(f"✓ {test.__name__} passed")
                else:
                    print(f"❌ {test.__name__} failed")
            except Exception as e:
                print(f"❌ {test.__name__} failed with exception: {e}")
        
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All service tests passed!")
            return True
        else:
            print("❌ Some service tests failed")
            return False
    
    return asyncio.run(run_tests())

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)