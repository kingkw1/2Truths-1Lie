#!/usr/bin/env python3
"""
Integration test for video upload and merge workflow
"""
import asyncio
import tempfile
import json
from pathlib import Path
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.upload_service import ChunkedUploadService
from services.video_merge_service import VideoMergeService
from models import UploadStatus

async def create_test_video_data(size_kb: int = 100) -> bytes:
    """Create test video data (mock MP4 header + random data)"""
    # Simple MP4 header (ftyp box)
    mp4_header = bytes([
        0x00, 0x00, 0x00, 0x20,  # box size
        0x66, 0x74, 0x79, 0x70,  # 'ftyp'
        0x69, 0x73, 0x6F, 0x6D,  # 'isom'
        0x00, 0x00, 0x02, 0x00,  # minor version
        0x69, 0x73, 0x6F, 0x6D,  # compatible brands
        0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31,
        0x6D, 0x70, 0x34, 0x31
    ])
    
    # Add random data to reach desired size
    remaining_size = (size_kb * 1024) - len(mp4_header)
    random_data = bytes(range(256)) * (remaining_size // 256 + 1)
    
    return mp4_header + random_data[:remaining_size]

async def test_upload_and_merge_integration():
    """Test the complete upload and merge workflow"""
    print("Testing Upload and Merge Integration...")
    
    # Initialize services with fresh state
    upload_service = ChunkedUploadService()
    upload_service.sessions = {}  # Clear any existing sessions
    merge_service = VideoMergeService()
    merge_service.upload_service = upload_service
    
    user_id = "test_user_123"
    merge_session_id = "test_merge_session_456"
    
    try:
        # Step 1: Initiate uploads for 3 videos
        print("Step 1: Initiating video uploads...")
        
        upload_sessions = []
        video_data = []
        
        for i in range(3):
            # Create test video data
            test_data = await create_test_video_data(50)  # 50KB test videos
            video_data.append(test_data)
            
            # Initiate upload session
            session = await upload_service.initiate_upload(
                user_id=user_id,
                filename=f"test_video_{i}.mp4",
                file_size=len(test_data),
                mime_type="video/mp4",
                metadata={
                    "merge_session_id": merge_session_id,
                    "video_index": i,
                    "video_count": 3,
                    "is_merge_video": True,
                    "video_duration": 5.0
                }
            )
            
            upload_sessions.append(session)
            print(f"  ✓ Upload session {i} initiated: {session.session_id}")
        
        # Step 2: Upload video data in chunks
        print("Step 2: Uploading video chunks...")
        
        for i, (session, data) in enumerate(zip(upload_sessions, video_data)):
            # Upload in chunks
            chunk_size = session.chunk_size
            total_chunks = session.total_chunks
            
            for chunk_num in range(total_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, len(data))
                chunk_data = data[start:end]
                
                updated_session, was_uploaded = await upload_service.upload_chunk(
                    session_id=session.session_id,
                    chunk_number=chunk_num,
                    chunk_data=chunk_data
                )
                
                if not was_uploaded:
                    print(f"  ! Chunk {chunk_num} for video {i} was already uploaded")
            
            print(f"  ✓ Video {i} chunks uploaded ({total_chunks} chunks)")
        
        # Step 3: Complete uploads
        print("Step 3: Completing uploads...")
        
        completed_paths = []
        for i, session in enumerate(upload_sessions):
            final_path = await upload_service.complete_upload(session.session_id)
            completed_paths.append(final_path)
            print(f"  ✓ Video {i} upload completed: {final_path}")
        
        # Step 4: Check merge readiness
        print("Step 4: Checking merge readiness...")
        

        readiness = await merge_service.check_merge_readiness(merge_session_id, user_id)
        
        if not readiness["ready"]:
            print(f"  ✗ Videos not ready for merge: {readiness}")
            return False
        
        print(f"  ✓ All {readiness['videos_completed']} videos ready for merge")
        
        # Step 5: Test merge status tracking
        print("Step 5: Testing merge status...")
        
        # Should not exist initially
        initial_status = await merge_service.get_merge_status(merge_session_id)
        if initial_status is not None:
            print(f"  ! Merge session already exists: {initial_status}")
        
        # Step 6: Initiate merge (but don't wait for completion in this test)
        print("Step 6: Initiating merge...")
        
        merge_result = await merge_service.initiate_merge(merge_session_id, user_id)
        
        if merge_result["status"] != "pending":
            print(f"  ✗ Expected pending status, got: {merge_result['status']}")
            return False
        
        print(f"  ✓ Merge initiated with estimated duration: {merge_result['estimated_duration_seconds']}s")
        
        # Step 7: Check merge status
        print("Step 7: Checking merge status...")
        
        # Wait a moment for merge to start
        await asyncio.sleep(1)
        
        merge_status = await merge_service.get_merge_status(merge_session_id)
        
        if not merge_status:
            print("  ✗ Merge status not found")
            return False
        
        print(f"  ✓ Merge status: {merge_status['status']}, progress: {merge_status.get('progress', 0)}%")
        
        # Step 8: Test cancellation (optional)
        print("Step 8: Testing merge cancellation...")
        
        if merge_status["status"] in ["pending", "processing"]:
            cancel_success = await merge_service.cancel_merge(merge_session_id)
            if cancel_success:
                print("  ✓ Merge cancelled successfully")
            else:
                print("  ! Merge cancellation failed (may have completed)")
        else:
            print(f"  - Merge already {merge_status['status']}, skipping cancellation")
        
        # Cleanup
        print("Cleanup: Removing uploaded files...")
        for path in completed_paths:
            if path.exists():
                path.unlink()
                print(f"  ✓ Removed: {path}")
        
        print("\n🎉 Upload and merge integration test completed successfully!")
        return True
        
    except Exception as e:
        print(f"✗ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_merge_readiness_validation():
    """Test merge readiness validation with various scenarios"""
    print("Testing Merge Readiness Validation...")
    
    merge_service = VideoMergeService()
    
    # Test 1: Non-existent merge session
    readiness = await merge_service.check_merge_readiness("nonexistent", "test_user")
    if readiness["ready"]:
        print("  ✗ Non-existent session should not be ready")
        return False
    print("  ✓ Non-existent session correctly reported as not ready")
    
    # Test 2: Empty merge session (no videos)
    readiness = await merge_service.check_merge_readiness("empty_session", "test_user")
    if readiness["ready"]:
        print("  ✗ Empty session should not be ready")
        return False
    print("  ✓ Empty session correctly reported as not ready")
    
    print("✓ Merge readiness validation tests passed")
    return True

async def main():
    """Main test function"""
    print("Upload and Merge Integration Test Suite")
    print("=" * 50)
    
    # Test merge readiness validation
    if not await test_merge_readiness_validation():
        return False
    
    print()
    
    # Test full integration
    if not await test_upload_and_merge_integration():
        return False
    
    print("\n✅ All integration tests completed successfully!")
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)