"""
Admin API Endpoints
Handles moderation, rate limiting, and system administration
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
import logging
import json

from services.auth_service import get_current_user
from services.challenge_service import challenge_service
from services.database_service import get_db_service
from models import Challenge, ChallengeListResponse, ModerationReviewRequest, ReportedChallengesResponse, ReportedChallenge
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

class SetPremiumRequest(BaseModel):
    email: EmailStr
    is_premium: bool

# Database service will be accessed via get_db_service() function


def log_admin_action(action: str, user_id: str, details: dict = None, success: bool = True):
    """Log admin actions for audit purposes"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "user_id": user_id,
        "success": success,
        "details": details or {}
    }
    
    if success:
        logger.info(f"ADMIN_ACTION: {json.dumps(log_entry)}")
    else:
        logger.error(f"ADMIN_ACTION_FAILED: {json.dumps(log_entry)}")


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
        reported_challenges = get_db_service().get_all_reported_challenges(
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
        total_count = get_db_service().get_reported_challenges_count()
        
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
        
        # Log the admin action
        log_admin_action(
            action="moderation_review",
            user_id=user_id,
            details={
                "challenge_id": challenge_id,
                "decision": request.decision,
                "reason": request.reason,
                "new_status": challenge.status
            }
        )
        
        return {
            "challenge_id": challenge.challenge_id,
            "status": challenge.status,
            "updated_at": challenge.updated_at
        }
        
    except HTTPException:
        log_admin_action(
            action="moderation_review",
            user_id=user_id,
            details={"challenge_id": challenge_id, "decision": request.decision},
            success=False
        )
        raise
    except Exception as e:
        logger.error(f"Failed to review challenge {challenge_id}: {str(e)}", exc_info=True)
        log_admin_action(
            action="moderation_review",
            user_id=user_id,
            details={"challenge_id": challenge_id, "error": str(e)},
            success=False
        )
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
        
        # Log the admin action
        log_admin_action(
            action="rate_limit_reset",
            user_id=current_user,
            details={"target_user_id": user_id}
        )
        
        return {"message": f"Rate limit reset for user {user_id}"}
        
    except Exception as e:
        logger.error(f"Failed to reset rate limit for user {user_id}: {str(e)}", exc_info=True)
        log_admin_action(
            action="rate_limit_reset",
            user_id=current_user,
            details={"target_user_id": user_id, "error": str(e)},
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset rate limit"
        )


@router.post("/cleanup")
async def cleanup_expired_sessions(current_user: str = Depends(get_current_user)):
    """
    Clean up expired upload sessions (admin endpoint)
    """
    try:
        from services.upload_service import ChunkedUploadService
        upload_service = ChunkedUploadService()
        
        cleaned_count = await upload_service.cleanup_expired_sessions()
        
        # Log the admin action
        log_admin_action(
            action="cleanup_sessions",
            user_id=current_user,
            details={"cleaned_count": cleaned_count}
        )
        
        return {"message": f"Cleaned up {cleaned_count} expired sessions"}
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired sessions: {str(e)}", exc_info=True)
        log_admin_action(
            action="cleanup_sessions",
            user_id=current_user,
            details={"error": str(e)},
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired sessions"
        )


@router.post("/cleanup/rate-limits")
async def cleanup_expired_rate_limits(current_user: str = Depends(get_current_user)):
    """
    Clean up expired rate limit data (admin endpoint)
    """
    try:
        from services.rate_limiter import RateLimiter
        rate_limiter = RateLimiter()
        
        cleaned_count = await rate_limiter.cleanup_expired_limits()
        
        # Log the admin action
        log_admin_action(
            action="cleanup_rate_limits",
            user_id=current_user,
            details={"cleaned_count": cleaned_count}
        )
        
        return {"message": f"Cleaned up rate limit data for {cleaned_count} users"}
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired rate limits: {str(e)}", exc_info=True)
        log_admin_action(
            action="cleanup_rate_limits",
            user_id=current_user,
            details={"error": str(e)},
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired rate limits"
        )


@router.post("/cleanup/orphaned-reports")
async def cleanup_orphaned_reports(current_user: str = Depends(get_current_user)):
    """
    Clean up orphaned report records (reports for challenges that no longer exist)
    """
    try:
        logger.info(f"Admin {current_user} cleaning up orphaned reports")
        
        # Get all reported challenge IDs
        reported_challenge_ids = get_db_service().get_all_reported_challenge_ids()
        
        # Check which ones actually exist in the challenge service
        orphaned_reports = []
        for challenge_id in reported_challenge_ids:
            try:
                challenge = await challenge_service.get_challenge(challenge_id)
                if not challenge:
                    orphaned_reports.append(challenge_id)
            except:
                # If we can't fetch the challenge, it's likely orphaned
                orphaned_reports.append(challenge_id)
        
        # Remove orphaned reports
        removed_count = 0
        for challenge_id in orphaned_reports:
            count = get_db_service().remove_reports_for_challenge(challenge_id)
            removed_count += count
            logger.info(f"Removed {count} orphaned reports for challenge {challenge_id}")
        
        # Log the admin action
        log_admin_action(
            action="cleanup_orphaned_reports",
            user_id=current_user,
            details={
                "orphaned_challenges": orphaned_reports,
                "total_reports_removed": removed_count
            }
        )
        
        return {
            "message": f"Cleaned up {removed_count} orphaned reports for {len(orphaned_reports)} challenges",
            "orphaned_challenges": orphaned_reports,
            "reports_removed": removed_count
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup orphaned reports: {str(e)}", exc_info=True)
        log_admin_action(
            action="cleanup_orphaned_reports",
            user_id=current_user,
            details={"error": str(e)},
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup orphaned reports"
        )


@router.delete("/challenges/{challenge_id}")
async def delete_challenge_admin(
    challenge_id: str,
    user_id: str = Depends(get_current_user),
    force: bool = False
):
    """
    Delete a challenge completely (admin only)
    This removes the challenge, all associated media files, and database records
    """
    try:
        logger.info(f"Admin {user_id} requesting deletion of challenge {challenge_id} (force={force})")
        
        # Check if challenge exists
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Challenge {challenge_id} not found"
            )
        
        # Log challenge details before deletion
        logger.info(f"Deleting challenge: {challenge_id}, status: {challenge.status}, creator: {challenge.creator_id}")
        
        # Delete from challenge service (handles JSON file)
        deleted = await challenge_service.admin_delete_challenge(challenge_id, user_id, force=force)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge could not be deleted. Use force=true to override restrictions."
            )
        
        # Delete associated database records
        db_deletions = get_db_service().admin_delete_challenge_records(challenge_id)
        
        # Try to delete associated media files from cloud storage
        media_deletions = {"deleted": 0, "errors": []}
        try:
            from services.cloud_storage_service import create_cloud_storage_service
            from config import settings
            
            if settings.USE_CLOUD_STORAGE:
                cloud_storage = create_cloud_storage_service(
                    provider=settings.CLOUD_STORAGE_PROVIDER,
                    bucket_name=settings.AWS_S3_BUCKET_NAME,
                    region_name=settings.AWS_S3_REGION,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
                )
                
                # Find and delete all media files associated with this challenge
                import boto3
                s3_client = cloud_storage.s3_client
                paginator = s3_client.get_paginator('list_objects_v2')
                
                objects_to_delete = []
                for page in paginator.paginate(Bucket=settings.AWS_S3_BUCKET_NAME):
                    if 'Contents' in page:
                        for obj in page['Contents']:
                            if challenge_id in obj['Key']:
                                objects_to_delete.append({'Key': obj['Key']})
                
                if objects_to_delete:
                    response = s3_client.delete_objects(
                        Bucket=settings.AWS_S3_BUCKET_NAME,
                        Delete={'Objects': objects_to_delete}
                    )
                    media_deletions["deleted"] = len(response.get('Deleted', []))
                    if 'Errors' in response:
                        media_deletions["errors"] = response['Errors']
                
        except Exception as e:
            logger.error(f"Error deleting media files for challenge {challenge_id}: {e}")
            media_deletions["errors"].append(str(e))
        
        logger.info(f"Successfully deleted challenge {challenge_id} by admin {user_id}")
        
        # Log the admin action with detailed information
        log_admin_action(
            action="challenge_deletion",
            user_id=user_id,
            details={
                "challenge_id": challenge_id,
                "force": force,
                "database_records_deleted": db_deletions,
                "media_files_deleted": media_deletions["deleted"],
                "media_deletion_errors": media_deletions["errors"]
            }
        )
        
        return {
            "success": True,
            "challenge_id": challenge_id,
            "challenge_service_deleted": deleted,
            "database_records_deleted": db_deletions,
            "media_files_deleted": media_deletions["deleted"],
            "media_deletion_errors": media_deletions["errors"],
            "deleted_by": user_id,
            "deleted_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        log_admin_action(
            action="challenge_deletion",
            user_id=user_id,
            details={"challenge_id": challenge_id, "force": force},
            success=False
        )
        raise
    except Exception as e:
        logger.error(f"Failed to delete challenge {challenge_id}: {str(e)}", exc_info=True)
        log_admin_action(
            action="challenge_deletion",
            user_id=user_id,
            details={"challenge_id": challenge_id, "force": force, "error": str(e)},
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete challenge"
        )


@router.get("/challenges/search/{search_term}")
async def search_challenges_admin(
    search_term: str,
    user_id: str = Depends(get_current_user)
):
    """
    Search for challenges by ID, creator, or title (admin only)
    """
    try:
        logger.info(f"Admin {user_id} searching challenges: {search_term}")
        
        # Search in challenge service
        all_challenges = list(challenge_service.challenges.values())
        
        matching_challenges = []
        for challenge in all_challenges:
            if (search_term.lower() in challenge.challenge_id.lower() or
                search_term.lower() in str(challenge.creator_id).lower() or
                (challenge.title and search_term.lower() in challenge.title.lower())):
                matching_challenges.append({
                    "challenge_id": challenge.challenge_id,
                    "title": challenge.title,
                    "creator_id": challenge.creator_id,
                    "status": challenge.status,
                    "created_at": challenge.created_at,
                    "view_count": challenge.view_count,
                    "guess_count": challenge.guess_count
                })
        
        return {
            "search_term": search_term,
            "matches_found": len(matching_challenges),
            "challenges": matching_challenges
        }
        
    except Exception as e:
        logger.error(f"Failed to search challenges: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search challenges"
        )

@router.post("/users/set-premium-status")
async def set_premium_status(
    request: SetPremiumRequest,
    admin_user_id: str = Depends(get_current_user)
):
    """
    Set a user's premium status (admin only).
    """
    try:
        db_service = get_db_service()

        # Find user by email
        user = db_service.get_user_by_email(request.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with email {request.email} not found"
            )

        # Set premium status
        success = db_service.set_user_premium_status(user['id'], request.is_premium)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update premium status in database"
            )

        # Log the admin action
        log_admin_action(
            action="set_premium_status",
            user_id=admin_user_id,
            details={"target_email": request.email, "new_status": request.is_premium}
        )

        return {
            "message": "Premium status updated successfully",
            "email": request.email,
            "is_premium": request.is_premium
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set premium status for {request.email}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set premium status"
        )


# TEMPORARY DEBUG ENDPOINT - REMOVE AFTER TESTING
@router.post("/debug/set-premium-user-10")
async def debug_set_premium_user_10():
    """
    TEMPORARY: Set premium status for user 10 directly
    This is for testing the premium rate limiting fix
    """
    try:
        db_service = get_db_service()
        
        # Find user 10
        user = db_service.get_user_by_id(10)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User 10 not found"
            )

        # Set premium status
        success = db_service.set_user_premium_status(10, True)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update premium status in database"
            )

        # Verify the change
        updated_user = db_service.get_user_by_id(10)
        
        return {
            "message": "Successfully set premium status for user 10",
            "user_id": 10,
            "email": user.get('email'),
            "old_premium": user.get('is_premium'),
            "new_premium": updated_user.get('is_premium')
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set premium status for user 10: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set premium status: {str(e)}"
        )