#!/bin/bash
# Token System Testing Script

echo "🧪 Testing Secure Token Management System"
echo "=========================================="

# Backend URL (adjust for Railway deployment)
BASE_URL="http://localhost:8001"

echo ""
echo "📡 1. Testing API Health Check"
curl -s "$BASE_URL/health" || echo "Health check endpoint not available"

echo ""
echo "🔐 2. Testing Authentication (should fail without JWT)"
echo "Balance without auth:"
curl -s -w "HTTP Status: %{http_code}\n" "$BASE_URL/api/v1/tokens/balance"

echo ""
echo "💰 3. Testing RevenueCat Purchase Webhook"
echo "Simulating token purchase..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/tokens/webhook/revenuecat" \
  -H "Content-Type: application/json" \
  -d '{
    "api_version": "1.0",
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test-user-123",
      "product_id": "token_pack_medium",
      "transaction_id": "txn_'"$(date +%s)"'",
      "price": 4.99,
      "currency": "USD"
    }
  }')

echo "Webhook Response: $WEBHOOK_RESPONSE"

echo ""
echo "🎯 4. Token Purchase Product Mapping"
echo "Product -> Token Mapping:"
echo "  • token_pack_small: 5 tokens"
echo "  • token_pack_medium: 500 tokens"
echo "  • token_pack_large: 25 tokens"
echo "  • pro_monthly: 500 tokens (subscription)"
echo "  • pro_annual: 6000 tokens (subscription)"

echo ""
echo "✅ Testing Complete!"
echo ""
echo "🚀 Next Steps for Railway Deployment:"
echo "  1. Set REVENUECAT_WEBHOOK_SECRET in Railway environment"
echo "  2. Set JWT_SECRET in Railway environment"
echo "  3. Configure RevenueCat webhook URL: https://your-app.railway.app/api/v1/tokens/webhook/revenuecat"
echo "  4. Test with your mobile app using real JWT tokens"