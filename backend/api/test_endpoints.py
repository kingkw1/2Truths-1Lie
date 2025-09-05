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
from typing import List, Optional, Dict, Any
import uuid
import logging
from services.s3_media_service import get_s3_media_service

logger = logging.getLogger(__name__)
from datetime import datetime
from services.s3_media_service import s3_media_service
from services.challenge_service import challenge_service
from services.upload_service import ChunkedUploadService
from models import CreateChallengeRequest, Challenge, Statement, StatementType, VideoSegmentMetadata, MergedVideoMetadata, ChallengeStatus

# DISABLED: Uncomment the line below to re-enable test endpoints for development
router = APIRouter(prefix="/api/v1/test", tags=["testing"])
# router = None  # Disabled to prevent confusion with production endpoints

class SimpleStatement(BaseModel):
    text: str
    media_file_id: str
    # Optional segment metadata for merged videos
    segment_start_time: Optional[float] = None
    segment_end_time: Optional[float] = None
    segment_duration: Optional[float] = None

class SimpleChallengeRequest(BaseModel):
    statements: List[SimpleStatement]
    lie_statement_index: int
    # Optional merged video fields
    is_merged_video: Optional[bool] = False
    merged_video_metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None

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
            
            # Extract segment metadata for this specific statement if merged video
            statement_segment_metadata = None
            statement_start_time_ms = None
            statement_end_time_ms = None
            statement_duration_ms = None
            
            if request.is_merged_video and request.merged_video_metadata and 'segments' in request.merged_video_metadata:
                # Find the segment for this statement index
                segments = request.merged_video_metadata.get('segments', [])
                for segment in segments:
                    if segment.get('statement_index') == i:
                        # Convert from milliseconds to seconds for VideoSegmentMetadata
                        statement_segment_metadata = VideoSegmentMetadata(
                            start_time=segment.get('start_time_ms', 0) / 1000.0,
                            end_time=segment.get('end_time_ms', 0) / 1000.0,
                            duration=segment.get('duration_ms', 0) / 1000.0,
                            statement_index=segment.get('statement_index', i)
                        )
                        # Keep milliseconds for statement fields (mobile app expects milliseconds)
                        statement_start_time_ms = segment.get('start_time_ms', 0)
                        statement_end_time_ms = segment.get('end_time_ms', 0)
                        statement_duration_ms = segment.get('duration_ms', 0)
                        break
            
            statement = Statement(
                statement_id=statement_id,
                text=stmt.text,
                media_file_id=media_file_id,  # Use real video from request or fallback
                media_url=real_media_url,  # Use the real uploaded video URL
                streaming_url=real_streaming_url,  # Use the real uploaded video URL
                duration_seconds=stmt.segment_duration if stmt.segment_duration else 3.0,  # Use segment duration or fallback
                cloud_storage_key=f"media/videos/20250905/{media_file_id}",
                storage_type="s3",
                statement_type=StatementType.LIE if i == request.lie_statement_index else StatementType.TRUTH,
                # Include segment metadata in milliseconds (mobile app expects milliseconds)
                segment_start_time=statement_start_time_ms,
                segment_end_time=statement_end_time_ms,
                segment_duration=statement_duration_ms,
                segment_metadata=statement_segment_metadata,
                created_at=datetime.now()
            )
            statements.append(statement)
            
            # Track the lie statement ID
            if i == request.lie_statement_index:
                lie_statement_id = statement_id
        
        # Create challenge object - use request data to determine if merged video
        # Transform merged video metadata if present
        transformed_merged_metadata = None
        if request.is_merged_video and request.merged_video_metadata:
            # Transform the metadata to match MergedVideoMetadata schema
            raw_metadata = request.merged_video_metadata
            
            # Convert segments from mobile app format to backend format
            transformed_segments = []
            if 'segments' in raw_metadata:
                for segment in raw_metadata['segments']:
                    transformed_segment = VideoSegmentMetadata(
                        start_time=segment.get('start_time_ms', 0) / 1000.0,
                        end_time=segment.get('end_time_ms', 0) / 1000.0,
                        duration=segment.get('duration_ms', 0) / 1000.0,
                        statement_index=segment.get('statement_index', 0)
                    )
                    transformed_segments.append(transformed_segment)
            
            # Get the media file ID from the first statement (since all statements use the same merged video)
            video_file_id = statements[0].media_file_id if statements else "unknown"
            
            # Create the properly formatted MergedVideoMetadata
            transformed_merged_metadata = MergedVideoMetadata(
                total_duration=raw_metadata.get('total_duration_ms', 0) / 1000.0,
                segments=transformed_segments,
                video_file_id=video_file_id,
                compression_applied=raw_metadata.get('compression_applied', False),
                original_total_duration=raw_metadata.get('original_total_duration_ms', None) / 1000.0 if raw_metadata.get('original_total_duration_ms') else None
            )
        
        challenge = Challenge(
            challenge_id=challenge_id,
            creator_id=creator_id,
            statements=statements,
            lie_statement_id=lie_statement_id,  # Required field
            status=ChallengeStatus.PUBLISHED,  # Make it visible
            view_count=0,
            guess_count=0,
            correct_guess_count=0,
            tags=request.tags if request.tags else ["test"],
            is_merged_video=request.is_merged_video if request.is_merged_video else False,
            merged_video_metadata=transformed_merged_metadata,
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
        print(f"🧪 TEST ENDPOINT: Is merged video: {request.is_merged_video}")
        print(f"🧪 TEST ENDPOINT: Has segment metadata: {bool(request.merged_video_metadata)}")
        
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
