"""
Challenge API Endpoints
Handles challenge creation, retrieval, and management
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import logging

from services.auth_service import get_current_user
from services.challenge_service import challenge_service
from services.upload_service import ChunkedUploadService
from models import (
    CreateChallengeRequest, 
    Challenge, 
    SubmitGuessRequest
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/challenges", tags=["challenges"])

# Initialize upload service for challenge creation
upload_service = ChunkedUploadService()


@router.post("/", response_model=Challenge, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    request: CreateChallengeRequest,
    creator_id: str = Depends(get_current_user)
) -> Challenge:
    """
    Create a new challenge with 3 statements and their associated media
    """
    try:
        logger.info(f"Creating challenge for user {creator_id}")
        logger.debug(f"Challenge request: {request.model_dump()}")
        
        # Create the challenge using the service
        challenge = await challenge_service.create_challenge(
            creator_id=creator_id,
            request=request,
            upload_service=upload_service
        )
        
        logger.info(f"Challenge created successfully: {challenge.id}")
        return challenge
        
    except ValueError as e:
        logger.warning(f"Invalid challenge data from user {creator_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating challenge for user {creator_id}: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create challenge"
        )


@router.get("/{challenge_id}", response_model=Challenge)
async def get_challenge(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
) -> Challenge:
    """
    Get a specific challenge by ID
    """
    try:
        logger.info(f"User {user_id} requesting challenge {challenge_id}")
        
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        logger.debug(f"Challenge retrieved: {challenge.id}")
        return challenge
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenge"
        )


@router.get("/", response_model=List[Challenge])
async def list_challenges(
    skip: int = 0,
    limit: int = 20,
    public_only: bool = True,
    user_id: str = Depends(get_current_user)
) -> List[Challenge]:
    """
    List challenges with pagination
    """
    try:
        logger.info(f"User {user_id} listing challenges (skip={skip}, limit={limit}, public_only={public_only})")
        
        challenges = await challenge_service.list_challenges(
            skip=skip,
            limit=limit,
            public_only=public_only
        )
        
        logger.debug(f"Retrieved {len(challenges)} challenges")
        return challenges
        
    except Exception as e:
        logger.error(f"Failed to list challenges: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list challenges"
        )


@router.post("/{challenge_id}/guess", response_model=dict)
async def submit_guess(
    challenge_id: str,
    request: SubmitGuessRequest,
    user_id: str = Depends(get_current_user)
) -> dict:
    """
    Submit a guess for a challenge
    """
    try:
        logger.info(f"User {user_id} submitting guess for challenge {challenge_id}")
        logger.debug(f"Guess request: {request.model_dump()}")
        
        # Update request with challenge_id from URL
        request.challenge_id = challenge_id
        
        guess_submission, points_earned = await challenge_service.submit_guess(
            user_id=user_id,
            request=request
        )
        
        result = {
            "correct": guess_submission.is_correct,
            "points_earned": points_earned,
            "correct_answer": None,  # Don't reveal immediately
            "guess_id": guess_submission.guess_id
        }
        
        logger.info(f"Guess submitted for challenge {challenge_id}: correct={guess_submission.is_correct}")
        return result
        
    except ValueError as e:
        logger.warning(f"Invalid guess from user {user_id} for challenge {challenge_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to submit guess for challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit guess"
        )


@router.get("/user/{user_id}", response_model=List[Challenge])
async def get_user_challenges(
    target_user_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user_id: str = Depends(get_current_user)
) -> List[Challenge]:
    """
    Get challenges created by a specific user
    """
    try:
        logger.info(f"User {current_user_id} requesting challenges by user {target_user_id}")
        
        challenges = await challenge_service.get_user_challenges(
            user_id=target_user_id,
            skip=skip,
            limit=limit
        )
        
        logger.debug(f"Retrieved {len(challenges)} challenges for user {target_user_id}")
        return challenges
        
    except Exception as e:
        logger.error(f"Failed to get challenges for user {target_user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user challenges"
        )


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_challenge(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Delete a challenge (only by creator)
    """
    try:
        logger.info(f"User {user_id} attempting to delete challenge {challenge_id}")
        
        success = await challenge_service.delete_challenge(
            challenge_id=challenge_id,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete challenge - not authorized or challenge not found"
            )
        
        logger.info(f"Challenge {challenge_id} deleted by user {user_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete challenge"
        )


@router.get("/{challenge_id}/stats")
async def get_challenge_stats(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get statistics for a challenge
    """
    try:
        logger.info(f"User {user_id} requesting stats for challenge {challenge_id}")
        
        stats = await challenge_service.get_challenge_stats(challenge_id)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get stats for challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenge stats"
        )
