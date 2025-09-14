"""
Admin API Endpoints
Handles moderation, rate limiting, and system administration
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
import logging

from services.auth_service import get_current_user
from services.challenge_service import challenge_service
from services.database_service import DatabaseService
from models import Challenge, ChallengeListResponse, ModerationReviewRequest, ReportedChallengesResponse, ReportedChallenge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Initialize database service for user reports
db_service = DatabaseService()


@router.get("/moderation/reports", response_model=ReportedChallengesResponse)
async def get_reported_challenges(
    page: int = 1,
    page_size: int = 50,
    user_id: str = Depends(get_current_user)
) -> ReportedChallengesResponse:
    """
    Get all challenges that have been reported by users (admin only)
    
    Returns a paginated list of challenges with user reports, including:
    - Challenge ID
    - Number of reports
    - First and last report timestamps
    - List of unique report reasons
    """
    try:
        logger.info(f"Admin {user_id} requesting reported challenges (page={page}, page_size={page_size})")
        
        # Calculate offset for pagination
        offset = (page - 1) * page_size
        
        # Get reported challenges from database
        reported_challenges = db_service.get_all_reported_challenges(
            limit=page_size,
            offset=offset
        )
        
        # Convert to response models
        challenge_reports = []
        for report_data in reported_challenges:
            challenge_reports.append(ReportedChallenge(
                challenge_id=report_data["challenge_id"],
                report_count=report_data["report_count"],
                first_report_at=report_data["first_report_at"],
                last_report_at=report_data["last_report_at"],
                reasons=report_data["reasons"]
            ))
        
        # Get total count for pagination
        total_count = db_service.get_reported_challenges_count()
        
        has_next = len(reported_challenges) == page_size
        
        logger.info(f"Retrieved {len(challenge_reports)} reported challenges for admin {user_id}")
        
        return ReportedChallengesResponse(
            reported_challenges=challenge_reports,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=has_next
        )
        
    except Exception as e:
        logger.error(f"Failed to get reported challenges for admin {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reported challenges"
        )


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


@router.put("/moderation/challenges/{challenge_id}")
async def admin_moderation_review(
    challenge_id: str,
    request: ModerationReviewRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Admin review of reported content (PUT endpoint as specified in design)
    
    Updates the moderation status of a challenge based on admin review.
    Supports actions: approved, rejected, flagged
    """
    try:
        logger.info(f"Admin {user_id} performing moderation review on challenge {challenge_id}")
        
        # Validate the action
        valid_actions = ["approved", "rejected", "flagged"]
        if request.decision not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action. Must be one of: {valid_actions}"
            )
        
        # Perform the moderation review
        challenge = await challenge_service.manual_moderation_review(
            challenge_id=challenge_id,
            moderator_id=user_id,
            decision=request.decision,
            reason=request.reason
        )
        
        # Map challenge status to response status
        status_mapping = {
            "published": "approved",
            "rejected": "rejected", 
            "flagged": "flagged",
            "pending_moderation": "pending"
        }
        
        new_status = status_mapping.get(challenge.status.value, challenge.status.value)
        
        logger.info(f"Challenge {challenge_id} moderation completed by admin {user_id}: {new_status}")
        
        return {
            "message": "Moderation action applied",
            "challenge_id": challenge.challenge_id,
            "new_status": new_status,
            "action": request.decision,
            "moderator_id": user_id,
            "updated_at": challenge.updated_at.isoformat() if challenge.updated_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to perform moderation review on challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform moderation review"
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