#!/bin/bash

# Real Native Module Testing Script
# This script actually tests if native modules will work on device

set -e

echo "🔧 Real Native Module Compatibility Test"
echo "========================================"

cd "$(dirname "$0")/mobile"

echo ""
echo "📱 Checking React Native version compatibility..."
RN_VERSION=$(npm list react-native --depth=0 2>/dev/null | grep react-native@ | sed 's/.*react-native@//' | sed 's/ .*//')
EXPO_SDK=$(npx expo --version 2>/dev/null)

echo "React Native: $RN_VERSION"
echo "Expo SDK: $EXPO_SDK"

echo ""
echo "🎯 Checking gesture handler compatibility..."
GESTURE_VERSION=$(npm list react-native-gesture-handler --depth=0 2>/dev/null | grep react-native-gesture-handler@ | sed 's/.*react-native-gesture-handler@//' | sed 's/ .*//' || echo "NOT_FOUND")

if [ "$GESTURE_VERSION" = "NOT_FOUND" ]; then
    echo "❌ react-native-gesture-handler not found"
    exit 1
fi

echo "Gesture Handler: $GESTURE_VERSION"

# Check if version is compatible with Expo SDK 54
if [[ "$GESTURE_VERSION" =~ ^2\.19\. ]]; then
    echo "✅ Gesture handler version is compatible with Expo SDK 54"
elif [[ "$GESTURE_VERSION" =~ ^2\.28\. ]]; then
    echo "❌ Gesture handler v2.28.x is INCOMPATIBLE with Expo SDK 54"
    echo "   This will cause 'RNGestureHandlerModule could not be found' error"
    echo "   Run: npx expo install react-native-gesture-handler@~2.19.0"
    exit 1
else
    echo "⚠️  Unknown gesture handler version compatibility"
fi

echo ""
echo "🏗️  Testing native project structure..."
if [ ! -d "android/" ]; then
    echo "❌ Android project not found. Run: npx expo prebuild"
    exit 1
fi

# Check if gesture handler is properly configured in MainActivity
if grep -q "RNGestureHandlerEnabledRootView" android/app/src/main/java/com/kingkw1/twotruthsoneliegame/MainActivity.kt 2>/dev/null; then
    echo "✅ MainActivity properly configured for gesture handler"
else
    echo "❌ MainActivity missing gesture handler configuration"
    exit 1
fi

echo ""
echo "📦 Building Android APK to test native linking..."
if npx expo run:android --no-install --no-bundler 2>&1 | tee /tmp/build-test.log; then
    echo "✅ Android build successful - native modules should work"
else
    echo "❌ Android build failed - check native module linking"
    echo ""
    echo "Common issues to check:"
    echo "- Gesture handler version compatibility"
    echo "- Native module autolinking"
    echo "- Android build configuration"
    exit 1
fi

echo ""
echo "✅ All native module tests passed!"
echo "Your app should work on device without RNGestureHandlerModule errors"