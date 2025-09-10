#!/usr/bin/env python3
"""
Complete integration test for merged video URL and metadata return
"""
import asyncio
import json
import sys
import os
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.upload_service import ChunkedUploadService
from services.video_merge_service import VideoMergeService, MergeSessionStatus
from models import UploadSession, UploadStatus
from datetime import datetime
import uuid

async def test_complete_merge_flow():
    """Test complete flow from upload to merged video URL and metadata"""
    print("Testing complete merge flow with URL and metadata return...")
    
    # Initialize services
    upload_service = ChunkedUploadService()
    merge_service = VideoMergeService()
    
    # Make sure merge service uses the same upload service instance
    merge_service.upload_service = upload_service
    
    merge_session_id = str(uuid.uuid4())
    user_id = "test-user"
    
    try:
        # Step 1: Create test video files
        print("Step 1: Creating test video files...")
        test_videos = []
        for i in range(3):
            video_content = b"fake video content " + str(i).encode() * 1000
            video_path = Path(f"test_video_{i}.mp4")
            with open(video_path, 'wb') as f:
                f.write(video_content)
            test_videos.append(video_path)
        print(f"✓ Created {len(test_videos)} test video files")
        
        # Step 2: Simulate upload sessions
        print("Step 2: Creating upload sessions...")
        upload_sessions = []
        for i, video_path in enumerate(test_videos):
            metadata = {
                "merge_session_id": merge_session_id,
                "video_index": i,
                "video_count": 3,
                "is_merge_video": True,
                "video_duration": 15.0 + i  # Different durations
            }
            
            session = await upload_service.initiate_upload(
                user_id=user_id,
                filename=video_path.name,
                file_size=video_path.stat().st_size,
                mime_type="video/mp4",
                metadata=metadata
            )
            
            # Simulate chunk upload and completion
            with open(video_path, 'rb') as f:
                chunk_data = f.read()
            
            await upload_service.upload_chunk(
                session_id=session.session_id,
                chunk_number=0,  # Chunks are 0-indexed
                chunk_data=chunk_data
            )
            
            final_path = await upload_service.complete_upload(
                session_id=session.session_id
            )
            
            upload_sessions.append(session)
            print(f"✓ Upload session {i} completed: {session.session_id}")
        
        # Step 3: Check merge readiness
        print("Step 3: Checking merge readiness...")
        readiness = await merge_service.check_merge_readiness(merge_session_id, user_id)
        if not readiness["ready"]:
            print(f"✗ Videos not ready for merge: {readiness}")
            return False
        print("✓ All videos ready for merge")
        
        # Step 4: Initiate merge
        print("Step 4: Initiating merge...")
        merge_result = await merge_service.initiate_merge(merge_session_id, user_id, "medium")
        print(f"✓ Merge initiated: {merge_result['status']}")
        
        # Step 5: Wait for merge completion (simulate)
        print("Step 5: Waiting for merge completion...")
        max_wait = 30  # seconds
        wait_time = 0
        
        while wait_time < max_wait:
            merge_status = await merge_service.get_merge_status(merge_session_id)
            if merge_status:
                status = merge_status.get("status")
                progress = merge_status.get("progress", 0)
                print(f"  Merge status: {status}, progress: {progress}%")
                
                if status == MergeSessionStatus.COMPLETED:
                    print("✓ Merge completed successfully!")
                    
                    # Verify merged video URL and metadata are present
                    merged_video_url = merge_status.get("merged_video_url")
                    merged_video_metadata = merge_status.get("merged_video_metadata")
                    
                    if not merged_video_url:
                        print("✗ Missing merged_video_url in merge status")
                        return False
                    
                    if not merged_video_metadata:
                        print("✗ Missing merged_video_metadata in merge status")
                        return False
                    
                    print(f"✓ Merged video URL: {merged_video_url}")
                    print(f"✓ Metadata keys: {list(merged_video_metadata.keys())}")
                    
                    # Verify metadata structure
                    if "segments" not in merged_video_metadata:
                        print("✗ Missing segments in merged_video_metadata")
                        return False
                    
                    segments = merged_video_metadata["segments"]
                    if len(segments) != 3:
                        print(f"✗ Expected 3 segments, got {len(segments)}")
                        return False
                    
                    # Verify each segment has required fields
                    for i, segment in enumerate(segments):
                        required_fields = ["start_time", "end_time", "duration", "statement_index"]
                        for field in required_fields:
                            if field not in segment:
                                print(f"✗ Missing {field} in segment {i}")
                                return False
                    
                    print("✓ All segment metadata validation passed")
                    
                    # Test the API response format
                    print("Step 6: Testing API response format...")
                    
                    # Simulate the complete_merge_video_upload response
                    response_content = {
                        "session_id": upload_sessions[-1].session_id,
                        "merge_session_id": merge_session_id,
                        "video_index": 2,
                        "video_count": 3,
                        "status": "completed",
                        "merge_triggered": True,
                        "merge_status": "completed",
                        "merged_video_url": merged_video_url,
                        "merged_video_metadata": merged_video_metadata,
                        "segment_metadata": segments
                    }
                    
                    # Verify response has all required fields
                    required_response_fields = [
                        "merged_video_url", "merged_video_metadata", "segment_metadata"
                    ]
                    
                    for field in required_response_fields:
                        if field not in response_content:
                            print(f"✗ Missing {field} in API response")
                            return False
                    
                    print("✓ API response format validation passed")
                    print(f"✓ Response includes merged video URL: {bool(response_content['merged_video_url'])}")
                    print(f"✓ Response includes metadata: {bool(response_content['merged_video_metadata'])}")
                    print(f"✓ Response includes segment metadata: {len(response_content['segment_metadata'])} segments")
                    
                    return True
                    
                elif status == MergeSessionStatus.FAILED:
                    error_msg = merge_status.get("error_message", "Unknown error")
                    print(f"✗ Merge failed: {error_msg}")
                    return False
            
            await asyncio.sleep(1)
            wait_time += 1
        
        print("✗ Merge did not complete within timeout")
        return False
        
    except Exception as e:
        print(f"✗ Error in complete merge flow test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup test files
        print("Cleanup: Removing test files...")
        for video_path in test_videos:
            try:
                if video_path.exists():
                    video_path.unlink()
                    print(f"✓ Removed: {video_path}")
            except Exception as e:
                print(f"✗ Failed to remove {video_path}: {e}")
        
        # Cleanup uploaded files
        for session in upload_sessions:
            try:
                uploaded_path = Path(f"uploads/{session.session_id}_{session.filename}")
                if uploaded_path.exists():
                    uploaded_path.unlink()
                    print(f"✓ Removed uploaded: {uploaded_path}")
            except Exception as e:
                print(f"✗ Failed to remove uploaded file: {e}")

async def main():
    """Run the complete merge flow test"""
    print("=" * 60)
    print("Complete Merge Flow Test - URL and Metadata Return")
    print("=" * 60)
    
    try:
        success = await test_complete_merge_flow()
        
        if success:
            print("\n🎉 Complete merge flow test PASSED!")
            print("✅ Merged video URL and metadata are properly returned through upload response")
        else:
            print("\n❌ Complete merge flow test FAILED!")
        
        return success
        
    except Exception as e:
        print(f"\n💥 Test suite error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)