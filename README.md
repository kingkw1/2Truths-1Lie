# 🎭 2Truths-1Lie: AI-Powered Mobile Social Game

<div align="center">

![App Icon](assets/app_icon_scaled.png)

[![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53.0-purple.svg)](https://expo.dev/)
[![Python](https://img.shields.io/badge/Python-3.12-green.svg)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org/)

**🏆 Built for Hackathons | 🚀 Production-Ready Mobile App | 🤖 AI-Powered**

</div>

## 🚀 Quick Start

### For Developers
```bash
# Get running in 5 minutes
git clone https://github.com/kingkw1/2Truths-1Lie.git
cd 2Truths-1Lie

# Backend setup
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Mobile setup (new terminal)
cd mobile && npm install && npm start
# Scan QR code with Expo Go app
```

**📋 See [Developer Quick Start Guide](DEVELOPER_QUICK_START.md) for complete setup**

### Current Status: **Media System Production Ready** ✅
- ✅ 15+ successful video uploads to AWS S3
- ✅ Complete mobile-to-backend integration  
- ✅ Challenge creation with uploaded media
- ✅ Local builds and deployment (no EAS credits needed)

**🎯 Next**: Implementing challenge browse and gameplay screens

### 🎯 **Key Innovations**
- **🎥 Native Mobile Video Recording** - Seamless camera integration for authentic storytelling
- **🧠 Real-time Emotion AI** - Advanced emotion recognition during video playback
- **📱 Mobile-First Design** - Optimized for iOS and Android with native performance
- **🎮 Gamified Social Experience** - Points, achievements, and community leaderboards
- **🔒 Privacy-Focused** - On-device processing with optional cloud enhancement

## ✨ Features

### 🎬 **Core Gameplay**
- Record and post your "Two Truths and a Lie" video challenges
- Guess lies in other players' videos with AI assistance
- Real-time emotion recognition overlays during video playback
- Community voting and scoring system

### 📱 **Mobile Experience**
- **Native iOS & Android apps** built with React Native/Expo
- Seamless camera and microphone integration
- Touch-optimized UI with haptic feedback
- Offline-capable with cloud synchronization

### 🤖 **AI & Analytics**
- Advanced emotion detection during video recording and playback
- Confidence scoring for lie detection assistance
- Optional premium analytics for content creators
- Privacy-first approach with on-device processing options

## 🚀 Getting Started

### Prerequisites
- Node.js >=18
- Expo CLI (`npm install -g @expo/cli`)
- Mobile device with Expo Go app or iOS/Android simulator
- Apple or Google Play Developer Account for production builds (optional)

### Installation
```bash
git clone https://github.com/kingkw1/2Truths1Lie.git
cd 2Truths1Lie
npm install          # Install main project dependencies
npm run mobile:install  # Install mobile dependencies
cd backend
pip install -r requirements.txt  # Install backend dependencies
```

### Running the Mobile App  
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

### Building for Production
```bash
npm run build:android    # Build Android APK/AAB
npm run build:ios        # Build iOS IPA
```

### Testing
```bash
cd mobile
npm test                 # Run mobile app tests
```

## Documentation

### For Users
- **[User Media Guide](docs/USER_MEDIA_GUIDE.md)** - Complete guide for creating and sharing video challenges

### For Developers  
- **[API Documentation](docs/api.md)** - Full REST endpoint specs and usage examples
- **[Persistent Media Workflow](docs/PERSISTENT_MEDIA_WORKFLOW.md)** - Complete developer guide for video upload and streaming

## Hackathon Participation
This project leverages AI-assisted development tools, primarily the Kiro agent, to accelerate and guide the build process.  
Detailed documentation of the AI-driven workflow, task execution logs, and usage of Kiro are available in [KIRO_HACKATHON.md](KIRO_HACKATHON.md).

## Contributing
Contributions welcome! Please open issues or pull requests following our [CONTRIBUTING.md](CONTRIBUTING.md).

## License
Licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Contact  
Project lead: Kingkw | kingkw@example.com  
Follow development: #BuildInPublic on Twitter and Devpost