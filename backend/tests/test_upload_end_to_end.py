"""
End-to-end upload tests covering complete upload workflow
Tests integration between all upload components
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
from unittest.mock import patch, AsyncMock, Mock
from fastapi.testclient import TestClient
import json
import time

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from services.upload_service import ChunkedUploadService
from services.media_upload_service import MediaUploadService
from services.cloud_storage_service import CloudStorageService
from services.auth_service import create_test_token
from models import UploadStatus, UploadSession
from config import Settings

@pytest.fixture
def temp_settings():
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    settings.CHUNK_SIZE = 1024 * 1024  # 1MB
    
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
    token = create_test_token("test-user")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def sample_video_file():
    """Create a sample video file for testing"""
    # Create realistic video-like data
    header = b"ftypisom"  # MP4 header
    content = b"video_frame_data_" * 1000  # ~16KB of content
    return header + content

class TestEndToEndUploadFlow:
    """End-to-end tests for complete upload workflow"""
    
    def test_complete_video_upload_workflow(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test complete video upload from initiation to completion"""
        with patch("config.settings", temp_settings):
            file_size = len(sample_video_file)
            filename = "test_video.mp4"
            
            # Step 1: Initiate upload
            initiate_data = {
                "filename": filename,
                "file_size": file_size,
                "duration_seconds": 30.0,
                "mime_type": "video/mp4"
            }
            
            response = client.post(
                "/api/v1/media/upload/initiate",
                data=initiate_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            initiate_result = response.json()
            session_id = initiate_result["session_id"]
            chunk_size = initiate_result["chunk_size"]
            total_chunks = initiate_result["total_chunks"]
            
            # Step 2: Upload chunks
            for chunk_num in range(total_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, file_size)
                chunk_data = sample_video_file[start:end]
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
                
                expected_progress = ((chunk_num + 1) / total_chunks) * 100
                assert abs(chunk_result["progress"] - expected_progress) < 1
            
            # Step 3: Complete upload
            file_hash = hashlib.sha256(sample_video_file).hexdigest()
            complete_response = client.post(
                f"/api/v1/media/upload/{session_id}/complete",
                json={"final_file_hash": file_hash},
                headers=auth_headers
            )
            
            assert complete_response.status_code == 200
            complete_result = complete_response.json()
            assert "media_id" in complete_result
            assert "media_url" in complete_result
            
            media_id = complete_result["media_id"]
            
            # Step 4: Verify file can be streamed
            stream_response = client.get(
                f"/api/v1/media/stream/{media_id}",
                headers=auth_headers
            )
            
            assert stream_response.status_code == 200
            assert stream_response.headers["content-type"] == "video/mp4"
            
            # Verify content matches original
            streamed_content = stream_response.content
            assert streamed_content == sample_video_file
    
    def test_chunked_upload_with_resume(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test upload resume functionality"""
        with patch("config.settings", temp_settings):
            file_size = len(sample_video_file)
            filename = "resume_test.mp4"
            
            # Initiate upload
            initiate_data = {
                "filename": filename,
                "file_size": file_size,
                "duration_seconds": 25.0,
                "mime_type": "video/mp4"
            }
            
            response = client.post(
                "/api/v1/media/upload/initiate",
                data=initiate_data,
                headers=auth_headers
            )
            
            session_id = response.json()["session_id"]
            chunk_size = response.json()["chunk_size"]
            total_chunks = response.json()["total_chunks"]
            
            # Upload first half of chunks
            half_chunks = total_chunks // 2
            for chunk_num in range(half_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, file_size)
                chunk_data = sample_video_file[start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                client.post(
                    f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                    files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
            
            # Check upload status (simulating resume)
            status_response = client.get(
                f"/api/v1/media/upload/{session_id}/status",
                headers=auth_headers
            )
            
            assert status_response.status_code == 200
            status_result = status_response.json()
            assert len(status_result["uploaded_chunks"]) == half_chunks
            assert len(status_result["remaining_chunks"]) == total_chunks - half_chunks
            
            # Resume upload with remaining chunks
            for chunk_num in status_result["remaining_chunks"]:
                start = chunk_num * chunk_size
                end = min(start + chunk_size, file_size)
                chunk_data = sample_video_file[start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                client.post(
                    f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                    files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
            
            # Complete upload
            file_hash = hashlib.sha256(sample_video_file).hexdigest()
            complete_response = client.post(
                f"/api/v1/media/upload/{session_id}/complete",
                json={"final_file_hash": file_hash},
                headers=auth_headers
            )
            
            assert complete_response.status_code == 200
    
    def test_upload_with_cloud_storage_integration(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test upload with cloud storage integration"""
        with patch("config.settings", temp_settings):
            with patch.object(CloudStorageService, 'upload_file') as mock_upload:
                with patch.object(CloudStorageService, 'get_signed_url') as mock_signed_url:
                    # Mock cloud storage responses
                    mock_upload.return_value = {
                        "success": True,
                        "cloud_path": "uploads/test-user/test_video.mp4",
                        "etag": "mock-etag-123"
                    }
                    mock_signed_url.return_value = "https://cdn.example.com/signed-url"
                    
                    file_size = len(sample_video_file)
                    
                    # Complete upload workflow
                    initiate_response = client.post(
                        "/api/v1/media/upload/initiate",
                        data={
                            "filename": "test_video.mp4",
                            "file_size": file_size,
                            "duration_seconds": 30.0,
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
                        chunk_data = sample_video_file[start:end]
                        chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                        
                        client.post(
                            f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                            files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                            data={"chunk_hash": chunk_hash},
                            headers=auth_headers
                        )
                    
                    # Complete upload
                    file_hash = hashlib.sha256(sample_video_file).hexdigest()
                    complete_response = client.post(
                        f"/api/v1/media/upload/{session_id}/complete",
                        json={"final_file_hash": file_hash},
                        headers=auth_headers
                    )
                    
                    assert complete_response.status_code == 200
                    
                    # Verify cloud storage was called
                    mock_upload.assert_called_once()
                    mock_signed_url.assert_called_once()
    
    def test_concurrent_uploads_different_users(
        self, client, temp_settings, sample_video_file
    ):
        """Test concurrent uploads from different users"""
        with patch("config.settings", temp_settings):
            # Create tokens for different users
            user1_token = create_test_token("user1")
            user2_token = create_test_token("user2")
            user3_token = create_test_token("user3")
            
            users = [
                {"headers": {"Authorization": f"Bearer {user1_token}"}, "id": "user1"},
                {"headers": {"Authorization": f"Bearer {user2_token}"}, "id": "user2"},
                {"headers": {"Authorization": f"Bearer {user3_token}"}, "id": "user3"},
            ]
            
            file_size = len(sample_video_file)
            
            # Initiate uploads for all users
            sessions = []
            for user in users:
                response = client.post(
                    "/api/v1/media/upload/initiate",
                    data={
                        "filename": f"{user['id']}_video.mp4",
                        "file_size": file_size,
                        "duration_seconds": 30.0,
                        "mime_type": "video/mp4"
                    },
                    headers=user["headers"]
                )
                
                assert response.status_code == 200
                session_data = response.json()
                sessions.append({
                    "session_id": session_data["session_id"],
                    "chunk_size": session_data["chunk_size"],
                    "total_chunks": session_data["total_chunks"],
                    "user": user
                })
            
            # Upload chunks for all users concurrently
            for session in sessions:
                for chunk_num in range(session["total_chunks"]):
                    start = chunk_num * session["chunk_size"]
                    end = min(start + session["chunk_size"], file_size)
                    chunk_data = sample_video_file[start:end]
                    chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                    
                    response = client.post(
                        f"/api/v1/media/upload/{session['session_id']}/chunk/{chunk_num}",
                        files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                        data={"chunk_hash": chunk_hash},
                        headers=session["user"]["headers"]
                    )
                    
                    assert response.status_code == 200
            
            # Complete all uploads
            completed_uploads = []
            for session in sessions:
                file_hash = hashlib.sha256(sample_video_file).hexdigest()
                response = client.post(
                    f"/api/v1/media/upload/{session['session_id']}/complete",
                    json={"final_file_hash": file_hash},
                    headers=session["user"]["headers"]
                )
                
                assert response.status_code == 200
                completed_uploads.append(response.json())
            
            # Verify all uploads completed successfully
            assert len(completed_uploads) == 3
            for upload in completed_uploads:
                assert "media_id" in upload
                assert "media_url" in upload

class TestUploadErrorScenarios:
    """Test various error scenarios in upload workflow"""
    
    def test_upload_with_invalid_file_type(self, client, auth_headers, temp_settings):
        """Test upload rejection for invalid file types"""
        with patch("config.settings", temp_settings):
            # Try to upload a text file as video
            response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "malicious.txt",
                    "file_size": 1000,
                    "duration_seconds": 30.0,
                    "mime_type": "text/plain"
                },
                headers=auth_headers
            )
            
            assert response.status_code == 400
            assert "Invalid file extension" in response.json()["detail"]
    
    def test_upload_exceeding_size_limit(self, client, auth_headers, temp_settings):
        """Test upload rejection for files exceeding size limit"""
        with patch("config.settings", temp_settings):
            # Try to upload file larger than limit
            large_size = temp_settings.MAX_FILE_SIZE + 1
            
            response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "large_video.mp4",
                    "file_size": large_size,
                    "duration_seconds": 300.0,
                    "mime_type": "video/mp4"
                },
                headers=auth_headers
            )
            
            assert response.status_code == 400
            assert "exceeds maximum" in response.json()["detail"]
    
    def test_chunk_upload_with_wrong_hash(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test chunk upload rejection for hash mismatch"""
        with patch("config.settings", temp_settings):
            # Initiate upload
            response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "test_video.mp4",
                    "file_size": len(sample_video_file),
                    "duration_seconds": 30.0,
                    "mime_type": "video/mp4"
                },
                headers=auth_headers
            )
            
            session_id = response.json()["session_id"]
            chunk_data = sample_video_file[:1024]
            wrong_hash = "wrong_hash_value"
            
            # Try to upload chunk with wrong hash
            response = client.post(
                f"/api/v1/media/upload/{session_id}/chunk/0",
                files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                data={"chunk_hash": wrong_hash},
                headers=auth_headers
            )
            
            assert response.status_code == 400
            assert "hash mismatch" in response.json()["detail"].lower()
    
    def test_complete_upload_with_missing_chunks(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test upload completion rejection when chunks are missing"""
        with patch("config.settings", temp_settings):
            # Initiate upload
            response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "incomplete_video.mp4",
                    "file_size": len(sample_video_file),
                    "duration_seconds": 30.0,
                    "mime_type": "video/mp4"
                },
                headers=auth_headers
            )
            
            session_id = response.json()["session_id"]
            
            # Upload only first chunk (leave others missing)
            chunk_data = sample_video_file[:1024]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            
            client.post(
                f"/api/v1/media/upload/{session_id}/chunk/0",
                files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                data={"chunk_hash": chunk_hash},
                headers=auth_headers
            )
            
            # Try to complete upload with missing chunks
            file_hash = hashlib.sha256(sample_video_file).hexdigest()
            response = client.post(
                f"/api/v1/media/upload/{session_id}/complete",
                json={"final_file_hash": file_hash},
                headers=auth_headers
            )
            
            assert response.status_code == 400
            assert "missing chunks" in response.json()["detail"].lower()

class TestUploadPerformance:
    """Performance tests for upload functionality"""
    
    def test_large_file_upload_performance(
        self, client, auth_headers, temp_settings
    ):
        """Test performance with large file uploads"""
        with patch("config.settings", temp_settings):
            # Create a larger test file (10MB)
            large_file_size = 10 * 1024 * 1024
            large_file_data = b"video_data_" * (large_file_size // 11)
            
            start_time = time.time()
            
            # Initiate upload
            response = client.post(
                "/api/v1/media/upload/initiate",
                data={
                    "filename": "large_video.mp4",
                    "file_size": len(large_file_data),
                    "duration_seconds": 120.0,
                    "mime_type": "video/mp4"
                },
                headers=auth_headers
            )
            
            session_id = response.json()["session_id"]
            chunk_size = response.json()["chunk_size"]
            total_chunks = response.json()["total_chunks"]
            
            # Upload all chunks
            for chunk_num in range(total_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, len(large_file_data))
                chunk_data = large_file_data[start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                client.post(
                    f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                    files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                    data={"chunk_hash": chunk_hash},
                    headers=auth_headers
                )
            
            # Complete upload
            file_hash = hashlib.sha256(large_file_data).hexdigest()
            client.post(
                f"/api/v1/media/upload/{session_id}/complete",
                json={"final_file_hash": file_hash},
                headers=auth_headers
            )
            
            end_time = time.time()
            upload_time = end_time - start_time
            
            # Should complete within reasonable time (adjust threshold as needed)
            assert upload_time < 30.0  # 30 seconds for 10MB
            
            # Calculate throughput
            throughput_mbps = (len(large_file_data) / (1024 * 1024)) / upload_time
            assert throughput_mbps > 0.1  # At least 0.1 MB/s
    
    def test_memory_usage_during_upload(
        self, client, auth_headers, temp_settings, sample_video_file
    ):
        """Test memory usage remains reasonable during upload"""
        import psutil
        import os
        
        with patch("config.settings", temp_settings):
            process = psutil.Process(os.getpid())
            initial_memory = process.memory_info().rss
            
            # Perform multiple uploads to test memory accumulation
            for i in range(5):
                response = client.post(
                    "/api/v1/media/upload/initiate",
                    data={
                        "filename": f"memory_test_{i}.mp4",
                        "file_size": len(sample_video_file),
                        "duration_seconds": 30.0,
                        "mime_type": "video/mp4"
                    },
                    headers=auth_headers
                )
                
                session_id = response.json()["session_id"]
                chunk_size = response.json()["chunk_size"]
                total_chunks = response.json()["total_chunks"]
                
                # Upload all chunks
                for chunk_num in range(total_chunks):
                    start = chunk_num * chunk_size
                    end = min(start + chunk_size, len(sample_video_file))
                    chunk_data = sample_video_file[start:end]
                    chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                    
                    client.post(
                        f"/api/v1/media/upload/{session_id}/chunk/{chunk_num}",
                        files={"chunk": ("chunk", chunk_data, "application/octet-stream")},
                        data={"chunk_hash": chunk_hash},
                        headers=auth_headers
                    )
                
                # Complete upload
                file_hash = hashlib.sha256(sample_video_file).hexdigest()
                client.post(
                    f"/api/v1/media/upload/{session_id}/complete",
                    json={"final_file_hash": file_hash},
                    headers=auth_headers
                )
            
            final_memory = process.memory_info().rss
            memory_increase = final_memory - initial_memory
            
            # Memory increase should be reasonable (less than 50MB for 5 uploads)
            assert memory_increase < 50 * 1024 * 1024

if __name__ == "__main__":
    pytest.main([__file__, "-v"])