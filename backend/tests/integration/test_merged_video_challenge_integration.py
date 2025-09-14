#!/usr/bin/env python3
"""
Integration test for merged video challenge creation flow
Tests the complete flow from video merge completion to challenge creation
"""
import asyncio
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models import (
    CreateChallengeRequest, 
    MergedVideoMetadata, 
    VideoSegmentMetadata,
    Challenge
)
from services.challenge_service import challenge_service
from services.upload_service import ChunkedUploadService

async def test_complete_merged_video_challenge_flow():
    """Test the complete flow from merge completion to challenge creation"""
    
    print("Testing complete merged video challenge creation flow...")
    
    # Simulate the response from a completed video merge
    # This would typically come from the challenge video endpoints
    merge_completion_response = {
        "merge_session_id": "merge_session_789",
        "status": "completed",
        "merged_video_url": "https://s3.amazonaws.com/bucket/merged_videos/merge_session_789.mp4",
        "merged_video_metadata": {
            "total_duration": 18.3,
            "segments": [
                {
                    "start_time": 0.0,
                    "end_time": 6.1,
                    "duration": 6.1,
                    "statement_index": 0
                },
                {
                    "start_time": 6.1,
                    "end_time": 12.4,
                    "duration": 6.3,
                    "statement_index": 1
                },
                {
                    "start_time": 12.4,
                    "end_time": 18.3,
                    "duration": 5.9,
                    "statement_index": 2
                }
            ],
            "video_file_id": "merged_video_789",
            "compression_applied": True,
            "original_total_duration": 19.1
        }
    }
    
    # Convert the merge response to our model format
    segments = []
    for seg_data in merge_completion_response["merged_video_metadata"]["segments"]:
        segment = VideoSegmentMetadata(
            start_time=seg_data["start_time"],
            end_time=seg_data["end_time"],
            duration=seg_data["duration"],
            statement_index=seg_data["statement_index"]
        )
        segments.append(segment)
    
    merged_metadata = MergedVideoMetadata(
        total_duration=merge_completion_response["merged_video_metadata"]["total_duration"],
        segments=segments,
        video_file_id=merge_completion_response["merged_video_metadata"]["video_file_id"],
        compression_applied=merge_completion_response["merged_video_metadata"]["compression_applied"],
        original_total_duration=merge_completion_response["merged_video_metadata"]["original_total_duration"]
    )
    
    # Create challenge request using the merged video data
    request = CreateChallengeRequest(
        title="My Travel Stories Challenge",
        statements=[
            {
                "media_file_id": "original_video_0",  # Original individual video IDs for reference
                "duration_seconds": 6.1,
                "statement_text": "I have climbed Mount Everest"
            },
            {
                "media_file_id": "original_video_1",
                "duration_seconds": 6.3,
                "statement_text": "I speak fluent Mandarin"
            },
            {
                "media_file_id": "original_video_2",
                "duration_seconds": 5.9,
                "statement_text": "I have never been on an airplane"
            }
        ],
        lie_statement_index=2,  # "Never been on an airplane" is the lie
        tags=["travel", "adventure", "languages"],
        is_merged_video=True,
        merged_video_metadata=merged_metadata,
        merged_video_url=merge_completion_response["merged_video_url"],
        merged_video_file_id=merge_completion_response["merged_video_metadata"]["video_file_id"],
        merge_session_id=merge_completion_response["merge_session_id"]
    )
    
    try:
        # Create the challenge
        upload_service = ChunkedUploadService()
        challenge = await challenge_service.create_challenge(
            creator_id="user_travel_enthusiast",
            request=request,
            upload_service=upload_service
        )
        
        print(f"✓ Challenge created successfully: {challenge.challenge_id}")
        print(f"  - Title: {challenge.title}")
        print(f"  - Creator: {challenge.creator_id}")
        print(f"  - Status: {challenge.status}")
        print(f"  - Is merged video: {challenge.is_merged_video}")
        print(f"  - Merged video URL: {challenge.merged_video_url}")
        print(f"  - Merge session ID: {challenge.merge_session_id}")
        
        # Verify all statements reference the same merged video
        unique_urls = set(stmt.media_url for stmt in challenge.statements)
        if len(unique_urls) == 1 and challenge.merged_video_url in unique_urls:
            print("✓ All statements correctly reference the merged video")
        else:
            print(f"✗ Statement URLs inconsistent: {unique_urls}")
            return False
        
        # Verify segment metadata is properly stored
        total_segment_duration = sum(stmt.duration_seconds for stmt in challenge.statements)
        expected_duration = merged_metadata.total_duration
        
        if abs(total_segment_duration - expected_duration) < 0.1:
            print(f"✓ Segment durations match total duration: {total_segment_duration}s")
        else:
            print(f"✗ Duration mismatch: segments={total_segment_duration}s, total={expected_duration}s")
            return False
        
        # Test segment metadata retrieval for playback
        segment_data = await challenge_service.get_challenge_segment_metadata(challenge.challenge_id)
        if segment_data:
            print("✓ Segment metadata retrieved for playback:")
            print(f"  - Total duration: {segment_data['total_duration']}s")
            print(f"  - Segments: {len(segment_data['segments'])}")
            
            for i, segment in enumerate(segment_data['segments']):
                stmt_type = segment['statement_type']
                start = segment['start_time']
                end = segment['end_time']
                print(f"    {i}: {stmt_type} ({start}s - {end}s)")
        else:
            print("✗ Failed to retrieve segment metadata")
            return False
        
        # Test challenge listing includes merged video info
        challenges, total = await challenge_service.list_challenges(
            creator_id="user_travel_enthusiast",
            page=1,
            page_size=10
        )
        
        found_challenge = None
        for c in challenges:
            if c.challenge_id == challenge.challenge_id:
                found_challenge = c
                break
        
        if found_challenge and found_challenge.is_merged_video:
            print("✓ Challenge appears in listings with merged video flag")
        else:
            print("✗ Challenge not found in listings or missing merged video flag")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ Integration test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_backward_compatibility():
    """Test that existing non-merged video challenges still work"""
    
    print("\nTesting backward compatibility with non-merged videos...")
    
    # This would be a traditional challenge creation request
    # (though it will fail due to missing upload sessions in this test environment)
    request = CreateChallengeRequest(
        title="Traditional Challenge",
        statements=[
            {
                "media_file_id": "individual_video_1",
                "duration_seconds": 5.0,
                "statement_text": "I love pizza"
            },
            {
                "media_file_id": "individual_video_2", 
                "duration_seconds": 4.5,
                "statement_text": "I have a pet cat"
            },
            {
                "media_file_id": "individual_video_3",
                "duration_seconds": 6.0,
                "statement_text": "I can juggle"
            }
        ],
        lie_statement_index=1,
        is_merged_video=False  # Traditional individual videos
    )
    
    try:
        upload_service = ChunkedUploadService()
        challenge = await challenge_service.create_challenge(
            creator_id="traditional_user",
            request=request,
            upload_service=upload_service
        )
        
        # This should not reach here in test environment due to missing uploads
        print("✗ Unexpected success - should have failed due to missing upload sessions")
        return False
        
    except Exception as e:
        # Expected to fail due to missing upload sessions
        if "Upload session" in str(e) and "not found" in str(e):
            print("✓ Traditional challenge validation correctly requires upload sessions")
            return True
        else:
            print(f"✗ Unexpected error: {str(e)}")
            return False

async def main():
    """Run integration tests"""
    print("=" * 70)
    print("Merged Video Challenge Integration Test Suite")
    print("=" * 70)
    
    success = True
    
    # Test complete merged video flow
    if not await test_complete_merged_video_challenge_flow():
        success = False
    
    # Test backward compatibility
    if not await test_backward_compatibility():
        success = False
    
    print("\n" + "=" * 70)
    if success:
        print("✓ All integration tests passed!")
        print("The challenge creation endpoint successfully accepts merged video URL and segment metadata.")
    else:
        print("✗ Some integration tests failed!")
    print("=" * 70)
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)