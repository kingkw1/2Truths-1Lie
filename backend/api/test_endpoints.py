"""
DISABLED: Simple challenge creation test - bypasses media validation for testing

This file contains mock/test endpoints that have been disabled to avoid confusion
with production challenge endpoints. These endpoints bypass proper validation
and authentication and should not be used in production.

To re-enable for development/testing purposes, uncomment the router registration
in main.py and the router definition below.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import uuid
import logging
from services.s3_media_service import get_s3_media_service

logger = logging.getLogger(__name__)
from datetime import datetime
from services.s3_media_service import s3_media_service
from services.challenge_service import challenge_service
from services.upload_service import ChunkedUploadService
from models import CreateChallengeRequest, Challenge

# DISABLED: Uncomment the line below to re-enable test endpoints for development
router = APIRouter(prefix="/api/v1/test", tags=["testing"])
# router = None  # Disabled to prevent confusion with production endpoints

class SimpleStatement(BaseModel):
    text: str
    media_file_id: str

class SimpleChallengeRequest(BaseModel):
    statements: List[SimpleStatement]
    lie_statement_index: int

class SimpleChallengeResponse(BaseModel):
    id: str
    message: str
    statements: List[SimpleStatement]
    lie_index: int
    created_at: datetime

# DISABLED: Uncomment the decorator below to re-enable this test endpoint
@router.post("/challenge", response_model=SimpleChallengeResponse)
async def create_test_challenge(request: SimpleChallengeRequest):
    """
    Create a test challenge without media validation - for testing purposes only
    
    This endpoint bypasses proper validation and authentication for testing.
    """
    try:
        # Basic validation
        if len(request.statements) != 3:
            raise HTTPException(
                status_code=400,
                detail="Must provide exactly 3 statements"
            )
        
        if request.lie_statement_index < 0 or request.lie_statement_index >= 3:
            raise HTTPException(
                status_code=400,
                detail="lie_statement_index must be 0, 1, or 2"
            )
        
        # Create challenge directly without validation (for testing)
        from models import Statement, StatementType, ChallengeStatus
        
        challenge_id = str(uuid.uuid4())
        creator_id = "test-user-123"
        
        # Create statements
        # Use video files from request if provided, otherwise use defaults for testing
        statements = []
        lie_statement_id = None
        for i, stmt in enumerate(request.statements):
            statement_id = str(uuid.uuid4())
            
            # Use the media_file_id from the request if it's a real UUID, otherwise use test videos
            if stmt.media_file_id and len(stmt.media_file_id) > 10 and '-' in stmt.media_file_id:
                # Real media file ID provided - use it directly
                media_file_id = stmt.media_file_id
            else:
                # Fallback to test videos if no real media_file_id provided
                available_videos = [
                    "460faef2-a043-446b-a9f2-0c1602f235f5",  # Statement 1
                    "47ba0574-a6da-4e56-b323-ca730fd4415a",  # Statement 2  
                    "6404fa02-8dda-4c5e-bff5-cba64d045cb1",  # Statement 3
                ]
                media_file_id = available_videos[i] if i < len(available_videos) else available_videos[0]
            
            # Generate proper signed URL for the real uploaded video
            try:
                s3_service = get_s3_media_service()
                real_streaming_url = await s3_service.generate_signed_url(media_file_id)
                real_media_url = real_streaming_url  # Use the same signed URL for both
            except Exception as e:
                # Fallback to BigBuckBunny if real video not found
                logger.warning(f"Could not generate URL for media_file_id {media_file_id}: {e}")
                real_streaming_url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                real_media_url = real_streaming_url
            
            statement = Statement(
                statement_id=statement_id,
                text=stmt.text,
                media_file_id=media_file_id,  # Use real video from request or fallback
                media_url=real_media_url,  # Use the real uploaded video URL
                streaming_url=real_streaming_url,  # Use the real uploaded video URL
                duration_seconds=3.0,  # Realistic duration for user-recorded videos
                cloud_storage_key=f"media/videos/20250905/{media_file_id}",
                storage_type="s3",
                statement_type=StatementType.LIE if i == request.lie_statement_index else StatementType.TRUTH,
                # No segment metadata - these are individual videos
                segment_start_time=None,
                segment_end_time=None,
                segment_duration=None,
                segment_metadata=None,
                created_at=datetime.now()
            )
            statements.append(statement)
            
            # Track the lie statement ID
            if i == request.lie_statement_index:
                lie_statement_id = statement_id
        
        # Create challenge object - explicitly NOT a merged video
        challenge = Challenge(
            challenge_id=challenge_id,
            creator_id=creator_id,
            statements=statements,
            lie_statement_id=lie_statement_id,  # Required field
            status=ChallengeStatus.PUBLISHED,  # Make it visible
            view_count=0,
            guess_count=0,
            correct_guess_count=0,
            tags=["test"],
            is_merged_video=False,  # Individual videos, not segments
            merged_video_metadata=None,  # No merged video metadata
            legacy_merged_metadata=None,  # No legacy metadata
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Store in challenge service
        challenge_service.challenges[challenge_id] = challenge
        await challenge_service._save_challenges()  # Persist to disk
        
        # Create response
        response = SimpleChallengeResponse(
            id=challenge.challenge_id,
            message="Test challenge created successfully and stored in database",
            statements=request.statements,
            lie_index=request.lie_statement_index,
            created_at=datetime.now()
        )
        
        print(f"🧪 TEST ENDPOINT: Created and stored test challenge {challenge.challenge_id}")
        print(f"🧪 TEST ENDPOINT: Statements: {len(request.statements)}")
        print(f"🧪 TEST ENDPOINT: Lie index: {request.lie_statement_index}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🚨 TEST ENDPOINT ERROR: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Test endpoint error: {str(e)}"
        )
    
    # DISABLED CODE BELOW - Uncomment to re-enable for development/testing
    """
    # Basic validation
    if len(request.statements) != 3:
        raise HTTPException(status_code=400, detail="Must have exactly 3 statements")
    
    if not (0 <= request.lie_statement_index <= 2):
        raise HTTPException(status_code=400, detail="lie_statement_index must be 0, 1, or 2")
    
    # Create a simple challenge response
    challenge_id = str(uuid.uuid4())
    
    return SimpleChallengeResponse(
        id=challenge_id,
        message="Test challenge created successfully!",
        statements=request.statements,
        lie_index=request.lie_statement_index,
        created_at=datetime.utcnow()
    )
    """
