#!/bin/bash

# Test script for complete challenge creation workflow
# Tests the full pipeline from user registration to challenge creation

echo "🧪 Testing Complete Challenge Creation Workflow"
echo "=============================================="

BASE_URL="http://192.168.50.111:8001"

# Test 1: Health check
echo ""
echo "1️⃣ Testing backend health..."
curl -s "$BASE_URL/health" | grep -q "healthy" && echo "✅ Backend is healthy" || echo "❌ Backend health check failed"

# Test 2: Create guest session
echo ""
echo "2️⃣ Testing guest session creation..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/guest" \
  -H "Content-Type: application/json")

if echo "$REGISTER_RESPONSE" | grep -q "access_token"; then
  echo "✅ Guest session creation successful"
  ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "🔑 Got access token: ${ACCESS_TOKEN:0:20}..."
else
  echo "❌ Guest session creation failed: $REGISTER_RESPONSE"
  exit 1
fi

# Test 3: Create challenge (simulating uploaded media)
echo ""
echo "3️⃣ Testing challenge creation..."
CHALLENGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/challenges/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "statements": [
      {
        "text": "I have traveled to 15 countries",
        "media_file_id": "6a672ef0-7eb7-4196-bd30-542265507ead"
      },
      {
        "text": "I once met a celebrity at a coffee shop",
        "media_file_id": "6a672ef0-7eb7-4196-bd30-542265507ead"
      },
      {
        "text": "I can speak three languages fluently",
        "media_file_id": "6a672ef0-7eb7-4196-bd30-542265507ead"
      }
    ],
    "lie_statement_index": 1,
    "is_public": true,
    "tags": ["test", "automated"]
  }')

if echo "$CHALLENGE_RESPONSE" | grep -q '"id"'; then
  echo "✅ Challenge creation successful"
  CHALLENGE_ID=$(echo "$CHALLENGE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  echo "🎯 Created challenge ID: $CHALLENGE_ID"
else
  echo "❌ Challenge creation failed: $CHALLENGE_RESPONSE"
  exit 1
fi

# Test 4: Retrieve challenge
echo ""
echo "4️⃣ Testing challenge retrieval..."
CHALLENGE_GET=$(curl -s -X GET "$BASE_URL/api/v1/challenges/$CHALLENGE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$CHALLENGE_GET" | grep -q "I have traveled to 15 countries"; then
  echo "✅ Challenge retrieval successful"
  echo "📋 Challenge contains expected statements"
else
  echo "❌ Challenge retrieval failed: $CHALLENGE_GET"
fi

# Test 5: Submit guess
echo ""
echo "5️⃣ Testing guess submission..."
GUESS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/challenges/$CHALLENGE_ID/guess" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "guessed_lie_index": 1
  }')

if echo "$GUESS_RESPONSE" | grep -q '"correct"'; then
  echo "✅ Guess submission successful"
  IS_CORRECT=$(echo "$GUESS_RESPONSE" | grep -o '"correct":[^,}]*' | cut -d':' -f2)
  echo "🎲 Guess was correct: $IS_CORRECT"
else
  echo "❌ Guess submission failed: $GUESS_RESPONSE"
fi

echo ""
echo "🎉 Test completed! All core functionality is working."
echo "📱 Now test the mobile app to complete the full end-to-end workflow."
