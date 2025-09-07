#!/bin/bash
# Local Android Build and Deploy Script with FFmpeg Support

set -e  # Exit on any error

echo "🚀 Starting local Android build and deploy with FFmpeg..."

# Step 0: Ensure Android project exists with native dependencies
echo "� Setting up Android project with native dependencies..."
if [ ! -d "android" ]; then
    echo "❌ Android directory not found. Running prebuild first..."
    npx expo prebuild --platform android --clean
fi

# Step 1: Build production APK with EAS
echo "� Building production APK with EAS (local)..."
eas build --platform android --local --non-interactive

# Step 2: Find the generated APK
echo "� Finding generated APK..."
APK_PATH=$(find ../build-*.apk 2>/dev/null | head -1)
if [ -z "$APK_PATH" ]; then
    echo "❌ No APK found. Build may have failed."
    exit 1
fi

echo "✅ Found APK: $APK_PATH"

# Step 3: Check if device is connected
echo "📱 Checking for connected devices..."
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device found. Please connect your device via USB."
    exit 1
fi

# Step 4: Uninstall old version
echo "🗑️  Uninstalling old version..."
adb uninstall com.kingkw1.twotruthsoneliegame || echo "No previous version found"

# Step 5: Install new version
echo "📲 Installing new version..."
adb install "$APK_PATH"

echo "✅ Build and deploy complete! FFmpeg-enabled app installed on your phone."
