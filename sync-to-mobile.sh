#!/bin/bash

# Mobile-only project setup script
# Since the web app has been archived, this script now focuses on mobile development
# Usage: ./sync-to-mobile.sh

echo "� Setting up mobile development environment..."

# Ensure mobile directory exists
MOBILE_DIR="mobile"
if [ ! -d "$MOBILE_DIR" ]; then
    echo "❌ Mobile directory not found at $MOBILE_DIR"
    exit 1
fi

echo "✅ Mobile directory confirmed"

# Install mobile dependencies if needed
echo "📦 Checking mobile dependencies..."
if [ ! -d "$MOBILE_DIR/node_modules" ]; then
    echo "   Installing mobile dependencies..."
    cd $MOBILE_DIR && npm install && cd ..
    echo "   ✓ Mobile dependencies installed"
else
    echo "   ✓ Mobile dependencies already installed"
fi

# Verify critical mobile files exist
echo ""
echo "🔍 Verifying mobile project structure..."

CRITICAL_FILES=(
    "$MOBILE_DIR/package.json"
    "$MOBILE_DIR/App.tsx"
    "$MOBILE_DIR/index.ts"
    "$MOBILE_DIR/src/types/index.ts"
    "$MOBILE_DIR/src/store/hooks.ts"
)

ALL_GOOD=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file exists"
    else
        echo "   ❌ $file missing"
        ALL_GOOD=false
    fi
done

if [ "$ALL_GOOD" = true ]; then
    echo ""
    echo "✅ Mobile project is ready for development!"
    echo ""
    echo "📱 Mobile Features Status:"
    echo "   ✓ React Native with Expo"
    echo "   ✓ TypeScript configuration"
    echo "   ✓ Redux state management"
    echo "   ✓ Native camera and media recording"
    echo "   ✓ Cross-platform iOS/Android support"
    echo ""
    echo "� Next steps to start development:"
    echo "   1. Start development server: npm start"
    echo "   2. Open Expo Go app on your phone"
    echo "   3. Scan QR code to run the app"
    echo "   4. For simulators: npm run android OR npm run ios"
    echo ""
    echo "� Development commands:"
    echo "   npm start          - Start Expo dev server"
    echo "   npm run android    - Run on Android simulator"
    echo "   npm run ios        - Run on iOS simulator"
    echo "   npm run build:android - Build Android APK"
    echo "   npm run build:ios  - Build iOS IPA"
else
    echo ""
    echo "❌ Mobile project setup incomplete. Please check missing files."
    exit 1
fi
