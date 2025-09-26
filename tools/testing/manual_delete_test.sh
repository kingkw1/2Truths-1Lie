#!/bin/bash
# Manual testing script for DELETE challenge endpoint
# This script provides curl commands to test the new DELETE endpoint

BASE_URL="https://2truths-1lie-production.up.railway.app"

echo "🧪 DELETE Challenge Endpoint Testing Guide"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

echo "📋 Step 1: Check API Health"
echo "curl -s \"$BASE_URL/health\" | jq ."
echo ""
curl -s "$BASE_URL/health" | jq .
echo ""

echo "📋 Step 2: Get API Documentation"
echo "🌐 Open in browser:"
echo "   Swagger UI: $BASE_URL/docs"
echo "   ReDoc: $BASE_URL/redoc"
echo ""
echo "💡 In the Swagger UI, you can:"
echo "   1. Try the authentication endpoints to get a real token"
echo "   2. Use the 'Authorize' button to set your Bearer token"
echo "   3. Test the DELETE endpoint directly"
echo ""

echo "📋 Step 3: Test Authentication (if you have valid credentials)"
echo "# Example: Get a token first (replace with real credentials)"
echo "curl -X POST \"$BASE_URL/api/v1/auth/login\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"username\":\"your_username\",\"password\":\"your_password\"}' | jq ."
echo ""

echo "📋 Step 4: List Available Challenges (requires auth token)"
echo "# Replace YOUR_TOKEN with actual JWT token"
echo "curl -X GET \"$BASE_URL/api/v1/challenges/\" \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" | jq ."
echo ""

echo "📋 Step 5: Test DELETE Endpoint"
echo "# Replace YOUR_TOKEN and CHALLENGE_ID with actual values"
echo "curl -X DELETE \"$BASE_URL/api/v1/challenges/CHALLENGE_ID\" \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -v"
echo ""

echo "🎯 Expected Results:"
echo "✅ 204 No Content - Success (challenge deleted)"
echo "🔒 403 Forbidden - You don't own this challenge"
echo "❌ 404 Not Found - Challenge doesn't exist"
echo "🔐 401 Unauthorized - Invalid or missing token"
echo ""

echo "📋 Step 6: Verify Deletion"
echo "# Try to get the deleted challenge (should return 404)"
echo "curl -X GET \"$BASE_URL/api/v1/challenges/CHALLENGE_ID\" \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" | jq ."
echo ""

echo "🛠️ Interactive Testing:"
echo "1. Go to: $BASE_URL/docs"
echo "2. Look for the DELETE /api/v1/challenges/{challenge_id} endpoint"
echo "3. Click 'Try it out'"
echo "4. Enter a challenge ID"
echo "5. Click 'Execute'"
echo ""

echo "📝 Test Scenarios to Try:"
echo "1. Delete your own challenge (should succeed with 204)"
echo "2. Delete someone else's challenge (should fail with 403)"
echo "3. Delete non-existent challenge (should fail with 404)"
echo "4. Delete without authentication (should fail with 401)"
echo ""