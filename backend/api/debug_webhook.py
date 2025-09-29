"""
Simple debug webhook endpoint to test RevenueCat webhook processing.
"""
from fastapi import APIRouter, Request, HTTPException, Header
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/webhooks/revenuecat/debug")
async def debug_revenuecat_webhook(request: Request):
    """Debug webhook endpoint that returns detailed information."""
    debug_info = {
        "steps": [],
        "user_info": None,
        "balance_info": None,
        "token_grant_test": None,
        "error": None
    }
    
    try:
        raw_body = await request.body()
        payload = json.loads(raw_body)
        debug_info["steps"].append("✅ Payload parsed successfully")
        
        # Test database connection
        from services.database_service import get_db_service
        db_service = get_db_service()
        debug_info["steps"].append("✅ Database service initialized")
        
        # Try to look up the user
        if 'event' in payload and 'app_user_id' in payload['event']:
            user_email = payload['event']['app_user_id']
            debug_info["steps"].append(f"🔍 Looking up user: {user_email}")
            
            user = db_service.get_user_by_email(user_email)
            if user:
                debug_info["user_info"] = {
                    "id": user['id'],
                    "email": user['email'],
                    "is_premium": user.get('is_premium', False)
                }
                debug_info["steps"].append(f"✅ User found: id={user['id']}")
                
                # Try to test token service
                from services.token_service import TokenService
                token_service = TokenService(db_service)
                debug_info["steps"].append("✅ Token service initialized")
                
                # Get current balance
                balance = token_service.get_user_balance(str(user['id']))
                debug_info["balance_info"] = {
                    "current_balance": balance.balance,
                    "last_updated": balance.last_updated
                }
                debug_info["steps"].append(f"✅ Current balance retrieved: {balance.balance}")
                
                # Test actual token granting
                try:
                    debug_info["steps"].append("🧪 Testing token granting...")
                    success = token_service.add_tokens_for_purchase(
                        user_id=str(user['id']),
                        product_id=payload['event']['product_id'],
                        tokens_to_add=10,
                        transaction_id=payload['event']['id'],
                        event_data=payload
                    )
                    debug_info["token_grant_test"] = {
                        "success": success,
                        "attempted_tokens": 10
                    }
                    if success:
                        debug_info["steps"].append("✅ Token granting test SUCCEEDED")
                        # Get new balance
                        new_balance = token_service.get_user_balance(str(user['id']))
                        debug_info["token_grant_test"]["new_balance"] = new_balance.balance
                    else:
                        debug_info["steps"].append("❌ Token granting test FAILED")
                        
                except Exception as token_error:
                    debug_info["token_grant_test"] = {
                        "success": False,
                        "error": str(token_error)
                    }
                    debug_info["steps"].append(f"❌ Token granting exception: {str(token_error)}")
                
            else:
                debug_info["steps"].append(f"❌ User not found: {user_email}")
        else:
            debug_info["steps"].append("❌ Invalid payload structure")
        
        return {"debug": "success", **debug_info}
    
    except Exception as e:
        debug_info["error"] = str(e)
        debug_info["steps"].append(f"💥 Exception: {str(e)}")
        import traceback
        debug_info["traceback"] = traceback.format_exc()
        return {"debug": "error", **debug_info}