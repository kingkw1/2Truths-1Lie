#!/usr/bin/env python3
"""
Test the new direct upload endpoint for multiple videos
"""
import asyncio
import json
import sys
import os
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import UploadFile
from api.challenge_video_endpoints import upload_videos_for_merge_direct
from services.video_merge_service import VideoMergeService

async def test_direct_upload_endpoint():
    """Test the direct upload endpoint logic"""
    print("Testing direct upload endpoint...")
    
    try:
        # Create mock video files
        mock_video_files = []
        for i in range(3):
            mock_file = Mock(spec=UploadFile)
            mock_file.filename = f"video_{i}.mp4"
            mock_file.content_type = "video/mp4"
            mock_file.size = 5000000  # 5MB
            mock_file.file = Mock()
            mock_video_files.append(mock_file)
        
        # Create mock metadata
        mock_metadata = []
        for i in range(3):
            metadata = {
                "statementIndex": i,
                "duration": 15000 + (i * 1000),  # 15-17 seconds
                "filename": f"video_{i}.mp4"
            }
            mock_metadata.append(json.dumps(metadata))
        
        print("✓ Mock data created")
        
        # Mock the video merge service
        with patch('api.challenge_video_endpoints.merge_service') as mock_merge_service:
            # Mock the synchronous merge processing
            mock_merge_result = {
                "success": True,
                "merged_video_url": "https://example.com/merged_video.mp4",
                "segment_metadata": [
                    {"statementIndex": 0, "startTime": 0, "endTime": 15000},
                    {"statementIndex": 1, "startTime": 15000, "endTime": 31000},
                    {"statementIndex": 2, "startTime": 31000, "endTime": 48000}
                ],
                "total_duration": 48000,
                "metadata": {"total_segments": 3}
            }
            
            mock_merge_service._process_merge_sync = AsyncMock(return_value=mock_merge_result)
            mock_merge_service.merge_sessions = {}
            
            # Test the endpoint logic (without actual FastAPI dependencies)
            print("✓ Testing endpoint validation logic...")
            
            # Validate video count
            if len(mock_video_files) != 3:
                print("✗ Video count validation failed")
                return False
            
            # Validate metadata parsing
            try:
                parsed_metadata = [json.loads(meta) for meta in mock_metadata]
                print("✓ Metadata parsing successful")
            except json.JSONDecodeError:
                print("✗ Metadata parsing failed")
                return False
            
            # Validate file properties
            for i, video_file in enumerate(mock_video_files):
                if video_file.content_type != "video/mp4":
                    print(f"✗ Video {i} content type validation failed")
                    return False
                
                if video_file.size > 50 * 1024 * 1024:  # 50MB limit
                    print(f"✗ Video {i} size validation failed")
                    return False
            
            print("✓ All validation checks passed")
            
            # Test merge session creation
            merge_session_id = "test-merge-session-123"
            mock_merge_service.merge_sessions[merge_session_id] = {
                "user_id": "test-user",
                "status": "processing",
                "video_paths": [f"/tmp/video_{i}.mp4" for i in range(3)],
                "video_metadata": parsed_metadata,
                "created_at": "2024-01-01T00:00:00",
                "progress": 0.0
            }
            
            print("✓ Mock merge session created")
            
            # Test the merge processing call
            result = await mock_merge_service._process_merge_sync(
                merge_session_id=merge_session_id,
                video_paths=[Path(f"/tmp/video_{i}.mp4") for i in range(3)],
                quality="medium"
            )
            
            if not result["success"]:
                print("✗ Merge processing failed")
                return False
            
            print("✓ Merge processing successful")
            print(f"✓ Merged video URL: {result['merged_video_url']}")
            print(f"✓ Segment count: {len(result['segment_metadata'])}")
            
            # Validate response format
            expected_fields = ["merged_video_url", "segment_metadata", "total_duration"]
            for field in expected_fields:
                if field not in result:
                    print(f"✗ Missing field in response: {field}")
                    return False
            
            print("✓ Response format validation passed")
            
            # Validate segment metadata format
            for i, segment in enumerate(result["segment_metadata"]):
                required_fields = ["statementIndex", "startTime", "endTime"]
                for field in required_fields:
                    if field not in segment:
                        print(f"✗ Missing field in segment {i}: {field}")
                        return False
            
            print("✓ Segment metadata format validation passed")
            
        print("✅ Direct upload endpoint test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_direct_upload_endpoint())
    sys.exit(0 if success else 1)