#!/usr/bin/env python3
"""
End-to-End Integration Tests for Complete Challenge Workflow
Tests the complete flow from media upload through challenge creation, storage, retrieval, and display
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
from unittest.mock import patch, Mock, AsyncMock
from fastapi.testclient import TestClient
from typing import Dict, Any, List

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from services.upload_service import ChunkedUploadService
from services.media_upload_service import MediaUploadService
from services.cloud_storage_service import CloudStorageService
from services.challenge_service import ChallengeService
from services.auth_service import create_test_token
from models import Challenge, Statement, UploadStatus, UploadSession
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
def sample_video_data():
    """Create sample video data for testing"""
    # Create realistic video-like data with proper MP4 header
    header = b"ftypisom"  # MP4 header
    content = b"video_frame_data_segment_" * 2000  # ~50KB of content
    return header + content

class TestCompleteWorkflowIntegration:
    """Test complete end-to-end workflow from upload to display"""
    
    def test_complete_challenge_lifecycle(
        self, client, auth_headers, temp_settings, sample_video_data
    ):
        """Test complete challenge lifecycle: upload -> create -> retrieve -> guess -> delete"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    # Mock cloud storage responses
                    mock_upload.return_value = {
                        "success": True,
                        "cloud_path": "uploads/e2e-test-user/merged_video.mp4",
                        "etag": "e2e-etag-123"
                    }
                    mock_signed_url.return_value = "https://cdn.example.com/e2e-signed-url"
                    
                    # Step 1: Upload merged video
                    file_size = len(sample_video_data)
                    filename = "e2e_merged_video.mp4"
                    
                    # Initiate upload
                    initiate_response = client.post(
                        "/api/v1/media/upload/initiate",
                        data={
                            "filename": filename,
                            "file_size": file_size,
                            "duration_seconds": 45.0,
                            "mime_type": "video/mp4"
                        },
                        headers=auth_headers
                    )
                    
                    assert initiate_response.status_code == 200
                    initiate_data = initiate_response.json()
                    session_id = initiate_data["session_id"]
                    chunk_size = initiate_data["chunk_size"]
                    total_chunks = initiate_data["total_chunks"]
                    
                    # Upload all chunks
                    for chunk_num in range(total_chunks):
                        start = chunk_num * chunk_size
                        end = min(start + chunk_size, file_size)
                        chunk_data = sample_video_data[start:end]
                        chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                        
                        chunk_response = client.post(
                            f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                            files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                            data={"chunk_hash": chunk_hash},
                            headers=auth_headers
                        )
                        
                        assert chunk_response.status_code == 200
                        chunk_result = chunk_response.json()
                        assert chunk_result["chunk_uploaded"] is True
                    
                    # Complete upload
                    file_hash = hashlib.sha256(sample_video_data).hexdigest()
                    complete_response = client.post(
                        f"/api/v1/media/upload/{session_id}/complete",
                        json={"final_file_hash": file_hash},
                        headers=auth_headers
                    )
                    
                    assert complete_response.status_code == 200
                    complete_data = complete_response.json()
                    media_id = complete_data["media_id"]
                    media_url = complete_data["media_url"]
                    
                    # Step 2: Create challenge with uploaded media
                    challenge_data = {
                        "statements": [
                            {
                                "text": "I have traveled to all seven continents",
                                "media_file_id": media_id,
                                "segment_start_time": 0,
                                "segment_end_time": 15,
                                "segment_duration": 15
                            },
                            {
                                "text": "I can speak five languages fluently",
                                "media_file_id": media_id,
                                "segment_start_time": 15,
                                "segment_end_time": 30,
                                "segment_duration": 15
                            },
                            {
                                "text": "I have never owned a pet",
                                "media_file_id": media_id,
                                "segment_start_time": 30,
                                "segment_end_time": 45,
                                "segment_duration": 15
                            }
                        ],
                        "lie_statement_index": 2,
                        "tags": ["travel", "languages", "pets"],
                        "is_merged_video": True,
                        "merged_video_metadata": {
                            "total_duration_ms": 45000,
                            "segment_count": 3,
                            "segments": [
                                {"statement_index": 0, "start_time_ms": 0, "end_time_ms": 15000, "duration_ms": 15000},
                                {"statement_index": 1, "start_time_ms": 15000, "end_time_ms": 30000, "duration_ms": 15000},
                                {"statement_index": 2, "start_time_ms": 30000, "end_time_ms": 45000, "duration_ms": 15000}
                            ]
                        }
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
                    assert created_challenge["merged_video_metadata"]["total_duration_ms"] == 45000
                    assert created_challenge["status"] == "published"
                    
                    # Step 3: Retrieve challenge list
                    list_response = client.get(
                        "/api/v1/challenges/?skip=0&limit=10",
                        headers=auth_headers
                    )
                    
                    assert list_response.status_code == 200
                    list_data = list_response.json()
                    assert list_data["total_count"] >= 1
                    assert len(list_data["challenges"]) >= 1
                    
                    # Find our challenge in the list
                    our_challenge = None
                    for challenge in list_data["challenges"]:
                        if challenge["challenge_id"] == challenge_id:
                            our_challenge = challenge
                            break
                    
                    assert our_challenge is not None
                    assert our_challenge["creator_id"] == "e2e-test-user"
                    
                    # Step 4: Retrieve specific challenge details
                    detail_response = client.get(
                        f"/api/v1/challenges/{challenge_id}",
                        headers=auth_headers
                    )
                    
                    assert detail_response.status_code == 200
                    detailed_challenge = detail_response.json()
                    assert detailed_challenge["challenge_id"] == challenge_id
                    assert len(detailed_challenge["statements"]) == 3
                    assert detailed_challenge["merged_video_metadata"]["segment_count"] == 3
                    
                    # Verify segment metadata
                    for i, statement in enumerate(detailed_challenge["statements"]):
                        expected_start = i * 15
                        expected_end = (i + 1) * 15
                        assert statement["segment_start_time"] == expected_start
                        assert statement["segment_end_time"] == expected_end
                        assert statement["duration_seconds"] == 15
                        assert statement["media_file_id"] == media_id
                    
                    # Step 5: Submit a guess
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
                    
                    # Step 6: Verify challenge stats updated
                    updated_detail_response = client.get(
                        f"/api/v1/challenges/{challenge_id}",
                        headers=auth_headers
                    )
                    
                    assert updated_detail_response.status_code == 200
                    updated_challenge = updated_detail_response.json()
                    assert updated_challenge["guess_count"] == 1
                    assert updated_challenge["correct_guess_count"] == 1
                    
                    # Step 7: Stream media content
                    stream_response = client.get(
                        f"/api/v1/media/stream/{media_id}",
                        headers=auth_headers
                    )
                    
                    assert stream_response.status_code == 200
                    assert stream_response.headers["content-type"] == "video/mp4"
                    assert stream_response.content == sample_video_data
                    
                    # Step 8: Delete challenge (cleanup)
                    delete_response = client.delete(
                        f"/api/v1/challenges/{challenge_id}",
                        headers=auth_headers
                    )
                    
                    assert delete_response.status_code == 200
                    
                    # Verify challenge is deleted
                    deleted_detail_response = client.get(
                        f"/api/v1/challenges/{challenge_id}",
                        headers=auth_headers
                    )
                    
                    assert deleted_detail_response.status_code == 404
    
    def test_concurrent_user_workflows(
        self, client, temp_settings, sample_video_data
    ):
        """Test concurrent workflows from multiple users"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    # Mock cloud storage
                    mock_upload.return_value = {"success": True, "cloud_path": "test", "etag": "test"}
                    mock_signed_url.return_value = "https://cdn.example.com/test"
                    
                    # Create multiple users
                    users = [
                        {"id": "concurrent_user_1", "token": create_test_token("concurrent_user_1")},
                        {"id": "concurrent_user_2", "token": create_test_token("concurrent_user_2")},
                        {"id": "concurrent_user_3", "token": create_test_token("concurrent_user_3")},
                    ]
                    
                    created_challenges = []
                    
                    # Each user creates a challenge
                    for user in users:
                        headers = {"Authorization": f"Bearer {user['token']}"}
                        
                        # Upload media
                        file_size = len(sample_video_data)
                        
                        initiate_response = client.post(
                            "/api/v1/media/upload/initiate",
                            data={
                                "filename": f"{user['id']}_video.mp4",
                                "file_size": file_size,
                                "duration_seconds": 30.0,
                                "mime_type": "video/mp4"
                            },
                            headers=headers
                        )
                        
                        session_id = initiate_response.json()["session_id"]
                        chunk_size = initiate_response.json()["chunk_size"]
                        total_chunks = initiate_response.json()["total_chunks"]
                        
                        # Upload chunks
                        for chunk_num in range(total_chunks):
                            start = chunk_num * chunk_size
                            end = min(start + chunk_size, file_size)
                            chunk_data = sample_video_data[start:end]
                            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                            
                            client.post(
                                f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                                files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                                data={"chunk_hash": chunk_hash},
                                headers=headers
                            )
                        
                        # Complete upload
                        file_hash = hashlib.sha256(sample_video_data).hexdigest()
                        complete_response = client.post(
                            f"/api/v1/media/upload/{session_id}/complete",
                            json={"final_file_hash": file_hash},
                            headers=headers
                        )
                        
                        media_id = complete_response.json()["media_id"]
                        
                        # Create challenge
                        challenge_data = {
                            "statements": [
                                {
                                    "text": f"{user['id']} statement 1",
                                    "media_file_id": media_id,
                                    "segment_start_time": 0,
                                    "segment_end_time": 10,
                                    "segment_duration": 10
                                },
                                {
                                    "text": f"{user['id']} statement 2",
                                    "media_file_id": media_id,
                                    "segment_start_time": 10,
                                    "segment_end_time": 20,
                                    "segment_duration": 10
                                },
                                {
                                    "text": f"{user['id']} statement 3 (lie)",
                                    "media_file_id": media_id,
                                    "segment_start_time": 20,
                                    "segment_end_time": 30,
                                    "segment_duration": 10
                                }
                            ],
                            "lie_statement_index": 2,
                            "is_merged_video": True,
                            "merged_video_metadata": {
                                "total_duration_ms": 30000,
                                "segment_count": 3,
                                "segments": [
                                    {"statement_index": 0, "start_time_ms": 0, "end_time_ms": 10000, "duration_ms": 10000},
                                    {"statement_index": 1, "start_time_ms": 10000, "end_time_ms": 20000, "duration_ms": 10000},
                                    {"statement_index": 2, "start_time_ms": 20000, "end_time_ms": 30000, "duration_ms": 10000}
                                ]
                            }
                        }
                        
                        create_response = client.post(
                            "/api/v1/challenges/",
                            json=challenge_data,
                            headers=headers
                        )
                        
                        assert create_response.status_code == 200
                        created_challenges.append({
                            "challenge": create_response.json(),
                            "user": user
                        })
                    
                    # Verify all challenges were created
                    assert len(created_challenges) == 3
                    
                    # Each user can see all challenges
                    for user in users:
                        headers = {"Authorization": f"Bearer {user['token']}"}
                        
                        list_response = client.get(
                            "/api/v1/challenges/?skip=0&limit=10",
                            headers=headers
                        )
                        
                        assert list_response.status_code == 200
                        list_data = list_response.json()
                        assert list_data["total_count"] >= 3
                    
                    # Cross-user guessing
                    user1_headers = {"Authorization": f"Bearer {users[0]['token']}"}
                    user2_challenge = created_challenges[1]["challenge"]
                    
                    # User 1 guesses on User 2's challenge
                    lie_statement = None
                    for statement in user2_challenge["statements"]:
                        if statement["statement_type"] == "lie":
                            lie_statement = statement
                            break
                    
                    guess_response = client.post(
                        f"/api/v1/challenges/{user2_challenge['challenge_id']}/guess",
                        json={"guessed_lie_statement_id": lie_statement["statement_id"]},
                        headers=user1_headers
                    )
                    
                    assert guess_response.status_code == 200
                    guess_result = guess_response.json()
                    assert guess_result["is_correct"] is True
    
    def test_error_recovery_workflow(
        self, client, auth_headers, temp_settings, sample_video_data
    ):
        """Test error scenarios and recovery mechanisms"""
        with patch("config.settings", temp_settings):
            # Test 1: Upload failure and retry
            file_size = len(sample_video_data)
            
            # Initiate upload
            initiate_response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "error_recovery_video.mp4",
                    "file_size": file_size,
                    "duration_seconds": 25.0,
                    "mime_type": "video/mp4"
                },
                headers=auth_headers
            )
            
            session_id = initiate_response.json()["session_id"]
            chunk_size = initiate_response.json()["chunk_size"]
            total_chunks = initiate_response.json()["total_chunks"]
            
            # Upload first chunk successfully
            chunk_data = sample_video_data[:chunk_size]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            
            chunk_response = client.post(
                f"/api/v1/media/upload/{session_id}/chunk/0",
                files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                data={"chunk_hash": chunk_hash},
                headers=auth_headers
            )
            
            assert chunk_response.status_code == 200
            
            # Check upload status (simulating resume)
            status_response = client.get(
                f"/api/v1/media/upload/{session_id}/status",
                headers=auth_headers
            )
            
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert 0 in status_data["uploaded_chunks"]
            assert len(status_data["remaining_chunks"]) == total_chunks - 1
            
            # Complete remaining chunks
            for chunk_num in status_data["remaining_chunks"]:
                start = chunk_num * chunk_size
                end = min(start + chunk_size, file_size)
                chunk_data = sample_video_data[start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                client.post(
                    f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                    files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
            
            # Complete upload
            file_hash = hashlib.sha256(sample_video_data).hexdigest()
            complete_response = client.post(
                f"/api/v1/media/upload/{session_id}/complete",
                json={"final_file_hash": file_hash},
                headers=auth_headers
            )
            
            assert complete_response.status_code == 200
            
            # Test 2: Invalid challenge creation
            invalid_challenge_data = {
                "statements": [
                    {
                        "text": "Only one statement",
                        "media_file_id": "non-existent-media",
                        "segment_start_time": 0,
                        "segment_end_time": 10,
                        "segment_duration": 10
                    }
                ],
                "lie_statement_index": 0
            }
            
            invalid_create_response = client.post(
                "/api/v1/challenges/",
                json=invalid_challenge_data,
                headers=auth_headers
            )
            
            assert invalid_create_response.status_code == 400
            
            # Test 3: Non-existent challenge retrieval
            nonexistent_response = client.get(
                "/api/v1/challenges/non-existent-challenge-id",
                headers=auth_headers
            )
            
            assert nonexistent_response.status_code == 404
            
            # Test 4: Invalid guess submission
            # First create a valid challenge
            media_id = complete_response.json()["media_id"]
            
            valid_challenge_data = {
                "statements": [
                    {
                        "text": "Valid statement 1",
                        "media_file_id": media_id,
                        "segment_start_time": 0,
                        "segment_end_time": 8,
                        "segment_duration": 8
                    },
                    {
                        "text": "Valid statement 2",
                        "media_file_id": media_id,
                        "segment_start_time": 8,
                        "segment_end_time": 16,
                        "segment_duration": 8
                    },
                    {
                        "text": "Valid statement 3 (lie)",
                        "media_file_id": media_id,
                        "segment_start_time": 16,
                        "segment_end_time": 25,
                        "segment_duration": 9
                    }
                ],
                "lie_statement_index": 2,
                "is_merged_video": True,
                "merged_video_metadata": {
                    "total_duration_ms": 25000,
                    "segment_count": 3,
                    "segments": [
                        {"statement_index": 0, "start_time_ms": 0, "end_time_ms": 8000, "duration_ms": 8000},
                        {"statement_index": 1, "start_time_ms": 8000, "end_time_ms": 16000, "duration_ms": 8000},
                        {"statement_index": 2, "start_time_ms": 16000, "end_time_ms": 25000, "duration_ms": 9000}
                    ]
                }
            }
            
            valid_create_response = client.post(
                "/api/v1/challenges/",
                json=valid_challenge_data,
                headers=auth_headers
            )
            
            assert valid_create_response.status_code == 200
            challenge_id = valid_create_response.json()["challenge_id"]
            
            # Try invalid guess
            invalid_guess_response = client.post(
                f"/api/v1/challenges/{challenge_id}/guess",
                json={"guessed_lie_statement_id": "non-existent-statement"},
                headers=auth_headers
            )
            
            assert invalid_guess_response.status_code == 400
    
    def test_data_validation_and_integrity(
        self, client, auth_headers, temp_settings, sample_video_data
    ):
        """Test data validation and integrity throughout the workflow"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    mock_upload.return_value = {"success": True, "cloud_path": "test", "etag": "test"}
                    mock_signed_url.return_value = "https://cdn.example.com/test"
                    
                    # Upload valid media
                    file_size = len(sample_video_data)
                    
                    initiate_response = client.post(
                        "/api/v1/media/upload/initiate",
                        data={
                            "filename": "validation_test.mp4",
                            "file_size": file_size,
                            "duration_seconds": 40.0,
                            "mime_type": "video/mp4"
                        },
                        headers=auth_headers
                    )
                    
                    session_id = initiate_response.json()["session_id"]
                    chunk_size = initiate_response.json()["chunk_size"]
                    total_chunks = initiate_response.json()["total_chunks"]
                    
                    # Upload all chunks
                    for chunk_num in range(total_chunks):
                        start = chunk_num * chunk_size
                        end = min(start + chunk_size, file_size)
                        chunk_data = sample_video_data[start:end]
                        chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                        
                        client.post(
                            f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                            files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                            data={"chunk_hash": chunk_hash},
                            headers=auth_headers
                        )
                    
                    # Complete upload
                    file_hash = hashlib.sha256(sample_video_data).hexdigest()
                    complete_response = client.post(
                        f"/api/v1/media/upload/{session_id}/complete",
                        json={"final_file_hash": file_hash},
                        headers=auth_headers
                    )
                    
                    media_id = complete_response.json()["media_id"]
                    
                    # Test various validation scenarios
                    validation_tests = [
                        {
                            "name": "Missing statements",
                            "data": {
                                "statements": [],
                                "lie_statement_index": 0
                            },
                            "expected_status": 400
                        },
                        {
                            "name": "Invalid lie index",
                            "data": {
                                "statements": [
                                    {"text": "Statement 1", "media_file_id": media_id, "segment_start_time": 0, "segment_end_time": 10, "segment_duration": 10},
                                    {"text": "Statement 2", "media_file_id": media_id, "segment_start_time": 10, "segment_end_time": 20, "segment_duration": 10},
                                    {"text": "Statement 3", "media_file_id": media_id, "segment_start_time": 20, "segment_end_time": 30, "segment_duration": 10}
                                ],
                                "lie_statement_index": 5  # Invalid index
                            },
                            "expected_status": 400
                        },
                        {
                            "name": "Overlapping segments",
                            "data": {
                                "statements": [
                                    {"text": "Statement 1", "media_file_id": media_id, "segment_start_time": 0, "segment_end_time": 15, "segment_duration": 15},
                                    {"text": "Statement 2", "media_file_id": media_id, "segment_start_time": 10, "segment_end_time": 25, "segment_duration": 15},  # Overlaps
                                    {"text": "Statement 3", "media_file_id": media_id, "segment_start_time": 20, "segment_end_time": 35, "segment_duration": 15}
                                ],
                                "lie_statement_index": 1,
                                "is_merged_video": True,
                                "merged_video_metadata": {
                                    "total_duration_ms": 35000,
                                    "segment_count": 3,
                                    "segments": [
                                        {"statement_index": 0, "start_time_ms": 0, "end_time_ms": 15000, "duration_ms": 15000},
                                        {"statement_index": 1, "start_time_ms": 10000, "end_time_ms": 25000, "duration_ms": 15000},
                                        {"statement_index": 2, "start_time_ms": 20000, "end_time_ms": 35000, "duration_ms": 15000}
                                    ]
                                }
                            },
                            "expected_status": 400
                        },
                        {
                            "name": "Valid challenge",
                            "data": {
                                "statements": [
                                    {"text": "I have climbed Mount Kilimanjaro", "media_file_id": media_id, "segment_start_time": 0, "segment_end_time": 12, "segment_duration": 12},
                                    {"text": "I can juggle five balls", "media_file_id": media_id, "segment_start_time": 12, "segment_end_time": 26, "segment_duration": 14},
                                    {"text": "I have never been to a concert", "media_file_id": media_id, "segment_start_time": 26, "segment_end_time": 40, "segment_duration": 14}
                                ],
                                "lie_statement_index": 2,
                                "tags": ["adventure", "skills", "music"],
                                "is_merged_video": True,
                                "merged_video_metadata": {
                                    "total_duration_ms": 40000,
                                    "segment_count": 3,
                                    "segments": [
                                        {"statement_index": 0, "start_time_ms": 0, "end_time_ms": 12000, "duration_ms": 12000},
                                        {"statement_index": 1, "start_time_ms": 12000, "end_time_ms": 26000, "duration_ms": 14000},
                                        {"statement_index": 2, "start_time_ms": 26000, "end_time_ms": 40000, "duration_ms": 14000}
                                    ]
                                }
                            },
                            "expected_status": 200
                        }
                    ]
                    
                    for test in validation_tests:
                        response = client.post(
                            "/api/v1/challenges/",
                            json=test["data"],
                            headers=auth_headers
                        )
                        
                        assert response.status_code == test["expected_status"], f"Test '{test['name']}' failed"
                        
                        if test["expected_status"] == 200:
                            # Verify the created challenge has correct structure
                            challenge = response.json()
                            assert len(challenge["statements"]) == len(test["data"]["statements"])
                            assert challenge["is_merged_video"] == test["data"]["is_merged_video"]
                            assert challenge["merged_video_metadata"]["segment_count"] == len(test["data"]["statements"])
                            
                            # Verify segment timing consistency
                            for i, statement in enumerate(challenge["statements"]):
                                expected_start = test["data"]["statements"][i]["segment_start_time"]
                                expected_end = test["data"]["statements"][i]["segment_end_time"]
                                expected_duration = test["data"]["statements"][i]["segment_duration"]
                                
                                assert statement["segment_start_time"] == expected_start
                                assert statement["segment_end_time"] == expected_end
                                assert statement["duration_seconds"] == expected_duration

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])