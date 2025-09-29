"""
Challenge API Endpoints
Handles challenge creation, retrieval, and management
"""

from typing import List, Optional
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import logging

from services.auth_service import get_current_user, get_authenticated_user, get_current_user_with_permissions
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.challenge_service import challenge_service, ChallengeNotFoundError, ChallengeAccessDeniedError
from services.upload_service import ChunkedUploadService
from services.cloud_storage_service import create_cloud_storage_service, CloudStorageError
from services.database_service import get_db_service
from services.rate_limiter import RateLimiter

# Database service will be accessed via get_db_service() function
from models import (
    CreateChallengeRequest, 
    Challenge, 
    SubmitGuessRequest,
    FlagChallengeRequest,
    UserReportRequest,
    UserReportResponse
)
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/challenges", tags=["challenges"])

# Initialize cloud storage service for signed URL generation
_cloud_storage_service = None

async def get_cloud_storage_service():
    """Get or create cloud storage service instance"""
    global _cloud_storage_service
    if _cloud_storage_service is None and settings.CLOUD_STORAGE_PROVIDER:
        try:
            _cloud_storage_service = create_cloud_storage_service(
                provider=settings.CLOUD_STORAGE_PROVIDER,
                bucket_name=settings.AWS_S3_BUCKET_NAME,
                region_name=settings.AWS_S3_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_S3_ENDPOINT_URL
            )
        except Exception as e:
            logger.error(f"Failed to initialize cloud storage service: {e}")
    return _cloud_storage_service

def extract_s3_key_from_url(url: str) -> Optional[str]:
    """Extract S3 key from full S3 URL
    
    Expected URL format: https://{bucket}.s3.{region}.amazonaws.com/{key}[?query_params]
    Returns the key part (without query parameters) or None if not a valid S3 URL
    """
    if not url or not url.startswith('https://'):
        return None
    
    try:
        import urllib.parse
        
        # Parse URL to extract key
        # Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
        if '.s3.' in url and '.amazonaws.com/' in url:
            # Find the position after .amazonaws.com/
            amazonaws_pos = url.find('.amazonaws.com/')
            if amazonaws_pos != -1:
                key_start = amazonaws_pos + len('.amazonaws.com/')
                key_with_params = url[key_start:]
                
                # Remove query parameters if present
                if '?' in key_with_params:
                    key_with_params = key_with_params.split('?')[0]
                
                # URL decode the key (handles cases where the key itself is encoded)
                key = urllib.parse.unquote(key_with_params)
                
                return key
    except Exception as e:
        logger.warning(f"Failed to extract S3 key from URL {url}: {e}")
    
    return None

async def get_signed_url_for_video(video_url: str, user_id: str = None) -> str:
    """Convert media reference to accessible URL for video streaming"""
    if not video_url:
        return video_url
    
    # Check if it's already a full S3 URL (always regenerate these to ensure they're not expired)
    if video_url.startswith('https://') and 's3.amazonaws.com' in video_url:
        # Extract S3 key from the URL and regenerate signed URL
        s3_key = extract_s3_key_from_url(video_url)
        if s3_key:
            try:
                cloud_storage = await get_cloud_storage_service()
                if cloud_storage:
                    signed_url = await cloud_storage.get_file_url(s3_key)
                    logger.info(f"Regenerated S3 signed URL for key: {s3_key}")
                    return signed_url
            except Exception as e:
                logger.error(f"Failed to regenerate S3 signed URL for {video_url}: {e}")
        # If we can't regenerate, fall through to other checks
    
    # Check if it's already a full URL (http/https) that's not S3
    if video_url.startswith(('http://', 'https://')):
        return video_url
    
    # Check if it's already a relative API path with query params (already signed)
    if video_url.startswith('/api/') and ('?' in video_url):
        return video_url
    
    # Extract S3 key from S3 URL patterns
    s3_key = extract_s3_key_from_url(video_url)
    if s3_key:
        try:
            # Handle S3 storage
            cloud_storage = await get_cloud_storage_service()
            if cloud_storage:
                signed_url = await cloud_storage.get_file_url(s3_key)
                return signed_url
        except Exception as e:
            logger.error(f"Failed to generate S3 signed URL for {video_url}: {e}")
    
    # Handle plain S3 key (not a full URL) - generate signed URL directly
    if not video_url.startswith(('http://', 'https://', '/api/')) and '.' in video_url:
        # This looks like a plain S3 key (e.g., "merged_video_12_1759007972.mp4")
        try:
            cloud_storage = await get_cloud_storage_service()
            if cloud_storage:
                signed_url = await cloud_storage.get_file_url(video_url)
                logger.info(f"Generated signed URL for S3 key: {video_url}")
                return signed_url
        except Exception as e:
            logger.error(f"Failed to generate signed URL for S3 key {video_url}: {e}")
    
    # Handle media ID - generate signed URL for local media access
    media_id = None
    if video_url.startswith('/api/v1/media/'):
        # Extract media ID from URL path like "/api/v1/media/uuid"
        media_id = video_url.split('/')[-1]
    elif len(video_url) > 8 and '-' in video_url:  # Looks like a UUID/media ID
        media_id = video_url
    
    if media_id:
        try:
            # Generate signed URL using auth service
            from services.auth_service import AuthService
            auth_service = AuthService()
            # Use guest user if no user_id provided
            effective_user_id = user_id or "guest_public"
            signed_url = auth_service.create_signed_url(media_id, effective_user_id, expires_in=7200)  # 2 hours
            return signed_url
        except Exception as e:
            logger.error(f"Failed to generate signed URL for media {media_id}: {e}")
    
    # Fallback: return original URL
    return video_url

# Optional authentication dependency
security = HTTPBearer(auto_error=False)

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    try:
        # Use the existing auth service to verify the token
        from services.auth_service import AuthService
        auth_service = AuthService()
        payload = auth_service.verify_token(credentials.credentials)
        return payload.get("sub")
    except:
        return None

# Initialize upload service for challenge creation
upload_service = ChunkedUploadService()

def enrich_challenge_with_creator_name(challenge: Challenge) -> dict:
    """Enrich challenge with creator name from database"""
    challenge_dict = challenge.model_dump()
    
    try:
        # Try to get creator name from database
        creator_id = challenge.creator_id
        
        # Handle both integer and string creator IDs
        if creator_id.isdigit():
            user_info = get_db_service().get_user_by_id(int(creator_id))
            if user_info and user_info.get("name"):
                challenge_dict["creator_name"] = user_info["name"]
            else:
                # Fallback to anonymous user instead of email for privacy
                challenge_dict["creator_name"] = "Anonymous User"
        else:
            # Non-numeric creator_id (guest users, etc.)
            if creator_id.startswith("guest_"):
                challenge_dict["creator_name"] = "Guest User"
            else:
                challenge_dict["creator_name"] = f"User {creator_id[:8]}"
                
    except Exception as e:
        logger.warning(f"Failed to get creator name for challenge {challenge.challenge_id}, creator_id {challenge.creator_id}: {e}")
        # Fallback to generic name
        challenge_dict["creator_name"] = f"User {challenge.creator_id[:8]}"
    
    return challenge_dict


@router.get("/creation-status", response_model=dict)
async def get_creation_status(
    user_payload: dict = Depends(get_current_user_with_permissions)
) -> dict:
    """
    Check if the current user can create a new challenge.
    """
    try:
        user_id = user_payload.get("sub")
        db_service = get_db_service()
        user_data = db_service.get_user_by_id(int(user_id))

        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        is_premium = user_data.get("is_premium", False)
        if is_premium:
            return {"canCreate": True}

        rate_limiter = RateLimiter()
        status = await rate_limiter.get_rate_limit_status(user_id)

        can_create = status.get("remaining", 0) > 0
        return {"canCreate": can_create}

    except Exception as e:
        logger.error(f"Failed to get creation status for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve creation status"
        )


@router.post("/", response_model=Challenge, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    request: CreateChallengeRequest,
    user_payload: dict = Depends(get_current_user_with_permissions)
) -> Challenge:
    """
    Create a new challenge with 3 statements and their associated media
    """
    try:
        creator_id = user_payload.get("sub")
        # Always check current premium status from database instead of relying on JWT token
        db_service = get_db_service()
        user_data = db_service.get_user_by_id(int(creator_id))
        is_premium = user_data.get("is_premium", False) if user_data else False
        logger.info(f"Creating challenge for user {creator_id} (Premium: {is_premium})")
        logger.debug(f"Challenge request: {request.model_dump()}")
        
        # Create the challenge using the service
        challenge = await challenge_service.create_challenge(
            creator_id=creator_id,
            request=request,
            upload_service=upload_service,
            is_premium=is_premium
        )
        
        logger.info(f"Challenge created successfully: {challenge.challenge_id}")
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
    user_id: Optional[str] = Depends(get_current_user_optional)
) -> Challenge:
    """
    Get a specific challenge by ID
    """
    try:
        logger.info(f"User {user_id or 'anonymous'} requesting challenge {challenge_id}")
        
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        logger.debug(f"Challenge retrieved: {challenge.challenge_id}")
        
        # Transform challenge to dictionary and enrich with creator name
        challenge_dict = enrich_challenge_with_creator_name(challenge)
        
        # Generate signed URLs for statement media
        if challenge_dict.get("statements"):
            for statement in challenge_dict["statements"]:
                if statement.get("streaming_url"):
                    statement["streaming_url"] = await get_signed_url_for_video(statement["streaming_url"], user_id)
                if statement.get("media_url"):
                    statement["media_url"] = await get_signed_url_for_video(statement["media_url"], user_id)
        
        # Add merged video information if available with signed URL
        if challenge.is_merged_video and challenge.merged_video_url:
            # Generate signed URL for merged video
            signed_video_url = await get_signed_url_for_video(challenge.merged_video_url, user_id)
            # Update the merged_video_url field directly in the response
            challenge_dict["merged_video_url"] = signed_video_url
        
        # Convert back to Challenge model for response
        return Challenge(**challenge_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenge"
        )


@router.get("/", response_model=dict)
async def list_challenges_authenticated(
    skip: int = 0,
    limit: int = 20,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    include_drafts: bool = False,
    user_id: str = Depends(get_current_user)
) -> dict:
    """
    List challenges with merged video data (authenticated endpoint)
    Returns challenges with complete merged video metadata including segment information
    """
    try:
        logger.info(f"Authenticated user {user_id} listing challenges (skip={skip}, limit={limit}, page={page}, page_size={page_size}, include_drafts={include_drafts})")
        
        # Handle both pagination styles
        if page is not None and page_size is not None:
            # Use page/page_size style
            actual_page = page
            actual_page_size = page_size
        else:
            # Convert skip/limit to page/page_size for service layer
            actual_page = (skip // limit) + 1 if limit > 0 else 1
            actual_page_size = limit
        
        # Set status filter - authenticated users can see published challenges and optionally their drafts
        from models import ChallengeStatus
        status_filter = None if include_drafts else ChallengeStatus.PUBLISHED
        creator_filter = user_id if include_drafts else None
        
        challenges, total_count = await challenge_service.list_challenges(
            page=actual_page,
            page_size=actual_page_size,
            creator_id=creator_filter,
            status=status_filter,
            user_id=user_id
        )
        
        logger.debug(f"Retrieved {len(challenges)} challenges for authenticated user")
        
        # Enhance challenges with merged video data and creator names
        enhanced_challenges = []
        for challenge in challenges:
            challenge_dict = enrich_challenge_with_creator_name(challenge)
            
            # Generate signed URLs for statement media
            if challenge_dict.get("statements"):
                for statement in challenge_dict["statements"]:
                    if statement.get("streaming_url"):
                        statement["streaming_url"] = await get_signed_url_for_video(statement["streaming_url"], user_id)
                    if statement.get("media_url"):
                        statement["media_url"] = await get_signed_url_for_video(statement["media_url"], user_id)
            
            # Add merged video information if available
            if challenge.is_merged_video:
                # Generate signed URL for merged video
                merged_video_url = challenge.merged_video_url
                
                # If merged_video_url is null, try to extract it from statements (legacy challenges)
                if not merged_video_url and challenge_dict.get("statements"):
                    # Look for merged video URL in the first statement (they all point to the same merged video)
                    first_statement = challenge_dict["statements"][0]
                    if first_statement.get("media_url"):
                        # Extract S3 key from the statement's media_url
                        legacy_url = first_statement["media_url"]
                        s3_key = extract_s3_key_from_url(legacy_url)
                        if s3_key:
                            merged_video_url = s3_key  # Use the S3 key for regeneration
                            logger.info(f"Extracted merged video S3 key from statements: {s3_key}")
                
                signed_video_url = await get_signed_url_for_video(merged_video_url, user_id)
                
                challenge_dict["merged_video_info"] = {
                    "has_merged_video": True,
                    "merged_video_url": signed_video_url,
                    "merged_video_file_id": challenge.merged_video_file_id,
                    "merge_session_id": challenge.merge_session_id
                }
                
                # Add segment metadata
                if challenge.merged_video_metadata:
                    challenge_dict["merged_video_info"]["metadata"] = {
                        "total_duration": challenge.merged_video_metadata.total_duration,
                        "compression_applied": challenge.merged_video_metadata.compression_applied,
                        "original_total_duration": challenge.merged_video_metadata.original_total_duration,
                        "segments": [
                            {
                                "statement_index": segment.statement_index,
                                "start_time": segment.start_time,
                                "end_time": segment.end_time,
                                "duration": segment.duration
                            }
                            for segment in challenge.merged_video_metadata.segments
                        ]
                    }
                elif challenge.legacy_merged_metadata:
                    challenge_dict["merged_video_info"]["legacy_metadata"] = challenge.legacy_merged_metadata
            else:
                challenge_dict["merged_video_info"] = {
                    "has_merged_video": False
                }
            
            enhanced_challenges.append(challenge_dict)
        
        has_next = (actual_page * actual_page_size) < total_count
        
        return {
            "challenges": enhanced_challenges,
            "total_count": total_count,
            "page": actual_page,
            "page_size": actual_page_size,
            "has_next": has_next,
            "authenticated": True,
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Failed to list challenges for authenticated user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list challenges"
        )


@router.get("/public", response_model=dict)
async def list_challenges_public(
    skip: int = 0,
    limit: int = 20,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    user_id: Optional[str] = Depends(get_current_user_optional)
) -> dict:
    """
    List public challenges (legacy endpoint for backward compatibility)
    """
    try:
        logger.info(f"User {user_id or 'anonymous'} listing public challenges (skip={skip}, limit={limit}, page={page}, page_size={page_size})")
        
        # Handle both pagination styles
        if page is not None and page_size is not None:
            # Use page/page_size style
            actual_page = page
            actual_page_size = page_size
        else:
            # Convert skip/limit to page/page_size for service layer
            actual_page = (skip // limit) + 1 if limit > 0 else 1
            actual_page_size = limit
        
        # Only show published challenges for public access
        from models import ChallengeStatus
        status_filter = ChallengeStatus.PUBLISHED
        
        challenges, total_count = await challenge_service.list_challenges(
            page=actual_page,
            page_size=actual_page_size,
            creator_id=None,
            status=status_filter
        )
        
        logger.debug(f"Retrieved {len(challenges)} public challenges")
        
        # Enhance challenges with signed URLs for video access and creator names
        enhanced_challenges = []
        for challenge in challenges:
            challenge_dict = enrich_challenge_with_creator_name(challenge)
            
            # Generate signed URLs for statement media
            if challenge_dict.get("statements"):
                for statement in challenge_dict["statements"]:
                    if statement.get("streaming_url"):
                        statement["streaming_url"] = await get_signed_url_for_video(statement["streaming_url"])
                    if statement.get("media_url"):
                        statement["media_url"] = await get_signed_url_for_video(statement["media_url"])
            
            # Generate signed URL for merged video if available
            if challenge.is_merged_video and challenge.merged_video_url:
                signed_video_url = await get_signed_url_for_video(challenge.merged_video_url)
                challenge_dict["merged_video_url"] = signed_video_url
            
            enhanced_challenges.append(challenge_dict)
        
        has_next = (actual_page * actual_page_size) < total_count
        
        return {
            "challenges": enhanced_challenges,
            "total_count": total_count,
            "page": actual_page,
            "page_size": actual_page_size,
            "has_next": has_next
        }
        
    except Exception as e:
        logger.error(f"Failed to list public challenges: {str(e)}", exc_info=True)
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


@router.get("/user/{target_user_id}", response_model=List[Challenge])
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
        
        # Convert skip/limit to page/page_size for service layer
        page = (skip // limit) + 1 if limit > 0 else 1
        page_size = limit
        
        challenges = await challenge_service.get_user_challenges(
            user_id=target_user_id,
            page=page,
            page_size=page_size
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
    user_id: str = Depends(get_authenticated_user)
):
    """
    Delete a challenge.

    This endpoint is protected and requires user authentication.
    - Returns 404 if the challenge is not found.
    - Returns 403 if the user is not the creator of the challenge.
    - Returns 204 on successful deletion.
    """
    try:
        logger.info(f"User {user_id} attempting to delete challenge {challenge_id}")
        
        await challenge_service.delete_challenge(
            challenge_id=challenge_id,
            user_id=user_id
        )
        
        logger.info(f"Challenge {challenge_id} deleted successfully by user {user_id}")
        
    except ChallengeNotFoundError as e:
        logger.warning(f"Delete failed: challenge not found. User: {user_id}, Challenge: {challenge_id}. Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )
    except ChallengeAccessDeniedError as e:
        logger.warning(f"Delete failed: access denied. User: {user_id}, Challenge: {challenge_id}. Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this challenge"
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the challenge"
        )


@router.get("/{challenge_id}/segments")
async def get_challenge_segments(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get segment metadata for a challenge (for merged video playback)
    """
    try:
        logger.info(f"User {user_id} requesting segment metadata for challenge {challenge_id}")
        
        segment_metadata = await challenge_service.get_challenge_segment_metadata(challenge_id)
        if not segment_metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found or not a merged video challenge"
            )
        
        return segment_metadata
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get segment metadata for challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenge segment metadata"
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


@router.post("/{challenge_id}/publish")
async def publish_challenge(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Publish a draft challenge
    """
    try:
        logger.info(f"User {user_id} attempting to publish challenge {challenge_id}")
        
        challenge = await challenge_service.publish_challenge(challenge_id, user_id)
        
        return {
            "challenge_id": challenge.challenge_id,
            "status": challenge.status,
            "published_at": challenge.published_at
        }
        
    except Exception as e:
        logger.error(f"Failed to publish challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish challenge"
        )


@router.get("/{challenge_id}/guesses")
async def get_challenge_guesses(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get all guesses for a challenge (creator only)
    """
    try:
        logger.info(f"User {user_id} requesting guesses for challenge {challenge_id}")
        
        guesses = await challenge_service.get_challenge_guesses(challenge_id, user_id)
        return {"guesses": guesses}
        
    except Exception as e:
        logger.error(f"Failed to get guesses for challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get challenge guesses"
        )


@router.post("/{challenge_id}/flag")
async def flag_challenge(
    challenge_id: str,
    request: FlagChallengeRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Flag a challenge for manual review
    """
    try:
        logger.info(f"User {user_id} flagging challenge {challenge_id}")
        
        reason = request.reason
        success = await challenge_service.flag_challenge(challenge_id, user_id, reason)
        
        if success:
            return {"message": "Challenge flagged successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to flag challenge"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to flag challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to flag challenge"
        )


@router.get("/{challenge_id}/moderation")
async def get_challenge_moderation_status(
    challenge_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get moderation status for a challenge
    """
    try:
        logger.info(f"User {user_id} requesting moderation status for challenge {challenge_id}")
        
        moderation_status = await challenge_service.get_moderation_status(challenge_id)
        if moderation_status:
            return {"moderation": moderation_status}
        else:
            return {"moderation": None}
        
    except Exception as e:
        logger.error(f"Failed to get moderation status for challenge {challenge_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get moderation status"
        )


@router.post("/{challenge_id}/report", response_model=UserReportResponse, status_code=status.HTTP_201_CREATED)
async def report_challenge(
    challenge_id: str,
    request: UserReportRequest,
    user_id: str = Depends(get_current_user)
) -> UserReportResponse:
    """
    Report a challenge for inappropriate content
    
    Allows authenticated users to report challenges that violate community guidelines.
    Each user can only report a challenge once to prevent spam.
    """
    try:
        logger.info(f"User {user_id} reporting challenge {challenge_id} for reason: {request.reason}")
        
        # First verify the challenge exists
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            logger.warning(f"Report attempt for non-existent challenge {challenge_id} by user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        # Get user ID as integer (the database expects integer user IDs)
        try:
            user_id_int = int(user_id)
        except ValueError:
            logger.error(f"Invalid user ID format: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
        
        # Create the report using the database service
        report_data = get_db_service().create_user_report(
            challenge_id=challenge_id,
            user_id=user_id_int,
            reason=request.reason,
            details=request.details
        )
        
        if not report_data:
            # User has already reported this challenge
            logger.warning(f"Duplicate report attempt: user {user_id} already reported challenge {challenge_id}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Challenge already reported by this user"
            )
        
        logger.info(f"Report created successfully: ID {report_data['id']}, user {user_id}, challenge {challenge_id}")
        
        return UserReportResponse(
            report_id=report_data["id"],
            message="Challenge reported successfully. Thank you for helping keep our community safe.",
            challenge_id=challenge_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create report for challenge {challenge_id} by user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create report"
        )


