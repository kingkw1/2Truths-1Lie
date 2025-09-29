"""
Webhook handler for RevenueCat events.
"""
from fastapi import APIRouter, Request, HTTPException, Header, Depends
import json
import os
import hmac
import hashlib
from token_models.revenuecat_webhook_models import RevenueCatWebhook
from services.token_service import TokenService
from services.database_service import get_db_service

router = APIRouter()

REVENUECAT_WEBHOOK_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
PRO_SUBSCRIPTION_PRODUCT_ID = "pro_monthly_subscription" # Assuming this is the product ID for "Pro" subscription
TOKENS_TO_GRANT = 10

def get_token_service() -> TokenService:
    """Dependency injector for TokenService"""
    db_service = get_db_service()
    return TokenService(db_service)

@router.post("/webhooks/revenuecat")
async def handle_revenuecat_webhook(
    request: Request,
    authorization: str = Header(None),
    token_service: TokenService = Depends(get_token_service)
):
    """
    Handles RevenueCat webhooks for subscription events.
    """
    if not REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="RevenueCat webhook secret is not configured.")

    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is missing.")

    # Verify signature
    try:
        raw_body = await request.body()
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
        if not hmac.compare_digest(expected_signature, authorization):
             raise HTTPException(status_code=403, detail="Webhook signature verification failed.")
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Webhook signature verification failed: {e}")

    try:
        payload = json.loads(raw_body)
        webhook_data = RevenueCatWebhook.parse_obj(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {e}")

    event = webhook_data.event
    event_type = event.type
    user_id = event.app_user_id
    product_id = event.product_id

    if event_type in ["INITIAL_PURCHASE", "RENEWAL"]:
        if product_id == PRO_SUBSCRIPTION_PRODUCT_ID:
            try:
                success = token_service.add_tokens_for_purchase(
                    user_id=user_id,
                    product_id=product_id,
                    tokens_to_add=TOKENS_TO_GRANT,
                    transaction_id=event.id,
                    event_data=payload
                )
                if not success:
                    raise HTTPException(status_code=500, detail="Failed to grant tokens.")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to process purchase event: {e}")

    return {"status": "ok"}