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
from services.database_service import get_db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str
    device_info: Optional[dict] = None

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    device_info: Optional[dict] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    permissions: list
    user: Optional[dict] = None

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new user and return JWT tokens"""
    try:
        if not request.email or not request.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
        
        # Validate email format (basic validation)
        if "@" not in request.email or "." not in request.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        # Validate password strength (minimum and maximum requirements)
        if len(request.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long"
            )
        
        # bcrypt has a 72-byte limit, so we enforce a reasonable character limit
        if len(request.password) > 72:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be no more than 72 characters long"
            )
        
        # Create user in database
        user_data = get_db_service().create_user(request.email, request.password, request.name)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        # Create tokens for the new user
        access_token = auth_service.create_access_token(
            data={"sub": str(user_data["id"]), "email": user_data["email"], "type": "authenticated", "is_premium": user_data.get("is_premium", False)}
        )
        refresh_token = auth_service.create_refresh_token(str(user_data["id"]))
        
        logger.info(f"New user registered: {request.email}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,  # 30 minutes
            permissions=["media:read", "media:upload", "media:delete", "challenge:create", "challenge:read", "challenge:play"],
            user={
                "id": str(user_data["id"]),
                "email": user_data["email"],
                "name": user_data.get("name"),
                "created_at": user_data["created_at"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login user and return JWT tokens"""
    try:
        if not request.email or not request.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
        
        # Validate password length to prevent bcrypt errors
        if len(request.password) > 72:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be no more than 72 characters long"
            )
        
        # Authenticate user against database
        user_data = get_db_service().authenticate_user(request.email, request.password)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create tokens for authenticated user
        access_token = auth_service.create_access_token(
            data={"sub": str(user_data["id"]), "email": user_data["email"], "type": "authenticated", "is_premium": user_data.get("is_premium", False)}
        )
        refresh_token = auth_service.create_refresh_token(str(user_data["id"]))
        
        logger.info(f"User logged in successfully: {request.email}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,  # 30 minutes
            permissions=["media:read", "media:upload", "media:delete", "challenge:create", "challenge:read", "challenge:play"],
            user={
                "id": str(user_data["id"]),
                "email": user_data["email"],
                "name": user_data.get("name"),
                "created_at": user_data["created_at"]
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 401 Unauthorized)
        raise
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
                "permissions": ["media:read", "media:upload", "challenge:create", "challenge:read", "challenge:play"]  # Allow full game functionality for guests
            }
        )
        refresh_token = auth_service.create_refresh_token(guest_id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,
            permissions=["media:read", "media:upload", "challenge:create", "challenge:read", "challenge:play"]
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
        user_id = current_user_data.get("sub")
        user_type = current_user_data.get("type", "user")
        
        # For authenticated users, fetch full user data from database
        user_info = None
        if user_type == "authenticated" and user_id:
            try:
                # Fetch user from database to get name and other details
                user_info = get_db_service().get_user_by_id(int(user_id))
            except (ValueError, Exception) as e:
                logger.warning(f"Could not fetch user data for ID {user_id}: {e}")
        
        response = {
            "valid": True,
            "user_id": user_id,
            "email": current_user_data.get("email"),
            "type": user_type,
            "permissions": current_user_data.get("permissions", []),
            "expires_at": current_user_data.get("exp")
        }
        
        # Add user details if available
        if user_info:
            response["user"] = {
                "id": str(user_info["id"]),
                "email": user_info["email"],
                "name": user_info.get("name"),
                "created_at": user_info.get("created_at")
            }
        
        return response
        
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
        user_id = current_user_data.get("sub")
        user_type = current_user_data.get("type", "user")

        if user_type != "authenticated" or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is not authenticated"
            )

        # Fetch full user data from the database
        user_info = get_db_service().get_user_by_id(int(user_id))

        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return user_info
        
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )