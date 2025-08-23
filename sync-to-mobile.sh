#!/bin/bash

# Sync script to keep mobile and web projects in sync
# Usage: ./sync-to-mobile.sh

echo "🔄 Syncing shared code from web to mobile..."

# Ensure mobile directory exists
MOBILE_DIR="mobile"
if [ ! -d "$MOBILE_DIR" ]; then
    echo "❌ Mobile directory not found at $MOBILE_DIR"
    exit 1
fi

# Copy types
echo "📄 Syncing types..."
if [ -d "src/types/" ]; then
    cp -r src/types/ $MOBILE_DIR/src/types/
    echo "   ✓ Types synced"
else
    echo "   ⚠️  Types directory not found"
fi

# Copy store (excluding mobile-specific configurations)
echo "🏪 Syncing Redux store..."
if [ -d "src/store/" ]; then
    # Create temporary directory for selective sync
    mkdir -p temp_store_sync
    
    # Copy store structure but preserve mobile-specific files
    cp -r src/store/* temp_store_sync/
    
    # Remove web-specific middleware that might not work on mobile
    if [ -f "temp_store_sync/middleware/websocketMiddleware.ts" ]; then
        echo "   ⚠️  Skipping websocket middleware (web-specific)"
        rm temp_store_sync/middleware/websocketMiddleware.ts
    fi
    
    # Sync slices (these should be identical)
    if [ -d "temp_store_sync/slices/" ]; then
        cp -r temp_store_sync/slices/ $MOBILE_DIR/src/store/slices/
        echo "   ✓ Store slices synced"
    fi
    
    # Sync selectors
    if [ -d "temp_store_sync/selectors/" ]; then
        cp -r temp_store_sync/selectors/ $MOBILE_DIR/src/store/selectors/
        echo "   ✓ Store selectors synced"
    fi
    
    # Sync hooks (should be identical)
    if [ -f "temp_store_sync/hooks.ts" ]; then
        cp temp_store_sync/hooks.ts $MOBILE_DIR/src/store/hooks.ts
        echo "   ✓ Store hooks synced"
    fi
    
    # Sync utils
    if [ -f "temp_store_sync/utils.ts" ]; then
        cp temp_store_sync/utils.ts $MOBILE_DIR/src/store/utils.ts
        echo "   ✓ Store utils synced"
    fi
    
    # Clean up
    rm -rf temp_store_sync
    
    echo "   ✓ Redux store synced (mobile-optimized)"
else
    echo "   ⚠️  Store directory not found"
fi

# Copy selected shared components if they exist
echo "🧩 Syncing shared components..."
mkdir -p $MOBILE_DIR/src/shared/

if [ -f "src/components/AnimatedFeedback.tsx" ]; then
    cp src/components/AnimatedFeedback.tsx $MOBILE_DIR/src/shared/AnimatedFeedback.tsx
    echo "   ✓ AnimatedFeedback component synced"
fi

# Sync validation utilities that are platform-agnostic
if [ -f "src/utils/qualityAssessment.ts" ]; then
    mkdir -p $MOBILE_DIR/src/utils/
    cp src/utils/qualityAssessment.ts $MOBILE_DIR/src/utils/qualityAssessment.ts
    echo "   ✓ Quality assessment utils synced"
fi

# Sync media compression utilities (mobile-compatible)
if [ -f "src/utils/mediaCompression.ts" ]; then
    mkdir -p $MOBILE_DIR/src/utils/
    cp src/utils/mediaCompression.ts $MOBILE_DIR/src/utils/mediaCompression.ts
    echo "   ✓ Media compression utils synced"
fi

# Verify critical files exist in mobile
echo ""
echo "🔍 Verifying sync integrity..."

CRITICAL_FILES=(
    "$MOBILE_DIR/src/types/index.ts"
    "$MOBILE_DIR/src/store/slices/challengeCreationSlice.ts"
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
    echo "✅ Sync complete! Mobile project updated with latest shared code."
    echo ""
    echo "📱 Mobile Redux Integration Status:"
    echo "   ✓ Challenge creation state management"
    echo "   ✓ Media recording state tracking"
    echo "   ✓ Cross-platform type definitions"
    echo "   ✓ Shared validation logic"
    echo ""
    echo "💡 Run this script whenever you:"
    echo "   - Update types in src/types/"
    echo "   - Modify Redux store slices in src/store/slices/"
    echo "   - Update shared validation or utility functions"
    echo "   - Want to ensure mobile-web state consistency"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Restart mobile development server: npm run mobile"
    echo "   2. Test challenge creation workflow on mobile"
    echo "   3. Verify Redux DevTools show consistent state"
else
    echo ""
    echo "❌ Sync completed with errors. Please check missing files."
    exit 1
fi
