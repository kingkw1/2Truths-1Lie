#!/usr/bin/env python3
"""
RevenueCat Webhook Integration Test Tool

This tool tests the RevenueCat webhook endpoint by simulating webhook calls.
Use this for:
- Debugging webhook integration issues
- Testing token granting functionality  
- Validating webhook signature verification
- Integration testing during development

Usage:
    export REVENUECAT_WEBHOOK_SECRET="your_secret_here"
    python tools/testing/revenuecat_webhook_test.py
"""

import requests
import json
import hmac
import hashlib
import os
from typing import Dict, Any

def create_test_webhook_payload(user_id: str = "revenuecat_test@example.com", product_id: str = "pro_monthly") -> Dict[str, Any]:
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
    user_id: str = "revenuecat_test@example.com",
    product_id: str = "pro_monthly"
):
    """Test the RevenueCat webhook endpoint."""
    
    print(f"🧪 Testing RevenueCat webhook...")
    print(f"   URL: {webhook_url}")
    print(f"   User ID: {user_id}")
    print(f"   Product ID: {product_id}")
    print(f"   Secret configured: {'Yes' if webhook_secret else 'No'}")
    print()
    
    # Test debug endpoint first
    debug_url = webhook_url.replace("/revenuecat", "/revenuecat/debug")
    print(f"🔍 First testing debug endpoint: {debug_url}")
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
    
    # Test debug endpoint first (no signature required)
    try:
        print("🔍 Testing debug endpoint...")
        debug_response = requests.post(debug_url, json=payload, headers={"Content-Type": "application/json"})
        print(f"🐛 Debug Response Status: {debug_response.status_code}")
        print(f"🐛 Debug Response Body: {debug_response.text}")
        print()
    except Exception as e:
        print(f"🐛 Debug endpoint failed: {e}")
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
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("🎉 Webhook processed successfully!")
        else:
            print("❌ Webhook failed!")
            
        # Test with a different user that definitely exists
        if response.status_code != 200:
            print("\n🔄 Testing with a user ID that might work better...")
            test_payload_numeric = create_test_webhook_payload("10", product_id)  # Try numeric ID
            test_signature = sign_payload(json.dumps(test_payload_numeric), webhook_secret)
            test_headers = {"Content-Type": "application/json", "Authorization": test_signature}
            
            print(f"📦 Testing with numeric user ID: 10")
            test_response = requests.post(webhook_url, json=test_payload_numeric, headers=test_headers)
            print(f"📊 Numeric ID test - Status: {test_response.status_code}, Body: {test_response.text}")
            
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
    
    # Test with the new test user
    test_webhook(WEBHOOK_URL, WEBHOOK_SECRET, "revenuecat_test@example.com", "pro_monthly")