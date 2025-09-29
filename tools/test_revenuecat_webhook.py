#!/usr/bin/env python3
"""
Tool to test RevenueCat webhook endpoint manually.
This helps debug webhook issues by simulating a RevenueCat webhook call.
"""

import requests
import json
import hmac
import hashlib
import os
from typing import Dict, Any

def create_test_webhook_payload(user_id: str = "fake1@gmail.com", product_id: str = "pro_monthly") -> Dict[str, Any]:
    """Create a test webhook payload similar to what RevenueCat would send."""
    return {
        "api_version": "1.0",
        "event": {
            "id": "test_transaction_12345",
            "type": "INITIAL_PURCHASE",
            "app_user_id": user_id,
            "product_id": product_id
        }
    }

def sign_payload(payload: str, secret: str) -> str:
    """Create HMAC signature for the payload."""
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

def test_webhook(
    webhook_url: str,
    webhook_secret: str,
    user_id: str = "fake1@gmail.com",
    product_id: str = "pro_monthly"
):
    """Test the RevenueCat webhook endpoint."""
    
    print(f"🧪 Testing RevenueCat webhook...")
    print(f"   URL: {webhook_url}")
    print(f"   User ID: {user_id}")
    print(f"   Product ID: {product_id}")
    print(f"   Secret configured: {'Yes' if webhook_secret else 'No'}")
    print()
    
    # Create test payload
    payload = create_test_webhook_payload(user_id, product_id)
    payload_json = json.dumps(payload)
    
    print(f"📦 Test payload:")
    print(json.dumps(payload, indent=2))
    print()
    
    # Sign the payload
    signature = sign_payload(payload_json, webhook_secret)
    print(f"🔐 Generated signature: {signature[:20]}...")
    print()
    
    # Make the request
    headers = {
        "Content-Type": "application/json",
        "Authorization": signature
    }
    
    try:
        print("🚀 Sending webhook request...")
        response = requests.post(webhook_url, json=payload, headers=headers)
        
        print(f"✅ Response Status: {response.status_code}")
        print(f"📄 Response Body: {response.text}")
        
        if response.status_code == 200:
            print("🎉 Webhook processed successfully!")
        else:
            print("❌ Webhook failed!")
            
    except Exception as e:
        print(f"💥 Request failed: {e}")

if __name__ == "__main__":
    # Configuration
    WEBHOOK_URL = "https://2truths-1lie-production.up.railway.app/api/webhooks/revenuecat"
    WEBHOOK_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
    
    if not WEBHOOK_SECRET:
        print("❌ REVENUECAT_WEBHOOK_SECRET environment variable not set!")
        print("   Set it with: export REVENUECAT_WEBHOOK_SECRET='your_secret_here'")
        exit(1)
    
    # Test with the user from the logs
    test_webhook(WEBHOOK_URL, WEBHOOK_SECRET, "fake1@gmail.com", "pro_monthly")