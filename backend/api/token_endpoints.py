"""
Token Management API Endpoints
Includes manual token addition for testing
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
import time

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

PREMIUM_PRODUCT_IDS = {"pro_monthly", "pro_annual"}

@router.get("/balance", response_model=TokenBalanceResponse)
async def get_token_balance(
    current_user: dict = Depends(get_current_user_with_permissions)
):
    """Get current token balance for authenticated user"""
    try:
        token_service = get_token_service()
        user_id = current_user.get('sub') or current_user.get('user_id') or current_user.get('email')
        
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
        user_id = current_user.get('sub') or current_user.get('user_id') or current_user.get('email')
        
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
        user_id = current_user.get('sub') or current_user.get('user_id') or current_user.get('email')
        
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

@router.get("/test-db")
async def test_db_connection():
    """Test database connection for token service"""
    try:
        token_service = get_token_service()
        # Try to get balance for user 10
        balance_response = token_service.get_user_balance("10")
        return {"success": True, "balance": balance_response.balance, "user_id": "10"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/test-add")
async def test_token_add():
    """Test token addition step by step"""
    try:
        import uuid
        from datetime import datetime
        from token_models.token_models import TokenTransactionType
        from services.database_service import get_db_service
        
        db = get_db_service()
        token_service = get_token_service()
        user_id = "10"
        amount = 25
        
        # Get initial balance
        initial_balance = token_service.get_user_balance(user_id)
        
        # Test each step individually
        steps = {}
        
        # Step 1: Generate transaction ID
        try:
            transaction_id = str(uuid.uuid4())
            steps["generate_transaction_id"] = "OK"
        except Exception as e:
            steps["generate_transaction_id"] = f"Error: {str(e)}"
            
        # Step 2: Calculate new balance
        try:
            current_balance = initial_balance.balance
            new_balance = current_balance + amount
            steps["calculate_balance"] = f"OK: {current_balance} + {amount} = {new_balance}"
        except Exception as e:
            steps["calculate_balance"] = f"Error: {str(e)}"
            
        # Step 3: Try database transaction directly
        try:
            metadata_json = '{"test": true, "method": "add_tokens_for_testing"}'
            current_time = datetime.utcnow()
            
            # Check current balance in DB
            current_balance_data = db._execute_select(
                "SELECT balance FROM token_balances WHERE user_id = ?",
                (user_id,),
                fetch_one=True
            )
            
            if current_balance_data:
                db_balance = current_balance_data['balance']
                steps["check_db_balance"] = f"OK: Found balance {db_balance}"
            else:
                steps["check_db_balance"] = "OK: No existing balance record"
                
        except Exception as e:
            steps["check_db_balance"] = f"Error: {str(e)}"
        
        # Step 4: Try UPSERT operation
        try:
            balance_data = {
                "user_id": user_id,
                "balance": new_balance,
                "last_updated": current_time
            }
            
            rows = db._execute_upsert(
                "token_balances", 
                balance_data,
                ["user_id"],  # conflict columns
                ["balance", "last_updated"]  # update columns
            )
            steps["upsert_balance"] = f"OK: Updated {rows} rows"
        except Exception as e:
            steps["upsert_balance"] = f"Error: {str(e)}"
        
        # Get final balance
        final_balance = token_service.get_user_balance(user_id)
        
        return {
            "steps": steps,
            "initial_balance": initial_balance.balance,
            "final_balance": final_balance.balance,
            "amount_added": amount
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    
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
        import time
        from token_models.token_models import TokenPurchaseEvent
        purchase_event = TokenPurchaseEvent(
            user_id=str(user_id),
            product_id="manual_test_tokens",
            transaction_id=f"manual_{user_id}_{int(time.time())}",
            tokens_purchased=request.amount,
            purchase_price="0.00",
            purchase_currency="USD"
        )
        
        # Simplified approach - directly update balance
        from datetime import datetime
        from services.database_service import get_db_service
        
        db = get_db_service()
        token_service = get_token_service()
        
        # Get current balance
        current_balance_response = token_service.get_user_balance(str(user_id))
        current_balance = current_balance_response.balance
        new_balance = current_balance + request.amount
        
        # Update balance directly
        balance_data = {
            "user_id": str(user_id),
            "balance": new_balance,
            "last_updated": datetime.utcnow()
        }
        
        rows_updated = db._execute_upsert(
            "token_balances", 
            balance_data,
            ["user_id"],
            ["balance", "last_updated"]
        )
        
        logger.info(f"Manually added {request.amount} tokens to user {user_id}, balance: {current_balance} -> {new_balance}")
        
        # Get the updated balance with proper timestamp
        final_balance = token_service.get_user_balance(str(user_id))
        return final_balance
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to manually add tokens for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add tokens: {str(e)}"
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
    """Handle RevenueCat webhook events for token purchases and premium status."""
    body = await request.body()
    if x_revenuecat_signature and not verify_revenuecat_webhook(body, x_revenuecat_signature):
        logger.warning("Invalid RevenueCat webhook signature")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    try:
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in webhook payload: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event = payload.get('event', {})
    app_user_id = event.get('app_user_id')
    product_id = event.get('product_id')
    event_type = event.get('type')

    if not app_user_id:
        logger.error("Missing app_user_id in webhook event")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required fields in webhook payload")

    db_service = get_db_service()
    token_service = get_token_service()

    # --- Handle Premium Status Updates ---
    if product_id in PREMIUM_PRODUCT_IDS:
        is_premium_active = event_type in ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION']
        is_premium_inactive = event_type in ['CANCELLATION', 'EXPIRATION', 'PRODUCT_CHANGE']

        try:
            # Handle both email and numeric user IDs
            if "@" in app_user_id:
                # Email-based user ID - look up the numeric ID
                user_data = db_service.get_user_by_email(app_user_id)
                if user_data:
                    user_id_int = user_data["id"]
                else:
                    logger.error(f"User not found for email: {app_user_id}")
                    raise ValueError(f"User not found for email: {app_user_id}")
            else:
                # Numeric user ID
                user_id_int = int(app_user_id)
            
            if is_premium_active:
                logger.info(f"Setting premium status to TRUE for user {app_user_id} (ID: {user_id_int}) due to {event_type}")
                db_service.set_user_premium_status(user_id_int, True)
            elif is_premium_inactive:
                logger.info(f"Setting premium status to FALSE for user {app_user_id} (ID: {user_id_int}) due to {event_type}")
                db_service.set_user_premium_status(user_id_int, False)
        except ValueError as ve:
            logger.error(f"Invalid app_user_id format for premium status update: {app_user_id} - {ve}")
        except Exception as e:
            logger.error(f"Failed to update premium status for user {app_user_id}: {e}")
            # Do not re-raise; token purchase might still need to be processed

    # --- Handle Token Purchases ---
    tokens_to_add = PRODUCT_TOKEN_MAP.get(product_id)
    if tokens_to_add and event_type in ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE']:
        logger.info(f"Processing token purchase: {tokens_to_add} tokens for user {app_user_id}, product {product_id}")
        try:
            # This logic should be encapsulated in the token_service
            token_service.add_tokens_for_purchase(
                user_id=app_user_id,
                product_id=product_id,
                tokens_to_add=tokens_to_add,
                transaction_id=event.get('transaction_id'),
                event_data=event
            )
        except Exception as e:
            logger.error(f"Failed to process token purchase for user {app_user_id}: {e}")
            # Decide if this should be a fatal error for the webhook
            # For now, we log and continue

    return {"status": "success", "message": "Webhook processed"}

@router.post("/debug/simulate-purchase")
async def simulate_revenuecat_purchase(
    user_email: str = "fake.kevin@gmail.com", 
    product_id: str = "token_pack_small"
):
    """Simulate a RevenueCat purchase webhook for testing"""
    try:
        tokens_to_add = PRODUCT_TOKEN_MAP.get(product_id, 0)
        if tokens_to_add == 0:
            return {"error": f"Product {product_id} not found or gives 0 tokens"}
        
        token_service = get_token_service()
        
        # Simulate the webhook processing
        success = token_service.add_tokens_for_purchase(
            user_id=user_email,
            product_id=product_id,
            tokens_to_add=tokens_to_add,
            transaction_id=f"sim_{int(time.time())}",
            event_data={"simulated": True, "timestamp": time.time()}
        )
        
        if success:
            balance_response = token_service.get_user_balance(user_email)
            return {
                "success": True,
                "tokens_added": tokens_to_add,
                "new_balance": balance_response.balance,
                "product_id": product_id,
                "user_email": user_email
            }
        else:
            return {"success": False, "error": "Failed to add tokens"}
            
    except Exception as e:
        logger.error(f"Failed to simulate purchase: {e}")
        return {"success": False, "error": str(e)}

@router.post("/test-webhook-debug")
async def test_webhook_debug():
    """Test webhook processing step by step"""
    try:
        # Test parameters
        app_user_id = "10"
        product_id = "token_pack_small"
        tokens_to_add = PRODUCT_TOKEN_MAP.get(product_id)
        
        # Test 1: Product mapping
        result = {"tests": {}}
        result["tests"]["product_mapping"] = f"OK - {product_id} = {tokens_to_add} tokens"
        
        # Test 2: Token service
        try:
            token_service = get_token_service()
            result["tests"]["token_service"] = "OK - Service created"
        except Exception as e:
            result["tests"]["token_service"] = f"ERROR: {str(e)}"
            return result
        
        # Test 3: Add tokens
        try:
            success = token_service.add_tokens_for_testing(app_user_id, tokens_to_add, "Webhook debug test")
            result["tests"]["add_tokens"] = f"OK - Success: {success}"
            
            if success:
                balance_response = token_service.get_user_balance(app_user_id)
                result["tests"]["final_balance"] = f"OK - Balance: {balance_response.balance}"
            else:
                result["tests"]["add_tokens"] = "ERROR - Returned False"
                
        except Exception as e:
            result["tests"]["add_tokens"] = f"ERROR: {str(e)}"
        
        return result
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug-balance/{user_email}")
async def debug_user_balance(user_email: str):
    """Debug endpoint to check token balance for any user (no auth required)"""
    try:
        token_service = get_token_service()
        balance_response = token_service.get_user_balance(user_email)
        
        # Also get transaction history to see recent activity
        try:
            transactions = token_service.get_transaction_history(user_email, limit=10)
            recent_transactions = [
                {
                    "type": tx["transaction_type"],
                    "amount": tx["amount"],
                    "balance_after": tx["balance_after"],
                    "description": tx["description"],
                    "created_at": str(tx["created_at"])
                }
                for tx in transactions[-5:]  # Last 5 transactions
            ]
        except Exception as e:
            recent_transactions = [f"Error getting transactions: {str(e)}"]
        
        return {
            "user_email": user_email,
            "current_balance": balance_response.balance,
            "last_updated": str(balance_response.last_updated),
            "recent_transactions": recent_transactions
        }
        
    except Exception as e:
        return {
            "user_email": user_email,
            "error": str(e),
            "current_balance": "unknown"
        }