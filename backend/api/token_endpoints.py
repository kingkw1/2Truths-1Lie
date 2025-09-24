"""
Token Management API Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request, Header
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import json
import hmac
import hashlib
import os

from services.auth_service import (
    auth_service,
    get_current_user_with_permissions,
    security
)
from services.database_service import get_db_service
from services.token_service import TokenService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tokens", tags=["tokens"])

# Token service instance
_token_service = None

def get_token_service() -> TokenService:
    """Get or create token service instance"""
    global _token_service
    if _token_service is None:
        db_service = get_db_service()
        _token_service = TokenService(db_service)
    return _token_service

class TokenSpendRequest(BaseModel):
    """Request to spend tokens"""
    amount: int
    description: str
    metadata: Optional[Dict[str, Any]] = {}

class TokenSpendResponse(BaseModel):
    """Response after spending tokens"""
    success: bool
    transaction_id: Optional[str] = None
    new_balance: int
    message: str

class TokenBalanceResponse(BaseModel):
    """Response containing user's token balance"""
    balance: int
    last_updated: str

class TokenTransactionResponse(BaseModel):
    """Single token transaction"""
    transaction_id: str
    transaction_type: str
    amount: int
    balance_before: int
    balance_after: int
    description: str
    metadata: Dict[str, Any]
    created_at: str

class RevenueCatWebhookPayload(BaseModel):
    """RevenueCat webhook payload"""
    api_version: str
    event: Dict[str, Any]

# Product ID to token mapping (customize based on your RevenueCat products)
PRODUCT_TOKEN_MAP = {
    "pro_monthly": 500,    # $4.99 gets 500 tokens
    "pro_annual": 6000,    # $49.99 gets 6000 tokens (extra bonus)
    "token_pack_small": 5,     # Small token pack
    "token_pack_medium": 500,  # Medium token pack
    "token_pack_large": 25,    # Large token pack
}

@router.get("/balance", response_model=TokenBalanceResponse)
async def get_token_balance(
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """Get current token balance for authenticated user"""
    try:
        token_service = get_token_service()
        user_id = current_user.get('user_id') or current_user.get('email')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )
        
        balance_response = token_service.get_user_balance(user_id)
        
        return TokenBalanceResponse(
            balance=balance_response.balance,
            last_updated=balance_response.last_updated.isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to get token balance for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve token balance"
        )

@router.post("/spend", response_model=TokenSpendResponse)
async def spend_tokens(
    spend_request: TokenSpendRequest,
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """Spend tokens for authenticated user"""
    try:
        token_service = get_token_service()
        user_id = current_user.get('user_id') or current_user.get('email')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )
        
        # Create spend request object
        from token_models.token_models import TokenSpendRequest as TokenSpendRequestModel
        spend_request_model = TokenSpendRequestModel(
            amount=spend_request.amount,
            description=spend_request.description,
            metadata=spend_request.metadata or {}
        )
        
        response = token_service.spend_tokens(user_id, spend_request_model)
        
        if not response.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.message
            )
        
        return TokenSpendResponse(
            success=response.success,
            transaction_id=response.transaction_id,
            new_balance=response.new_balance,
            message=response.message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to spend tokens for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to spend tokens"
        )

@router.get("/history", response_model=List[TokenTransactionResponse])
async def get_transaction_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """Get transaction history for authenticated user"""
    try:
        token_service = get_token_service()
        user_id = current_user.get('user_id') or current_user.get('email')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )
        
        transactions = token_service.get_transaction_history(user_id, limit)
        
        return [
            TokenTransactionResponse(
                transaction_id=tx["transaction_id"],
                transaction_type=tx["transaction_type"],
                amount=tx["amount"],
                balance_before=tx["balance_before"],
                balance_after=tx["balance_after"],
                description=tx["description"],
                metadata=tx["metadata"],
                created_at=tx["created_at"].isoformat() if hasattr(tx["created_at"], 'isoformat') else str(tx["created_at"])
            )
            for tx in transactions
        ]
        
    except Exception as e:
        logger.error(f"Failed to get transaction history for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve transaction history"
        )

# Manual token addition for testing (should be protected or removed in production)
class ManualTokenAddRequest(BaseModel):
    """Request to manually add tokens (testing only)"""
    amount: int
    description: str = "Manual token addition for testing"
    
@router.post("/add-manual", response_model=TokenBalanceResponse)
async def add_tokens_manually(
    request: ManualTokenAddRequest,
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """Manually add tokens to user balance (for testing purposes)"""
    try:
        user_id = current_user.get("user_id") or current_user.get("id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to identify user"
            )
        
        if request.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be positive"
            )
        
        # Create a mock purchase event for manual addition
        from token_models.token_models import TokenPurchaseEvent
        purchase_event = TokenPurchaseEvent(
            user_id=str(user_id),
            product_id="manual_test_tokens",
            transaction_id=f"manual_{user_id}_{int(__import__('time').time())}",
            tokens_purchased=request.amount,
            purchase_price="0.00",
            purchase_currency="USD"
        )
        
        token_service = get_token_service()
        success = token_service.add_tokens_from_purchase(purchase_event)
        
        if success:
            # Get updated balance
            balance = token_service.get_user_balance(str(user_id))
            logger.info(f"Manually added {request.amount} tokens to user {user_id}, new balance: {balance}")
            
            return TokenBalanceResponse(
                balance=balance,
                user_id=str(user_id)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add tokens"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to manually add tokens for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add tokens manually"
        )

def verify_revenuecat_webhook(payload: bytes, signature: str) -> bool:
    """Verify RevenueCat webhook signature"""
    webhook_secret = os.getenv('REVENUECAT_WEBHOOK_SECRET')
    if not webhook_secret:
        logger.warning("REVENUECAT_WEBHOOK_SECRET not set, skipping signature verification")
        return True  # In development, you might want to skip verification
    
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # RevenueCat sends signature as "sha256=<hash>"
    if signature.startswith('sha256='):
        signature = signature[7:]
    
    return hmac.compare_digest(expected_signature, signature)

@router.post("/webhook/revenuecat")
async def revenuecat_webhook(
    request: Request,
    x_revenuecat_signature: Optional[str] = Header(None)
):
    """Handle RevenueCat webhook events for token purchases"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify webhook signature
        if x_revenuecat_signature:
            if not verify_revenuecat_webhook(body, x_revenuecat_signature):
                logger.warning("Invalid RevenueCat webhook signature")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        
        # Parse webhook payload
        try:
            payload = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in webhook payload: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload"
            )
        
        # Extract event data
        event = payload.get('event', {})
        event_type = event.get('type')
        
        # Only process purchase events
        if event_type not in ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE']:
            logger.info(f"Ignoring webhook event type: {event_type}")
            return {"status": "ignored", "reason": "Not a purchase event"}
        
        # Extract purchase data
        app_user_id = event.get('app_user_id')
        product_id = event.get('product_id')
        transaction_id = event.get('transaction_id')
        
        if not all([app_user_id, product_id, transaction_id]):
            logger.error(f"Missing required fields in webhook: {event}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields in webhook payload"
            )
        
        # Map product to tokens
        tokens_to_add = PRODUCT_TOKEN_MAP.get(product_id)
        if tokens_to_add is None:
            logger.warning(f"Unknown product ID in webhook: {product_id}")
            return {"status": "ignored", "reason": f"Unknown product: {product_id}"}
        
        # Create purchase event
        from token_models.token_models import TokenPurchaseEvent
        purchase_event = TokenPurchaseEvent(
            user_id=app_user_id,
            product_id=product_id,
            transaction_id=transaction_id,
            tokens_purchased=tokens_to_add,
            purchase_price=event.get('price'),
            purchase_currency=event.get('currency')
        )
        
        # Add tokens to user balance
        token_service = get_token_service()
        success = token_service.add_tokens_from_purchase(purchase_event)
        
        if success:
            logger.info(f"Successfully processed token purchase: {tokens_to_add} tokens for user {app_user_id}")
            return {
                "status": "success", 
                "tokens_added": tokens_to_add,
                "user_id": app_user_id,
                "transaction_id": transaction_id
            }
        else:
            logger.error(f"Failed to process token purchase for user {app_user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process token purchase"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing RevenueCat webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error processing webhook"
        )