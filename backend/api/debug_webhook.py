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
    """Debug webhook endpoint that logs everything."""
    try:
        raw_body = await request.body()
        headers = dict(request.headers)
        
        logger.info(f"🎯 DEBUG: Webhook received")
        logger.info(f"📦 DEBUG: Body: {raw_body.decode()}")
        logger.info(f"📋 DEBUG: Headers: {headers}")
        
        payload = json.loads(raw_body)
        logger.info(f"📄 DEBUG: Parsed payload: {payload}")
        
        # Test database connection
        from services.database_service import get_db_service
        db_service = get_db_service()
        
        # Try to look up the user
        if 'event' in payload and 'app_user_id' in payload['event']:
            user_email = payload['event']['app_user_id']
            logger.info(f"🔍 DEBUG: Looking up user: {user_email}")
            
            user = db_service.get_user_by_email(user_email)
            if user:
                logger.info(f"✅ DEBUG: User found: id={user['id']}, email={user['email']}")
                
                # Try to test token service
                from services.token_service import TokenService
                token_service = TokenService(db_service)
                
                logger.info(f"🪙 DEBUG: Getting current balance for user {user['id']}")
                balance = token_service.get_user_balance(str(user['id']))
                logger.info(f"💰 DEBUG: Current balance: {balance.balance}")
                
            else:
                logger.error(f"❌ DEBUG: User not found: {user_email}")
        
        return {"debug": "success", "message": "Check logs for details"}
    
    except Exception as e:
        logger.error(f"💥 DEBUG: Exception: {e}")
        import traceback
        logger.error(f"🔍 DEBUG: Traceback: {traceback.format_exc()}")
        return {"debug": "error", "error": str(e)}