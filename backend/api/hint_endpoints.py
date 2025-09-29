"""
Hint Token API Endpoints
Handles spending tokens for hints in the game
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
import logging

from services.auth_service import get_current_user_with_permissions
from services.database_service import get_db_service
from services.token_service import TokenService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hints", tags=["hints"])

# Token service instance
_token_service = None

def get_token_service() -> TokenService:
    """Get or create token service instance"""
    global _token_service
    if _token_service is None:
        db_service = get_db_service()
        _token_service = TokenService(db_service)
    return _token_service

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
        token_service = get_token_service()
        user_id = current_user.get('sub') or current_user.get('user_id') or current_user.get('email')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )
        
        # Check current balance first
        balance_response = token_service.get_user_balance(user_id)
        current_balance = balance_response.balance
        
        # Return 402 Payment Required if insufficient tokens
        if current_balance <= 0:
            logger.warning(f"User {user_id} attempted to use hint with insufficient tokens: {current_balance}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient tokens to use hint. Please purchase more tokens."
            )
        
        # Create spend request for hint usage
        from token_models.token_models import TokenSpendRequest
        spend_request = TokenSpendRequest(
            amount=1,
            description="Hint token usage",
            metadata={"type": "hint", "feature": "50_50_hint"}
        )
        
        # Spend the token
        response = token_service.spend_tokens(user_id, spend_request)
        
        if not response.success:
            # This shouldn't happen since we checked balance, but handle edge cases
            logger.error(f"Token spend failed for user {user_id}: {response.message}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Unable to process hint token. Please try again."
            )
        
        logger.info(f"User {user_id} successfully used hint token. New balance: {response.new_balance}")
        
        return HintUseResponse(
            success=True,
            new_balance=response.new_balance,
            message="Hint token used successfully",
            transaction_id=response.transaction_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to use hint token for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process hint token request"
        )