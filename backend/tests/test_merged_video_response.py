#!/usr/bin/env python3
"""
Test to verify merged video URL and metadata are returned through upload response
"""
import asyncio
import json
import sys
import os
from unittest.mock import Mock, AsyncMock, patch

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.challenge_video_endpoints import complete_merge_video_upload
from services.upload_service import ChunkedUploadService
from services.video_merge_service import VideoMergeService, MergeSessionStatus
from models import UploadSession, UploadStatus
from datetime import datetime
import uuid

async def test_merged_video_response():
    """Test that merged video URL and metadata are returned in upload response"""
    print("Testing merged video URL and metadata in upload response...")
    
    # Create a mock completed session
    session_id = str(uuid.uuid4())
    merge_session_id = str(uuid.uuid4())
    
    mock_session = UploadSession(
        session_id=session_id,
        user_id="test-user",
        filename="video1.mp4",
        file_size=5000000,
        chunk_size=1048576,
        total_chunks=5,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        completed_at=datetime.utcnow(),
        metadata={
            "merge_session_id": merge_session_id,
            "video_index": 2,  # Last video (0-indexed)
            "video_count": 3,
            "is_merge_video": True
        }
    )
    
    # Mock merge service with completed merge
    mock_merge_service = Mock(spec=VideoMergeService)
    
    # Mock merge readiness check - all videos ready
    mock_merge_service.check_merge_readiness = AsyncMock(return_value={
        "ready": True,
        "videos_found": 3,
        "videos_completed": 3,
        "video_files": []
    })
    
    # Mock merge initiation
    mock_merge_service.initiate_merge = AsyncMock(return_value={
        "merge_session_id": merge_session_id,
        "status": "pending"
    })
    
    # Mock merge status with completed merge including URL and metadata
    mock_merge_status = {
        "status": MergeSessionStatus.COMPLETED,
        "progress": 100.0,
        "merged_video_url": f"https://s3.amazonaws.com/bucket/merged_videos/test-user/{uuid.uuid4()}/merged_video.mp4",
        "merged_video_metadata": {
            "total_duration": 45.7,
            "segments": [
                {
                    "start_time": 0.0,
                    "end_time": 15.2,
                    "duration": 15.2,
                    "statement_index": 0
                },
                {
                    "start_time": 15.2,
                    "end_time": 30.5,
                    "duration": 15.3,
                    "statement_index": 1
                },
                {
                    "start_time": 30.5,
                    "end_time": 45.7,
                    "duration": 15.2,
                    "statement_index": 2
                }
            ],
            "video_file_id": str(uuid.uuid4()),
            "compression_applied": True
        }
    }
    
    mock_merge_service.get_merge_status = AsyncMock(return_value=mock_merge_status)
    
    # Mock upload service
    mock_upload_service = Mock(spec=ChunkedUploadService)
    mock_upload_service.get_upload_status = AsyncMock(return_value=mock_session)
    mock_upload_service.complete_upload = AsyncMock(return_value="/path/to/video1.mp4")
    
    # Test the response structure
    with patch('api.challenge_video_endpoints.upload_service', mock_upload_service), \
         patch('api.challenge_video_endpoints.merge_service', mock_merge_service):
        
        try:
            # This would normally be called by FastAPI, but we'll test the logic
            from fastapi import Form
            from fastapi.responses import JSONResponse
            
            # Mock the dependencies
            def mock_get_current_user():
                return "test-user"
            
            # Call the endpoint function directly
            response = await complete_merge_video_upload(
                session_id=session_id,
                file_hash="test-hash",
                current_user="test-user"
            )
            
            # Verify response is JSONResponse
            if not isinstance(response, JSONResponse):
                print(f"✗ Expected JSONResponse, got {type(response)}")
                return False
            
            # Parse response content
            response_data = json.loads(response.body.decode())
            
            # Verify required fields are present
            required_fields = [
                "session_id", "merge_session_id", "video_index", "video_count",
                "status", "merge_triggered", "merge_status"
            ]
            
            for field in required_fields:
                if field not in response_data:
                    print(f"✗ Missing required field: {field}")
                    return False
            
            # Verify merged video URL is included when merge completes
            if "merged_video_url" not in response_data:
                print("✗ Missing merged_video_url in response")
                return False
            
            # Verify merged video metadata is included
            if "merged_video_metadata" not in response_data:
                print("✗ Missing merged_video_metadata in response")
                return False
            
            # Verify segment metadata is extracted for easier client access
            if "segment_metadata" not in response_data:
                print("✗ Missing segment_metadata in response")
                return False
            
            # Verify the content of merged video metadata
            metadata = response_data["merged_video_metadata"]
            if "total_duration" not in metadata:
                print("✗ Missing total_duration in merged_video_metadata")
                return False
            
            if "segments" not in metadata:
                print("✗ Missing segments in merged_video_metadata")
                return False
            
            # Verify segment metadata structure
            segments = response_data["segment_metadata"]
            if not isinstance(segments, list) or len(segments) != 3:
                print(f"✗ Expected 3 segments, got {len(segments) if isinstance(segments, list) else 'not a list'}")
                return False
            
            # Verify each segment has required fields
            for i, segment in enumerate(segments):
                required_segment_fields = ["start_time", "end_time", "duration", "statement_index"]
                for field in required_segment_fields:
                    if field not in segment:
                        print(f"✗ Missing {field} in segment {i}")
                        return False
            
            # Verify response headers
            headers = response.headers
            expected_headers = ["X-Merge-Session-ID", "X-Video-Index", "X-Video-Status", "X-Merge-Triggered"]
            for header in expected_headers:
                if header not in headers:
                    print(f"✗ Missing response header: {header}")
                    return False
            
            print("✓ All response validation checks passed")
            print(f"✓ Merged video URL: {response_data['merged_video_url']}")
            print(f"✓ Total duration: {metadata['total_duration']}s")
            print(f"✓ Segments: {len(segments)} segments")
            print(f"✓ Merge status: {response_data['merge_status']}")
            
            return True
            
        except Exception as e:
            print(f"✗ Error testing merged video response: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

async def test_merge_session_status_response():
    """Test that merge session status endpoint returns merged video URL and metadata"""
    print("\nTesting merge session status response...")
    
    merge_session_id = str(uuid.uuid4())
    
    # Mock upload service with completed sessions
    mock_upload_service = Mock(spec=ChunkedUploadService)
    mock_sessions = {}
    
    for i in range(3):
        session_id = str(uuid.uuid4())
        session = UploadSession(
            session_id=session_id,
            user_id="test-user",
            filename=f"video{i+1}.mp4",
            file_size=5000000,
            chunk_size=1048576,
            total_chunks=5,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            completed_at=datetime.utcnow(),
            metadata={
                "merge_session_id": merge_session_id,
                "video_index": i,
                "video_count": 3,
                "is_merge_video": True
            }
        )
        mock_sessions[session_id] = session
    
    mock_upload_service.sessions = mock_sessions
    mock_upload_service.get_progress_percent = Mock(return_value=100.0)
    
    # Mock merge service with completed merge
    mock_merge_service = Mock(spec=VideoMergeService)
    mock_merge_status = {
        "status": MergeSessionStatus.COMPLETED,
        "progress": 100.0,
        "merged_video_url": f"https://s3.amazonaws.com/bucket/merged_videos/test-user/{uuid.uuid4()}/merged_video.mp4",
        "merged_video_metadata": {
            "total_duration": 45.7,
            "segments": [
                {"start_time": 0.0, "end_time": 15.2, "duration": 15.2, "statement_index": 0},
                {"start_time": 15.2, "end_time": 30.5, "duration": 15.3, "statement_index": 1},
                {"start_time": 30.5, "end_time": 45.7, "duration": 15.2, "statement_index": 2}
            ],
            "video_file_id": str(uuid.uuid4()),
            "compression_applied": True
        }
    }
    
    mock_merge_service.get_merge_status = AsyncMock(return_value=mock_merge_status)
    
    # Test the merge session status endpoint
    with patch('api.challenge_video_endpoints.upload_service', mock_upload_service), \
         patch('api.challenge_video_endpoints.merge_service', mock_merge_service):
        
        try:
            from api.challenge_video_endpoints import get_merge_session_status
            
            response = await get_merge_session_status(
                merge_session_id=merge_session_id,
                current_user="test-user"
            )
            
            # Verify response structure
            required_fields = [
                "merge_session_id", "overall_status", "total_videos", "completed_videos",
                "merge_triggered", "merge_status", "merged_video_url", "merged_video_metadata"
            ]
            
            for field in required_fields:
                if field not in response:
                    print(f"✗ Missing required field in status response: {field}")
                    return False
            
            # Verify merged video URL and metadata are present
            if not response["merged_video_url"]:
                print("✗ merged_video_url is empty in status response")
                return False
            
            if not response["merged_video_metadata"]:
                print("✗ merged_video_metadata is empty in status response")
                return False
            
            print("✓ Merge session status response validation passed")
            print(f"✓ Status: {response['merge_status']}")
            print(f"✓ URL: {response['merged_video_url']}")
            print(f"✓ Metadata present: {bool(response['merged_video_metadata'])}")
            
            return True
            
        except Exception as e:
            print(f"✗ Error testing merge session status response: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

async def main():
    """Run all tests"""
    print("=" * 60)
    print("Merged Video URL and Metadata Response Test Suite")
    print("=" * 60)
    
    tests = [
        test_merged_video_response,
        test_merge_session_status_response
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if await test():
                passed += 1
                print("✓ PASSED")
            else:
                print("✗ FAILED")
        except Exception as e:
            print(f"✗ ERROR: {str(e)}")
        print("-" * 40)
    
    print(f"\nTest Results: {passed}/{total} tests passed")
    if passed == total:
        print("🎉 All tests passed! Merged video URL and metadata are properly returned.")
    else:
        print("❌ Some tests failed.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)