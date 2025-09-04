"""
Simple challenge creation test - bypasses media validation for testing
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/v1/test", tags=["testing"])

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

@router.post("/challenge", response_model=SimpleChallengeResponse)
async def create_test_challenge(request: SimpleChallengeRequest):
    """
    Create a test challenge without media validation - for testing purposes only
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
