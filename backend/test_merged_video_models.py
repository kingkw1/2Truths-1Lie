#!/usr/bin/env python3
"""
Test script for merged video models and validation
"""
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

def test_merged_video_models():
    """Test that the merged video models work correctly"""
    
    print("Testing merged video models...")
    
    try:
        # Test VideoSegmentMetadata
        segment = VideoSegmentMetadata(
            start_time=0.0,
            end_time=5.5,
            duration=5.5,
            statement_index=0
        )
        print(f"✓ VideoSegmentMetadata created: {segment.start_time}s - {segment.end_time}s")
        
        # Test MergedVideoMetadata
        segments = [
            VideoSegmentMetadata(start_time=0.0, end_time=5.0, duration=5.0, statement_index=0),
            VideoSegmentMetadata(start_time=5.0, end_time=10.0, duration=5.0, statement_index=1),
            VideoSegmentMetadata(start_time=10.0, end_time=15.0, duration=5.0, statement_index=2)
        ]
        
        merged_metadata = MergedVideoMetadata(
            total_duration=15.0,
            segments=segments,
            video_file_id="test_merged_video",
            compression_applied=True
        )
        print(f"✓ MergedVideoMetadata created with {len(merged_metadata.segments)} segments")
        
        # Test CreateChallengeRequest with merged video fields
        request = CreateChallengeRequest(
            title="Test Merged Video Challenge",
            statements=[
                {"media_file_id": "vid1", "duration_seconds": 5.0},
                {"media_file_id": "vid2", "duration_seconds": 5.0},
                {"media_file_id": "vid3", "duration_seconds": 5.0}
            ],
            lie_statement_index=1,
            is_merged_video=True,
            merged_video_metadata=merged_metadata,
            merged_video_url="https://example.com/merged.mp4",
            merged_video_file_id="test_merged_video",
            merge_session_id="test_session"
        )
        print("✓ CreateChallengeRequest created with merged video fields")
        print(f"  - Merged video URL: {request.merged_video_url}")
        print(f"  - Merge session ID: {request.merge_session_id}")
        print(f"  - Total duration: {request.merged_video_metadata.total_duration}s")
        
        return True
        
    except Exception as e:
        print(f"✗ Model test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_model_validation():
    """Test model validation for merged video data"""
    
    print("\nTesting model validation...")
    
    # Test invalid segment metadata (end_time <= start_time)
    try:
        invalid_segment = VideoSegmentMetadata(
            start_time=5.0,
            end_time=3.0,  # Invalid: end < start
            duration=2.0,
            statement_index=0
        )
        print("✗ Should have failed validation for invalid segment times")
        return False
    except Exception as e:
        print(f"✓ Correctly rejected invalid segment times: {type(e).__name__}")
    
    # Test invalid statement index
    try:
        invalid_segment = VideoSegmentMetadata(
            start_time=0.0,
            end_time=5.0,
            duration=5.0,
            statement_index=5  # Invalid: should be 0-2
        )
        print("✗ Should have failed validation for invalid statement index")
        return False
    except Exception as e:
        print(f"✓ Correctly rejected invalid statement index: {type(e).__name__}")
    
    # Test duration mismatch
    try:
        invalid_segment = VideoSegmentMetadata(
            start_time=0.0,
            end_time=5.0,
            duration=10.0,  # Invalid: doesn't match end - start
            statement_index=0
        )
        print("✗ Should have failed validation for duration mismatch")
        return False
    except Exception as e:
        print(f"✓ Correctly rejected duration mismatch: {type(e).__name__}")
    
    return True

def test_json_serialization():
    """Test that models can be serialized to/from JSON"""
    
    print("\nTesting JSON serialization...")
    
    try:
        # Create test data
        segments = [
            VideoSegmentMetadata(start_time=0.0, end_time=4.5, duration=4.5, statement_index=0),
            VideoSegmentMetadata(start_time=4.5, end_time=9.2, duration=4.7, statement_index=1),
            VideoSegmentMetadata(start_time=9.2, end_time=14.0, duration=4.8, statement_index=2)
        ]
        
        merged_metadata = MergedVideoMetadata(
            total_duration=14.0,
            segments=segments,
            video_file_id="json_test_video",
            compression_applied=True,
            original_total_duration=15.2
        )
        
        request = CreateChallengeRequest(
            title="JSON Test Challenge",
            statements=[
                {"media_file_id": "json_vid1", "duration_seconds": 4.5},
                {"media_file_id": "json_vid2", "duration_seconds": 4.7},
                {"media_file_id": "json_vid3", "duration_seconds": 4.8}
            ],
            lie_statement_index=2,
            tags=["json", "test"],
            is_merged_video=True,
            merged_video_metadata=merged_metadata,
            merged_video_url="https://cdn.example.com/json_test.mp4",
            merged_video_file_id="json_test_video",
            merge_session_id="json_test_session"
        )
        
        # Test serialization
        json_data = request.model_dump()
        print("✓ Model serialized to JSON successfully")
        print(f"  - Keys: {list(json_data.keys())}")
        
        # Test deserialization
        reconstructed = CreateChallengeRequest(**json_data)
        print("✓ Model deserialized from JSON successfully")
        
        # Verify data integrity
        if (reconstructed.merged_video_url == request.merged_video_url and
            reconstructed.merge_session_id == request.merge_session_id and
            len(reconstructed.merged_video_metadata.segments) == len(request.merged_video_metadata.segments)):
            print("✓ JSON round-trip preserved all data")
        else:
            print("✗ JSON round-trip lost data")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ JSON serialization test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all model tests"""
    print("=" * 60)
    print("Merged Video Models Test Suite")
    print("=" * 60)
    
    success = True
    
    # Test basic model creation
    if not test_merged_video_models():
        success = False
    
    # Test validation
    if not test_model_validation():
        success = False
    
    # Test JSON serialization
    if not test_json_serialization():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✓ All model tests passed!")
        print("Merged video models are working correctly.")
    else:
        print("✗ Some model tests failed!")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)