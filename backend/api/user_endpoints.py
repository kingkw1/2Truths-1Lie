"""
User-specific API Endpoints
Handles user guesses, user challenges, and rate limiting
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
import logging

from services.auth_service import get_current_user
from services.challenge_service import challenge_service
from models import Challenge, ChallengeListResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me/guesses")
async def get_my_guesses(
    user_id: str = Depends(get_current_user)
):
    """
    Get all guesses by the current user
    """
    try:
        logger.info(f"User {user_id} requesting their guesses")
        
        guesses = await challenge_service.get_user_guesses(user_id)
        return {"guesses": guesses}
        
    except Exception as e:
        logger.error(f"Failed to get guesses for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user guesses"
        )


@router.get("/me/challenges", response_model=ChallengeListResponse)
async def get_my_challenges(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user)
) -> ChallengeListResponse:
    """
    Get all challenges created by the current user
    """
    try:
        logger.info(f"User {user_id} requesting their challenges")
        
        # Convert status string to enum if provided
        status_filter = None
        if status:
            from models import ChallengeStatus
            try:
                status_filter = ChallengeStatus(status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {status}"
                )
        
        challenges, total_count = await challenge_service.list_challenges(
            page=page,
            page_size=page_size,
            creator_id=user_id,
            status=status_filter
        )
        
        has_next = (page * page_size) < total_count
        
        return ChallengeListResponse(
            challenges=challenges,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=has_next
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get challenges for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user challenges"
        )


@router.get("/{target_user_id}/challenges", response_model=List[Challenge])
async def get_user_challenges(
    target_user_id: str,
    page: int = 1,
    page_size: int = 20,
    current_user_id: str = Depends(get_current_user)
) -> List[Challenge]:
    """
    Get challenges created by a specific user
    """
    try:
        logger.info(f"User {current_user_id} requesting challenges by user {target_user_id}")
        
        challenges = await challenge_service.get_user_challenges(
            user_id=target_user_id,
            page=page,
            page_size=page_size
        )
        
        return challenges
        
    except Exception as e:
        logger.error(f"Failed to get challenges for user {target_user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user challenges"
        )


@router.get("/me/rate-limit")
async def get_rate_limit_status(
    user_id: str = Depends(get_current_user)
):
    """
    Get current rate limit status for the authenticated user
    """
    try:
        from services.rate_limiter import RateLimiter
        rate_limiter = RateLimiter()
        
        status = await rate_limiter.get_rate_limit_status(user_id)
        return {"rate_limit": status}
        
    except Exception as e:
        logger.error(f"Failed to get rate limit status for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get rate limit status"
        )