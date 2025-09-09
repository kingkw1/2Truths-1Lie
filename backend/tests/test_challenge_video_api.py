"""
Unit tests for Challenge Video API endpoints - Multi-video upload and merge functionality
"""
import pytest
import asyncio
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import tempfile
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.video_merge_service import VideoMergeService, VideoMergeError, MergeSessionStatus
from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from models import UploadSession, UploadStatus, VideoSegmentMetadata

# Mock FastAPI TestClient for testing
class MockTestClient:
    def __init__(self, app):
        self.app = app
    
    def post(self, url, data=None, files=None):
        return MockResponse(200, {"status": "success"})
    
    def get(self, url):
        return MockResponse(200, {"status": "success"})
    
    def delete(self, url):
        return MockResponse(200, {"status": "success"})

class MockResponse:
    def __init__(self, status_code, json_data, headers=None):
        self.status_code = status_code
        self._json_data = json_data
        self.headers = headers or {}
    
    def json(self):
        return self._json_data

# Use mock client for testing
client = MockTestClient(None)

@pytest.fixture
def mock_auth():
    """Mock authentication to return test user"""
    with patch('api.challenge_video_endpoints.get_current_user') as mock:
        mock.return_value = "test_user"
        yield mock

@pytest.fixture
def mock_upload_service():
    """Mock chunked upload service"""
    service = Mock(spec=ChunkedUploadService)
    service.sessions = {}
    return service

@pytest.fixture
def mock_merge_service():
    """Mock video merge service"""
    service = Mock(spec=VideoMergeService)
    service.merge_sessions = {}
    return service

@pytest.fixture
def mock_upload_session():
    """Create mock upload session"""
    session = Mock(spec=UploadSession)
    session.session_id = "test_session_id"
    session.user_id = "test_user"
    session.filename = "test_video.mp4"
    session.file_size = 5000000
    session.chunk_size = 1048576
    session.total_chunks = 5
    session.status = UploadStatus.PENDING
    session.uploaded_chunks = []
    session.created_at = datetime.utcnow()
    session.updated_at = datetime.utcnow()
    session.completed_at = None
    session.metadata = {
        "merge_session_id": "test_merge_session",
        "video_index": 0,
        "video_count": 3,
        "is_merge_video": True
    }
    return session

class TestChallengeVideoAPI:
    """Test challenge video API endpoints"""
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_initiate_multi_video_upload_success(self, mock_upload_service_patch, mock_auth):
        """Test successful multi-video upload initiation"""
        # Mock upload service responses
        mock_sessions = []
        for i in range(3):
            session = Mock()
            session.session_id = f"session_{i}"
            session.chunk_size = 1048576
            session.total_chunks = 5
            session.created_at = datetime.utcnow()
            mock_sessions.append(session)
        
        mock_upload_service_patch.initiate_upload = AsyncMock(side_effect=mock_sessions)
        
        # Prepare request data
        video_filenames = json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"])
        video_file_sizes = json.dumps([5000000, 4500000, 5500000])
        video_durations = json.dumps([30.0, 25.0, 35.0])
        video_mime_types = json.dumps(["video/mp4", "video/mp4", "video/mp4"])
        
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": video_filenames,
                "video_file_sizes": video_file_sizes,
                "video_durations": video_durations,
                "video_mime_types": video_mime_types,
                "challenge_title": "Test Challenge"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "merge_session_id" in data
        assert data["total_videos"] == 3
        assert len(data["upload_sessions"]) == 3
        assert data["status"] == "initiated"
        assert "estimated_merge_time_seconds" in data
        
        # Check headers
        assert "X-Merge-Session-ID" in response.headers
        assert "X-Total-Videos" in response.headers
    
    def test_initiate_multi_video_upload_invalid_video_count(self, mock_auth):
        """Test multi-video upload initiation with invalid video count"""
        video_filenames = json.dumps(["video1.mp4", "video2.mp4"])  # Only 2 videos
        video_file_sizes = json.dumps([5000000, 4500000])
        video_durations = json.dumps([30.0, 25.0])
        video_mime_types = json.dumps(["video/mp4", "video/mp4"])
        
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 2,  # Should be 3
                "video_filenames": video_filenames,
                "video_file_sizes": video_file_sizes,
                "video_durations": video_durations,
                "video_mime_types": video_mime_types
            }
        )
        
        assert response.status_code == 400
        assert "Exactly 3 videos are required" in response.json()["detail"]
    
    def test_initiate_multi_video_upload_invalid_json(self, mock_auth):
        """Test multi-video upload initiation with invalid JSON"""
        response = client.post(
            "/api/v1/challenge-videos/upload-for-merge/initiate",
            data={
                "video_count": 3,
                "video_filenames": "invalid_json",  # Invalid JSON
                "video_file_sizes": json.dumps([5000000, 4500000, 5500000]),
                "video_durations": json.dumps([30.0, 25.0, 35.0]),
                "video_mime_types": json.dumps(["video/mp4", "video/mp4", "video/mp4"])
            }
        )
        
        assert response.status_code == 400
        assert "Invalid JSON" in response.json()["detail"]
    
    def test_initiate_multi_video_upload_array_length_mismatch(self, mock_auth):
        """Test multi-video upload initiation with mismatched array lengths"""
        video_filenames = json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"])
        video_file_sizes = json.dumps([5000000, 4500000])  # Only 2 sizes for 3 videos
        video_durations = json.dumps([30.0, 25.0, 35.0])
        video_mime_types = json.dumps(["video/mp4", "video/mp4", "video/mp4"])
        
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
        
        assert response.status_code == 400
        assert "same length as video_count" in response.json()["detail"]
    
    def test_initiate_multi_video_upload_invalid_file_size(self, mock_auth):
        """Test multi-video upload initiation with invalid file size"""
        video_filenames = json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"])
        video_file_sizes = json.dumps([0, 4500000, 5500000])  # First video has 0 size
        video_durations = json.dumps([30.0, 25.0, 35.0])
        video_mime_types = json.dumps(["video/mp4", "video/mp4", "video/mp4"])
        
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
        
        assert response.status_code == 400
        assert "file size must be greater than 0" in response.json()["detail"]
    
    def test_initiate_multi_video_upload_invalid_mime_type(self, mock_auth):
        """Test multi-video upload initiation with invalid MIME type"""
        video_filenames = json.dumps(["video1.mp4", "video2.txt", "video3.mp4"])
        video_file_sizes = json.dumps([5000000, 4500000, 5500000])
        video_durations = json.dumps([30.0, 25.0, 35.0])
        video_mime_types = json.dumps(["video/mp4", "text/plain", "video/mp4"])  # Invalid MIME type
        
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
        
        assert response.status_code == 400
        assert "MIME type" in response.json()["detail"]
        assert "is not allowed" in response.json()["detail"]
    
    def test_initiate_multi_video_upload_invalid_duration(self, mock_auth):
        """Test multi-video upload initiation with invalid duration"""
        video_filenames = json.dumps(["video1.mp4", "video2.mp4", "video3.mp4"])
        video_file_sizes = json.dumps([5000000, 4500000, 5500000])
        video_durations = json.dumps([30.0, 0.0, 35.0])  # Second video has 0 duration
        video_mime_types = json.dumps(["video/mp4", "video/mp4", "video/mp4"])
        
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
        
        assert response.status_code == 400
        assert "duration must be greater than 0" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_upload_video_chunk_for_merge_success(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test successful video chunk upload for merge"""
        # Mock upload service responses
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        
        updated_session = Mock(spec=UploadSession)
        updated_session.uploaded_chunks = [0]
        updated_session.updated_at = datetime.utcnow()
        
        mock_upload_service_patch.upload_chunk = AsyncMock(return_value=(updated_session, True))
        mock_upload_service_patch.get_remaining_chunks = Mock(return_value=[1, 2, 3, 4])
        mock_upload_service_patch.get_progress_percent = Mock(return_value=20.0)
        
        # Create test file data
        test_data = b"test chunk data"
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/chunk/0",
            files={"file": ("chunk.bin", test_data, "application/octet-stream")},
            data={"chunk_hash": "test_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test_session_id"
        assert data["merge_session_id"] == "test_merge_session"
        assert data["video_index"] == 0
        assert data["chunk_number"] == 0
        assert data["status"] == "uploaded"
        assert data["progress_percent"] == 20.0
        
        # Check headers
        assert "X-Merge-Session-ID" in response.headers
        assert "X-Video-Index" in response.headers
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_upload_video_chunk_session_not_found(self, mock_upload_service_patch, mock_auth):
        """Test video chunk upload with non-existent session"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=None)
        
        test_data = b"test chunk data"
        
        response = client.post(
            "/api/v1/challenge-videos/upload/nonexistent_session/chunk/0",
            files={"file": ("chunk.bin", test_data, "application/octet-stream")}
        )
        
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_upload_video_chunk_access_denied(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test video chunk upload with access denied"""
        mock_upload_session.user_id = "other_user"  # Different user
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        
        test_data = b"test chunk data"
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/chunk/0",
            files={"file": ("chunk.bin", test_data, "application/octet-stream")}
        )
        
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_upload_video_chunk_not_merge_session(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test video chunk upload for non-merge session"""
        mock_upload_session.metadata = {"is_merge_video": False}  # Not a merge session
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        
        test_data = b"test chunk data"
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/chunk/0",
            files={"file": ("chunk.bin", test_data, "application/octet-stream")}
        )
        
        assert response.status_code == 400
        assert "only for merge video uploads" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_get_merge_upload_status_success(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test getting merge upload status"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.get_progress_percent = Mock(return_value=60.0)
        mock_upload_service_patch.get_remaining_chunks = Mock(return_value=[2, 3, 4])
        
        response = client.get("/api/v1/challenge-videos/upload/test_session_id/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test_session_id"
        assert data["merge_session_id"] == "test_merge_session"
        assert data["video_index"] == 0
        assert data["video_count"] == 3
        assert data["is_merge_video"] is True
        assert data["progress_percent"] == 60.0
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_get_merge_upload_status_not_found(self, mock_upload_service_patch, mock_auth):
        """Test getting merge upload status for non-existent session"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=None)
        
        response = client.get("/api/v1/challenge-videos/upload/nonexistent_session/status")
        
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    @patch('api.challenge_video_endpoints.merge_service')
    def test_complete_merge_video_upload_success(self, mock_merge_service_patch, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test successful merge video upload completion"""
        # Mock upload service
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.complete_upload = AsyncMock(return_value="/path/to/completed/video.mp4")
        
        # Mock completed session
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        mock_upload_service_patch.get_upload_status = AsyncMock(side_effect=[mock_upload_session, completed_session])
        
        # Mock merge service
        mock_merge_service_patch.check_merge_readiness = AsyncMock(return_value={"ready": True})
        mock_merge_service_patch.initiate_merge = AsyncMock(return_value={
            "status": MergeSessionStatus.PENDING,
            "merge_session_id": "test_merge_session"
        })
        mock_merge_service_patch.get_merge_status = AsyncMock(return_value=None)  # Merge not completed yet
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/complete",
            data={"file_hash": "test_file_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test_session_id"
        assert data["merge_session_id"] == "test_merge_session"
        assert data["video_index"] == 0
        assert data["status"] == UploadStatus.COMPLETED
        assert data["ready_for_merge"] is True
        assert data["merge_triggered"] is True
        assert data["merge_status"] == MergeSessionStatus.PENDING
    
    @patch('api.challenge_video_endpoints.upload_service')
    @patch('api.challenge_video_endpoints.merge_service')
    def test_complete_merge_video_upload_with_completed_merge(self, mock_merge_service_patch, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test merge video upload completion when merge completes quickly"""
        # Mock upload service
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.complete_upload = AsyncMock(return_value="/path/to/completed/video.mp4")
        
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        mock_upload_service_patch.get_upload_status = AsyncMock(side_effect=[mock_upload_session, completed_session])
        
        # Mock merge service with completed merge
        mock_merge_service_patch.check_merge_readiness = AsyncMock(return_value={"ready": True})
        mock_merge_service_patch.initiate_merge = AsyncMock(return_value={
            "status": MergeSessionStatus.PENDING,
            "merge_session_id": "test_merge_session"
        })
        
        # Mock completed merge status
        mock_segments = [
            {"start_time": 0.0, "end_time": 10.0, "duration": 10.0, "statement_index": 0},
            {"start_time": 10.0, "end_time": 20.0, "duration": 10.0, "statement_index": 1},
            {"start_time": 20.0, "end_time": 30.0, "duration": 10.0, "statement_index": 2}
        ]
        mock_merge_service_patch.get_merge_status = AsyncMock(return_value={
            "status": MergeSessionStatus.COMPLETED,
            "merged_video_url": "https://cdn.example.com/merged_video.mp4",
            "merged_video_metadata": {
                "total_duration": 30.0,
                "segments": mock_segments
            }
        })
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/complete",
            data={"file_hash": "test_file_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["merge_status"] == "completed"
        assert data["merged_video_url"] == "https://cdn.example.com/merged_video.mp4"
        assert "merged_video_metadata" in data
        assert "segment_metadata" in data
        assert len(data["segment_metadata"]) == 3
    
    @patch('api.challenge_video_endpoints.upload_service')
    @patch('api.challenge_video_endpoints.merge_service')
    def test_complete_merge_video_upload_merge_not_ready(self, mock_merge_service_patch, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test merge video upload completion when merge is not ready"""
        # Mock upload service
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.complete_upload = AsyncMock(return_value="/path/to/completed/video.mp4")
        
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        mock_upload_service_patch.get_upload_status = AsyncMock(side_effect=[mock_upload_session, completed_session])
        
        # Mock merge service - not ready
        mock_merge_service_patch.check_merge_readiness = AsyncMock(return_value={
            "ready": False,
            "error": "Missing videos"
        })
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/complete",
            data={"file_hash": "test_file_hash"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["merge_triggered"] is False
        assert data["merge_status"] == "pending"
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_get_merge_session_status_success(self, mock_upload_service_patch, mock_auth):
        """Test getting merge session status"""
        # Mock upload sessions for merge session
        mock_sessions = {}
        for i in range(3):
            session_id = f"session_{i}"
            session = Mock(spec=UploadSession)
            session.user_id = "test_user"
            session.status = UploadStatus.COMPLETED if i < 2 else UploadStatus.IN_PROGRESS
            session.metadata = {
                "merge_session_id": "test_merge_session",
                "video_index": i,
                "is_merge_video": True
            }
            session.filename = f"video_{i}.mp4"
            session.completed_at = datetime.utcnow() if i < 2 else None
            mock_sessions[session_id] = session
        
        mock_upload_service_patch.sessions = mock_sessions
        mock_upload_service_patch.get_progress_percent = Mock(side_effect=[100.0, 100.0, 50.0])
        
        # Mock merge service
        with patch('api.challenge_video_endpoints.merge_service') as mock_merge_service_patch:
            mock_merge_service_patch.get_merge_status = AsyncMock(return_value={
                "status": MergeSessionStatus.PROCESSING,
                "progress": 75.0,
                "merged_video_url": None,
                "merged_video_metadata": None
            })
            
            response = client.get("/api/v1/challenge-videos/merge-session/test_merge_session/status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["merge_session_id"] == "test_merge_session"
            assert data["total_videos"] == 3
            assert data["completed_videos"] == 2
            assert data["failed_videos"] == 0
            assert data["overall_status"] == "partially_uploaded"
            assert data["ready_for_merge"] is False
            assert data["merge_triggered"] is True
            assert data["merge_status"] == MergeSessionStatus.PROCESSING
            assert data["merge_progress_percent"] == 75.0
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_get_merge_session_status_not_found(self, mock_upload_service_patch, mock_auth):
        """Test getting merge session status for non-existent session"""
        mock_upload_service_patch.sessions = {}
        
        response = client.get("/api/v1/challenge-videos/merge-session/nonexistent_session/status")
        
        assert response.status_code == 404
        assert "Merge session not found" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_cancel_merge_video_upload_success(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test successful merge video upload cancellation"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.cancel_upload = AsyncMock(return_value=True)
        
        response = client.delete("/api/v1/challenge-videos/upload/test_session_id")
        
        assert response.status_code == 200
        data = response.json()
        assert "cancelled successfully" in data["message"]
        assert data["session_id"] == "test_session_id"
        assert data["merge_session_id"] == "test_merge_session"
        assert data["video_index"] == 0
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_cancel_merge_video_upload_not_found(self, mock_upload_service_patch, mock_auth):
        """Test merge video upload cancellation for non-existent session"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=None)
        
        response = client.delete("/api/v1/challenge-videos/upload/nonexistent_session")
        
        assert response.status_code == 404
        assert "Upload session not found" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_cancel_entire_merge_session_success(self, mock_upload_service_patch, mock_auth):
        """Test successful entire merge session cancellation"""
        # Mock upload sessions for merge session
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
        
        mock_upload_service_patch.sessions = mock_sessions
        mock_upload_service_patch.cancel_upload = AsyncMock(return_value=True)
        
        response = client.delete("/api/v1/challenge-videos/merge-session/test_merge_session")
        
        assert response.status_code == 200
        data = response.json()
        assert "cancelled successfully" in data["message"]
        assert data["merge_session_id"] == "test_merge_session"
        assert data["total_sessions"] == 3
        assert data["cancelled_sessions"] == 3
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_cancel_entire_merge_session_not_found(self, mock_upload_service_patch, mock_auth):
        """Test entire merge session cancellation for non-existent session"""
        mock_upload_service_patch.sessions = {}
        
        response = client.delete("/api/v1/challenge-videos/merge-session/nonexistent_session")
        
        assert response.status_code == 404
        assert "Merge session not found" in response.json()["detail"]

class TestChallengeVideoAPIErrorHandling:
    """Test error handling in challenge video API"""
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_upload_chunk_upload_service_error(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test chunk upload with upload service error"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.upload_chunk = AsyncMock(
            side_effect=UploadServiceError("Chunk validation failed", UploadErrorType.VALIDATION_ERROR)
        )
        
        test_data = b"test chunk data"
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/chunk/0",
            files={"file": ("chunk.bin", test_data, "application/octet-stream")}
        )
        
        assert response.status_code == 400
        assert "Chunk validation failed" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    def test_complete_upload_hash_mismatch(self, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test upload completion with hash mismatch"""
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.complete_upload = AsyncMock(
            side_effect=UploadServiceError("Hash mismatch", UploadErrorType.HASH_MISMATCH)
        )
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/complete",
            data={"file_hash": "wrong_hash"}
        )
        
        assert response.status_code == 400
        assert "Hash mismatch" in response.json()["detail"]
    
    @patch('api.challenge_video_endpoints.upload_service')
    @patch('api.challenge_video_endpoints.merge_service')
    def test_complete_upload_merge_initiation_error(self, mock_merge_service_patch, mock_upload_service_patch, mock_auth, mock_upload_session):
        """Test upload completion when merge initiation fails"""
        # Mock upload service
        mock_upload_service_patch.get_upload_status = AsyncMock(return_value=mock_upload_session)
        mock_upload_service_patch.complete_upload = AsyncMock(return_value="/path/to/completed/video.mp4")
        
        completed_session = Mock(spec=UploadSession)
        completed_session.status = UploadStatus.COMPLETED
        completed_session.completed_at = datetime.utcnow()
        mock_upload_service_patch.get_upload_status = AsyncMock(side_effect=[mock_upload_session, completed_session])
        
        # Mock merge service with error
        mock_merge_service_patch.check_merge_readiness = AsyncMock(return_value={"ready": True})
        mock_merge_service_patch.initiate_merge = AsyncMock(
            side_effect=VideoMergeError("Merge initiation failed", "MERGE_ERROR")
        )
        
        response = client.post(
            "/api/v1/challenge-videos/upload/test_session_id/complete",
            data={"file_hash": "test_file_hash"}
        )
        
        assert response.status_code == 200  # Should still succeed for individual upload
        data = response.json()
        assert data["merge_triggered"] is False
        assert data["merge_status"] == "failed"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])