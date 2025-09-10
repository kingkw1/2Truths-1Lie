<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Mobile App Testing Guide

This guide covers testing the native mobile app built with Expo/React Native. The project now focuses exclusively on mobile development.

## **Prerequisites**

- Node.js >=18
- Expo CLI (`npm install -g @expo/cli`)
- Android device with Expo Go app OR Android Studio simulator
- iOS device with Expo Go app OR Xcode simulator (macOS only)

## **Development Testing with Expo Go**

### 1. **Start the Development Server**
```bash
cd mobile
npm start
# or from root directory:
npm start
```

### 2. **Test on Physical Device**
- **Install Expo Go** from App Store (iOS) or Play Store (Android)
- **Scan QR code** displayed in terminal/browser with:
  - Camera app (iOS)
  - Expo Go app (Android)

### 3. **Test on Simulators**

**Android Simulator:**
```bash
npm run android
```

**iOS Simulator (macOS only):**
```bash
npm run ios
```

## **B. Expo/React Native Approach (Recommended for Shipaton/Store Submission)**

If you want to publish as a true mobile app (required for Shipaton), this is the way:

### 1. **Converting Your Project (if needed)**
- If you’re using Create React App, look into [React Native Web](https://necolas.github.io/react-native-web/) or migrate your logic to an [Expo](https://expo.dev/) project.

### 2. **Set Up Expo (if not already):**
   ```bash
   npm install -g expo-cli
   expo init your-project-name
   ```
   - Choose a blank (TypeScript, JS) or tabs template.
   - Copy key components and logic over.

### 3. **Start with Expo Go for Local Testing:**

- **Start the Expo development server:**
   ```bash
   expo start
   ```
- **Install the Expo Go app** from the Play Store on your Android device.
- **Scan the QR code** from your dev machine using Expo Go.

**Your app now runs on your phone!**
- Hot reload works between your computer and device.

### 4. **Direct Build & Install APK**

- **Build the APK:**
   ```bash
   expo build:android
   ```
   - If using EAS Build (expo’s cloud service):  
     ```bash
     eas build -p android
     ```
- **Download the APK file** from the build site, transfer it to your Android device.
- **On your device:**
   - Open the APK (ensure “Install from unknown sources” is enabled), and install your app.
- **Now test your app natively!**

### 5. **Test Device Features**
- Try camera, mic recording, notifications, and local file access.
- Make sure all permissions requests are handled in your code.

### 6. **Prepare for Play Store Submission**
- Configure your app manifest (icon, name, permissions).
- Validate with `expo build:android --release-channel production`.
- Proceed to Play Console submission steps (see [Expo docs](https://docs.expo.dev/distribution/uploading-apps/)).

***

## **Summary Checklist**

| Step                                    | PWA               | Native (Expo/React Native)                     |
|------------------------------------------|-------------------|-----------------------------------------------|
| View app in browser on Android           | Yes               | Yes                                          |
| Test camera/microphone                   | Limited           | Full (native API, permissions)                |
| Install as app (icon on home, offline)   | Limited           | Yes (full native install)                     |
| Prepare for Play Store                   | No                | Yes (required for Shipaton)                   |

***
