"""
FastAPI backend for 2Truths-1Lie game with chunked upload support
"""
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
from config import settings

app = FastAPI(
    title="2Truths-1Lie API",
    description="Backend API for chunked media uploads and game management",
    version="1.0.0"
)

# Include routers
app.include_router(media_router)
app.include_router(auth_router)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
upload_service = ChunkedUploadService()
challenge_service = ChallengeService()
rate_limiter = RateLimiter()

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

# Challenge endpoints
@app.post("/api/v1/challenges", response_model=CreateChallengeResponse)
async def create_challenge(
    request: CreateChallengeRequest,
    current_user: str = Depends(get_current_user)
):
    """Create a new challenge"""
    try:
        challenge = await challenge_service.create_challenge(
            creator_id=current_user,
            request=request,
            upload_service=upload_service
        )
        
        # Get updated rate limit status to include in response headers
        rate_limit_status = await rate_limiter.get_rate_limit_status(current_user)
        
        response = CreateChallengeResponse(
            challenge_id=challenge.challenge_id,
            status=challenge.status,
            created_at=challenge.created_at,
            statements=challenge.statements
        )
        
        # Create JSONResponse to add custom headers
        json_response = JSONResponse(
            content=response.model_dump(mode='json'),
            headers={
                "X-RateLimit-Limit": str(rate_limit_status["limit"]),
                "X-RateLimit-Remaining": str(rate_limit_status["remaining"]),
                "X-RateLimit-Reset": rate_limit_status["reset_time"] or "",
            }
        )
        
        return json_response
        
    except ChallengeServiceError as e:
        # Check if it's a rate limit error to return 429 status
        if "Rate limit exceeded" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create challenge")

@app.post("/api/v1/challenges/{challenge_id}/publish")
async def publish_challenge(
    challenge_id: str,
    current_user: str = Depends(get_current_user)
):
    """Publish a draft challenge"""
    try:
        challenge = await challenge_service.publish_challenge(challenge_id, current_user)
        return {
            "challenge_id": challenge.challenge_id,
            "status": challenge.status,
            "published_at": challenge.published_at
        }
    except ChallengeServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to publish challenge")

@app.get("/api/v1/challenges/{challenge_id}", response_model=Challenge)
async def get_challenge(challenge_id: str):
    """Get a specific challenge"""
    challenge = await challenge_service.get_challenge(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge

@app.get("/api/v1/challenges", response_model=ChallengeListResponse)
async def list_challenges(
    page: int = 1,
    page_size: int = 20,
    creator_id: Optional[str] = None,
    status: Optional[ChallengeStatus] = None,
    tags: Optional[str] = None,
    current_user: Optional[str] = Depends(get_current_user)
):
    """List challenges with pagination and filtering"""
    try:
        # Parse tags if provided
        tag_list = tags.split(",") if tags else None
        
        # If creator_id is not specified but user is authenticated, show their challenges
        if creator_id is None and current_user and status:
            creator_id = current_user
        
        challenges, total_count = await challenge_service.list_challenges(
            page=page,
            page_size=page_size,
            creator_id=creator_id,
            status=status,
            tags=tag_list
        )
        
        has_next = (page * page_size) < total_count
        
        return ChallengeListResponse(
            challenges=challenges,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=has_next
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to list challenges")

@app.post("/api/v1/challenges/{challenge_id}/guess", response_model=SubmitGuessResponse)
async def submit_guess(
    challenge_id: str,
    request: SubmitGuessRequest,
    current_user: str = Depends(get_current_user)
):
    """Submit a guess for a challenge"""
    try:
        # Ensure the challenge_id in the request matches the URL parameter
        request.challenge_id = challenge_id
        
        guess, points_earned = await challenge_service.submit_guess(current_user, request)
        
        # Get the challenge to return the correct answer
        challenge = await challenge_service.get_challenge(challenge_id)
        
        return SubmitGuessResponse(
            guess_id=guess.guess_id,
            is_correct=guess.is_correct,
            correct_lie_statement_id=challenge.lie_statement_id,
            points_earned=points_earned,
            submitted_at=guess.submitted_at
        )
    except ChallengeServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to submit guess")

@app.get("/api/v1/challenges/{challenge_id}/guesses")
async def get_challenge_guesses(
    challenge_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get all guesses for a challenge (creator only)"""
    try:
        guesses = await challenge_service.get_challenge_guesses(challenge_id, current_user)
        return {"guesses": guesses}
    except ChallengeServiceError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get challenge guesses")

@app.get("/api/v1/users/me/guesses")
async def get_my_guesses(current_user: str = Depends(get_current_user)):
    """Get all guesses by the current user"""
    try:
        guesses = await challenge_service.get_user_guesses(current_user)
        return {"guesses": guesses}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get user guesses")

@app.get("/api/v1/users/me/challenges", response_model=ChallengeListResponse)
async def get_my_challenges(
    page: int = 1,
    page_size: int = 20,
    status: Optional[ChallengeStatus] = None,
    current_user: str = Depends(get_current_user)
):
    """Get all challenges created by the current user"""
    try:
        challenges, total_count = await challenge_service.list_challenges(
            page=page,
            page_size=page_size,
            creator_id=current_user,
            status=status
        )
        
        has_next = (page * page_size) < total_count
        
        return ChallengeListResponse(
            challenges=challenges,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=has_next
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get user challenges")

@app.delete("/api/v1/challenges/{challenge_id}")
async def delete_challenge(
    challenge_id: str,
    current_user: str = Depends(get_current_user)
):
    """Delete a draft challenge"""
    try:
        success = await challenge_service.delete_challenge(challenge_id, current_user)
        if success:
            return {"message": "Challenge deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Challenge not found")
    except ChallengeServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete challenge")

# Moderation endpoints
@app.post("/api/v1/challenges/{challenge_id}/flag")
async def flag_challenge(
    challenge_id: str,
    request: FlagChallengeRequest,
    current_user: str = Depends(get_current_user)
):
    """Flag a challenge for manual review"""
    try:
        success = await challenge_service.flag_challenge(challenge_id, current_user, request.reason)
        if success:
            return {"message": "Challenge flagged successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to flag challenge")
    except ChallengeServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to flag challenge")

@app.get("/api/v1/challenges/{challenge_id}/moderation")
async def get_challenge_moderation_status(
    challenge_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get moderation status for a challenge"""
    try:
        moderation_status = await challenge_service.get_moderation_status(challenge_id)
        if moderation_status:
            return {"moderation": moderation_status}
        else:
            return {"moderation": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get moderation status")

@app.get("/api/v1/admin/moderation/challenges", response_model=ChallengeListResponse)
async def get_challenges_for_moderation(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: str = Depends(get_current_user)
):
    """Get challenges that need moderation review (admin only)"""
    # Note: In a real implementation, you'd check if current_user is an admin/moderator
    try:
        challenges, total_count = await challenge_service.get_challenges_for_moderation(
            status=status,
            page=page,
            page_size=page_size
        )
        
        has_next = (page * page_size) < total_count
        
        return ChallengeListResponse(
            challenges=challenges,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=has_next
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get challenges for moderation")

@app.post("/api/v1/admin/moderation/challenges/{challenge_id}/review")
async def manual_moderation_review(
    challenge_id: str,
    request: ModerationReviewRequest,
    current_user: str = Depends(get_current_user)
):
    """Manually review a flagged or pending challenge (admin only)"""
    # Note: In a real implementation, you'd check if current_user is an admin/moderator
    try:
        challenge = await challenge_service.manual_moderation_review(
            challenge_id=challenge_id,
            moderator_id=current_user,
            decision=request.decision,
            reason=request.reason
        )
        
        return {
            "challenge_id": challenge.challenge_id,
            "status": challenge.status,
            "updated_at": challenge.updated_at
        }
    except ChallengeServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to review challenge")

@app.get("/api/v1/admin/moderation/stats")
async def get_moderation_stats(current_user: str = Depends(get_current_user)):
    """Get moderation statistics (admin only)"""
    # Note: In a real implementation, you'd check if current_user is an admin/moderator
    try:
        stats = challenge_service.moderation_service.get_moderation_stats()
        return {"stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get moderation stats")

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