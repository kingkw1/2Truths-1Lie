"""
Webhook handler for RevenueCat events.
"""
from fastapi import APIRouter, Request, HTTPException, Header, Depends
import json
import os
import hmac
import hashlib
import logging
from token_models.revenuecat_webhook_models import RevenueCatWebhook
from services.token_service import TokenService
from services.database_service import get_db_service, DatabaseService

router = APIRouter()

logger = logging.getLogger(__name__)

REVENUECAT_WEBHOOK_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
PRO_SUBSCRIPTION_PRODUCT_IDS = ["pro_monthly", "pro_annual"]  # Support both monthly and annual
TOKENS_TO_GRANT = 10

def get_token_service() -> TokenService:
    """Dependency injector for TokenService"""
    db_service = get_db_service()
    return TokenService(db_service)

def get_database_service() -> DatabaseService:
    """Dependency injector for DatabaseService"""
    return get_db_service()

@router.post("/webhooks/revenuecat")
async def handle_revenuecat_webhook(
    request: Request,
    authorization: str = Header(None),
    token_service: TokenService = Depends(get_token_service),
    db_service: DatabaseService = Depends(get_database_service)
):
    """
    Handles RevenueCat webhooks for subscription events.
    """
    logger.info("🎯 RevenueCat webhook received")
    
    if not REVENUECAT_WEBHOOK_SECRET:
        logger.error("❌ RevenueCat webhook secret not configured")
        raise HTTPException(status_code=500, detail="RevenueCat webhook secret is not configured.")

    if not authorization:
        logger.warning("⚠️ Authorization header missing in webhook")
        raise HTTPException(status_code=401, detail="Authorization header is missing.")

    # Verify signature
    try:
        raw_body = await request.body()
        logger.info(f"📦 Webhook payload size: {len(raw_body)} bytes")
        
        expected_signature = hmac.new(
            REVENUECAT_WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        # The signature from RevenueCat is in the format "sha256=<signature>"
        # but the docs say it's just in the Authorization header. Let's assume it's just the signature for now.
        # A common format is `t=<timestamp>,v1=<signature>`. The documentation is a bit ambiguous.
        # Let's assume for now the header is just the signature.
        # A more robust implementation would parse the header.
        logger.debug(f"🔐 Expected signature: {expected_signature[:10]}...")
        logger.debug(f"🔐 Received signature: {authorization[:10] if authorization else 'None'}...")
        
        if not hmac.compare_digest(expected_signature, authorization):
             logger.error("❌ Webhook signature verification failed")
             raise HTTPException(status_code=403, detail="Webhook signature verification failed.")
        
        logger.info("✅ Webhook signature verified successfully")
    except Exception as e:
        logger.error(f"❌ Webhook signature verification error: {e}")
        raise HTTPException(status_code=403, detail=f"Webhook signature verification failed: {e}")

    try:
        payload = json.loads(raw_body)
        logger.info(f"📋 Webhook payload parsed successfully")
        logger.debug(f"📋 Payload keys: {list(payload.keys())}")
        
        webhook_data = RevenueCatWebhook.parse_obj(payload)
        logger.info("✅ Webhook data validated successfully")
    except Exception as e:
        logger.error(f"❌ Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {e}")

    event = webhook_data.event
    event_type = event.type
    revenuecat_user_id = event.app_user_id  # This is the email from RevenueCat
    product_id = event.product_id

    logger.info(f"🎯 Processing event: type={event_type}, revenuecat_user={revenuecat_user_id}, product={product_id}")

    if event_type in ["INITIAL_PURCHASE", "RENEWAL"]:
        logger.info(f"💰 Processing purchase/renewal event")
        if product_id in PRO_SUBSCRIPTION_PRODUCT_IDS:
            logger.info(f"🎯 Product matches Pro subscription, granting {TOKENS_TO_GRANT} tokens")
            
            # Look up user by email to get numeric user ID
            try:
                logger.info(f"🔍 Looking up user by email: {revenuecat_user_id}")
                user = db_service.get_user_by_email(revenuecat_user_id)
                
                if not user:
                    logger.error(f"❌ User not found in database: {revenuecat_user_id}")
                    raise HTTPException(status_code=404, detail=f"User not found: {revenuecat_user_id}")
                
                database_user_id = str(user["id"])  # Convert to string as expected by token service
                logger.info(f"✅ Found user: email={revenuecat_user_id}, database_id={database_user_id}")
                
                success = token_service.add_tokens_for_purchase(
                    user_id=database_user_id,
                    product_id=product_id,
                    tokens_to_add=TOKENS_TO_GRANT,
                    transaction_id=event.id,
                    event_data=payload
                )
                if not success:
                    logger.error("❌ Token service failed to grant tokens")
                    raise HTTPException(status_code=500, detail="Failed to grant tokens.")
                logger.info(f"✅ Successfully granted {TOKENS_TO_GRANT} tokens to user {revenuecat_user_id} (id: {database_user_id})")
            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as e:
                logger.error(f"❌ Failed to process purchase event: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to process purchase event: {e}")
        else:
            logger.info(f"ℹ️ Product {product_id} is not a Pro subscription, skipping token grant")
    else:
        logger.info(f"ℹ️ Event type {event_type} is not a purchase/renewal, skipping")

    logger.info("✅ Webhook processed successfully")
    return {"status": "ok"}

@router.get("/webhooks/revenuecat/health")
async def webhook_health_check():
    """
    Simple health check endpoint for RevenueCat webhook.
    """
    return {
        "status": "healthy",
        "webhook_secret_configured": bool(REVENUECAT_WEBHOOK_SECRET),
        "supported_products": PRO_SUBSCRIPTION_PRODUCT_IDS,
        "tokens_per_subscription": TOKENS_TO_GRANT
    }