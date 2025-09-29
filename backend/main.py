"""
FastAPI backend for 2Truths-1Lie game with chunked upload support
"""
from dotenv import load_dotenv
# Load environment variables from .env file
load_dotenv()

# Initialize logging configuration early
import logging_config

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import aiofiles
import os
import hashlib
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
import uuid
from datetime import datetime, timedelta

from models import (
    UploadSession, ChunkInfo, UploadStatus,
    InitiateUploadRequest, InitiateUploadResponse,
    UploadChunkResponse, CompleteUploadRequest, CompleteUploadResponse,
    UploadStatusResponse,
    Challenge, ChallengeStatus, GuessSubmission,
    CreateChallengeRequest, CreateChallengeResponse,
    SubmitGuessRequest, SubmitGuessResponse,
    ChallengeListResponse, FlagChallengeRequest, ModerationReviewRequest
)
from services.upload_service import ChunkedUploadService
from services.challenge_service import ChallengeService, ChallengeServiceError
from services.auth_service import get_current_user
from services.rate_limiter import RateLimiter, RateLimitExceeded
from services.validation_service import gameplay_validator, integrity_validator
from api.media_endpoints import router as media_router
from api.auth_endpoints import router as auth_router
from api.s3_media_endpoints import router as s3_media_router
from api.test_endpoints import router as test_router  # Enabled for testing challenge creation
from config import settings

app = FastAPI(
    title="2Truths-1Lie API",
    description="Backend API for chunked media uploads and game management with AWS S3 integration. "
                "Interactive documentation available at /docs and /redoc endpoints.",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI (default, but explicit for clarity)
    redoc_url="/redoc"  # ReDoc documentation (default, but explicit for clarity)
)

# Include routers
app.include_router(media_router)
app.include_router(auth_router)
app.include_router(s3_media_router)
app.include_router(test_router)  # Enabled for challenge creation testing

# Import and include challenge endpoints
from api.challenge_endpoints import router as challenge_router
from api.challenge_video_endpoints import router as challenge_video_router
from api.user_endpoints import router as user_router
from api.admin_endpoints import router as admin_router
from api.monitoring_endpoints import router as monitoring_router
from api.token_endpoints import router as token_router
from api.hint_endpoints import router as hint_router

app.include_router(challenge_router)
app.include_router(challenge_video_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(monitoring_router)
app.include_router(token_router)
app.include_router(hint_router)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
upload_service = ChunkedUploadService()
challenge_service = ChallengeService()
rate_limiter = RateLimiter()

@app.on_event("startup")
async def startup_event():
    """Run startup tasks including database migrations"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Run score migration if needed
        from services.database_service import get_db_service
        db_service = get_db_service()
        
        # Check if score column exists
        try:
            db_service._execute_query(
                "SELECT score FROM users LIMIT 1",
                ()
            )
            logger.info("✅ Score column already exists")
        except Exception as e:
            if "does not exist" in str(e):
                logger.info("📝 Adding score column to users table...")
                try:
                    db_service._execute_query(
                        "ALTER TABLE users ADD COLUMN score INTEGER NOT NULL DEFAULT 0",
                        ()
                    )
                    logger.info("✅ Score column added successfully")
                except Exception as migration_error:
                    logger.error(f"❌ Failed to add score column: {migration_error}")
            else:
                logger.error(f"❌ Database check failed: {e}")
                
    except Exception as e:
        logger.error(f"❌ Startup migration failed: {e}")
        # Don't fail startup if migration fails

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "2Truths-1Lie API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "upload_directory": str(settings.UPLOAD_DIR),
        "max_file_size": settings.MAX_FILE_SIZE
    }

# Note: FastAPI automatically serves documentation at:
# - Swagger UI: /docs (interactive API testing)
# - ReDoc: /redoc (clean documentation)
# - OpenAPI spec: /openapi.json

# Upload endpoints
@app.post("/api/v1/upload/initiate")
async def initiate_upload(
    request: InitiateUploadRequest,
    current_user: str = Depends(get_current_user)
):
    """Initiate a new chunked upload session"""
    try:
        session = await upload_service.initiate_upload(
            user_id=current_user,
            filename=request.filename,
            file_size=request.file_size,
            mime_type=request.mime_type,
            chunk_size=request.chunk_size,
            file_hash=request.file_hash,
            metadata=request.metadata
        )
        
        return InitiateUploadResponse(
            session_id=session.session_id,
            upload_url=f"/api/v1/upload/{session.session_id}/chunk",
            chunk_size=session.chunk_size,
            total_chunks=session.total_chunks,
            expires_at=session.created_at + timedelta(seconds=settings.UPLOAD_SESSION_TIMEOUT)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to initiate upload")

@app.post("/api/v1/upload/{session_id}/chunk/{chunk_number}")
async def upload_chunk(
    session_id: str,
    chunk_number: int,
    file: UploadFile = File(...),
    chunk_hash: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """Upload a single chunk"""
    try:
        # Verify session belongs to user
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        if session.user_id != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Read chunk data
        chunk_data = await file.read()
        
        # Upload chunk
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session_id,
            chunk_number=chunk_number,
            chunk_data=chunk_data,
            chunk_hash=chunk_hash
        )
        
        return UploadChunkResponse(
            session_id=session_id,
            chunk_number=chunk_number,
            status="uploaded" if was_uploaded else "already_exists",
            uploaded_chunks=updated_session.uploaded_chunks,
            remaining_chunks=upload_service.get_remaining_chunks(session_id),
            progress_percent=upload_service.get_progress_percent(session_id)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to upload chunk")

@app.post("/api/v1/upload/{session_id}/complete")
async def complete_upload(
    session_id: str,
    request: CompleteUploadRequest,
    current_user: str = Depends(get_current_user)
):
    """Complete the upload by assembling all chunks"""
    try:
        # Verify session belongs to user
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        if session.user_id != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Complete upload
        final_path = await upload_service.complete_upload(
            session_id=session_id,
            final_file_hash=request.file_hash
        )
        
        # Get updated session
        completed_session = await upload_service.get_upload_status(session_id)
        
        return CompleteUploadResponse(
            session_id=session_id,
            status=completed_session.status,
            file_url=f"/api/v1/files/{session_id}_{session.filename}",
            file_size=session.file_size,
            completed_at=completed_session.completed_at
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to complete upload")

@app.get("/api/v1/upload/{session_id}/status")
async def get_upload_status(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get the status of an upload session"""
    session = await upload_service.get_upload_status(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session.user_id != current_user:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return UploadStatusResponse(
        session_id=session_id,
        status=session.status,
        progress_percent=upload_service.get_progress_percent(session_id),
        uploaded_chunks=session.uploaded_chunks,
        remaining_chunks=upload_service.get_remaining_chunks(session_id),
        created_at=session.created_at,
        updated_at=session.updated_at
    )

@app.delete("/api/v1/upload/{session_id}")
async def cancel_upload(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Cancel an upload session"""
    session = await upload_service.get_upload_status(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session.user_id != current_user:
        raise HTTPException(status_code=403, detail="Access denied")
    
    success = await upload_service.cancel_upload(session_id)
    if success:
        return {"message": "Upload cancelled successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to cancel upload")

@app.get("/api/v1/files/{filename}")
async def get_file(filename: str):
    """Serve uploaded files"""
    file_path = settings.UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

# Challenge endpoints are now handled by the challenge_endpoints router

# Rate limiting endpoints
@app.get("/api/v1/users/me/rate-limit")
async def get_rate_limit_status(current_user: str = Depends(get_current_user)):
    """Get current rate limit status for the authenticated user"""
    try:
        status = await rate_limiter.get_rate_limit_status(current_user)
        return {"rate_limit": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get rate limit status")

@app.post("/api/v1/admin/rate-limit/{user_id}/reset")
async def reset_user_rate_limit(
    user_id: str,
    current_user: str = Depends(get_current_user)
):
    """Reset rate limit for a specific user (admin only)"""
    # Note: In a real implementation, you'd check if current_user is an admin
    try:
        await rate_limiter.reset_user_limit(user_id)
        return {"message": f"Rate limit reset for user {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to reset rate limit")

# Cleanup task (would typically run as a background task)
@app.post("/api/v1/admin/cleanup")
async def cleanup_expired_sessions():
    """Clean up expired upload sessions (admin endpoint)"""
    cleaned_count = await upload_service.cleanup_expired_sessions()
    return {"message": f"Cleaned up {cleaned_count} expired sessions"}

@app.post("/api/v1/admin/cleanup/rate-limits")
async def cleanup_expired_rate_limits():
    """Clean up expired rate limit data (admin endpoint)"""
    cleaned_count = await rate_limiter.cleanup_expired_limits()
    return {"message": f"Cleaned up rate limit data for {cleaned_count} users"}

# Validation endpoints
@app.post("/api/v1/validation/challenge-request")
async def validate_challenge_request(
    request: CreateChallengeRequest,
    current_user: str = Depends(get_current_user)
):
    """Validate a challenge creation request before submission"""
    try:
        validation_result = await gameplay_validator.validate_challenge_creation(
            request, upload_service
        )
        
        return {
            "is_valid": validation_result.is_valid,
            "message": validation_result.message,
            "details": validation_result.details,
            "timestamp": validation_result.timestamp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

@app.get("/api/v1/validation/challenge/{challenge_id}")
async def validate_existing_challenge(
    challenge_id: str,
    current_user: str = Depends(get_current_user)
):
    """Validate an existing challenge"""
    try:
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Run complete validation
        complete_validation = await gameplay_validator.validate_complete_challenge(
            challenge, upload_service
        )
        
        # Run integrity validation
        integrity_validation = await integrity_validator.validate_challenge_consistency(challenge)
        
        return {
            "challenge_id": challenge_id,
            "complete_validation": {
                "is_valid": complete_validation.is_valid,
                "message": complete_validation.message,
                "details": complete_validation.details
            },
            "integrity_validation": {
                "is_valid": integrity_validation.is_valid,
                "message": integrity_validation.message,
                "details": integrity_validation.details
            },
            "overall_valid": complete_validation.is_valid and integrity_validation.is_valid
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

@app.get("/api/v1/validation/stats")
async def get_validation_stats(current_user: str = Depends(get_current_user)):
    """Get validation statistics"""
    try:
        stats = gameplay_validator.get_validation_stats()
        return {"validation_stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get validation stats: {str(e)}")

@app.post("/api/v1/admin/validation/clear-history")
async def clear_validation_history(current_user: str = Depends(get_current_user)):
    """Clear validation history (admin only)"""
    # Note: In a real implementation, you'd check if current_user is an admin
    try:
        gameplay_validator.clear_validation_history()
        return {"message": "Validation history cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear validation history: {str(e)}")
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )