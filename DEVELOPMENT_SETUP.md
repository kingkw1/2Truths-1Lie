# Development Setup - Mobile-First Development 🚀

## Overview
This project is now **mobile-only**, focusing exclusively on React Native/Expo development. The web app has been archived to streamline development and optimize for AI-assisted coding with Kiro and VS Code Copilot.

## Quick Start Commands

### Mobile Development
```bash
npm start                 # Start Expo development server
# Scan QR code with Expo Go app on your phone
# OR run on simulator:
npm run android          # Android simulator  
npm run ios              # iOS simulator
```

### Backend Development
```bash
cd backend
uvicorn main:app --reload # Start API server on http://localhost:8000
```

### Production Builds
```bash
npm run build:android    # Build Android APK/AAB
npm run build:ios        # Build iOS IPA
```

## Project Architecture

### 📁 **Directory Structure**
```
2Truths-1Lie/                  # Root project (mobile-focused)
├── mobile/                    # Main mobile app (React Native/Expo)
│   ├── src/
│   │   ├── types/             # TypeScript interfaces
│   │   ├── store/             # Redux store & slices
│   │   ├── screens/           # Mobile screens
│   │   ├── components/        # Mobile-specific components
│   │   └── services/          # API services
│   └── package.json           # Mobile dependencies
├── backend/                   # API server
├── docs/                      # Mobile-focused documentation
├── archive/
│   └── web-app/              # Archived web app (reference only)
└── package.json              # Root package (mobile scripts)
```

### � **Mobile-Only Architecture Benefits**

**✅ Simplified Development:**
- Single platform focus reduces complexity
- Faster AI-assisted development with Kiro
- Streamlined VS Code Copilot suggestions
- No cross-platform synchronization overhead

**✅ Native Mobile Features:**
- Full access to device camera and microphone
- Native performance and user experience
- App store distribution capabilities
- Offline-first capabilities

**✅ Optimized for Hackathons:**
- Faster iteration cycles for KiRo and Shipaton competitions
- Reduced codebase complexity for AI tooling
- Direct mobile deployment pipeline

## Development Workflow

### 🚀 **Mobile Development Process**

1. **Start Development Server**
```bash
npm start                 # Starts Expo dev server
```

2. **Test on Device/Simulator**
```bash
# Physical device: Scan QR code with Expo Go app
npm run android          # Test on Android simulator
npm run ios              # Test on iOS simulator (macOS only)
```

3. **Run Tests**
```bash
cd mobile
npm test                 # Run mobile app tests
npm run test:coverage    # Run tests with coverage
```

4. **Build for Production**
```bash
npm run build:android    # Build Android APK/AAB for Play Store
npm run build:ios        # Build iOS IPA for App Store
```

### 📱 **Mobile-Specific Development Tips**

- **Use Expo Go** for fastest iteration during development
- **Test on real devices** frequently for camera/microphone features
- **Use Metro bundler** hot reload for instant feedback
- **Profile performance** on mid-range devices for optimal UX
- **Leverage native features** like haptic feedback and device storage

### 🔧 **Environment Setup**

#### Prerequisites
- Node.js >=18
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android simulation)
- Xcode (for iOS simulation, macOS only)

#### First-Time Setup
```bash
git clone https://github.com/kingkw1/2Truths1Lie.git
cd 2Truths1Lie
npm install              # Install root dependencies
npm run mobile:install   # Install mobile dependencies
```
