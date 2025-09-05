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
from datetime import datetime
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
        statements = []
        lie_statement_id = None
        for i, stmt in enumerate(request.statements):
            statement_id = str(uuid.uuid4())
            statement = Statement(
                statement_id=statement_id,
                text=stmt.text,
                media_file_id=stmt.media_file_id,
                media_url=f"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",  # Use reliable test video
                streaming_url=f"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",  # Use reliable test video
                duration_seconds=596.0,  # Real duration for Big Buck Bunny sample
                cloud_storage_key=f"challenges/{challenge_id}/segments/{i}.mp4",
                storage_type="s3",
                statement_type=StatementType.LIE if i == request.lie_statement_index else StatementType.TRUTH,
                created_at=datetime.now()
            )
            statements.append(statement)
            
            # Track the lie statement ID
            if i == request.lie_statement_index:
                lie_statement_id = statement_id
        
        # Create challenge object
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
