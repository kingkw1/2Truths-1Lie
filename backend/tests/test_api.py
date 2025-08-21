"""
Tests for upload API endpoints
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
from fastapi.testclient import TestClient
import io

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from services.auth_service import create_test_token
from config import Settings

@pytest.fixture
def temp_settings(monkeypatch):
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    
    # Patch the settings
    monkeypatch.setattr('config.settings', settings)
    monkeypatch.setattr('services.upload_service.settings', settings)
    
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
    token = create_test_token("test_user")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def sample_file_data():
    """Create sample file data for testing"""
    return b"Hello, World! " * 1000  # ~13KB

class TestUploadAPI:
    """Test cases for upload API endpoints"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_initiate_upload_success(self, client, auth_headers, temp_settings, sample_file_data):
        """Test successful upload initiation"""
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain",
            "chunk_size": 1024
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data
        assert "upload_url" in data
        assert data["chunk_size"] == 1024
        assert data["total_chunks"] == (len(sample_file_data) + 1023) // 1024
    
    def test_initiate_upload_unauthorized(self, client, sample_file_data):
        """Test upload initiation without authentication"""
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain"
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload)
        assert response.status_code == 403  # No auth header
    
    def test_initiate_upload_invalid_mime_type(self, client, auth_headers):
        """Test upload initiation with invalid MIME type"""
        payload = {
            "filename": "test.exe",
            "file_size": 1000,
            "mime_type": "application/x-executable"
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        assert response.status_code == 400
    
    def test_upload_chunk_success(self, client, auth_headers, temp_settings, sample_file_data):
        """Test successful chunk upload"""
        # First initiate upload
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain",
            "chunk_size": 1024
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        session_id = response.json()["session_id"]
        
        # Upload first chunk
        chunk_data = sample_file_data[:1024]
        chunk_hash = hashlib.sha256(chunk_data).hexdigest()
        
        files = {"file": ("chunk_0", io.BytesIO(chunk_data), "application/octet-stream")}
        data = {"chunk_hash": chunk_hash}
        
        response = client.post(
            f"/api/v1/upload/{session_id}/chunk/0",
            files=files,
            data=data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["chunk_number"] == 0
        assert result["status"] == "uploaded"
        assert 0 in result["uploaded_chunks"]
    
    def test_upload_chunk_session_not_found(self, client, auth_headers, sample_file_data):
        """Test chunk upload with invalid session ID"""
        chunk_data = sample_file_data[:1024]
        files = {"file": ("chunk_0", io.BytesIO(chunk_data), "application/octet-stream")}
        
        response = client.post(
            "/api/v1/upload/invalid_session/chunk/0",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_get_upload_status(self, client, auth_headers, temp_settings, sample_file_data):
        """Test getting upload status"""
        # Initiate upload
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain",
            "chunk_size": 1024
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        session_id = response.json()["session_id"]
        
        # Get status
        response = client.get(f"/api/v1/upload/{session_id}/status", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["session_id"] == session_id
        assert data["status"] == "pending"
        assert data["progress_percent"] == 0.0
    
    def test_cancel_upload(self, client, auth_headers, temp_settings, sample_file_data):
        """Test upload cancellation"""
        # Initiate upload
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain"
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        session_id = response.json()["session_id"]
        
        # Cancel upload
        response = client.delete(f"/api/v1/upload/{session_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify status
        response = client.get(f"/api/v1/upload/{session_id}/status", headers=auth_headers)
        data = response.json()
        assert data["status"] == "cancelled"
    
    def test_complete_upload_success(self, client, auth_headers, temp_settings, sample_file_data):
        """Test successful upload completion"""
        file_hash = hashlib.sha256(sample_file_data).hexdigest()
        chunk_size = 1024
        
        # Initiate upload
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain",
            "chunk_size": chunk_size,
            "file_hash": file_hash
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        session_data = response.json()
        session_id = session_data["session_id"]
        total_chunks = session_data["total_chunks"]
        
        # Upload all chunks
        for i in range(total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(sample_file_data))
            chunk_data = sample_file_data[start:end]
            
            files = {"file": (f"chunk_{i}", io.BytesIO(chunk_data), "application/octet-stream")}
            
            response = client.post(
                f"/api/v1/upload/{session_id}/chunk/{i}",
                files=files,
                headers=auth_headers
            )
            assert response.status_code == 200
        
        # Complete upload
        complete_payload = {
            "session_id": session_id,
            "file_hash": file_hash
        }
        
        response = client.post(
            f"/api/v1/upload/{session_id}/complete",
            json=complete_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert "file_url" in data
    
    def test_complete_upload_missing_chunks(self, client, auth_headers, temp_settings, sample_file_data):
        """Test upload completion with missing chunks"""
        # Initiate upload
        payload = {
            "filename": "test.txt",
            "file_size": len(sample_file_data),
            "mime_type": "text/plain",
            "chunk_size": 1024
        }
        
        response = client.post("/api/v1/upload/initiate", json=payload, headers=auth_headers)
        session_id = response.json()["session_id"]
        
        # Upload only first chunk
        chunk_data = sample_file_data[:1024]
        files = {"file": ("chunk_0", io.BytesIO(chunk_data), "application/octet-stream")}
        
        response = client.post(
            f"/api/v1/upload/{session_id}/chunk/0",
            files=files,
            headers=auth_headers
        )
        
        # Try to complete upload
        complete_payload = {"session_id": session_id}
        response = client.post(
            f"/api/v1/upload/{session_id}/complete",
            json=complete_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 400

if __name__ == "__main__":
    pytest.main([__file__])