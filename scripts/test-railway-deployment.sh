#!/bin/bash

# Test script to verify the Railway backend deployment
echo "🚀 Testing 2Truths-1Lie Railway Backend Deployment"
echo "=================================================="

BACKEND_URL="https://2truths-1lie-production.up.railway.app"

echo ""
echo "1. Testing basic health check..."
curl -s "$BACKEND_URL/" | jq '.' || echo "❌ Basic health check failed"

echo ""
echo "2. Testing detailed health check..."
curl -s "$BACKEND_URL/health" | jq '.' || echo "❌ Detailed health check failed"

echo ""
echo "3. Testing Swagger documentation availability..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/docs")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Swagger UI is available at: $BACKEND_URL/docs"
else
    echo "❌ Swagger UI is not accessible (HTTP $HTTP_CODE)"
fi

echo ""
echo "4. Testing ReDoc documentation availability..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/redoc")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ReDoc is available at: $BACKEND_URL/redoc"
else
    echo "❌ ReDoc is not accessible (HTTP $HTTP_CODE)"
fi

echo ""
echo "5. Testing OpenAPI spec..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/openapi.json")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ OpenAPI spec is available at: $BACKEND_URL/openapi.json"
else
    echo "❌ OpenAPI spec is not accessible (HTTP $HTTP_CODE)"
fi

echo ""
echo "=================================================="
echo "🔍 Manual verification steps:"
echo "1. Open $BACKEND_URL/docs in your browser"
echo "2. Verify Swagger UI loads with API documentation"
echo "3. Test mobile app with new configuration"
echo "4. Check mobile app logs for Railway URL usage"
echo "=================================================="
