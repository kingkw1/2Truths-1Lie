"""
Integration tests for challenge creation rate limiting
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from main import app
from services.challenge_service import ChallengeService
from services.upload_service import ChunkedUploadService
from models import UploadSession, UploadStatus, CreateChallengeRequest
from config import settings

@pytest.fixture
def temp_dir():
    """Create temporary directory for test data"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def mock_settings(temp_dir):
    """Mock settings with test values"""
    with patch.object(settings, 'TEMP_DIR', temp_dir), \
         patch.object(settings, 'UPLOAD_RATE_LIMIT', 2):  # 2 challenges per hour for testing
        yield

@pytest.fixture
def mock_auth():
    """Mock authentication to return test user"""
    with patch('main.get_current_user', return_value="test_user"):
        yield

@pytest.fixture
def mock_upload_service():
    """Mock upload service"""
    mock_service = AsyncMock(spec=ChunkedUploadService)
    
    # Mock upload session
    mock_session = UploadSession(
        session_id="test_session_1",
        user_id="test_user",
        filename="test_video.mp4",
        file_size=1000000,
        chunk_size=1048576,
        total_chunks=1,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED
    )
    
    mock_service.get_upload_status.return_value = mock_session
    return mock_service

@pytest.fixture
def client(mock_settings, mock_auth, mock_upload_service):
    """Create test client with mocked dependencies"""
    with patch('main.upload_service', mock_upload_service):
        with TestClient(app) as client:
            yield client

class TestChallengeRateLimiting:
    """Test rate limiting for challenge creation"""
    
    def test_challenge_creation_within_limit(self, client):
        """Test that challenge creation works within rate limit"""
        challenge_data = {
            "title": "Test Challenge 1",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 1,
            "tags": ["test"]
        }
        
        # First challenge should succeed
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 200
        
        # Check rate limit headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert response.headers["X-RateLimit-Limit"] == "2"
        assert response.headers["X-RateLimit-Remaining"] == "1"
        
        data = response.json()
        assert "challenge_id" in data
        assert data["status"] == "draft"
    
    def test_challenge_creation_at_limit(self, client):
        """Test challenge creation at the rate limit"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 0,
            "tags": ["test"]
        }
        
        # Create challenges up to the limit (2)
        for i in range(2):
            challenge_data["title"] = f"Test Challenge {i+1}"
            response = client.post("/api/v1/challenges", json=challenge_data)
            assert response.status_code == 200
        
        # Third challenge should be rate limited
        challenge_data["title"] = "Test Challenge 3"
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 429
        
        data = response.json()
        assert "Rate limit exceeded" in data["detail"]
        assert "Maximum 2 requests per 1 hour" in data["detail"]
    
    def test_rate_limit_status_endpoint(self, client):
        """Test the rate limit status endpoint"""
        # Check initial status
        response = client.get("/api/v1/users/me/rate-limit")
        assert response.status_code == 200
        
        data = response.json()
        rate_limit = data["rate_limit"]
        assert rate_limit["limit"] == 2
        assert rate_limit["remaining"] == 2
        assert rate_limit["used"] == 0
        assert rate_limit["window_hours"] == 1
        
        # Create a challenge
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 2,
            "tags": ["test"]
        }
        
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 200
        
        # Check updated status
        response = client.get("/api/v1/users/me/rate-limit")
        assert response.status_code == 200
        
        data = response.json()
        rate_limit = data["rate_limit"]
        assert rate_limit["remaining"] == 1
        assert rate_limit["used"] == 1
    
    def test_rate_limit_reset_endpoint(self, client):
        """Test the admin rate limit reset endpoint"""
        # Create challenges up to limit
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 1,
            "tags": ["test"]
        }
        
        for i in range(2):
            challenge_data["title"] = f"Test Challenge {i+1}"
            response = client.post("/api/v1/challenges", json=challenge_data)
            assert response.status_code == 200
        
        # Should be rate limited
        challenge_data["title"] = "Test Challenge 3"
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 429
        
        # Reset rate limit (admin endpoint)
        response = client.post("/api/v1/admin/rate-limit/test_user/reset")
        assert response.status_code == 200
        
        data = response.json()
        assert "Rate limit reset for user test_user" in data["message"]
        
        # Should be able to create challenge again
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 200
    
    def test_rate_limit_cleanup_endpoint(self, client):
        """Test the rate limit cleanup endpoint"""
        response = client.post("/api/v1/admin/cleanup/rate-limits")
        assert response.status_code == 200
        
        data = response.json()
        assert "Cleaned up rate limit data" in data["message"]
    
    def test_rate_limit_different_users(self, client):
        """Test that rate limits are per-user"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 0,
            "tags": ["test"]
        }
        
        # User 1 creates challenges up to limit
        with patch('main.get_current_user', return_value="user1"):
            for i in range(2):
                challenge_data["title"] = f"User1 Challenge {i+1}"
                response = client.post("/api/v1/challenges", json=challenge_data)
                assert response.status_code == 200
            
            # User 1 should be rate limited
            challenge_data["title"] = "User1 Challenge 3"
            response = client.post("/api/v1/challenges", json=challenge_data)
            assert response.status_code == 429
        
        # User 2 should still be able to create challenges
        with patch('main.get_current_user', return_value="user2"):
            challenge_data["title"] = "User2 Challenge 1"
            response = client.post("/api/v1/challenges", json=challenge_data)
            assert response.status_code == 200
    
    def test_rate_limit_error_message_format(self, client):
        """Test that rate limit error messages are user-friendly"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 2,
            "tags": ["test"]
        }
        
        # Create challenges up to limit
        for i in range(2):
            challenge_data["title"] = f"Test Challenge {i+1}"
            response = client.post("/api/v1/challenges", json=challenge_data)
            assert response.status_code == 200
        
        # Next challenge should be rate limited with helpful message
        challenge_data["title"] = "Test Challenge 3"
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 429
        
        data = response.json()
        error_message = data["detail"]
        
        # Should contain helpful information
        assert "Rate limit exceeded" in error_message
        assert "Maximum 2 requests per 1 hour" in error_message
        assert "Try again in" in error_message
        assert "minutes" in error_message or "seconds" in error_message
    
    def test_rate_limit_headers_in_response(self, client):
        """Test that rate limit information is included in response headers"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "test_session_1", "duration_seconds": 10.0},
                {"media_file_id": "test_session_1", "duration_seconds": 12.0},
                {"media_file_id": "test_session_1", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 1,
            "tags": ["test"]
        }
        
        # First request
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 200
        
        # Check headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
        
        assert response.headers["X-RateLimit-Limit"] == "2"
        assert response.headers["X-RateLimit-Remaining"] == "1"
        
        # Second request
        challenge_data["title"] = "Test Challenge 2"
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 200
        
        assert response.headers["X-RateLimit-Remaining"] == "0"