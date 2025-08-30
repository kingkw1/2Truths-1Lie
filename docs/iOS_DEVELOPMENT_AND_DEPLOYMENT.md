# iOS Development & Deployment Plan for 2Truths-1Lie

## Overview

This document outlines the steps to prepare, build, test, and deploy the 2Truths-1Lie mobile app to the Apple App Store targeting iOS, leveraging Expo Application Services (EAS) Build and Expo Go Testing. This plan assumes Android development is fully complete and tested.

***

## Prerequisites

- Completed Android app development with functional core features.
- Apple Developer Program membership ($99/year) active.
- Expo CLI installed (`npm install -g expo-cli`).
- Access to an Apple device (iPhone or iPad) for testing.
- An Expo account linked with your project.

***

## Step 1: Configure Expo Project for iOS

1. Open your project’s `app.json` or `app.config.js` file.
2. Add or update iOS-specific configuration:
   ```json
   "ios": {
     "bundleIdentifier": "com.yourcompany.2truths1lie",
     "buildNumber": "1.0.0",
     "supportsTablet": true,
     "infoPlist": {
       "NSCameraUsageDescription": "This app uses the camera for video challenges",
       "NSMicrophoneUsageDescription": "Microphone access is needed to record audio"
     }
   }
   ```
3. Ensure you have iOS app icons and splash screens defined or use default Expo assets.

***

## Step 2: Test on iOS Using Expo Go

1. Run the Expo development server:
   ```bash
   expo start
   ```
2. Open the Expo Go app on your iOS device (download from the App Store if needed).
3. Scan the QR code shown in your terminal or browser.
4. Test the app thoroughly on your device, verifying all core features function as expected (video recording, challenge creation, AI emotion detection overlays, navigation).

***

## Step 3: Prepare to Build iOS App with EAS Build

1. Install EAS CLI if not already installed:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to Expo and Apple developer accounts:
   ```bash
   eas login
   ```
3. Initialize EAS configuration:
   ```bash
   eas build:configure
   ```
4. Update app versioning as needed in `app.json` or `app.config.js`:
   - Increment `ios.buildNumber`
   - Update `version` field if used

***

## Step 4: Create iOS Build on EAS

1. Trigger a cloud build for iOS:
   ```bash
   eas build --platform ios
   ```
2. Follow prompts to:
   - Provide Apple Developer credentials (or use credentials provider)
   - Let Expo manage certificates or provide your own
3. Monitor build status on Expo dashboard or CLI.
4. Once build completes, download the `.ipa` file for testing and submission.

***

## Step 5: Distribute and Test iOS Build via TestFlight

1. Upload the `.ipa` binary using `eas submit` or through Apple’s Transporter app.
2. Go to **App Store Connect** and add testers via **TestFlight**.
3. Distribute the app to testers; they receive notifications to install and test pre-release builds.
4. Gather feedback and fix any iOS-specific bugs or performance issues.

***

## Step 6: Prepare for Apple App Store Submission

1. Configure metadata on **App Store Connect**:
   - App name, description, keywords, support URL, privacy policy
2. Upload required screenshots of your app running on iPhone and iPad.
3. Fill out compliance and age rating forms.
4. Submit the app for Apple review:
   - Allow 1–3 days for review
   - Respond promptly to any feedback or rejection notices
5. After approval, your app will go live on the App Store.

***

## Additional Tips

- Test often on real devices to catch platform-specific issues.
- Use Expo’s OTA updates to push non-binary updates quickly after release.
- Make sure privacy policies cover video recording and AI data use clearly.
- Keep backups of all credentials and certificates secure.
- Follow Apple's Human Interface Guidelines for best UX compliance.

***

## Summary Timeline

| Phase                      | Estimated Timeframe         | Description                        |
|----------------------------|-----------------------------|------------------------------------|
| Configure Expo for iOS     | 1-2 days                    | Setup app.json iOS config          |
| Test on Expo Go            | 1-3 days                    | Functional testing on device       |
| Setup EAS Build            | 1 day                       | EAS CLI install and configure      |
| Build iOS App              | 1-2 days                    | Cloud build and retrieval          |
| Test via TestFlight        | 2-4 days (parallel to build)| Beta testing and bug fixing        |
| Prepare & Submit App Store | 2-3 days                    | Metadata, screenshots, submit app  |
| Apple Review               | 1-3 days                    | Waiting for review and approval    |
