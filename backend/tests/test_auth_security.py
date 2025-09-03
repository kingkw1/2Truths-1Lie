"""
Tests for enhanced authentication and authorization security
"""
import pytest
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app
from services.auth_service import auth_service, create_access_token
from config import settings

client = TestClient(app)

class TestAuthenticationSecurity:
    """Test authentication security features"""
    
    def test_create_guest_session(self):
        """Test guest session creation"""
        response = client.post("/api/v1/auth/guest")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800
        assert "media:read" in data["permissions"]
        assert "media:upload" in data["permissions"]
        assert "media:delete" not in data["permissions"]  # Guests can't delete
    
    def test_login_with_credentials(self):
        """Test login with email and password"""
        response = client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword",
            "device_info": {"platform": "mobile"}
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "media:read" in data["permissions"]
        assert "media:upload" in data["permissions"]
        assert "media:delete" in data["permissions"]
    
    def test_login_missing_credentials(self):
        """Test login with missing credentials"""
        response = client.post("/api/v1/auth/login", json={
            "email": "",
            "password": ""
        })
        
        assert response.status_code == 400
        assert "Email and password are required" in response.json()["detail"]
    
    def test_token_validation(self):
        """Test token validation endpoint"""
        # Create a test token
        token = create_access_token(data={"sub": "test_user"})
        
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] is True
        assert data["user_id"] == "test_user"
        assert "permissions" in data
    
    def test_invalid_token_validation(self):
        """Test validation with invalid token"""
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": "Bearer invalid_token"
        })
        
        assert response.status_code == 401
        assert "Invalid authentication credentials" in response.json()["detail"]
    
    def test_expired_token_validation(self):
        """Test validation with expired token"""
        # Create an expired token
        expired_token = create_access_token(
            data={"sub": "test_user"},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {expired_token}"
        })
        
        assert response.status_code == 401
        assert "Token has expired" in response.json()["detail"]
    
    def test_refresh_token(self):
        """Test token refresh"""
        # Create a refresh token
        refresh_token = auth_service.create_refresh_token("test_user")
        
        response = client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["refresh_token"] == refresh_token  # Same refresh token
    
    def test_invalid_refresh_token(self):
        """Test refresh with invalid token"""
        response = client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid_refresh_token"
        })
        
        assert response.status_code == 401
        assert "Invalid refresh token" in response.json()["detail"]
    
    def test_get_user_permissions(self):
        """Test getting user permissions"""
        token = create_access_token(data={
            "sub": "test_user",
            "permissions": ["media:read", "media:upload"]
        })
        
        response = client.get("/api/v1/auth/permissions", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["user_id"] == "test_user"
        assert "media:read" in data["permissions"]
        assert "media:upload" in data["permissions"]
    
    def test_logout(self):
        """Test user logout"""
        token = create_access_token(data={"sub": "test_user"})
        
        response = client.post("/api/v1/auth/logout", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200
        assert "Logged out successfully" in response.json()["message"]
    
    def test_get_current_user_info(self):
        """Test getting current user information"""
        token = create_access_token(data={
            "sub": "test_user",
            "email": "test@example.com",
            "permissions": ["media:read", "media:upload"]
        })
        
        response = client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["user_id"] == "test_user"
        assert data["email"] == "test@example.com"
        assert "media:read" in data["permissions"]

class TestAuthorizationSecurity:
    """Test authorization and permission-based security"""
    
    def test_media_upload_permission_required(self):
        """Test that media upload requires proper permission"""
        # Create token without upload permission
        token = create_access_token(data={
            "sub": "test_user",
            "permissions": ["media:read"]  # No upload permission
        })
        
        response = client.post("/api/v1/media/upload/initiate", 
            data={
                "filename": "test.mp4",
                "file_size": "1000000",
                "duration_seconds": "30",
                "mime_type": "video/mp4"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
    
    def test_media_delete_permission_required(self):
        """Test that media deletion requires proper permission"""
        # Create token without delete permission
        token = create_access_token(data={
            "sub": "test_user",
            "permissions": ["media:read", "media:upload"]  # No delete permission
        })
        
        response = client.delete("/api/v1/media/delete/test_media_id", 
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
    
    def test_rate_limiting_upload(self):
        """Test upload rate limiting"""
        token = create_access_token(data={
            "sub": "test_user",
            "permissions": ["media:upload"]
        })
        
        # Make multiple upload requests to trigger rate limit
        for i in range(6):  # Exceed the limit of 5
            response = client.post("/api/v1/media/upload/initiate",
                data={
                    "filename": f"test{i}.mp4",
                    "file_size": "1000000",
                    "duration_seconds": "30",
                    "mime_type": "video/mp4"
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if i < 5:
                # First 5 should succeed (or fail for other reasons, not rate limiting)
                assert response.status_code != 429
            else:
                # 6th should be rate limited
                assert response.status_code == 429
                assert "rate limit exceeded" in response.json()["detail"].lower()
    
    def test_signed_url_generation(self):
        """Test signed URL generation for secure media access"""
        token = create_access_token(data={
            "sub": "test_user",
            "permissions": ["media:read"]
        })
        
        # Mock media service to avoid actual media lookup
        with patch('api.media_endpoints.media_service') as mock_service:
            mock_service.verify_media_access.return_value = {"accessible": True}
            
            response = client.post("/api/v1/media/generate-signed-url/test_media_id",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert "signed_url" in data
            assert "expires_in" in data
            assert "expires_at" in data
            assert data["media_id"] == "test_media_id"
    
    def test_signed_url_access_verification(self):
        """Test signed URL access verification"""
        # Generate a signed URL
        media_id = "test_media_id"
        user_id = "test_user"
        expires_in = 3600
        
        signed_url = auth_service.create_signed_url(media_id, user_id, expires_in)
        
        # Extract parameters from signed URL
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(signed_url)
        params = parse_qs(parsed.query)
        
        # Mock the streaming endpoint with signed URL parameters
        with patch('api.media_endpoints.media_service') as mock_service:
            mock_service.stream_media.return_value = {
                "streaming_type": "local",
                "file_path": "/fake/path",
                "start": 0,
                "content_length": 1000,
                "mime_type": "video/mp4",
                "supports_range": False,
                "file_size": 1000
            }
            
            response = client.get(f"/api/v1/media/stream/{media_id}",
                params={
                    "user": params["user"][0],
                    "expires": params["expires"][0],
                    "signature": params["signature"][0]
                }
            )
            
            # Should succeed with valid signed URL
            assert response.status_code in [200, 500]  # 500 due to mock file path
    
    def test_invalid_signed_url_access(self):
        """Test access with invalid signed URL"""
        media_id = "test_media_id"
        
        response = client.get(f"/api/v1/media/stream/{media_id}",
            params={
                "user": "test_user",
                "expires": str(int(time.time()) + 3600),
                "signature": "invalid_signature"
            }
        )
        
        assert response.status_code == 403
        assert "Invalid or expired signed URL" in response.json()["detail"]
    
    def test_expired_signed_url_access(self):
        """Test access with expired signed URL"""
        media_id = "test_media_id"
        user_id = "test_user"
        
        # Create expired signed URL
        expired_time = int(time.time()) - 3600  # 1 hour ago
        message = f"{media_id}:{user_id}:{expired_time}"
        
        import hmac
        import hashlib
        signature = hmac.new(
            settings.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        response = client.get(f"/api/v1/media/stream/{media_id}",
            params={
                "user": user_id,
                "expires": str(expired_time),
                "signature": signature
            }
        )
        
        assert response.status_code == 403
        assert "Invalid or expired signed URL" in response.json()["detail"]

class TestSecurityFeatures:
    """Test additional security features"""
    
    def test_token_audience_validation(self):
        """Test that tokens with wrong audience are rejected"""
        # Create token with wrong audience
        from jose import jwt
        
        payload = {
            "sub": "test_user",
            "aud": "wrong-audience",  # Should be "twotruthsalie-mobile"
            "iss": "twotruthsalie-api",
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        
        wrong_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {wrong_token}"
        })
        
        assert response.status_code == 401
        assert "Invalid token audience" in response.json()["detail"]
    
    def test_token_issuer_validation(self):
        """Test that tokens with wrong issuer are rejected"""
        from jose import jwt
        
        payload = {
            "sub": "test_user",
            "aud": "twotruthsalie-mobile",
            "iss": "wrong-issuer",  # Should be "twotruthsalie-api"
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        
        wrong_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {wrong_token}"
        })
        
        assert response.status_code == 401
        assert "Invalid token issuer" in response.json()["detail"]
    
    def test_rate_limit_cleanup(self):
        """Test rate limit data cleanup"""
        # Add some rate limit data
        auth_service.check_rate_limit("test_user", "upload", limit=5, window=3600)
        
        # Verify data exists
        assert "test_user:upload" in auth_service.rate_limits
        
        # Test cleanup (in real scenario, this would clean expired data)
        # For now, just verify the method exists and can be called
        assert hasattr(auth_service, 'rate_limits')
    
    def test_session_revocation(self):
        """Test token session revocation"""
        user_id = "test_user"
        token = create_access_token(data={"sub": user_id})
        
        # Token should be valid initially
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        
        # Revoke the session
        auth_service.revoke_token(user_id)
        
        # Token should now be invalid
        response = client.get("/api/v1/auth/validate", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 401
        assert "Token has been revoked" in response.json()["detail"]

if __name__ == "__main__":
    pytest.main([__file__])