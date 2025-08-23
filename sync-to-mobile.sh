#!/bin/bash

# Sync script to keep mobile and web projects in sync
# Usage: ./sync-to-mobile.sh

echo "🔄 Syncing shared code from web to mobile..."

# Copy types
echo "📄 Syncing types..."
cp -r src/types/ 2Truths-1Lie-mobile/src/types/

# Copy store
echo "🏪 Syncing Redux store..."
cp -r src/store/ 2Truths-1Lie-mobile/src/store/

# Copy selected shared components if they exist
echo "🧩 Syncing shared components..."
if [ -f "src/components/AnimatedFeedback.tsx" ]; then
    mkdir -p 2Truths-1Lie-mobile/src/shared/
    cp src/components/AnimatedFeedback.tsx 2Truths-1Lie-mobile/src/shared/
fi

echo "✅ Sync complete! Mobile project updated with latest shared code."
echo ""
echo "💡 Run this script whenever you:"
echo "   - Update types in src/types/"
echo "   - Modify Redux store in src/store/"
echo "   - Want to sync other shared components"
echo ""
echo "🚀 Restart mobile development server: npm run mobile"
