"""
Integration tests for validation service with API endpoints
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
def valid_upload_session():
    """Valid completed upload session"""
    return UploadSession(
        session_id="test-session-1",
        user_id="test-user",
        filename="test-video.mp4",
        file_size=5_000_000,  # 5MB
        chunk_size=1024,
        total_chunks=5000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(5000))
    )

@pytest.fixture
def invalid_upload_session():
    """Invalid upload session (audio instead of video)"""
    return UploadSession(
        session_id="test-session-1",
        user_id="test-user",
        filename="test-audio.mp3",
        file_size=1_000_000,
        chunk_size=1024,
        total_chunks=1000,
        mime_type="audio/mp3",  # Invalid - not video
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(1000))
    )

class TestValidationIntegration:
    """Integration tests for validation service with API"""
    
    def test_create_challenge_with_validation_success(
        self, client, auth_headers, temp_dir, valid_upload_session
    ):
        """Test challenge creation with successful validation"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = valid_upload_session
                
                challenge_data = {
                    "title": "Valid Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1,
                    "tags": ["test", "validation"]
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
    
    def test_create_challenge_with_validation_failure_wrong_count(
        self, client, auth_headers, temp_dir
    ):
        """Test challenge creation fails validation with wrong statement count"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            challenge_data = {
                "title": "Invalid Challenge",
                "statements": [
                    {"media_file_id": "session-1", "duration_seconds": 10.0},
                    {"media_file_id": "session-2", "duration_seconds": 12.0}
                ],  # Only 2 statements
                "lie_statement_index": 1
            }
            
            response = client.post(
                "/api/v1/challenges",
                json=challenge_data,
                headers=auth_headers
            )
            
            assert response.status_code == 400
            assert "exactly 3 statements" in response.json()["detail"]
    
    def test_create_challenge_with_validation_failure_invalid_media(
        self, client, auth_headers, temp_dir, invalid_upload_session
    ):
        """Test challenge creation fails validation with invalid media"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = invalid_upload_session
                
                challenge_data = {
                    "title": "Invalid Media Challenge",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                
                assert response.status_code == 400
                assert "must be video" in response.json()["detail"]
    
    def test_validate_challenge_request_endpoint_success(
        self, client, auth_headers, valid_upload_session
    ):
        """Test validation endpoint for challenge request"""
        with patch("main.upload_service.get_upload_status") as mock_upload:
            mock_upload.return_value = valid_upload_session
            
            challenge_data = {
                "title": "Test Challenge",
                "statements": [
                    {"media_file_id": "session-1", "duration_seconds": 10.0},
                    {"media_file_id": "session-2", "duration_seconds": 12.0},
                    {"media_file_id": "session-3", "duration_seconds": 8.0}
                ],
                "lie_statement_index": 1,
                "tags": ["test"]
            }
            
            response = client.post(
                "/api/v1/validation/challenge-request",
                json=challenge_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["is_valid"] is True
            assert "valid" in data["message"].lower()
            assert "details" in data
    
    def test_validate_challenge_request_endpoint_failure(
        self, client, auth_headers
    ):
        """Test validation endpoint fails for invalid request"""
        challenge_data = {
            "title": "Invalid Challenge",
            "statements": [
                {"media_file_id": "session-1", "duration_seconds": 10.0}
            ],  # Only 1 statement
            "lie_statement_index": 0
        }
        
        response = client.post(
            "/api/v1/validation/challenge-request",
            json=challenge_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert "exactly 3 statements" in data["message"]
    
    def test_validate_existing_challenge_endpoint(
        self, client, auth_headers, temp_dir, valid_upload_session
    ):
        """Test validation endpoint for existing challenge"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = valid_upload_session
                
                # Create a challenge first
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
                
                # Validate the existing challenge
                validate_response = client.get(
                    f"/api/v1/validation/challenge/{challenge_id}",
                    headers=auth_headers
                )
                
                assert validate_response.status_code == 200
                data = validate_response.json()
                assert data["challenge_id"] == challenge_id
                assert data["overall_valid"] is True
                assert data["complete_validation"]["is_valid"] is True
                assert data["integrity_validation"]["is_valid"] is True
    
    def test_get_validation_stats_endpoint(self, client, auth_headers):
        """Test validation stats endpoint"""
        response = client.get(
            "/api/v1/validation/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "validation_stats" in data
        assert "total_validations" in data["validation_stats"]
        assert "success_rate" in data["validation_stats"]
    
    def test_clear_validation_history_endpoint(self, client, auth_headers):
        """Test clear validation history endpoint"""
        response = client.post(
            "/api/v1/admin/validation/clear-history",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert "cleared successfully" in response.json()["message"]
    
    def test_publish_challenge_with_validation(
        self, client, auth_headers, temp_dir, valid_upload_session
    ):
        """Test challenge publishing includes validation"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                mock_upload.return_value = valid_upload_session
                
                # Create challenge
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
                
                # Publish challenge (should include validation)
                publish_response = client.post(
                    f"/api/v1/challenges/{challenge_id}/publish",
                    headers=auth_headers
                )
                
                assert publish_response.status_code == 200
                data = publish_response.json()
                assert data["status"] == "published"
    
    def test_validation_prevents_invalid_challenge_creation(
        self, client, auth_headers, temp_dir
    ):
        """Test that validation prevents creation of structurally invalid challenges"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            # Test various invalid scenarios
            invalid_scenarios = [
                {
                    "name": "empty_statements",
                    "data": {
                        "title": "Empty Challenge",
                        "statements": [],
                        "lie_statement_index": 0
                    },
                    "expected_error": "exactly 3 statements"
                },
                {
                    "name": "invalid_lie_index",
                    "data": {
                        "title": "Invalid Lie Index",
                        "statements": [
                            {"media_file_id": "session-1", "duration_seconds": 10.0},
                            {"media_file_id": "session-2", "duration_seconds": 12.0},
                            {"media_file_id": "session-3", "duration_seconds": 8.0}
                        ],
                        "lie_statement_index": 5
                    },
                    "expected_error": "Lie statement index must be between"
                },
                {
                    "name": "too_many_tags",
                    "data": {
                        "title": "Too Many Tags",
                        "statements": [
                            {"media_file_id": "session-1", "duration_seconds": 10.0},
                            {"media_file_id": "session-2", "duration_seconds": 12.0},
                            {"media_file_id": "session-3", "duration_seconds": 8.0}
                        ],
                        "lie_statement_index": 1,
                        "tags": [f"tag{i}" for i in range(15)]  # Too many tags
                    },
                    "expected_error": "cannot have more than 10 tags"
                }
            ]
            
            for scenario in invalid_scenarios:
                response = client.post(
                    "/api/v1/challenges",
                    json=scenario["data"],
                    headers=auth_headers
                )
                
                assert response.status_code == 400, f"Scenario {scenario['name']} should fail"
                assert scenario["expected_error"] in response.json()["detail"], \
                    f"Scenario {scenario['name']} should contain expected error message"

class TestValidationServiceRobustness:
    """Test validation service robustness and edge cases"""
    
    def test_validation_with_network_errors(
        self, client, auth_headers, temp_dir
    ):
        """Test validation handles network/service errors gracefully"""
        with patch("config.settings.TEMP_DIR", temp_dir):
            with patch("main.upload_service.get_upload_status") as mock_upload:
                # Simulate network error
                mock_upload.side_effect = Exception("Network error")
                
                challenge_data = {
                    "title": "Network Error Test",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": 10.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
                
                response = client.post(
                    "/api/v1/challenges",
                    json=challenge_data,
                    headers=auth_headers
                )
                
                assert response.status_code == 400
                assert "validation failed" in response.json()["detail"].lower()
    
    def test_validation_with_malformed_data(self, client, auth_headers):
        """Test validation handles malformed data gracefully"""
        malformed_scenarios = [
            {
                "name": "missing_media_file_id",
                "data": {
                    "title": "Missing Media ID",
                    "statements": [
                        {"duration_seconds": 10.0},  # Missing media_file_id
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
            },
            {
                "name": "negative_duration",
                "data": {
                    "title": "Negative Duration",
                    "statements": [
                        {"media_file_id": "session-1", "duration_seconds": -5.0},
                        {"media_file_id": "session-2", "duration_seconds": 12.0},
                        {"media_file_id": "session-3", "duration_seconds": 8.0}
                    ],
                    "lie_statement_index": 1
                }
            }
        ]
        
        for scenario in malformed_scenarios:
            response = client.post(
                "/api/v1/challenges",
                json=scenario["data"],
                headers=auth_headers
            )
            
            # Should either fail validation or be caught by Pydantic
            assert response.status_code in [400, 422], \
                f"Scenario {scenario['name']} should fail with 400 or 422"

if __name__ == "__main__":
    pytest.main([__file__])