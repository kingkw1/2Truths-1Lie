#!/usr/bin/env python3
"""
Integration test for S3 upload and individual video cleanup functionality
"""
import asyncio
import tempfile
import shutil
from pathlib import Path
import uuid
from datetime import datetime
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_merge_service import VideoMergeService, MergeSessionStatus
from services.upload_service import ChunkedUploadService, UploadSession, UploadStatus
from services.cloud_storage_service import S3CloudStorageService, CloudStorageError
from models import VideoSegmentMetadata, MergedVideoMetadata
from config import settings

async def test_s3_upload_and_cleanup():
    """Test S3 upload and individual video cleanup integration"""
    
    print("Testing S3 upload and individual video cleanup integration...")
    
    # Create temporary directories for testing
    temp_dir = Path(tempfile.mkdtemp())
    upload_dir = temp_dir / "uploads"
    upload_dir.mkdir(exist_ok=True)
    
    # Override settings for testing
    original_upload_dir = settings.UPLOAD_DIR
    original_temp_dir = settings.TEMP_DIR
    original_use_cloud_storage = settings.USE_CLOUD_STORAGE
    
    settings.UPLOAD_DIR = upload_dir
    settings.TEMP_DIR = temp_dir / "temp"
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.USE_CLOUD_STORAGE = True
    
    try:
        # Create mock S3 service
        mock_s3_service = AsyncMock(spec=S3CloudStorageService)
        mock_s3_service.upload_file_stream = AsyncMock(return_value="https://test-bucket.s3.amazonaws.com/merged_videos/test_user/video123/merged_video.mp4")
        
        # Initialize merge service with mocked cloud storage
        merge_service = VideoMergeService()
        merge_service.cloud_storage = mock_s3_service
        merge_service.use_cloud_storage = True
        
        upload_service = merge_service.upload_service
        
        # Create test data
        user_id = "test_user_123"
        merge_session_id = str(uuid.uuid4())
        
        # Create mock upload sessions and video files
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
        
        # Create mock segment metadata
        segment_metadata = [
            VideoSegmentMetadata(start_time=0.0, end_time=10.0, duration=10.0, statement_index=0),
            VideoSegmentMetadata(start_time=10.0, end_time=20.0, duration=10.0, statement_index=1),
            VideoSegmentMetadata(start_time=20.0, end_time=30.0, duration=10.0, statement_index=2)
        ]
        
        # Create a mock compressed video file
        compressed_path = temp_dir / "compressed_video.mp4"
        with open(compressed_path, 'wb') as f:
            f.write(b"compressed video data " * 2000)
        
        print(f"\nTesting S3 upload and cleanup...")
        
        # Test the _finalize_merge method which should upload to S3 and cleanup individual videos
        result = await merge_service._finalize_merge(
            compressed_path=compressed_path,
            segment_metadata=segment_metadata,
            merge_session_id=merge_session_id,
            user_id=user_id
        )
        
        print(f"Finalize merge result: {result}")
        
        # Verify S3 upload was called
        mock_s3_service.upload_file_stream.assert_called_once()
        upload_call_args = mock_s3_service.upload_file_stream.call_args
        
        # Verify upload parameters
        assert upload_call_args.kwargs['content_type'] == "video/mp4"
        assert upload_call_args.kwargs['file_size'] == compressed_path.stat().st_size
        assert "merged_videos" in upload_call_args.kwargs['key']
        assert user_id in upload_call_args.kwargs['key']
        
        # Verify metadata
        metadata = upload_call_args.kwargs['metadata']
        assert metadata['user_id'] == user_id
        assert metadata['merge_session_id'] == merge_session_id
        assert metadata['compression_applied'] == "true"
        
        print("✅ S3 upload parameters verified")
        
        # Verify individual video files are deleted
        for video_file in video_files:
            assert not video_file.exists(), f"Individual video file should be deleted: {video_file}"
        
        print("✅ Individual video files cleaned up successfully")
        
        # Verify session metadata is updated
        for session in video_sessions:
            assert session.metadata.get("cleaned_up") == True, "Session should be marked as cleaned up"
            assert "cleanup_timestamp" in session.metadata, "Session should have cleanup timestamp"
        
        print("✅ Session metadata updated correctly")
        
        # Verify result structure
        assert result['storage_type'] == 'cloud'
        assert result['streaming_url'] == mock_s3_service.upload_file_stream.return_value
        assert 'metadata' in result
        assert result['file_size'] == compressed_path.stat().st_size
        
        print("✅ Result structure verified")
        
        print("\n🎉 S3 upload and cleanup integration test passed!")
        
        # Test error handling - S3 upload failure
        print("\nTesting S3 upload failure handling...")
        
        # Create new test files for error test
        error_merge_session_id = str(uuid.uuid4())
        error_video_files = []
        
        for i in range(2):
            session_id = str(uuid.uuid4())
            filename = f"error_test_video_{i}.mp4"
            
            # Create mock video file
            video_file_path = upload_dir / f"{session_id}_{filename}"
            with open(video_file_path, 'wb') as f:
                f.write(b"error test video data " * 500)
            error_video_files.append(video_file_path)
            
            # Create upload session
            session = UploadSession(
                session_id=session_id,
                user_id=user_id,
                filename=filename,
                file_size=len(b"error test video data " * 500),
                chunk_size=1024,
                total_chunks=1,
                mime_type="video/mp4",
                status=UploadStatus.COMPLETED,
                metadata={
                    "merge_session_id": error_merge_session_id,
                    "is_merge_video": True,
                    "video_index": i,
                    "video_count": 2
                }
            )
            
            upload_service.sessions[session_id] = session
        
        # Mock S3 service to raise an error
        mock_s3_service.upload_file_stream = AsyncMock(side_effect=CloudStorageError("S3 upload failed"))
        
        # Test that finalize_merge raises an error and doesn't cleanup files
        try:
            await merge_service._finalize_merge(
                compressed_path=compressed_path,
                segment_metadata=segment_metadata,
                merge_session_id=error_merge_session_id,
                user_id=user_id
            )
            assert False, "Should have raised VideoMergeError"
        except Exception as e:
            assert "CLOUD_UPLOAD_ERROR" in str(e) or "Failed to upload merged video to cloud storage" in str(e)
            print(f"✅ Correctly raised error: {e}")
        
        # Verify individual video files are NOT deleted when S3 upload fails
        for video_file in error_video_files:
            assert video_file.exists(), f"Individual video file should NOT be deleted when S3 upload fails: {video_file}"
        
        print("✅ Individual video files preserved on S3 upload failure")
        
        print("\n🎉 S3 error handling test passed!")
        
    finally:
        # Restore original settings
        settings.UPLOAD_DIR = original_upload_dir
        settings.TEMP_DIR = original_temp_dir
        settings.USE_CLOUD_STORAGE = original_use_cloud_storage
        
        # Clean up test directory
        shutil.rmtree(temp_dir, ignore_errors=True)

async def test_local_storage_and_cleanup():
    """Test local storage and individual video cleanup"""
    
    print("\nTesting local storage and individual video cleanup...")
    
    # Create temporary directories for testing
    temp_dir = Path(tempfile.mkdtemp())
    upload_dir = temp_dir / "uploads"
    upload_dir.mkdir(exist_ok=True)
    
    # Override settings for testing
    original_upload_dir = settings.UPLOAD_DIR
    original_temp_dir = settings.TEMP_DIR
    original_use_cloud_storage = settings.USE_CLOUD_STORAGE
    
    settings.UPLOAD_DIR = upload_dir
    settings.TEMP_DIR = temp_dir / "temp"
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.USE_CLOUD_STORAGE = False  # Test local storage
    
    try:
        # Initialize merge service for local storage
        merge_service = VideoMergeService()
        upload_service = merge_service.upload_service
        
        # Create test data
        user_id = "test_user_local"
        merge_session_id = str(uuid.uuid4())
        
        # Create mock upload sessions and video files
        video_files = []
        
        for i in range(3):
            session_id = str(uuid.uuid4())
            filename = f"local_test_video_{i}.mp4"
            
            # Create mock video file
            video_file_path = upload_dir / f"{session_id}_{filename}"
            with open(video_file_path, 'wb') as f:
                f.write(b"local video data " * 800)
            video_files.append(video_file_path)
            
            # Create upload session
            session = UploadSession(
                session_id=session_id,
                user_id=user_id,
                filename=filename,
                file_size=len(b"local video data " * 800),
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
        
        # Create mock segment metadata
        segment_metadata = [
            VideoSegmentMetadata(start_time=0.0, end_time=8.0, duration=8.0, statement_index=0),
            VideoSegmentMetadata(start_time=8.0, end_time=16.0, duration=8.0, statement_index=1),
            VideoSegmentMetadata(start_time=16.0, end_time=24.0, duration=8.0, statement_index=2)
        ]
        
        # Create a mock compressed video file
        compressed_path = temp_dir / "local_compressed_video.mp4"
        with open(compressed_path, 'wb') as f:
            f.write(b"local compressed video data " * 1500)
        
        print(f"Testing local storage and cleanup...")
        
        # Test the _finalize_merge method for local storage
        result = await merge_service._finalize_merge(
            compressed_path=compressed_path,
            segment_metadata=segment_metadata,
            merge_session_id=merge_session_id,
            user_id=user_id
        )
        
        print(f"Local finalize merge result: {result}")
        
        # Verify local storage
        assert result['storage_type'] == 'local'
        assert 'merged_videos' in result['storage_path']
        assert result['streaming_url'].startswith('/api/v1/media/merged/')
        
        # Verify merged video file exists locally
        local_merged_path = Path(result['storage_path'])
        assert local_merged_path.exists(), f"Merged video should exist locally: {local_merged_path}"
        
        print("✅ Local storage verified")
        
        # Verify individual video files are deleted
        for video_file in video_files:
            assert not video_file.exists(), f"Individual video file should be deleted: {video_file}"
        
        print("✅ Individual video files cleaned up successfully")
        
        print("\n🎉 Local storage and cleanup test passed!")
        
    finally:
        # Restore original settings
        settings.UPLOAD_DIR = original_upload_dir
        settings.TEMP_DIR = original_temp_dir
        settings.USE_CLOUD_STORAGE = original_use_cloud_storage
        
        # Clean up test directory
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    async def run_all_tests():
        await test_s3_upload_and_cleanup()
        await test_local_storage_and_cleanup()
        print("\n🎉 All S3 and cleanup integration tests passed successfully!")
    
    asyncio.run(run_all_tests())