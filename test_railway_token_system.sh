#!/bin/bash
# Production Token System Test Script

echo "🚀 Testing Production Token System on Railway"
echo "============================================="

# Your Railway backend URL (replace with your actual URL)
RAILWAY_URL="https://your-app.railway.app"

echo ""
echo "📡 1. Testing Railway Backend Health"
curl -s "$RAILWAY_URL/health" | jq . || echo "Backend not responding or jq not installed"

echo ""
echo "🔐 2. Testing Token Balance Endpoint (should require auth)"
echo "Without JWT (should get 403):"
curl -s -w "HTTP Status: %{http_code}\n" "$RAILWAY_URL/api/v1/tokens/balance"

echo ""
echo "💰 3. Testing RevenueCat Webhook Endpoint"
echo "Simulating webhook (should process successfully):"
WEBHOOK_RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/v1/tokens/webhook/revenuecat" \
  -H "Content-Type: application/json" \
  -d '{
    "api_version": "1.0",
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test-railway-user",
      "product_id": "token_pack_medium",
      "transaction_id": "railway_test_'"$(date +%s)"'",
      "price": 4.99,
      "currency": "USD"
    }
  }')

echo "Webhook Response: $WEBHOOK_RESPONSE"

echo ""
echo "✅ Railway Backend Test Complete!"
echo ""
echo "🎯 Your Token Configuration:"
echo "  • token_pack_small: 5 tokens"
echo "  • token_pack_medium: 500 tokens"
echo "  • token_pack_large: 25 tokens"
echo "  • pro_monthly: 500 tokens (subscription)"
echo "  • pro_annual: 6000 tokens (subscription)"