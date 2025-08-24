# Android Build & Deployment Guide

## Overview
This guide documents the complete process for building and deploying an Expo React Native app to the Google Play Store, including troubleshooting common issues and optimizing the workflow to avoid wasting EAS Build credits.

## Table of Contents
1. [Pre-EAS Testing Strategy](#pre-eas-testing-strategy)
2. [Local Android Development Setup](#local-android-development-setup)
3. [EAS Build Configuration](#eas-build-configuration)
4. [Signing & Release Management](#signing--release-management)
5. [Troubleshooting Common Issues](#troubleshooting-common-issues)
6. [Google Play Store Deployment](#google-play-store-deployment)

## Pre-EAS Testing Strategy

### Why Test Locally First?
- **Save EAS Build Credits**: Each failed EAS build consumes credits
- **Faster Iteration**: Local builds provide immediate feedback
- **Environment Validation**: Ensures all dependencies and configurations work
- **Cost Effective**: Free local testing vs. paid EAS builds

### Local Testing Checklist
Before running any EAS builds, ensure these work locally:

```bash
# 1. Install dependencies successfully
yarn install

# 2. Expo prebuild works without errors
npx expo prebuild --platform android

# 3. Local Android build succeeds
cd android && ./gradlew assembleRelease

# 4. Bundle generation works
./gradlew bundleRelease
```

## Local Android Development Setup

### 1. Install Android SDK
```bash
# Download Android Command Line Tools
cd ~
mkdir -p Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip -d Android/Sdk/cmdline-tools/
mv Android/Sdk/cmdline-tools/cmdline-tools Android/Sdk/cmdline-tools/latest
```

### 2. Set Environment Variables
```bash
# Add to ~/.bashrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Reload environment
source ~/.bashrc
```

### 3. Install Required SDK Components
```bash
# Accept licenses
sdkmanager --licenses

# Install essential components
sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34"

# Verify installation
sdkmanager --list_installed
```

### 4. Test Local Build Process
```bash
# Generate native Android project
npx expo prebuild --platform android

# Build APK (for testing)
cd android
./gradlew assembleRelease

# Build AAB (for Play Store)
./gradlew bundleRelease

# Check generated files
ls -lh app/build/outputs/apk/release/app-release.apk
ls -lh app/build/outputs/bundle/release/app-release.aab
```

## EAS Build Configuration

### 1. Project Configuration Files

#### `eas.json` - Build Profiles
```json
{
  "cli": {
    "version": ">= 16.17.4",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "app-bundle"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### `app.json` - App Configuration
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    }
  }
}
```

### 2. Dependency Management

#### `package.json` - Key Dependencies
- Ensure `expo` package is installed: `yarn add expo`
- Remove conflicting lock files: `rm package-lock.json` (if using yarn)
- Add postinstall hook for verification:
```json
{
  "scripts": {
    "postinstall": "expo --version"
  }
}
```

### 3. Failsafe Scripts

#### `eas-build-pre-install.sh`
```bash
#!/bin/bash
# Failsafe script to ensure expo CLI is available
echo "🔧 EAS Build Pre-Install Script"
echo "Node version: $(node --version)"
echo "Yarn version: $(yarn --version)"

# Install expo CLI globally as fallback
npm install -g @expo/cli

echo "✅ Pre-install setup complete"
```

Make executable: `chmod +x eas-build-pre-install.sh`

## Signing & Release Management

### 1. Understanding the Debug vs Release Issue

**Problem**: Google Play Console rejects APKs/AABs signed with debug keystores.

**Symptoms**:
- Error: "You uploaded an APK or Android App Bundle that was signed in debug mode"
- Build appears successful but fails during upload

### 2. EAS Credentials Management

#### Check Current Credentials
```bash
npx eas credentials
```

#### Key Information to Verify:
- **Type**: Should be JKS (Java KeyStore)
- **Fingerprints**: MD5, SHA1, SHA256 should be present
- **Updated**: Should show recent activity
- **Alias**: Should be a proper release alias (not debug)

#### Example of Proper Release Keystore:
```
Keystore  
Type                JKS
Key Alias           f907ed9e620d570b2c042c5901e0f4ca
MD5 Fingerprint     8E:05:9F:0D:BA:0E:27:16:68:56:03:FC:79:0B:0D:FB
SHA1 Fingerprint    1E:0E:AF:B8:B1:6A:0B:96:80:5D:54:13:0B:17:02:0C:15:35:48:E9
SHA256 Fingerprint  26:3D:DA:6F:00:BA:39:3E:CF:5E:70:6E:D2:7B:08:38:8C:B8:DF:FA:9E:D9:00:FC:42:41:36:72:CF:66:52:00
```

### 3. Proper Build Command for Release

**❌ Wrong (Debug Signing)**:
```bash
npx eas build --platform android
# Uses default profile, may use debug signing
```

**✅ Correct (Release Signing)**:
```bash
npx eas build --platform android --profile production
# Uses production profile with release keystore
```

## Troubleshooting Common Issues

### 1. "expo command not found"
**Cause**: Expo CLI not properly installed or not in PATH

**Solution**:
```bash
# Install expo package
yarn add expo

# Use npx for commands
npx expo prebuild --platform android

# Or install globally
npm install -g @expo/cli
```

### 2. EAS Build Prebuild Failures
**Symptoms**: "yarn expo prebuild --no-install --platform android exited with non-zero code: 1"

**Solutions**:
1. Remove conflicting lock files: `rm package-lock.json`
2. Ensure consistent package manager (yarn vs npm)
3. Add failsafe script: `eas-build-pre-install.sh`
4. Test locally first with `npx expo prebuild`

### 3. Debug Signing Errors
**Symptoms**: Google Play Console rejects AAB with debug signing error

**Solutions**:
1. Always use production profile: `--profile production`
2. Verify credentials with `npx eas credentials`
3. Check EAS configuration has proper build types
4. Ensure app.json has correct package identifier

### 4. Version Conflicts
**Solutions**:
```bash
# Check current Expo SDK version
npx expo --version

# Upgrade/downgrade if needed
npx expo install --fix

# Use compatible versions (Expo SDK 51 recommended for stability)
```

## Google Play Store Deployment

### 1. File Types
- **APK**: For testing and sideloading only
- **AAB**: Required for Google Play Store uploads

### 2. Build Output Locations
- **Local builds**: `android/app/build/outputs/bundle/release/app-release.aab`
- **EAS builds**: Download from provided URL after build completion

### 3. Upload Process
1. **Google Play Console** → **App Bundle Explorer**
2. Upload the **AAB file** (not APK)
3. Use **Closed Testing** or **Internal Testing** first
4. Verify no signing errors

### 4. Pre-Upload Checklist
- [ ] Built with production profile
- [ ] Used release keystore (verified via `eas credentials`)
- [ ] AAB file (not APK)
- [ ] Version number incremented
- [ ] Package name matches Google Play Console

## Complete Workflow Summary

### 1. Initial Setup (One-time)
```bash
# Set up Android SDK
# Configure environment variables
# Install required SDK components
```

### 2. Pre-EAS Validation (Every release)
```bash
# Test dependencies
yarn install

# Test prebuild
npx expo prebuild --platform android

# Test local build
cd android && ./gradlew bundleRelease
```

### 3. EAS Build (Only after local validation)
```bash
# Build with production profile
npx eas build --platform android --profile production
```

### 4. Deploy to Google Play
```bash
# Download AAB from EAS
# Upload to Google Play Console
# Verify acceptance and no signing errors
```

## Best Practices

### Development Workflow
1. **Always test locally first** to save EAS credits
2. **Use production profile** for Play Store builds
3. **Increment versions** manually or use `autoIncrement`
4. **Keep credentials secure** and backed up

### Build Optimization
- Use `app-bundle` build type for smaller download sizes
- Enable `autoIncrement` for version management
- Set up proper environment variables for different build profiles

### Cost Management
- **Local testing** is free and fast
- **EAS builds** consume credits - use wisely
- **Failed builds** still consume credits - validate locally first

## Emergency Recovery

### If You Run Out of EAS Credits
You can always fall back to local builds:
```bash
# Generate signed AAB locally
npx expo prebuild --platform android
cd android
./gradlew bundleRelease

# Manual signing (if needed)
# Use Android Studio or command line tools
```

### If Keystore is Lost
- **DO NOT** generate a new keystore for existing apps
- **CONTACT** Google Play Console support
- **USE** EAS credentials backup if available

---

## Conclusion

This workflow ensures reliable, cost-effective Android app deployment while minimizing failed builds and maximizing success rates. Always validate locally before using EAS Build credits, and always use the production profile for Google Play Store uploads.
