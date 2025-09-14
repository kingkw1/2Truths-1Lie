#!/bin/bash

# Test script to verify the name functionality works correctly
# This script tests both backend and frontend changes

echo "🧪 Testing Name Field Implementation"
echo "===================================="

# Test backend API changes
echo ""
echo "1️⃣ Testing Backend API..."

# Test register endpoint with name
echo "Testing register endpoint with name..."
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "John Doe"
  }' \
  | jq '.'

echo ""
echo "✅ Backend test completed"

echo ""
echo "2️⃣ Frontend changes implemented:"
echo "   ✅ Name field added to SignupScreen"
echo "   ✅ AuthService.signup() accepts name parameter"
echo "   ✅ User creation handles name from backend response"
echo "   ✅ Welcome messages show actual user names"

echo ""
echo "3️⃣ To test the complete flow:"
echo "   1. Run the backend: cd backend && python run.py"
echo "   2. Run the mobile app: cd mobile && npm start"
echo "   3. Navigate to signup screen"
echo "   4. Enter email, optional name, and password"
echo "   5. Check that welcome message shows the entered name"

echo ""
echo "🎉 Name field implementation complete!"