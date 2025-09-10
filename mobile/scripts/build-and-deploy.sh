#!/bin/bash
# Local Android Build and Deploy Script with FFmpeg Support

set -e  # Exit on any error

echo "🚀 Starting local Android build and deploy with FFmpeg..."

# Step 0: Ensure Android project exists with native dependencies
echo "🔧 Setting up Android project with native dependencies..."
if [ ! -d "android" ]; then
    echo "❌ Android directory not found. Running prebuild first..."
    npx expo prebuild --platform android --clean
fi

# Step 1: Build APK using Gradle directly (supports native dependencies)
echo "🏗️ Building APK with Gradle (supports native dependencies)..."
cd android
./gradlew assembleRelease

# Step 2: Find the generated APK
echo "🔍 Finding generated APK..."
APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at expected location: $APK_PATH"
    echo "Looking for APK files..."
    find app/build/outputs/apk -name "*.apk" -type f
    exit 1
fi

cd ..
echo "✅ Found APK: android/$APK_PATH"

# Step 3: Check if device is connected
echo "📱 Checking for connected devices..."
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device found. Please connect your device via USB."
    echo "Run 'adb devices' to check connected devices."
    exit 1
fi

# Step 4: Uninstall old version
echo "🗑️ Uninstalling old version..."
adb uninstall com.kingkw1.twotruthsoneliegame || echo "No previous version found"

# Step 5: Install new version
echo "📲 Installing new version..."
adb install "android/$APK_PATH"

echo "✅ Build and deploy complete! FFmpeg-enabled app installed on your phone."
echo "🎬 Video merging with FFmpeg Kit is now available!"
