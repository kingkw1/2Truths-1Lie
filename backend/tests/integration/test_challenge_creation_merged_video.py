#!/usr/bin/env python3
"""
Test script for challenge creation with merged video URL and segment metadata
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

async def test_challenge_creation_with_merged_video():
    """Test creating a challenge with server-side merged video URL and metadata"""
    
    print("Testing challenge creation with merged video URL and segment metadata...")
    
    # Create test segment metadata
    segments = [
        VideoSegmentMetadata(
            start_time=0.0,
            end_time=5.2,
            duration=5.2,
            statement_index=0
        ),
        VideoSegmentMetadata(
            start_time=5.2,
            end_time=10.8,
            duration=5.6,
            statement_index=1
        ),
        VideoSegmentMetadata(
            start_time=10.8,
            end_time=16.5,
            duration=5.7,
            statement_index=2
        )
    ]
    
    # Create merged video metadata
    merged_metadata = MergedVideoMetadata(
        total_duration=16.5,
        segments=segments,
        video_file_id="merged_video_123",
        compression_applied=True,
        original_total_duration=17.2
    )
    
    # Create challenge request with merged video data
    request = CreateChallengeRequest(
        title="Test Challenge with Merged Video",
        statements=[
            {
                "media_file_id": "statement_0",
                "duration_seconds": 5.2,
                "statement_text": "I have been to Paris"
            },
            {
                "media_file_id": "statement_1", 
                "duration_seconds": 5.6,
                "statement_text": "I can speak three languages"
            },
            {
                "media_file_id": "statement_2",
                "duration_seconds": 5.7,
                "statement_text": "I have never broken a bone"
            }
        ],
        lie_statement_index=1,
        tags=["travel", "languages", "health"],
        is_merged_video=True,
        merged_video_metadata=merged_metadata,
        merged_video_url="https://cdn.example.com/merged_videos/merged_video_123.mp4",
        merged_video_file_id="merged_video_123",
        merge_session_id="merge_session_456"
    )
    
    try:
        # Mock upload service to avoid actual file operations
        upload_service = ChunkedUploadService()
        
        # Create the challenge
        challenge = await challenge_service.create_challenge(
            creator_id="test_user_123",
            request=request,
            upload_service=upload_service
        )
        
        print(f"✓ Challenge created successfully: {challenge.challenge_id}")
        print(f"  - Title: {challenge.title}")
        print(f"  - Is merged video: {challenge.is_merged_video}")
        print(f"  - Merged video URL: {challenge.merged_video_url}")
        print(f"  - Merge session ID: {challenge.merge_session_id}")
        print(f"  - Number of statements: {len(challenge.statements)}")
        
        # Verify merged video metadata
        if challenge.merged_video_metadata:
            print(f"  - Total duration: {challenge.merged_video_metadata.total_duration}s")
            print(f"  - Number of segments: {len(challenge.merged_video_metadata.segments)}")
            
            for i, segment in enumerate(challenge.merged_video_metadata.segments):
                print(f"    Segment {i}: {segment.start_time}s - {segment.end_time}s ({segment.duration}s)")
        
        # Verify statements reference the merged video
        for i, statement in enumerate(challenge.statements):
            print(f"  - Statement {i}:")
            print(f"    - Type: {statement.statement_type}")
            print(f"    - Media URL: {statement.media_url}")
            print(f"    - Duration: {statement.duration_seconds}s")
            if statement.segment_metadata:
                print(f"    - Segment: {statement.segment_metadata.start_time}s - {statement.segment_metadata.end_time}s")
        
        # Test segment metadata retrieval
        segment_metadata = await challenge_service.get_challenge_segment_metadata(challenge.challenge_id)
        if segment_metadata:
            print(f"✓ Segment metadata retrieved successfully")
            print(f"  - Total duration: {segment_metadata.get('total_duration')}s")
            print(f"  - Number of segments: {len(segment_metadata.get('segments', []))}")
        else:
            print("✗ Failed to retrieve segment metadata")
        
        return True
        
    except Exception as e:
        print(f"✗ Challenge creation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_challenge_creation_validation():
    """Test validation of merged video challenge creation"""
    
    print("\nTesting merged video challenge validation...")
    
    # Test missing segment metadata
    try:
        request = CreateChallengeRequest(
            title="Invalid Challenge - Missing Metadata",
            statements=[
                {"media_file_id": "stmt_0", "duration_seconds": 5.0},
                {"media_file_id": "stmt_1", "duration_seconds": 5.0},
                {"media_file_id": "stmt_2", "duration_seconds": 5.0}
            ],
            lie_statement_index=0,
            is_merged_video=True,
            merged_video_url="https://example.com/video.mp4",
            # Missing merged_video_metadata
        )
        
        upload_service = ChunkedUploadService()
        challenge = await challenge_service.create_challenge(
            creator_id="test_user",
            request=request,
            upload_service=upload_service
        )
        
        print("✗ Should have failed validation for missing metadata")
        return False
        
    except Exception as e:
        print(f"✓ Correctly rejected invalid request: {str(e)}")
    
    # Test invalid segment indices
    try:
        segments = [
            VideoSegmentMetadata(start_time=0.0, end_time=5.0, duration=5.0, statement_index=0),
            VideoSegmentMetadata(start_time=5.0, end_time=10.0, duration=5.0, statement_index=1),
            VideoSegmentMetadata(start_time=10.0, end_time=15.0, duration=5.0, statement_index=3)  # Invalid index
        ]
        
        merged_metadata = MergedVideoMetadata(
            total_duration=15.0,
            segments=segments,
            video_file_id="test_video"
        )
        
        request = CreateChallengeRequest(
            title="Invalid Challenge - Bad Segment Index",
            statements=[
                {"media_file_id": "stmt_0", "duration_seconds": 5.0},
                {"media_file_id": "stmt_1", "duration_seconds": 5.0},
                {"media_file_id": "stmt_2", "duration_seconds": 5.0}
            ],
            lie_statement_index=0,
            is_merged_video=True,
            merged_video_metadata=merged_metadata,
            merged_video_url="https://example.com/video.mp4"
        )
        
        upload_service = ChunkedUploadService()
        challenge = await challenge_service.create_challenge(
            creator_id="test_user",
            request=request,
            upload_service=upload_service
        )
        
        print("✗ Should have failed validation for invalid segment index")
        return False
        
    except Exception as e:
        print(f"✓ Correctly rejected invalid segment indices: {str(e)}")
    
    return True

async def main():
    """Run all tests"""
    print("=" * 60)
    print("Challenge Creation with Merged Video - Test Suite")
    print("=" * 60)
    
    success = True
    
    # Test basic merged video challenge creation
    if not await test_challenge_creation_with_merged_video():
        success = False
    
    # Test validation
    if not await test_challenge_creation_validation():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed!")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)