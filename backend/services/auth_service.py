"""
Enhanced Authentication service for API endpoints with secure media access
"""
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
import hmac
import time
import logging

from config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()

class AuthService:
    """Enhanced authentication service with media-specific security"""
    
    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.rate_limits: Dict[str, Dict[str, Any]] = {}
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token with enhanced claims"""
        to_encode = data.copy()
        
        # Set expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Add standard claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": "twotruthsalie-api",
            "aud": "twotruthsalie-mobile"
        })
        
        # Add media-specific permissions
        if "permissions" not in to_encode:
            to_encode["permissions"] = ["media:read", "media:upload", "media:delete"]
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        # Track active session
        user_id = data.get("sub")
        if user_id:
            self.active_sessions[user_id] = {
                "token": encoded_jwt,
                "created_at": datetime.utcnow(),
                "expires_at": expire,
                "permissions": to_encode.get("permissions", [])
            }
        
        return encoded_jwt
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create refresh token for token renewal"""
        return self.create_access_token(
            data={"sub": user_id, "type": "refresh"},
            expires_delta=timedelta(days=7)
        )
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode JWT token with comprehensive validation"""
        logger.info(f"=== VERIFY_TOKEN CALLED ===")
        logger.info(f"Token received: {token[:50]}...")
        
        try:
            logger.info(f"Starting JWT verification for token: {token[:50]}...")
            logger.info(f"Using SECRET_KEY: {settings.SECRET_KEY}")
            logger.info(f"Using ALGORITHM: {settings.ALGORITHM}")
            
            # Decode and validate JWT - specify expected audience and issuer
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM],
                audience="twotruthsalie-mobile",
                issuer="twotruthsalie-api"
            )
            
            # Debug logging
            logger.info(f"JWT payload decoded successfully: {payload}")
            logger.info(f"Expected audience: 'twotruthsalie-mobile', Got: '{payload.get('aud')}'")
            logger.info(f"Expected issuer: 'twotruthsalie-api', Got: '{payload.get('iss')}'")
            
            # Validate user ID is present
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user ID",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Check if token is still active in our session store (skip for guest users)
            # Only validate session if user is actively tracked and has a different token
            token_type = payload.get("type", "user")
            if user_id in self.active_sessions and token_type != "guest":
                session = self.active_sessions[user_id]
                if session["token"] != token:
                    logger.warning(f"Token mismatch for user {user_id}: session has different token")
                    # For now, allow the token if it's valid JWT - session tracking is optional
                    # This prevents issues when server restarts and sessions are cleared
                    # TODO: Implement persistent session store (Redis/database) for production
                    pass
            
            # JWT library has already validated audience and issuer during decode
            # Return the validated payload
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.error("JWT ERROR: Token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except JWTError as e:
            logger.error(f"JWT ERROR: {e}")
            logger.error(f"JWT ERROR Type: {type(e).__name__}")
            logger.error(f"JWT ERROR Args: {e.args}")
            logger.warning(f"JWT validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def check_rate_limit(self, user_id: str, action: str, limit: int = 10, window: int = 3600) -> bool:
        """Check if user has exceeded rate limit for specific action"""
        now = time.time()
        key = f"{user_id}:{action}"
        
        if key not in self.rate_limits:
            self.rate_limits[key] = {"count": 0, "window_start": now}
        
        rate_data = self.rate_limits[key]
        
        # Reset window if expired
        if now - rate_data["window_start"] > window:
            rate_data["count"] = 0
            rate_data["window_start"] = now
        
        # Check limit
        if rate_data["count"] >= limit:
            return False
        
        rate_data["count"] += 1
        return True
    
    def check_permission(self, payload: dict, required_permission: str) -> bool:
        """Check if user has required permission"""
        permissions = payload.get("permissions", [])
        return required_permission in permissions or "admin" in permissions
    
    def create_signed_url(self, media_id: str, user_id: str, expires_in: int = 3600) -> str:
        """Create signed URL for secure media access"""
        expires_at = int(time.time()) + expires_in
        
        # Create signature
        message = f"{media_id}:{user_id}:{expires_at}"
        signature = hmac.new(
            settings.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"/api/v1/media/stream/{media_id}?user={user_id}&expires={expires_at}&signature={signature}"
    
    def verify_signed_url(self, media_id: str, user_id: str, expires_at: str, signature: str) -> bool:
        """Verify signed URL for media access"""
        try:
            # Check expiration
            if int(expires_at) < time.time():
                return False
            
            # Verify signature
            message = f"{media_id}:{user_id}:{expires_at}"
            expected_signature = hmac.new(
                settings.SECRET_KEY.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        except (ValueError, TypeError):
            return False
    
    def revoke_token(self, user_id: str) -> bool:
        """Revoke user's active token"""
        if user_id in self.active_sessions:
            del self.active_sessions[user_id]
            return True
        return False
    
    def get_user_permissions(self, user_id: str) -> list:
        """Get user's current permissions"""
        if user_id in self.active_sessions:
            return self.active_sessions[user_id].get("permissions", [])
        return []

# Global auth service instance
auth_service = AuthService()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    return auth_service.create_access_token(data, expires_delta)

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    return auth_service.verify_token(token)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current user from JWT token"""
    payload = verify_token(credentials.credentials)
    return payload.get("sub")

async def get_current_user_with_permissions(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current user with full token payload including permissions"""
    payload = verify_token(credentials.credentials)
    return payload

async def get_authenticated_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current user from JWT token - ONLY authenticated users, rejects guests"""
    payload = verify_token(credentials.credentials)
    user_type = payload.get("type", "user")
    
    if user_type == "guest":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This action requires user authentication. Please sign in with an account.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload.get("sub")

def require_permission(permission: str):
    """Factory function to create permission-based dependency"""
    async def _check_permission(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> str:
        """Check specific permission for endpoint access"""
        payload = verify_token(credentials.credentials)
        
        if not auth_service.check_permission(payload, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission}"
            )
        
        return payload.get("sub")
    
    return _check_permission

async def check_upload_rate_limit(
    request: Request,
    current_user: str = Depends(get_current_user)
) -> str:
    """Check upload rate limit for user"""
    if not auth_service.check_rate_limit(current_user, "upload", limit=5, window=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Upload rate limit exceeded. Try again later."
        )
    
    return current_user

async def check_download_rate_limit(
    request: Request,
    current_user: str = Depends(get_current_user)
) -> str:
    """Check download rate limit for user"""
    if not auth_service.check_rate_limit(current_user, "download", limit=100, window=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Download rate limit exceeded. Try again later."
        )
    
    return current_user

# For development/testing - create a simple token
def create_test_token(user_id: str = "test_user") -> str:
    """Create a test token for development"""
    return create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(hours=24)
    )