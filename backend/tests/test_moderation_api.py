"""
Integration tests for moderation API endpoints
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from models import ChallengeStatus


class TestModerationAPI:
    """Test cases for moderation API endpoints"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data"""
        temp_dir = Path(tempfile.mkdtemp())
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def client(self, temp_dir, monkeypatch):
        """Create test client with temporary storage"""
        # Mock settings
        class MockSettings:
            TEMP_DIR = temp_dir
            UPLOAD_DIR = temp_dir / "uploads"
            MAX_FILE_SIZE = 100_000_000
            UPLOAD_SESSION_TIMEOUT = 3600
        
        MockSettings.UPLOAD_DIR.mkdir(exist_ok=True)
        
        monkeypatch.setattr('main.settings', MockSettings())
        monkeypatch.setattr('services.upload_service.settings', MockSettings())
        monkeypatch.setattr('services.challenge_service.settings', MockSettings())
        monkeypatch.setattr('services.moderation_service.settings', MockSettings())
        
        return TestClient(app)
    
    def test_flag_challenge_success(self, client):
        """Test successfully flagging a challenge"""
        # First create and publish a challenge
        # Create challenge
        create_response = client.post(
            "/api/v1/challenges",
            json={
                "title": "Test Challenge",
                "statements": [
                    {"media_file_id": "file1", "duration_seconds": 30},
                    {"media_file_id": "file2", "duration_seconds": 25},
                    {"media_file_id": "file3", "duration_seconds": 35}
                ],
                "lie_statement_index": 1,
                "tags": ["test"]
            },
            headers={"Authorization": "Bearer test-user"}
        )
        
        # Mock upload sessions for the challenge creation
        from services.upload_service import ChunkedUploadService
        from models import UploadSession, UploadStatus
        from datetime import datetime
        
        upload_service = ChunkedUploadService()
        for file_id in ["file1", "file2", "file3"]:
            session = UploadSession(
                session_id=file_id,
                user_id="test-user",
                filename=f"{file_id}.mp4",
                file_size=5000000,
                chunk_size=1048576,
                total_chunks=5,
                mime_type="video/mp4",
                status=UploadStatus.COMPLETED,
                completed_at=datetime.utcnow()
            )
            upload_service.sessions[file_id] = session
        
        # Retry challenge creation
        create_response = client.post(
            "/api/v1/challenges",
            json={
                "title": "Test Challenge",
                "statements": [
                    {"media_file_id": "file1", "duration_seconds": 30},
                    {"media_file_id": "file2", "duration_seconds": 25},
                    {"media_file_id": "file3", "duration_seconds": 35}
                ],
                "lie_statement_index": 1,
                "tags": ["test"]
            },
            headers={"Authorization": "Bearer test-user"}
        )
        
        assert create_response.status_code == 200
        challenge_id = create_response.json()["challenge_id"]
        
        # Publish challenge
        publish_response = client.post(
            f"/api/v1/challenges/{challenge_id}/publish",
            headers={"Authorization": "Bearer test-user"}
        )
        assert publish_response.status_code == 200
        
        # Flag the challenge
        flag_response = client.post(
            f"/api/v1/challenges/{challenge_id}/flag",
            json={"reason": "Inappropriate content"},
            headers={"Authorization": "Bearer other-user"}
        )
        
        assert flag_response.status_code == 200
        assert flag_response.json()["message"] == "Challenge flagged successfully"
    
    def test_flag_challenge_not_found(self, client):
        """Test flagging a non-existent challenge"""
        response = client.post(
            "/api/v1/challenges/nonexistent/flag",
            json={"reason": "Test reason"},
            headers={"Authorization": "Bearer test-user"}
        )
        
        assert response.status_code == 400
        assert "Challenge not found" in response.json()["detail"]
    
    def test_get_moderation_status(self, client):
        """Test getting moderation status for a challenge"""
        response = client.get(
            "/api/v1/challenges/test-challenge/moderation",
            headers={"Authorization": "Bearer test-user"}
        )
        
        assert response.status_code == 200
        # Should return None for non-existent challenge
        assert response.json()["moderation"] is None
    
    def test_get_challenges_for_moderation(self, client):
        """Test getting challenges that need moderation"""
        response = client.get(
            "/api/v1/admin/moderation/challenges",
            headers={"Authorization": "Bearer admin-user"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "challenges" in data
        assert "total_count" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_next" in data
    
    def test_get_challenges_for_moderation_filtered(self, client):
        """Test getting challenges for moderation with status filter"""
        response = client.get(
            "/api/v1/admin/moderation/challenges?status=pending",
            headers={"Authorization": "Bearer admin-user"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "challenges" in data
    
    def test_manual_moderation_review_approve(self, client):
        """Test manual moderation review with approval"""
        # This test would need a challenge in pending/flagged status
        # For now, test the endpoint structure
        response = client.post(
            "/api/v1/admin/moderation/challenges/test-challenge/review",
            json={
                "decision": "approved",
                "reason": "Content is appropriate"
            },
            headers={"Authorization": "Bearer admin-user"}
        )
        
        # Will fail because challenge doesn't exist, but tests endpoint structure
        assert response.status_code == 400
        assert "Challenge not found" in response.json()["detail"]
    
    def test_manual_moderation_review_reject(self, client):
        """Test manual moderation review with rejection"""
        response = client.post(
            "/api/v1/admin/moderation/challenges/test-challenge/review",
            json={
                "decision": "rejected",
                "reason": "Violates community guidelines"
            },
            headers={"Authorization": "Bearer admin-user"}
        )
        
        # Will fail because challenge doesn't exist, but tests endpoint structure
        assert response.status_code == 400
        assert "Challenge not found" in response.json()["detail"]
    
    def test_manual_moderation_review_invalid_decision(self, client):
        """Test manual moderation review with invalid decision"""
        response = client.post(
            "/api/v1/admin/moderation/challenges/test-challenge/review",
            json={
                "decision": "invalid_decision",
                "reason": "Test reason"
            },
            headers={"Authorization": "Bearer admin-user"}
        )
        
        assert response.status_code == 400
    
    def test_get_moderation_stats(self, client):
        """Test getting moderation statistics"""
        response = client.get(
            "/api/v1/admin/moderation/stats",
            headers={"Authorization": "Bearer admin-user"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_moderated" in stats
        assert "approved" in stats
        assert "rejected" in stats
        assert "flagged" in stats
        assert "pending" in stats
    
    def test_flag_challenge_validation(self, client):
        """Test flag challenge request validation"""
        # Test missing reason
        response = client.post(
            "/api/v1/challenges/test-challenge/flag",
            json={},
            headers={"Authorization": "Bearer test-user"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_moderation_review_validation(self, client):
        """Test moderation review request validation"""
        # Test missing decision
        response = client.post(
            "/api/v1/admin/moderation/challenges/test-challenge/review",
            json={"reason": "Test reason"},
            headers={"Authorization": "Bearer admin-user"}
        )
        
        assert response.status_code == 422  # Validation error


if __name__ == "__main__":
    pytest.main([__file__])