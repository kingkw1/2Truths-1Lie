"""
Integration tests for multi-video upload and merge endpoints
Tests the complete workflow from upload initiation through merge completion
"""
import pytest
import asyncio
import json
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.challenge_video_endpoints import router as challenge_video_router
from services.video_merge_service import VideoMergeService, VideoMergeError, MergeSessionStatus
from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType, UploadStatus
from services.auth_service import get_current_user
from models import UploadSession, VideoSegmentMetadata, MergedVideoMetadata
from config import Settings

# Create test app
app = FastAPI()
app.include_router(challenge_video_router)

# Override auth dependency for testing
def mock_get_current_user():
    return "test_user"

app.dependency_overrides[get_current_user] = mock_get_current_user

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def temp_settings():
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.USE_CLOUD_STORAGE = False
    settings.MAX_FILE_SIZE = 50_000_000  # 50MB
    settings.MAX_VIDEO_DURATION_SECONDS = 300  # 5 minutes
    settings.ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"]
    
    yield settings
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def sample_video_data():
    """Create sample video data for testing"""
    videos = []
    for i in range(3):
        # Create mock video data
        video_data = b"MOCK_VIDEO_DATA_" + str(i).encode() * 1000
        videos.append({
            "index": i,
            "filename": f"test_video_{i}.mp4",
            "data": video_data,
            "size": len(video_data),
            "duration": 10.0 + i * 2.5,  # 10.0, 12.5, 15.0 seconds
            "mime_type": "video/mp4",
            "hash": hashlib.md5(video_data).hexdigest()
        })
    return videos

@pytest.fixture
def mock_services(temp_settings, monkeypatch):
    """Mock upload and merge services"""
    monkeypatch.setattr('config.settings', temp_settings)
    
    # Mock upload service
    upload_service = Mock(spec=ChunkedUploadService)
    upload_service.sessions = {}
    
    # Mock merge service
    merge_service = Mock(spec=VideoMergeService)
    merge_service.merge_sessions = {}
    
    # Patch the services in the endpoints module
    monkeypatch.setattr('api.challenge_video_endpoints.upload_service', upload_service)
    monkeypatch.setattr('api.challenge_video_endpoints.merge_service', merge_service)
    
    return {
        "upload_service": upload_service,
        "merge_service": merge_service
    }

class TestMultiVideoUploadMergeIntegration:
    """Integration tests for multi-video upload and merge workflow"""
    
    def test_complete_workflow_success(self, client, mock_services, sample_video_data, temp_settings):
        """Test complete workflow from initiation to merge completion"""
        upload_service = mock_services["upload_service"]
        merge_service = mock_services["merge_service"]
        
        # Step 1: Initiate multi-video upload
        video_filenames = json.dumps([v["filename"] for v in sample_video_data])
        video_file_sizes = json.dumps([v["size"] for v in sample_video_data])
        video_durations = json.dumps([v["duration"] for v in sample_video_data])
        video_mime_types = json.dumps([v["mime_type"] for v in sample_video_data])
        
        # Mock upload session creation
        mock_sessions = []
        for i, video in enumerate(sample_video_data):
            session = Mock(spec=UploadSession)
            session.session_id = f"session_{i}"
            session.user_id = "test_user"
            session.filename = video["filename"]
            session.file_size = video["size"]
            session.chunk_size = 1048576
            session.total_chunks = max(1, video["size"] // 1048576 + 1)
            session.status = UploadStatus.PENDING
            session.uploaded_chunks = []
            session.created_at = datetime.utcnow()
            session.updated_at = datetime.utcnow()
            session.completed_at = None
            session.metadata = {
                "merge_session_id": "test_merge_session",
                "video_index": i,
                "video_count": 3,
                "is_merge_video": True
            }
            mock_sessions.append(session)
        
        upload_service.initiate_upload = AsyncMock(side_effect=mock_sessions)
        
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": video_filenames,
                "video_file_sizes": video_file_sizes,
                "video_durations": video_durations,
                "video_mime_types": video_mime_types,
                "challenge_title": "Integration Test Challenge"
            }
        )
        
        assert response.status_code == 200
        initiate_data = response.json()
        merge_session_id = initiate_data["merge_session_id"]
        
        assert initiate_data["total_videos"] == 3
        assert len(initiate_data["upload_sessions"]) == 3
        assert initiate_data["status"] == "initiated"
        
        # Step 2: Upload chunks for each video
        for i, video in enumerate(sample_video_data):
            session_id = f"session_{i}"
            session = mock_sessions[i]
            
            # Mock upload service responses for chunk upload
            upload_service.get_upload_status = AsyncMock(return_value=session)
            
            # Mock successful chunk upload
            updated_session = Mock(spec=UploadSession)
            updated_session.uploaded_chunks = [0]
            updated_session.updated_at = datetime.utcnow()
            upload_service.upload_chunk = AsyncMock(return_value=(updated_session, True))
            upload_service.get_remaining_chunks = Mock(return_value=[])
            upload_service.get_progress_percent = Mock(return_value=100.0)
            
            # Upload single chunk (small test data)
            chunk_response = client.post(
                f"/api/v1/challenge-videos/upload/{session_id}/chunk/0",
                files={"file": ("chunk.bin", video["data"], "application/octet-stream")},
                data={"chunk_hash": video["hash"]}
            )
            
            assert chunk_response.status_code == 200
            chunk_data = chunk_response.json()
            assert chunk_data["session_id"] == session_id
            assert chunk_data["merge_session_id"] == merge_session_id
            assert chunk_data["video_index"] == i
            assert chunk_data["status"] == "uploaded"
        
        # Step 3: Complete uploads for each video
        for i, video in enumerate(sample_video_data):
            session_id = f"session_{i}"
            session = mock_sessions[i]
            
            # Mock completed session
            completed_session = Mock(spec=UploadSession)
            completed_session.status = UploadStatus.COMPLETED
            completed_session.completed_at = datetime.utcnow()
            completed_session.metadata = session.metadata
            
            upload_service.get_upload_status = AsyncMock(side_effect=[session, completed_session])
            upload_service.complete_upload = AsyncMock(return_value=f"/path/to/{video['filename']}")
            
            # Mock merge readiness check
            if i == 2:  # Last video - merge should be ready
                merge_service.check_merge_readiness = AsyncMock(return_value={"ready": True})
                merge_service.initiate_merge = AsyncMock(return_value={
                    "status": MergeSessionStatus.PENDING,
                    "merge_session_id": merge_session_id,
                    "video_count": 3
                })
                merge_service.get_merge_status = AsyncMock(return_value=None)  # Merge not completed yet
            else:
                merge_service.check_merge_readiness = AsyncMock(return_value={"ready": False})
            
            complete_response = client.post(
                f"/api/v1/challenge-videos/upload/{session_id}/complete",
                data={"file_hash": video["hash"]}
            )
            
            assert complete_response.status_code == 200
            complete_data = complete_response.json()
            assert complete_data["session_id"] == session_id
            assert complete_data["status"] == UploadStatus.COMPLETED
            
            if i == 2:  # Last video should trigger merge
                assert complete_data["merge_triggered"] is True
                assert complete_data["merge_status"] == MergeSessionStatus.PENDING
            else:
                assert complete_data["merge_triggered"] is False
        
        # Step 4: Check merge session status
        # Mock sessions in upload service
        upload_service.sessions = {f"session_{i}": mock_sessions[i] for i in range(3)}
        for session in mock_sessions:
            session.status = UploadStatus.COMPLETED
        upload_service.get_progress_percent = Mock(return_value=100.0)
        
        # Mock merge status
        merge_service.get_merge_status = AsyncMock(return_value={
            "status": MergeSessionStatus.PROCESSING,
            "progress": 50.0,
            "merged_video_url": None,
            "merged_video_metadata": None
        })
        
        status_response = client.get(f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status")
        
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data["merge_session_id"] == merge_session_id
        assert status_data["total_videos"] == 3
        assert status_data["completed_videos"] == 3
        assert status_data["overall_status"] == "ready_for_merge"
        assert status_data["merge_triggered"] is True
        assert status_data["merge_status"] == MergeSessionStatus.PROCESSING
        assert status_data["merge_progress_percent"] == 50.0
        
        # Step 5: Simulate merge completion
        mock_segments = [
            {"start_time": 0.0, "end_time": 10.0, "duration": 10.0, "statement_index": 0},
            {"start_time": 10.0, "end_time": 22.5, "duration": 12.5, "statement_index": 1},
            {"start_time": 22.5, "end_time": 37.5, "duration": 15.0, "statement_index": 2}
        ]
        
        merge_service.get_merge_status = AsyncMock(return_value={
            "status": MergeSessionStatus.COMPLETED,
            "progress": 100.0,
            "merged_video_url": "https://cdn.example.com/merged_video.mp4",
            "merged_video_metadata": {
                "total_duration": 37.5,
                "segments": mock_segments
            }
        })
        
        final_status_response = client.get(f"/api/v1/challenge-videos/merge-session/{merge_session_id}/status")
        
        assert final_status_response.status_code == 200
        final_status_data = final_status_response.json()
        assert final_status_data["merge_status"] == MergeSessionStatus.COMPLETED
        assert final_status_data["merge_progress_percent"] == 100.0
        assert final_status_data["merged_video_url"] == "https://cdn.example.com/merged_video.mp4"
        assert final_status_data["merged_video_metadata"]["total_duration"] == 37.5
        assert len(final_status_data["merged_video_metadata"]["segments"]) == 3
    
    def test_upload_failure_and_recovery(self, client, mock_services, sample_video_data):
        """Test upload failure scenarios and recovery"""
        upload_service = mock_services["upload_service"]
        merge_service = mock_services["merge_service"]
        
        # Initiate upload
        video_filenames = json.dumps([v["filename"] for v in sample_video_data])
        video_file_sizes = json.dumps([v["size"] for v in sample_video_data])
        video_durations = json.dumps([v["duration"] for v in sample_video_data])
        video_mime_types = json.dumps([v["mime_type"] for v in sample_video_data])
        
        mock_sessions = []
        for i, video in enumerate(sample_video_data):
            session = Mock(spec=UploadSession)
            session.session_id = f"session_{i}"
            session.user_id = "test_user"
            session.metadata = {
                "merge_session_id": "test_merge_session",
                "video_index": i,
                "is_merge_video": True
            }
            mock_sessions.append(session)
        
        upload_service.initiate_upload = AsyncMock(side_effect=mock_sessions)
        
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": video_filenames,
                "video_file_sizes": video_file_sizes,
                "video_durations": video_durations,
                "video_mime_types": video_mime_types
            }
        )
        
        assert response.status_code == 200
        merge_session_id = response.json()["merge_session_id"]
        
        # Simulate chunk upload failure
        session = mock_sessions[0]
        upload_service.get_upload_status = AsyncMock(return_value=session)
        upload_service.upload_chunk = AsyncMock(
            side_effect=UploadServiceError("Chunk validation failed", UploadErrorType.VALIDATION_ERROR)
        )
        
        chunk_response = client.post(
            f"/api/v1/challenge-videos/upload/session_0/chunk/0",
            files={"file": ("chunk.bin", sample_video_data[0]["data"], "application/octet-stream")}
        )
        
        assert chunk_response.status_code == 400
        assert "Chunk validation failed" in chunk_response.json()["detail"]
        
        # Test recovery - retry chunk upload successfully
        updated_session = Mock(spec=UploadSession)
        updated_session.uploaded_chunks = [0]
        updated_session.updated_at = datetime.utcnow()
        upload_service.upload_chunk = AsyncMock(return_value=(updated_session, True))
        upload_service.get_remaining_chunks = Mock(return_value=[])
        upload_service.get_progress_percent = Mock(return_value=100.0)
        
        retry_response = client.post(
            f"/api/v1/challenge-videos/upload/session_0/chunk/0",
            files={"file": ("chunk.bin", sample_video_data[0]["data"], "application/octet-stream")}
        )
        
        assert retry_response.status_code == 200
        assert retry_response.json()["status"] == "uploaded"
    
    def test_merge_session_cancellation(self, client, mock_services, sample_video_data):
        """Test cancellation of entire merge session"""
        upload_service = mock_services["upload_service"]
        
        # Create mock sessions
        mock_sessions = {}
        for i in range(3):
            session_id = f"session_{i}"
            session = Mock(spec=UploadSession)
            session.user_id = "test_user"
            session.metadata = {
                "merge_session_id": "test_merge_session",
                "video_index": i
            }
            mock_sessions[session_id] = session
        
        upload_service.sessions = mock_sessions
        upload_service.cancel_upload = AsyncMock(return_value=True)
        
        response = client.delete("/api/v1/challenge-videos/merge-session/test_merge_session")
        
        assert response.status_code == 200
        data = response.json()
        assert "cancelled successfully" in data["message"]
        assert data["merge_session_id"] == "test_merge_session"
        assert data["total_sessions"] == 3
        assert data["cancelled_sessions"] == 3
        
        # Verify all sessions were cancelled
        assert upload_service.cancel_upload.call_count == 3
    
    def test_individual_upload_cancellation(self, client, mock_services):
        """Test cancellation of individual upload session"""
        upload_service = mock_services["upload_service"]
        
        session = Mock(spec=UploadSession)
        session.user_id = "test_user"
        session.metadata = {
            "merge_session_id": "test_merge_session",
            "video_index": 0
        }
        
        upload_service.get_upload_status = AsyncMock(return_value=session)
        upload_service.cancel_upload = AsyncMock(return_value=True)
        
        response = client.delete("/api/v1/challenge-videos/upload/session_0")
        
        assert response.status_code == 200
        data = response.json()
        assert "cancelled successfully" in data["message"]
        assert data["session_id"] == "session_0"
        assert data["merge_session_id"] == "test_merge_session"
        assert data["video_index"] == 0
    
    def test_merge_initiation_failure(self, client, mock_services, sample_video_data):
        """Test merge initiation failure scenarios"""
        upload_service = mock_services["upload_service"]
        merge_service = mock_services["merge_service"]
        
        # Setup completed upload session
        session = Mock(spec=UploadSession)
        session.user_id = "test_user"
        session.metadata = {
            "merge_session_id": "test_merge_session",
            "video_index": 2,  # Last video
            "video_count": 3,
            "is_merge_video": True
        }
        
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        completed_session.metadata = session.metadata
        
        upload_service.get_upload_status = AsyncMock(side_effect=[session, completed_session])
        upload_service.complete_upload = AsyncMock(return_value="/path/to/video.mp4")
        
        # Mock merge service failure
        merge_service.check_merge_readiness = AsyncMock(return_value={"ready": True})
        merge_service.initiate_merge = AsyncMock(
            side_effect=VideoMergeError("FFmpeg not available")
        )
        
        response = client.post(
            "/api/v1/challenge-videos/upload/session_2/complete",
            data={"file_hash": "test_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == UploadStatus.COMPLETED
        assert data["merge_triggered"] is False
        assert data["merge_status"] == "failed"
    
    def test_concurrent_uploads(self, client, mock_services, sample_video_data):
        """Test concurrent uploads for multiple videos"""
        upload_service = mock_services["upload_service"]
        
        # Create sessions for concurrent uploads
        mock_sessions = []
        for i, video in enumerate(sample_video_data):
            session = Mock(spec=UploadSession)
            session.session_id = f"session_{i}"
            session.user_id = "test_user"
            session.metadata = {
                "merge_session_id": "concurrent_test_session",
                "video_index": i,
                "is_merge_video": True
            }
            mock_sessions.append(session)
        
        # Mock concurrent chunk uploads
        upload_service.get_upload_status = AsyncMock(side_effect=mock_sessions * 2)  # Called twice per upload
        
        updated_sessions = []
        for session in mock_sessions:
            updated = Mock(spec=UploadSession)
            updated.uploaded_chunks = [0]
            updated.updated_at = datetime.utcnow()
            updated_sessions.append(updated)
        
        upload_service.upload_chunk = AsyncMock(side_effect=[(s, True) for s in updated_sessions])
        upload_service.get_remaining_chunks = Mock(return_value=[])
        upload_service.get_progress_percent = Mock(return_value=100.0)
        
        # Simulate concurrent uploads
        responses = []
        for i, video in enumerate(sample_video_data):
            response = client.post(
                f"/api/v1/challenge-videos/upload/session_{i}/chunk/0",
                files={"file": ("chunk.bin", video["data"], "application/octet-stream")}
            )
            responses.append(response)
        
        # Verify all uploads succeeded
        for i, response in enumerate(responses):
            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == f"session_{i}"
            assert data["merge_session_id"] == "concurrent_test_session"
            assert data["video_index"] == i
            assert data["status"] == "uploaded"
    
    def test_upload_status_monitoring(self, client, mock_services):
        """Test upload status monitoring during progress"""
        upload_service = mock_services["upload_service"]
        
        # Create session with partial progress
        session = Mock(spec=UploadSession)
        session.session_id = "status_test_session"
        session.user_id = "test_user"
        session.filename = "test_video.mp4"
        session.file_size = 10000000
        session.status = UploadStatus.IN_PROGRESS
        session.uploaded_chunks = [0, 1, 2]
        session.total_chunks = 10
        session.created_at = datetime.utcnow()
        session.updated_at = datetime.utcnow()
        session.completed_at = None
        session.metadata = {
            "merge_session_id": "status_merge_session",
            "video_index": 1,
            "video_count": 3,
            "is_merge_video": True
        }
        
        upload_service.get_upload_status = AsyncMock(return_value=session)
        upload_service.get_progress_percent = Mock(return_value=30.0)
        upload_service.get_remaining_chunks = Mock(return_value=[3, 4, 5, 6, 7, 8, 9])
        
        response = client.get("/api/v1/challenge-videos/upload/status_test_session/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "status_test_session"
        assert data["merge_session_id"] == "status_merge_session"
        assert data["video_index"] == 1
        assert data["video_count"] == 3
        assert data["is_merge_video"] is True
        assert data["status"] == UploadStatus.IN_PROGRESS
        assert data["progress_percent"] == 30.0
        assert len(data["uploaded_chunks"]) == 3
        assert len(data["remaining_chunks"]) == 7
        assert data["total_chunks"] == 10
    
    def test_merge_with_quick_completion(self, client, mock_services, sample_video_data):
        """Test merge that completes quickly and returns merged video immediately"""
        upload_service = mock_services["upload_service"]
        merge_service = mock_services["merge_service"]
        
        # Setup last video completion
        session = Mock(spec=UploadSession)
        session.user_id = "test_user"
        session.metadata = {
            "merge_session_id": "quick_merge_session",
            "video_index": 2,
            "video_count": 3,
            "is_merge_video": True
        }
        
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        completed_session.metadata = session.metadata
        
        upload_service.get_upload_status = AsyncMock(side_effect=[session, completed_session])
        upload_service.complete_upload = AsyncMock(return_value="/path/to/video.mp4")
        
        # Mock quick merge completion
        merge_service.check_merge_readiness = AsyncMock(return_value={"ready": True})
        merge_service.initiate_merge = AsyncMock(return_value={
            "status": MergeSessionStatus.PENDING,
            "merge_session_id": "quick_merge_session"
        })
        
        # Mock completed merge status
        mock_segments = [
            {"start_time": 0.0, "end_time": 10.0, "duration": 10.0, "statement_index": 0},
            {"start_time": 10.0, "end_time": 22.5, "duration": 12.5, "statement_index": 1},
            {"start_time": 22.5, "end_time": 37.5, "duration": 15.0, "statement_index": 2}
        ]
        
        merge_service.get_merge_status = AsyncMock(return_value={
            "status": MergeSessionStatus.COMPLETED,
            "merged_video_url": "https://cdn.example.com/quick_merged_video.mp4",
            "merged_video_metadata": {
                "total_duration": 37.5,
                "segments": mock_segments
            }
        })
        
        response = client.post(
            "/api/v1/challenge-videos/upload/session_2/complete",
            data={"file_hash": "test_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["merge_triggered"] is True
        assert data["merge_status"] == "completed"
        assert data["merged_video_url"] == "https://cdn.example.com/quick_merged_video.mp4"
        assert "merged_video_metadata" in data
        assert "segment_metadata" in data
        assert len(data["segment_metadata"]) == 3
        assert data["segment_metadata"][0]["start_time"] == 0.0
        assert data["segment_metadata"][2]["end_time"] == 37.5

class TestMultiVideoUploadValidation:
    """Test validation scenarios for multi-video upload"""
    
    def test_invalid_video_count(self, client):
        """Test upload initiation with invalid video count"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 2,  # Should be 3
                "video_filenames": json.dumps(["video1.mp4", "video2.mp4"]),
                "video_file_sizes": json.dumps([5000000, 4500000]),
                "video_durations": json.dumps([30.0, 25.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "Exactly 3 videos are required" in response.json()["detail"]
    
    def test_invalid_json_parameters(self, client):
        """Test upload initiation with invalid JSON parameters"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": "invalid_json",
                "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                "video_durations": json.dumps([30.0, 25.0, 35.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "Invalid JSON" in response.json()["detail"]
    
    def test_mismatched_array_lengths(self, client):
        """Test upload initiation with mismatched array lengths"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                "video_file_sizes": json.dumps([5000000, 4500000]),  # Only 2 sizes
                "video_durations": json.dumps([30.0, 25.0, 35.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "same length as video_count" in response.json()["detail"]
    
    def test_invalid_file_sizes(self, client):
        """Test upload initiation with invalid file sizes"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                "video_file_sizes": json.dumps([0, 4500000, 5500000]),  # First video has 0 size
                "video_durations": json.dumps([30.0, 25.0, 35.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "file size must be greater than 0" in response.json()["detail"]
    
    def test_invalid_mime_types(self, client):
        """Test upload initiation with invalid MIME types"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": json.dumps(["video1.mp4", "video2.txt", "video3.mp4"]),
                "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                "video_durations": json.dumps([30.0, 25.0, 35.0]),
                "video_mime_types": json.dumps(["video/mp4", "text/plain", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "MIME type" in response.json()["detail"]
        assert "is not allowed" in response.json()["detail"]
    
    def test_invalid_durations(self, client):
        """Test upload initiation with invalid durations"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"]),
                "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                "video_durations": json.dumps([30.0, 0.0, 35.0]),  # Second video has 0 duration
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "duration must be greater than 0" in response.json()["detail"]

class TestMultiVideoUploadErrorHandling:
    """Test error handling scenarios"""
    
    def test_session_not_found(self, client, mock_services):
        """Test operations on non-existent sessions"""
        upload_service = mock_services["upload_service"]
        upload_service.get_upload_status = AsyncMock(return_value=None)
        
        # Test chunk upload
        response = client.post(
            "/api/v1/challenge-videos/upload/nonexistent_session/chunk/0",
            files={"file": ("chunk.bin", b"test data", "application/octet-stream")}
        )
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
        
        # Test status check
        response = client.get("/api/v1/challenge-videos/upload/nonexistent_session/status")
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
        
        # Test completion
        response = client.post("/api/v1/challenge-videos/upload/nonexistent_session/complete")
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
        
        # Test cancellation
        response = client.delete("/api/v1/challenge-videos/upload/nonexistent_session")
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
    
    def test_access_denied(self, client, mock_services):
        """Test access denied scenarios"""
        upload_service = mock_services["upload_service"]
        
        # Create session for different user
        session = Mock(spec=UploadSession)
        session.user_id = "other_user"  # Different from test user
        session.metadata = {"is_merge_video": True}
        
        upload_service.get_upload_status = AsyncMock(return_value=session)
        
        response = client.post(
            "/api/v1/challenge-videos/upload/session_id/chunk/0",
            files={"file": ("chunk.bin", b"test data", "application/octet-stream")}
        )
        
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
    
    def test_non_merge_session_operations(self, client, mock_services):
        """Test operations on non-merge sessions"""
        upload_service = mock_services["upload_service"]
        
        session = Mock(spec=UploadSession)
        session.user_id = "test_user"
        session.metadata = {"is_merge_video": False}  # Not a merge session
        
        upload_service.get_upload_status = AsyncMock(return_value=session)
        
        response = client.post(
            "/api/v1/challenge-videos/upload/session_id/chunk/0",
            files={"file": ("chunk.bin", b"test data", "application/octet-stream")}
        )
        
        assert response.status_code == 400
        assert "only for merge video uploads" in response.json()["detail"]
    
    def test_merge_session_not_found(self, client, mock_services):
        """Test merge session operations on non-existent sessions"""
        upload_service = mock_services["upload_service"]
        upload_service.sessions = {}
        
        # Test status check
        response = client.get("/api/v1/challenge-videos/merge-session/nonexistent_session/status")
        assert response.status_code == 404
        assert "Merge session not found" in response.json()["detail"]
        
        # Test cancellation
        response = client.delete("/api/v1/challenge-videos/merge-session/nonexistent_session")
        assert response.status_code == 404
        assert "Merge session not found" in response.json()["detail"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])