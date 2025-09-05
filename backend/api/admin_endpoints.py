"""
Admin API Endpoints
Handles moderation, rate limiting, and system administration
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
import logging

from services.auth_service import get_current_user
from services.challenge_service import challenge_service
from models import Challenge, ChallengeListResponse, ModerationReviewRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/moderation/challenges", response_model=ChallengeListResponse)
async def get_challenges_for_moderation(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user_id: str = Depends(get_current_user)
) -> ChallengeListResponse:
    """
    Get challenges that need moderation review (admin only)
    """
    try:
        logger.info(f"Admin {user_id} requesting challenges for moderation")
        
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
        logger.error(f"Failed to get challenges for moderation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get challenges for moderation"
        )


@router.post("/moderation/challenges/{challenge_id}/review")
async def manual_moderation_review(
    challenge_id: str,
    request: ModerationReviewRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Manually review a flagged or pending challenge (admin only)
    """
    try:
        logger.info(f"Admin {user_id} reviewing challenge {challenge_id}")
        
        challenge = await challenge_service.manual_moderation_review(
            challenge_id=challenge_id,
            moderator_id=user_id,
            decision=request.decision,
            reason=request.reason
        )
        
        return {
            "challenge_id": challenge.challenge_id,
            "status": challenge.status,
            "updated_at": challenge.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to review challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to review challenge"
        )


@router.get("/moderation/stats")
async def get_moderation_stats(
    user_id: str = Depends(get_current_user)
):
    """
    Get moderation statistics (admin only)
    """
    try:
        logger.info(f"Admin {user_id} requesting moderation stats")
        
        stats = challenge_service.moderation_service.get_moderation_stats()
        return {"stats": stats}
        
    except Exception as e:
        logger.error(f"Failed to get moderation stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get moderation stats"
        )


@router.post("/rate-limit/{user_id}/reset")
async def reset_user_rate_limit(
    user_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Reset rate limit for a specific user (admin only)
    """
    try:
        logger.info(f"Admin {current_user} resetting rate limit for user {user_id}")
        
        from services.rate_limiter import RateLimiter
        rate_limiter = RateLimiter()
        
        await rate_limiter.reset_user_limit(user_id)
        return {"message": f"Rate limit reset for user {user_id}"}
        
    except Exception as e:
        logger.error(f"Failed to reset rate limit for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset rate limit"
        )


@router.post("/cleanup")
async def cleanup_expired_sessions():
    """
    Clean up expired upload sessions (admin endpoint)
    """
    try:
        from services.upload_service import ChunkedUploadService
        upload_service = ChunkedUploadService()
        
        cleaned_count = await upload_service.cleanup_expired_sessions()
        return {"message": f"Cleaned up {cleaned_count} expired sessions"}
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired sessions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired sessions"
        )


@router.post("/cleanup/rate-limits")
async def cleanup_expired_rate_limits():
    """
    Clean up expired rate limit data (admin endpoint)
    """
    try:
        from services.rate_limiter import RateLimiter
        rate_limiter = RateLimiter()
        
        cleaned_count = await rate_limiter.cleanup_expired_limits()
        return {"message": f"Cleaned up rate limit data for {cleaned_count} users"}
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired rate limits: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired rate limits"
        )