"""
Integration tests for challenge API endpoints
"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch
import tempfile
import shutil
from pathlib import Path

from main import app
from services.auth_service import create_test_token
from models import UploadSession, UploadStatus

@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing"""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path)

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
def sample_upload_session():
    """Sample completed upload session"""
    return UploadSession(
        session_id="test-session-1",
        user_id="test-user",
        filename="test-video.mp4",
        file_size=1000000,
        chunk_size=1024,
        total_chunks=1000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(1000))
    )

class TestChallengeAPI:
    """Test cases for Challenge API endpoints"""
    
    def test_create_challenge_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test successful challenge creation"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                challenge_data = {
                    "title": "Test Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1,
                    "tags": ["test", "demo"]
                }
                
                response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "challenge_id" in data
                assert data["status"] == "draft"
                assert len(data["statements"]) == 3
    
    def test_create_challenge_unauthorized(self, client):
        """Test challenge creation without authentication"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "session-1", "duration_seconds": 10.0},
                {"media_file_id": "session-2", "duration_seconds": 12.0},
                {"media_file_id": "session-3", "duration_seconds": 8.0}
            ],
            "lie_statement_index": 1
        }
        
        response = client.post("/api/v1/challenges", json=challenge_data)
        assert response.status_code == 403
    
    def test_create_challenge_invalid_data(self, client, auth_headers):
        """Test challenge creation with invalid data"""
        challenge_data = {
            "title": "Test Challenge",
            "statements": [
                {"media_file_id": "session-1", "duration_seconds": 10.0}
            ],  # Only 1 statement instead of 3
            "lie_statement_index": 0
        }
        
        response = client.post(
            "/api/v1/challenges",
            json=challenge_data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
    
    def test_publish_challenge_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test successful challenge publishing"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create challenge first
                challenge_data = {
                    "title": "Test Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                create_response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                challenge_id = create_response.json()["challenge_id"]
                
                # Publish challenge
                publish_response = client.post(
                    f"/api/v1/challenges/{challenge_id}/publish",
                    headers=auth_headers
                )
                
                assert publish_response.status_code == 200
                data = publish_response.json()
                assert data["status"] == "published"
                assert "published_at" in data
    
    def test_get_challenge_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test getting a published challenge"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create and publish challenge
                challenge_data = {
                    "title": "Test Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                create_response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                challenge_id = create_response.json()["challenge_id"]
                
                client.post(
                    f"/api/v1/challenges/{challenge_id}/publish",
                    headers=auth_headers
                )
                
                # Get challenge
                get_response = client.get(f"/api/v1/challenges/{challenge_id}")
                
                assert get_response.status_code == 200
                data = get_response.json()
                assert data["challenge_id"] == challenge_id
                assert data["title"] == "Test Challenge"
                assert data["status"] == "published"
    
    def test_list_challenges_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test listing published challenges"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create and publish multiple challenges
                for i in range(3):
                    challenge_data = {
                        "title": f"Test Challenge {i}",
                        "statements": [
                            {"media_file_id": f"session-{i}-1", "duration_seconds": 10.0},
                            {"media_file_id": f"session-{i}-2", "duration_seconds": 12.0},
                            {"media_file_id": f"session-{i}-3", "duration_seconds": 8.0}
                        ],
                        "lie_statement_index": 0
                    }
                    
                    create_response = client.post(
                        "/api/v1/challenges",
                        json=challenge_data,
                        headers=auth_headers
                    )
                    challenge_id = create_response.json()["challenge_id"]
                    
                    client.post(
                        f"/api/v1/challenges/{challenge_id}/publish",
                        headers=auth_headers
                    )
                
                # List challenges
                list_response = client.get("/api/v1/challenges")
                
                assert list_response.status_code == 200
                data = list_response.json()
                assert len(data["challenges"]) == 3
                assert data["total_count"] == 3
                assert data["page"] == 1
    
    def test_submit_guess_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test submitting a guess"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create and publish challenge
                challenge_data = {
                    "title": "Test Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                create_response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                challenge_id = create_response.json()["challenge_id"]
                lie_statement_id = create_response.json()["statements"][1]["statement_id"]
                
                client.post(
                    f"/api/v1/challenges/{challenge_id}/publish",
                    headers=auth_headers
                )
                
                # Create different user token for guessing
                guesser_token = create_test_token("guesser-user")
                guesser_headers = {"Authorization": f"Bearer {guesser_token}"}
                
                # Submit guess
                guess_data = {
                    "guessed_lie_statement_id": lie_statement_id,
                    "response_time_seconds": 15.0
                }
                
                guess_response = client.post(
                    f"/api/v1/challenges/{challenge_id}/guess",
                    json=guess_data,
                    headers=guesser_headers
                )
                
                assert guess_response.status_code == 200
                data = guess_response.json()
                assert data["is_correct"] is True
                assert data["points_earned"] > 0
                assert "guess_id" in data
    
    def test_get_my_challenges(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test getting user's own challenges"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create challenge
                challenge_data = {
                    "title": "My Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                
                # Get user's challenges
                my_challenges_response = client.get(
                    "/api/v1/users/me/challenges",
                    headers=auth_headers
                )
                
                assert my_challenges_response.status_code == 200
                data = my_challenges_response.json()
                assert len(data["challenges"]) == 1
                assert data["challenges"][0]["title"] == "My Challenge"
    
    def test_delete_challenge_success(self, client, auth_headers, temp_dir, sample_upload_session):
        """Test deleting a draft challenge"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = sample_upload_session
                
                # Create challenge (draft)
                challenge_data = {
                    "title": "Test Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                create_response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                challenge_id = create_response.json()["challenge_id"]
                
                # Delete challenge
                delete_response = client.delete(
                    f"/api/v1/challenges/{challenge_id}",
                    headers=auth_headers
                )
                
                assert delete_response.status_code == 200
                assert "deleted successfully" in delete_response.json()["message"]

if __name__ == "__main__":
    pytest.main([__file__])