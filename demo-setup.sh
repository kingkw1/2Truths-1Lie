#!/bin/bash

# 🚀 2Truths-1Lie Mobile App - Quick Demo Setup
# For hackathon judges and demo purposes

echo "🎭 Setting up 2Truths-1Lie Mobile Demo..."
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📱 Installing mobile dependencies..."
cd mobile
npm install

echo "🔧 Installing backend dependencies..."
cd ../backend
pip install -r requirements.txt

echo "🌟 Setup complete! Ready for demo."
echo ""
echo "🎬 DEMO COMMANDS:"
echo "1. Start mobile app:  npm run start:mobile"
echo "2. Start backend:     npm run start:backend"
echo "3. Open on device:    Scan QR code with Expo Go app"
echo ""
echo "📱 Android APK available in: build-output/app-release.apk"
echo "📖 Full documentation: docs/README.md"
echo ""
echo "🏆 Ready for hackathon presentation!"
