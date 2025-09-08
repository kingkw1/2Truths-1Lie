#!/usr/bin/env python3
"""
Test script for individual video cleanup functionality
"""
import asyncio
import tempfile
import shutil
from pathlib import Path
import uuid
from datetime import datetime
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_merge_service import VideoMergeService, MergeSessionStatus
from services.upload_service import ChunkedUploadService, UploadSession, UploadStatus
from models import VideoSegmentMetadata
from config import settings

async def test_individual_video_cleanup():
    """Test the individual video cleanup functionality"""
    
    print("Testing individual video cleanup functionality...")
    
    # Create temporary directories for testing
    temp_dir = Path(tempfile.mkdtemp())
    upload_dir = temp_dir / "uploads"
    upload_dir.mkdir(exist_ok=True)
    
    # Override settings for testing
    original_upload_dir = settings.UPLOAD_DIR
    original_temp_dir = settings.TEMP_DIR
    settings.UPLOAD_DIR = upload_dir
    settings.TEMP_DIR = temp_dir / "temp"
    settings.TEMP_DIR.mkdir(exist_ok=True)
    
    try:
        # Initialize services
        merge_service = VideoMergeService()
        upload_service = merge_service.upload_service  # Use the same upload service instance
        
        # Create test data
        user_id = "test_user_123"
        merge_session_id = str(uuid.uuid4())
        
        # Create mock upload sessions for individual videos
        video_sessions = []
        video_files = []
        
        for i in range(3):
            session_id = str(uuid.uuid4())
            filename = f"test_video_{i}.mp4"
            
            # Create mock video file
            video_file_path = upload_dir / f"{session_id}_{filename}"
            with open(video_file_path, 'wb') as f:
                f.write(b"mock video data " * 1000)  # Create some dummy data
            video_files.append(video_file_path)
            
            # Create upload session
            session = UploadSession(
                session_id=session_id,
                user_id=user_id,
                filename=filename,
                file_size=len(b"mock video data " * 1000),
                chunk_size=1024,
                total_chunks=1,
                mime_type="video/mp4",
                status=UploadStatus.COMPLETED,
                metadata={
                    "merge_session_id": merge_session_id,
                    "is_merge_video": True,
                    "video_index": i,
                    "video_count": 3
                }
            )
            
            upload_service.sessions[session_id] = session
            video_sessions.append(session)
        
        # Verify files exist before cleanup
        print(f"Created {len(video_files)} test video files:")
        for video_file in video_files:
            assert video_file.exists(), f"Test video file should exist: {video_file}"
            print(f"  - {video_file} ({video_file.stat().st_size} bytes)")
        
        # Create a mock merge session
        merge_service.merge_sessions[merge_session_id] = {
            "merge_session_id": merge_session_id,
            "user_id": user_id,
            "status": MergeSessionStatus.COMPLETED,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Test the cleanup functionality
        print(f"\nTesting cleanup for merge session: {merge_session_id}")
        cleanup_result = await merge_service._cleanup_individual_videos(merge_session_id, user_id)
        
        print(f"Cleanup result: {cleanup_result}")
        
        # Verify cleanup results
        assert cleanup_result["files_deleted"] == 3, f"Expected 3 files deleted, got {cleanup_result['files_deleted']}"
        assert cleanup_result["files_failed"] == 0, f"Expected 0 files failed, got {cleanup_result['files_failed']}"
        assert cleanup_result["sessions_cleaned"] == 3, f"Expected 3 sessions cleaned, got {cleanup_result['sessions_cleaned']}"
        assert len(cleanup_result["errors"]) == 0, f"Expected no errors, got {cleanup_result['errors']}"
        
        # Verify files are actually deleted
        for video_file in video_files:
            assert not video_file.exists(), f"Video file should be deleted: {video_file}"
        
        # Verify session metadata is updated
        for session in video_sessions:
            assert session.metadata.get("cleaned_up") == True, "Session should be marked as cleaned up"
            assert "cleanup_timestamp" in session.metadata, "Session should have cleanup timestamp"
        
        print("✅ Individual video cleanup test passed!")
        
        # Test manual cleanup method
        print("\nTesting manual cleanup method...")
        
        # Create new test files for manual cleanup test
        new_merge_session_id = str(uuid.uuid4())
        new_video_files = []
        
        for i in range(2):
            session_id = str(uuid.uuid4())
            filename = f"manual_test_video_{i}.mp4"
            
            # Create mock video file
            video_file_path = upload_dir / f"{session_id}_{filename}"
            with open(video_file_path, 'wb') as f:
                f.write(b"manual test video data " * 500)
            new_video_files.append(video_file_path)
            
            # Create upload session
            session = UploadSession(
                session_id=session_id,
                user_id=user_id,
                filename=filename,
                file_size=len(b"manual test video data " * 500),
                chunk_size=1024,
                total_chunks=1,
                mime_type="video/mp4",
                status=UploadStatus.COMPLETED,
                metadata={
                    "merge_session_id": new_merge_session_id,
                    "is_merge_video": True,
                    "video_index": i,
                    "video_count": 2
                }
            )
            
            upload_service.sessions[session_id] = session
        
        # Create merge session
        merge_service.merge_sessions[new_merge_session_id] = {
            "merge_session_id": new_merge_session_id,
            "user_id": user_id,
            "status": MergeSessionStatus.COMPLETED,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Test manual cleanup
        manual_result = await merge_service.cleanup_individual_videos_for_session(new_merge_session_id, user_id)
        
        print(f"Manual cleanup result: {manual_result}")
        
        assert manual_result["success"] == True, "Manual cleanup should succeed"
        assert manual_result["cleanup_result"]["files_deleted"] == 2, "Should delete 2 files"
        
        # Verify files are deleted
        for video_file in new_video_files:
            assert not video_file.exists(), f"Manual cleanup should delete file: {video_file}"
        
        print("✅ Manual cleanup test passed!")
        
        # Test error cases
        print("\nTesting error cases...")
        
        # Test with non-existent merge session
        error_result = await merge_service.cleanup_individual_videos_for_session("non_existent", user_id)
        assert error_result["success"] == False, "Should fail for non-existent session"
        assert "not found" in error_result["error"], "Should indicate session not found"
        
        # Test with wrong user ID
        wrong_user_result = await merge_service.cleanup_individual_videos_for_session(new_merge_session_id, "wrong_user")
        assert wrong_user_result["success"] == False, "Should fail for wrong user"
        assert "does not match" in wrong_user_result["error"], "Should indicate user mismatch"
        
        print("✅ Error case tests passed!")
        
        print("\n🎉 All individual video cleanup tests passed successfully!")
        
    finally:
        # Restore original settings
        settings.UPLOAD_DIR = original_upload_dir
        settings.TEMP_DIR = original_temp_dir
        
        # Clean up test directory
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(test_individual_video_cleanup())