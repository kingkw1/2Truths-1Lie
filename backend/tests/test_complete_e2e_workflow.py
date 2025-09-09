#!/usr/bin/env python3
"""
Complete End-to-End Workflow Tests
Tests the entire user journey from video capture through upload, merge, challenge creation, and playback
Covers all aspects of the server-side video processing specification
"""
import pytest
import asyncio
import tempfile
import shutil
import hashlib
import json
import time
import os
import sys
from pathlib import Path
from unittest.mock import patch, Mock, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from typing import Dict, Any, List
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from services.upload_service import ChunkedUploadService
from services.video_merge_service import VideoMergeService, MergeSessionStatus
from services.cloud_storage_service import CloudStorageService
from services.challenge_service import ChallengeService
from services.auth_service import create_test_token
from models import Challenge, Statement, UploadStatus, UploadSession, VideoSegmentMetadata
from config import Settings

@pytest.fixture
def temp_settings():
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.CHALLENGE_DATA_FILE = temp_dir / "challenges.json"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    settings.CHUNK_SIZE = 1024 * 1024  # 1MB
    settings.USE_CLOUD_STORAGE = True
    settings.ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"]
    
    # Initialize empty challenge data
    with open(settings.CHALLENGE_DATA_FILE, 'w') as f:
        json.dump({"challenges": []}, f)
    
    yield settings
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def auth_headers():
    """Create authentication headers"""
    token = create_test_token("e2e-test-user")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def sample_video_files():
    """Create sample video files for multi-video upload"""
    videos = []
    for i in range(3):
        # Create realistic video-like data with proper MP4 header
        header = b"ftypisom"  # MP4 header
        content = f"video_statement_{i}_frame_data_".encode() * 1000  # ~30KB per video
        video_data = header + content
        
        videos.append({
            "index": i,
            "filename": f"statement_{i}.mp4",
            "data": video_data,
            "size": len(video_data),
            "duration": 10.0 + i * 2.5,  # 10.0, 12.5, 15.0 seconds
            "mime_type": "video/mp4",
            "hash": hashlib.sha256(video_data).hexdigest()
        })
    
    return videos

class TestCompleteE2EWorkflow:
    """Test complete end-to-end workflow covering all user scenarios"""
    
    def test_complete_multi_video_upload_merge_challenge_workflow(
        self, client, auth_headers, temp_settings, sample_video_files
    ):
        """Test complete workflow: multi-video upload -> merge -> challenge creation -> playback"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    with patch.object(VideoMergeService, 'merge_videos') as mock_merge:
                        # Mock cloud storage responses
                        mock_upload.return_value = {
                            "success": True,
                            "cloud_path": "uploads/e2e-test-user/merged_video.mp4",
                            "etag": "e2e-merged-etag-123"
                        }
                        mock_signed_url.return_value = "https://cdn.example.com/e2e-merged-video"
                        
                        # Mock video merge service
                        merged_video_data = b"ftypisom" + b"merged_video_content_" * 2000
                        mock_merge.return_value = {
                            "success": True,
                            "merged_video_path": "/tmp/merged_video.mp4",
                            "merged_video_data": merged_video_data,
                            "total_duration": 37.5,
                            "segments": [
                                {"start_time": 0.0, "end_time": 10.0, "duration": 10.0, "statement_index": 0},
                                {"start_time": 10.0, "end_time": 22.5, "duration": 12.5, "statement_index": 1},
                                {"start_time": 22.5, "end_time": 37.5, "duration": 15.0, "statement_index": 2}
                            ]
                        }
                        
                        # Step 1: Initiate multi-video upload for merge
                        video_filenames = json.dumps([v["filename"] for v in sample_video_files])
                        video_file_sizes = json.dumps([v["size"] for v in sample_video_files])
                        video_durations = json.dumps([v["duration"] for v in sample_video_files])
                        video_mime_types = json.dumps([v["mime_type"] for v in sample_video_files])
                        
                        initiate_response = client.post(
                            "/api/v1/challenge-videos/upload-for-merge/initiate",
                            data={
                                "video_count": 3,
                                "video_filenames": video_filenames,
                                "video_file_sizes": video_file_sizes,
                                "video_durations": video_durations,
                                "video_mime_types": video_mime_types,
                                "challenge_title": "E2E Test Challenge"
                            },
                            headers=auth_headers
                        )
                        
                        assert initiate_response.status_code == 200
                        initiate_data = initiate_response.json()
                        merge_session_id = initiate_data["merge_session_id"]
                        upload_sessions = initiate_data["upload_sessions"]
                        
                        assert initiate_data["total_videos"] == 3
                        assert len(upload_sessions) == 3
                        assert initiate_data["status"] == "initiated"
                        
                        # Step 2: Upload all video files
                        for i, video in enumerate(sample_video_files):
                            session_id = upload_sessions[i]["session_id"]
                            chunk_size = upload_sessions[i]["chunk_size"]
                            total_chunks = upload_sessions[i]["total_chunks"]
                            
                            # Upload chunks for this video
                            for chunk_num in range(total_chunks):
                                start = chunk_num * chunk_size
                                end = min(start + chunk_size, video["size"])
                                chunk_data = video["data"][start:end]
                                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                                
                                chunk_response = client.post(
                                    f"/api/v1/challenge-videos/upload/{session_id}/chunk/{chunk_num}",
                                    files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                                    data={"chunk_hash": chunk_hash},
                                    headers=auth_headers
                                )
                                
                                assert chunk_response.status_code == 200
                                chunk_data_response = chunk_response.json()
                                assert chunk_data_response["session_id"] == session_id
                                assert chunk_data_response["merge_session_id"] == merge_session_id
                                assert chunk_data_response["video_index"] == i
                                assert chunk_data_response["status"] == "uploaded"
                            
                            # Complete upload for this video
                            complete_response = client.post(
                                f"/api/v1/challenge-videos/upload/{session_id}/complete",
                                data={"file_hash": video["hash"]},
                                headers=auth_headers
                            )
                            
                            assert complete_response.status_code == 200
                            complete_data = complete_response.json()
                            assert complete_data["session_id"] == session_id
                            assert complete_data["status"] == UploadStatus.COMPLETED
                            
                            # Last video should trigger merge
                            if i == 2:
                                assert complete_data["merge_triggered"] is True
                                assert complete_data["merge_status"] in [MergeSessionStatus.PENDING, MergeSessionStatus.PROCESSING]
                        
                        # Step 3: Check merge session status and wait for completion
                        max_attempts = 10
                        attempt = 0
                        merge_completed = False
                        
                        while attempt < max_attempts and not merge_completed:
                            status_response = client.get(
                                f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status",
                                headers=auth_headers
                            )
                            
                            assert status_response.status_code == 200
                            status_data = status_response.json()
                            
                            assert status_data["merge_session_id"] == merge_session_id
                            assert status_data["total_videos"] == 3
                            assert status_data["completed_videos"] == 3
                            
                            if status_data["merge_status"] == MergeSessionStatus.COMPLETED:
                                merge_completed = True
                                assert "merged_video_url" in status_data
                                assert "merged_video_metadata" in status_data
                                assert status_data["merged_video_metadata"]["total_duration"] == 37.5
                                assert len(status_data["merged_video_metadata"]["segments"]) == 3
                                
                                merged_video_url = status_data["merged_video_url"]
                                merged_video_metadata = status_data["merged_video_metadata"]
                                break
                            
                            attempt += 1
                            time.sleep(0.1)  # Short delay for async processing
                        
                        assert merge_completed, "Merge did not complete within expected time"
                        
                        # Step 4: Create challenge with merged video data
                        challenge_data = {
                            "statements": [
                                {
                                    "text": "I have traveled to all seven continents",
                                    "media_url": merged_video_url,
                                    "segment_start_time": 0.0,
                                    "segment_end_time": 10.0,
                                    "segment_duration": 10.0
                                },
                                {
                                    "text": "I can speak five languages fluently",
                                    "media_url": merged_video_url,
                                    "segment_start_time": 10.0,
                                    "segment_end_time": 22.5,
                                    "segment_duration": 12.5
                                },
                                {
                                    "text": "I have never owned a pet",
                                    "media_url": merged_video_url,
                                    "segment_start_time": 22.5,
                                    "segment_end_time": 37.5,
                                    "segment_duration": 15.0
                                }
                            ],
                            "lie_statement_index": 2,
                            "tags": ["travel", "languages", "pets"],
                            "is_merged_video": True,
                            "merged_video_metadata": merged_video_metadata
                        }
                        
                        create_response = client.post(
                            "/api/v1/challenges/",
                            json=challenge_data,
                            headers=auth_headers
                        )
                        
                        assert create_response.status_code == 200
                        created_challenge = create_response.json()
                        challenge_id = created_challenge["challenge_id"]
                        
                        # Verify challenge structure
                        assert len(created_challenge["statements"]) == 3
                        assert created_challenge["is_merged_video"] is True
                        assert created_challenge["merged_video_metadata"]["total_duration"] == 37.5
                        assert created_challenge["status"] == "published"
                        
                        # Verify segment metadata
                        for i, statement in enumerate(created_challenge["statements"]):
                            expected_segment = merged_video_metadata["segments"][i]
                            assert statement["segment_start_time"] == expected_segment["start_time"]
                            assert statement["segment_end_time"] == expected_segment["end_time"]
                            assert statement["duration_seconds"] == expected_segment["duration"]
                        
                        # Step 5: Retrieve challenge for playback
                        detail_response = client.get(
                            f"/api/v1/challenges/{challenge_id}",
                            headers=auth_headers
                        )
                        
                        assert detail_response.status_code == 200
                        detailed_challenge = detail_response.json()
                        assert detailed_challenge["challenge_id"] == challenge_id
                        assert len(detailed_challenge["statements"]) == 3
                        assert detailed_challenge["merged_video_metadata"]["segment_count"] == 3
                        
                        # Step 6: Test playback functionality by accessing media
                        media_response = client.get(
                            merged_video_url,
                            headers=auth_headers
                        )
                        
                        # Should redirect to signed URL or serve content
                        assert media_response.status_code in [200, 302, 307]
                        
                        # Step 7: Submit guess and verify result
                        lie_statement = None
                        for statement in detailed_challenge["statements"]:
                            if statement["statement_type"] == "lie":
                                lie_statement = statement
                                break
                        
                        assert lie_statement is not None
                        
                        guess_response = client.post(
                            f"/api/v1/challenges/{challenge_id}/guess",
                            json={"guessed_lie_statement_id": lie_statement["statement_id"]},
                            headers=auth_headers
                        )
                        
                        assert guess_response.status_code == 200
                        guess_result = guess_response.json()
                        assert guess_result["is_correct"] is True
                        assert guess_result["challenge_id"] == challenge_id
                        
                        # Step 8: Verify challenge stats updated
                        updated_detail_response = client.get(
                            f"/api/v1/challenges/{challenge_id}",
                            headers=auth_headers
                        )
                        
                        assert updated_detail_response.status_code == 200
                        updated_challenge = updated_detail_response.json()
                        assert updated_challenge["guess_count"] == 1
                        assert updated_challenge["correct_guess_count"] == 1
    
    def test_upload_failure_recovery_and_resume(
        self, client, auth_headers, temp_settings, sample_video_files
    ):
        """Test upload failure scenarios and recovery mechanisms"""
        with patch("config.settings", temp_settings):
            # Step 1: Initiate multi-video upload
            video_filenames = json.dumps([v["filename"] for v in sample_video_files])
            video_file_sizes = json.dumps([v["size"] for v in sample_video_files])
            video_durations = json.dumps([v["duration"] for v in sample_video_files])
            video_mime_types = json.dumps([v["mime_type"] for v in sample_video_files])
            
            initiate_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": video_filenames,
                    "video_file_sizes": video_file_sizes,
                    "video_durations": video_durations,
                    "video_mime_types": video_mime_types,
                    "challenge_title": "Recovery Test Challenge"
                },
                headers=auth_headers
            )
            
            assert initiate_response.status_code == 200
            merge_session_id = initiate_response.json()["merge_session_id"]
            upload_sessions = initiate_response.json()["upload_sessions"]
            
            # Step 2: Upload first video successfully
            video = sample_video_files[0]
            session_id = upload_sessions[0]["session_id"]
            chunk_size = upload_sessions[0]["chunk_size"]
            total_chunks = upload_sessions[0]["total_chunks"]
            
            # Upload all chunks for first video
            for chunk_num in range(total_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, video["size"])
                chunk_data = video["data"][start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                chunk_response = client.post(
                    f"/api/v1/challenge-videos/upload/{session_id}/chunk/{chunk_num}",
                    files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
                
                assert chunk_response.status_code == 200
            
            # Complete first video
            complete_response = client.post(
                f"/api/v1/challenge-videos/upload/{session_id}/complete",
                data={"file_hash": video["hash"]},
                headers=auth_headers
            )
            
            assert complete_response.status_code == 200
            
            # Step 3: Simulate partial upload failure for second video
            video2 = sample_video_files[1]
            session_id2 = upload_sessions[1]["session_id"]
            chunk_size2 = upload_sessions[1]["chunk_size"]
            total_chunks2 = upload_sessions[1]["total_chunks"]
            
            # Upload only first chunk of second video
            chunk_data = video2["data"][:chunk_size2]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            
            chunk_response = client.post(
                f"/api/v1/challenge-videos/upload/{session_id2}/chunk/0",
                files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                data={"chunk_hash": chunk_hash},
                headers=auth_headers
            )
            
            assert chunk_response.status_code == 200
            
            # Step 4: Check upload status to see partial progress
            status_response = client.get(
                f"/api/v1/challenge-videos/upload/{session_id2}/status",
                headers=auth_headers
            )
            
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert status_data["session_id"] == session_id2
            assert 0 in status_data["uploaded_chunks"]
            assert len(status_data["remaining_chunks"]) == total_chunks2 - 1
            assert status_data["status"] == UploadStatus.IN_PROGRESS
            
            # Step 5: Resume upload by uploading remaining chunks
            for chunk_num in status_data["remaining_chunks"]:
                start = chunk_num * chunk_size2
                end = min(start + chunk_size2, video2["size"])
                chunk_data = video2["data"][start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                chunk_response = client.post(
                    f"/api/v1/challenge-videos/upload/{session_id2}/chunk/{chunk_num}",
                    files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
                
                assert chunk_response.status_code == 200
            
            # Complete second video
            complete_response2 = client.post(
                f"/api/v1/challenge-videos/upload/{session_id2}/complete",
                data={"file_hash": video2["hash"]},
                headers=auth_headers
            )
            
            assert complete_response2.status_code == 200
            
            # Step 6: Upload third video normally
            video3 = sample_video_files[2]
            session_id3 = upload_sessions[2]["session_id"]
            chunk_size3 = upload_sessions[2]["chunk_size"]
            total_chunks3 = upload_sessions[2]["total_chunks"]
            
            for chunk_num in range(total_chunks3):
                start = chunk_num * chunk_size3
                end = min(start + chunk_size3, video3["size"])
                chunk_data = video3["data"][start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                chunk_response = client.post(
                    f"/api/v1/challenge-videos/upload/{session_id3}/chunk/{chunk_num}",
                    files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
                
                assert chunk_response.status_code == 200
            
            # Complete third video (should trigger merge)
            complete_response3 = client.post(
                f"/api/v1/challenge-videos/upload/{session_id3}/complete",
                data={"file_hash": video3["hash"]},
                headers=auth_headers
            )
            
            assert complete_response3.status_code == 200
            complete_data3 = complete_response3.json()
            assert complete_data3["merge_triggered"] is True
            
            # Step 7: Verify merge session shows all videos completed
            final_status_response = client.get(
                f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status",
                headers=auth_headers
            )
            
            assert final_status_response.status_code == 200
            final_status_data = final_status_response.json()
            assert final_status_data["total_videos"] == 3
            assert final_status_data["completed_videos"] == 3
            assert final_status_data["failed_videos"] == 0
            assert final_status_data["overall_status"] == "ready_for_merge"
    
    def test_concurrent_multi_user_upload_and_merge(
        self, client, temp_settings, sample_video_files
    ):
        """Test concurrent multi-video uploads from multiple users"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    with patch.object(VideoMergeService, 'merge_videos') as mock_merge:
                        # Mock services
                        mock_upload.return_value = {"success": True, "cloud_path": "test", "etag": "test"}
                        mock_signed_url.return_value = "https://cdn.example.com/test"
                        mock_merge.return_value = {
                            "success": True,
                            "merged_video_path": "/tmp/merged.mp4",
                            "merged_video_data": b"merged_content",
                            "total_duration": 30.0,
                            "segments": [
                                {"start_time": 0.0, "end_time": 10.0, "duration": 10.0, "statement_index": 0},
                                {"start_time": 10.0, "end_time": 20.0, "duration": 10.0, "statement_index": 1},
                                {"start_time": 20.0, "end_time": 30.0, "duration": 10.0, "statement_index": 2}
                            ]
                        }
                        
                        # Create multiple users
                        users = [
                            {"id": "concurrent_user_1", "token": create_test_token("concurrent_user_1")},
                            {"id": "concurrent_user_2", "token": create_test_token("concurrent_user_2")},
                        ]
                        
                        user_merge_sessions = []
                        
                        # Each user initiates multi-video upload
                        for user in users:
                            headers = {"Authorization": f"Bearer {user['token']}"}
                            
                            video_filenames = json.dumps([f"{user['id']}_{v['filename']}" for v in sample_video_files])
                            video_file_sizes = json.dumps([v["size"] for v in sample_video_files])
                            video_durations = json.dumps([v["duration"] for v in sample_video_files])
                            video_mime_types = json.dumps([v["mime_type"] for v in sample_video_files])
                            
                            initiate_response = client.post(
                                "/api/v1/challenge-videos/upload-for-merge/initiate",
                                data={
                                    "video_count": 3,
                                    "video_filenames": video_filenames,
                                    "video_file_sizes": video_file_sizes,
                                    "video_durations": video_durations,
                                    "video_mime_types": video_mime_types,
                                    "challenge_title": f"{user['id']} Challenge"
                                },
                                headers=headers
                            )
                            
                            assert initiate_response.status_code == 200
                            initiate_data = initiate_response.json()
                            user_merge_sessions.append({
                                "user": user,
                                "merge_session_id": initiate_data["merge_session_id"],
                                "upload_sessions": initiate_data["upload_sessions"]
                            })
                        
                        # Each user uploads their videos
                        for user_session in user_merge_sessions:
                            user = user_session["user"]
                            headers = {"Authorization": f"Bearer {user['token']}"}
                            upload_sessions = user_session["upload_sessions"]
                            
                            for i, video in enumerate(sample_video_files):
                                session_id = upload_sessions[i]["session_id"]
                                chunk_size = upload_sessions[i]["chunk_size"]
                                total_chunks = upload_sessions[i]["total_chunks"]
                                
                                # Upload all chunks
                                for chunk_num in range(total_chunks):
                                    start = chunk_num * chunk_size
                                    end = min(start + chunk_size, video["size"])
                                    chunk_data = video["data"][start:end]
                                    chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                                    
                                    chunk_response = client.post(
                                        f"/api/v1/challenge-videos/upload/{session_id}/chunk/{chunk_num}",
                                        files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                                        data={"chunk_hash": chunk_hash},
                                        headers=headers
                                    )
                                    
                                    assert chunk_response.status_code == 200
                                
                                # Complete upload
                                complete_response = client.post(
                                    f"/api/v1/challenge-videos/upload/{session_id}/complete",
                                    data={"file_hash": video["hash"]},
                                    headers=headers
                                )
                                
                                assert complete_response.status_code == 200
                        
                        # Verify both users' merge sessions are independent
                        for user_session in user_merge_sessions:
                            user = user_session["user"]
                            headers = {"Authorization": f"Bearer {user['token']}"}
                            merge_session_id = user_session["merge_session_id"]
                            
                            status_response = client.get(
                                f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status",
                                headers=headers
                            )
                            
                            assert status_response.status_code == 200
                            status_data = status_response.json()
                            assert status_data["merge_session_id"] == merge_session_id
                            assert status_data["total_videos"] == 3
                            assert status_data["completed_videos"] == 3
    
    def test_validation_and_error_handling(
        self, client, auth_headers, temp_settings
    ):
        """Test comprehensive validation and error handling scenarios"""
        with patch("config.settings", temp_settings):
            # Test 1: Invalid video count
            invalid_count_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 2,  # Should be 3
                    "video_filenames": json.dumps(["video1.mp4", "video2.mp4"]),
                    "video_file_sizes": json.dumps([5000000, 4500000]),
                    "video_durations": json.dumps([30.0, 25.0]),
                    "video_mime_types": json.dumps(["video/mp4", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert invalid_count_response.status_code == 400
            assert "Exactly 3 videos are required" in invalid_count_response.json()["detail"]
            
            # Test 2: Invalid JSON parameters
            invalid_json_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": "invalid_json",
                    "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                    "video_durations": json.dumps([30.0, 25.0, 35.0]),
                    "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert invalid_json_response.status_code == 400
            assert "Invalid JSON" in invalid_json_response.json()["detail"]
            
            # Test 3: Mismatched array lengths
            mismatch_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                    "video_file_sizes": json.dumps([5000000, 4500000]),  # Only 2 sizes
                    "video_durations": json.dumps([30.0, 25.0, 35.0]),
                    "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert mismatch_response.status_code == 400
            assert "same length as video_count" in mismatch_response.json()["detail"]
            
            # Test 4: Invalid file sizes
            invalid_size_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                    "video_file_sizes": json.dumps([0, 4500000, 5500000]),  # First video has 0 size
                    "video_durations": json.dumps([30.0, 25.0, 35.0]),
                    "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert invalid_size_response.status_code == 400
            assert "file size must be greater than 0" in invalid_size_response.json()["detail"]
            
            # Test 5: Invalid MIME types
            invalid_mime_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": json.dumps(["video1.mp4", "video2.txt", "video3.mp4"]),
                    "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                    "video_durations": json.dumps([30.0, 25.0, 35.0]),
                    "video_mime_types": json.dumps(["video/mp4", "text/plain", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert invalid_mime_response.status_code == 400
            assert "MIME type" in invalid_mime_response.json()["detail"]
            assert "is not allowed" in invalid_mime_response.json()["detail"]
            
            # Test 6: Invalid durations
            invalid_duration_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                    "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                    "video_durations": json.dumps([30.0, 0.0, 35.0]),  # Second video has 0 duration
                    "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
                },
                headers=auth_headers
            )
            
            assert invalid_duration_response.status_code == 400
            assert "duration must be greater than 0" in invalid_duration_response.json()["detail"]
    
    def test_session_cancellation_and_cleanup(
        self, client, auth_headers, temp_settings, sample_video_files
    ):
        """Test session cancellation and cleanup functionality"""
        with patch("config.settings", temp_settings):
            # Step 1: Initiate multi-video upload
            video_filenames = json.dumps([v["filename"] for v in sample_video_files])
            video_file_sizes = json.dumps([v["size"] for v in sample_video_files])
            video_durations = json.dumps([v["duration"] for v in sample_video_files])
            video_mime_types = json.dumps([v["mime_type"] for v in sample_video_files])
            
            initiate_response = client.post(
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                data={
                    "video_count": 3,
                    "video_filenames": video_filenames,
                    "video_file_sizes": video_file_sizes,
                    "video_durations": video_durations,
                    "video_mime_types": video_mime_types,
                    "challenge_title": "Cancellation Test Challenge"
                },
                headers=auth_headers
            )
            
            assert initiate_response.status_code == 200
            merge_session_id = initiate_response.json()["merge_session_id"]
            upload_sessions = initiate_response.json()["upload_sessions"]
            
            # Step 2: Upload partial data for first video
            video = sample_video_files[0]
            session_id = upload_sessions[0]["session_id"]
            chunk_size = upload_sessions[0]["chunk_size"]
            
            # Upload only first chunk
            chunk_data = video["data"][:chunk_size]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            
            chunk_response = client.post(
                f"/api/v1/challenge-videos/upload/{session_id}/chunk/0",
                files={"file": ("chunk.bin", chunk_data, "application/octet-stream")},
                data={"chunk_hash": chunk_hash},
                headers=auth_headers
            )
            
            assert chunk_response.status_code == 200
            
            # Step 3: Cancel individual upload session
            cancel_individual_response = client.delete(
                f"/api/v1/challenge-videos/upload/{session_id}",
                headers=auth_headers
            )
            
            assert cancel_individual_response.status_code == 200
            cancel_data = cancel_individual_response.json()
            assert "cancelled successfully" in cancel_data["message"]
            assert cancel_data["session_id"] == session_id
            assert cancel_data["merge_session_id"] == merge_session_id
            
            # Step 4: Cancel entire merge session
            cancel_merge_response = client.delete(
                f"/api/v1/challenge-videos/merge-session/{merge_session_id}",
                headers=auth_headers
            )
            
            assert cancel_merge_response.status_code == 200
            cancel_merge_data = cancel_merge_response.json()
            assert "cancelled successfully" in cancel_merge_data["message"]
            assert cancel_merge_data["merge_session_id"] == merge_session_id
            assert cancel_merge_data["total_sessions"] == 3
            
            # Step 5: Verify session is no longer accessible
            status_response = client.get(
                f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status",
                headers=auth_headers
            )
            
            assert status_response.status_code == 404
            assert "Merge session not found" in status_response.json()["detail"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])