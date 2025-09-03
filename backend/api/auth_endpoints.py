"""
Authentication API Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import logging

from services.auth_service import (
    auth_service,
    get_current_user_with_permissions,
    security,
    create_access_token
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str
    device_info: Optional[dict] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    permissions: list

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login user and return JWT tokens"""
    try:
        # In production, validate credentials against your user database
        # For now, we'll create a simple mock authentication
        
        if not request.email or not request.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
        
        # Mock user validation (replace with real authentication)
        user_id = f"user_{request.email.split('@')[0]}"
        
        # Create tokens
        access_token = auth_service.create_access_token(
            data={"sub": user_id, "email": request.email}
        )
        refresh_token = auth_service.create_refresh_token(user_id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,  # 30 minutes
            permissions=["media:read", "media:upload", "media:delete"]
        )
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/guest", response_model=TokenResponse)
async def create_guest_session(request: Request):
    """Create guest session for anonymous users"""
    try:
        # Generate guest user ID
        import time
        import random
        guest_id = f"guest_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Create tokens with limited permissions
        access_token = auth_service.create_access_token(
            data={
                "sub": guest_id,
                "type": "guest",
                "permissions": ["media:read", "media:upload"]  # No delete for guests
            }
        )
        refresh_token = auth_service.create_refresh_token(guest_id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,
            permissions=["media:read", "media:upload"]
        )
        
    except Exception as e:
        logger.error(f"Guest session creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create guest session"
        )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """Refresh access token using refresh token"""
    try:
        # Verify refresh token
        payload = auth_service.verify_token(request.refresh_token)
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        user_type = payload.get("type", "user")
        
        # Create new access token
        token_data = {"sub": user_id}
        if "email" in payload:
            token_data["email"] = payload["email"]
        if user_type == "guest":
            token_data["type"] = "guest"
            token_data["permissions"] = ["media:read", "media:upload"]
        
        access_token = auth_service.create_access_token(data=token_data)
        
        # Get permissions
        permissions = auth_service.get_user_permissions(user_id)
        if not permissions:
            permissions = ["media:read", "media:upload", "media:delete"] if user_type != "guest" else ["media:read", "media:upload"]
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=request.refresh_token,  # Keep same refresh token
            expires_in=1800,
            permissions=permissions
        )
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.get("/validate")
async def validate_token(
    current_user_data: dict = Depends(get_current_user_with_permissions)
):
    """Validate current token and return user info"""
    try:
        return {
            "valid": True,
            "user_id": current_user_data.get("sub"),
            "email": current_user_data.get("email"),
            "type": current_user_data.get("type", "user"),
            "permissions": current_user_data.get("permissions", []),
            "expires_at": current_user_data.get("exp")
        }
        
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

@router.get("/permissions")
async def get_user_permissions(
    current_user_data: dict = Depends(get_current_user_with_permissions)
):
    """Get current user's permissions"""
    try:
        return {
            "user_id": current_user_data.get("sub"),
            "permissions": current_user_data.get("permissions", [])
        }
        
    except Exception as e:
        logger.error(f"Error getting permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get permissions"
        )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Logout user and revoke token"""
    try:
        payload = auth_service.verify_token(credentials.credentials)
        user_id = payload.get("sub")
        
        # Revoke token
        success = auth_service.revoke_token(user_id)
        
        return {
            "message": "Logged out successfully",
            "revoked": success
        }
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        # Don't fail logout even if token is invalid
        return {
            "message": "Logged out successfully",
            "revoked": False
        }

@router.get("/me")
async def get_current_user_info(
    current_user_data: dict = Depends(get_current_user_with_permissions)
):
    """Get current user information"""
    try:
        return {
            "user_id": current_user_data.get("sub"),
            "email": current_user_data.get("email"),
            "type": current_user_data.get("type", "user"),
            "permissions": current_user_data.get("permissions", []),
            "created_at": current_user_data.get("iat"),
            "expires_at": current_user_data.get("exp")
        }
        
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )