"""
Hint Token API Endpoints
Handles spending tokens for hints in the game
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime

from services.auth_service import get_current_user_with_permissions
from services.database_service import get_db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hints", tags=["hints"])

class HintUseResponse(BaseModel):
    """Response after using a hint token"""
    success: bool
    new_balance: int
    message: str
    transaction_id: Optional[str] = None

@router.post("/use", response_model=HintUseResponse)
async def use_hint_token(
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """
    Use a hint token for the authenticated user
    
    - **Requires authentication**
    - **Deducts 1 token from user balance**
    - **Returns 402 Payment Required if insufficient tokens**
    """
    try:
        db_service = get_db_service()
        user_id = current_user.get('sub') or current_user.get('user_id') or current_user.get('email')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )
        
        # Get current balance using direct database query
        result = db_service._execute_select(
            "SELECT balance FROM token_balances WHERE user_id = %s",
            (user_id,),
            fetch_one=True
        )
        
        if not result:
            # Initialize user with 0 balance if not exists
            db_service._execute_insert("token_balances", {
                "user_id": user_id,
                "balance": 0,
                "last_updated": datetime.utcnow()
            })
            current_balance = 0
        else:
            current_balance = result['balance']
        
        # Return 402 Payment Required if insufficient tokens
        if current_balance <= 0:
            logger.warning(f"User {user_id} attempted to use hint with insufficient tokens: {current_balance}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient tokens to use hint. Please purchase more tokens."
            )
        
        # Deduct 1 token from balance
        new_balance = current_balance - 1
        db_service._execute_update(
            "token_balances",
            {"balance": new_balance, "last_updated": datetime.utcnow()},
            "user_id = %s",
            (user_id,)
        )
        
        logger.info(f"User {user_id} successfully used hint token. New balance: {new_balance}")
        
        return HintUseResponse(
            success=True,
            new_balance=new_balance,
            message="Hint token used successfully",
            transaction_id=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to use hint token for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process hint token request: {str(e)}"
        )