#!/bin/bash
# Local Android Build and Deploy Script

set -e  # Exit on any error

echo "🚀 Starting local Android build and deploy..."

# Step 1: Export Expo bundle
echo "📦 Exporting Expo bundle..."
npx expo export --platform android --output-dir ./dist

# Step 2: Copy bundle to Android assets
echo "📋 Copying bundle to Android assets..."
cp dist/_expo/static/js/android/index-*.hbc android/app/src/main/assets/index.android.bundle

# Step 3: Build APK
echo "🔨 Building Android APK..."
./android/gradlew -p android assembleDebug

# Step 4: Check if device is connected
echo "📱 Checking for connected devices..."
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device found. Please connect your device via USB."
    exit 1
fi

# Step 5: Uninstall old version
echo "🗑️  Uninstalling old version..."
adb uninstall com.kingkw1.twotruthsoneliegame || echo "No previous version found"

# Step 6: Install new version
echo "📲 Installing new version..."
adb install android/app/build/outputs/apk/debug/app-debug.apk

echo "✅ Build and deploy complete! Check your phone."
