#!/bin/bash
# S3 Media API Test Script using curl

BASE_URL="http://127.0.0.1:8001"
S3_PREFIX="/api/v1/s3-media"

echo "🚀 Testing S3 Media API Endpoints"
echo "=================================="

# Test 1: Health Check
echo
echo "🏥 Testing S3 Health Endpoint..."
curl -s "${BASE_URL}${S3_PREFIX}/health/s3" | python -m json.tool

# Test 2: Upload (without auth - will fail but shows structure)
echo
echo "📤 Testing S3 Upload Endpoint (without auth)..."
echo "dummy video content" > /tmp/test_video.mp4
curl -X POST \
     -F "file=@/tmp/test_video.mp4" \
     -s "${BASE_URL}${S3_PREFIX}/upload" | python -m json.tool

# Test 3: Streaming (without auth - will fail)
echo
echo "🎬 Testing S3 Streaming Endpoint (without auth)..."
curl -s "${BASE_URL}${S3_PREFIX}/dummy-media-id" | python -m json.tool

# Test 4: Delete (without auth - will fail)  
echo
echo "🗑️  Testing S3 Delete Endpoint (without auth)..."
curl -X DELETE \
     -s "${BASE_URL}${S3_PREFIX}/dummy-media-id" | python -m json.tool

# Cleanup
rm -f /tmp/test_video.mp4

echo
echo "📝 Note: Upload, streaming, and delete endpoints require authentication."
echo "   These tests show the API structure and error responses."
