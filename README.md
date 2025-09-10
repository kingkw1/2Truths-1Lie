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

## 📚 Documentation Hub

**All documentation has been consolidated and organized!** 

- **[📚 Complete Documentation Index](docs/README.md)** - Organized access to all docs
- **[🎯 Project Overview](docs/PROJECT_OVERVIEW.md)** - High-level project summary
- **[📱 Mobile Development](docs/MOBILE_GUIDE.md)** - React Native development guide
- **[🖥 Backend Development](docs/BACKEND_GUIDE.md)** - Python FastAPI development guide
- **[📋 API Reference](docs/api.md)** - Complete API documentation
- **[🧪 Testing Guide](docs/TESTING_GUIDE.md)** - Testing strategies and tools
- **[🚀 Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment

### Current Status: **Enhanced Media System Production Ready** ✅
- ✅ Server-side video processing with professional-grade merging
- ✅ Individual video uploads with resume capability and smart retry
- ✅ Global content delivery network for lightning-fast streaming
- ✅ Advanced segment-based playback with frame-accurate seeking
- ✅ Complete mobile-to-backend integration with enhanced error handling
- ✅ Cross-platform optimization for iOS and Android

**🎯 Next**: Implementing challenge browse and gameplay screens

### 🎯 **Key Innovations**
- **🎥 Native Mobile Video Recording** - Seamless camera integration for authentic storytelling
- **🧠 Real-time Emotion AI** - Advanced emotion recognition during video playback
- **📱 Mobile-First Design** - Optimized for iOS and Android with native performance
- **🎮 Gamified Social Experience** - Points, achievements, and community leaderboards
- **🔒 Privacy-Focused** - On-device processing with optional cloud enhancement

## ✨ Features

### 🎬 **Core Gameplay**
- Record three individual statement videos with professional server-side merging
- Advanced segment-based video playback with frame-accurate seeking and seamless switching
- Enhanced video streaming with global content delivery and adaptive quality
- Guess lies in other players' videos with AI assistance and improved playback controls
- Real-time emotion recognition overlays during video playback
- Community voting and scoring system with cross-device synchronization

### 📱 **Enhanced Mobile Experience**
- **Native iOS & Android apps** built with React Native/Expo and optimized for performance
- **Professional video processing** - record three statements, merged server-side with advanced algorithms
- **Advanced interactive playback** - frame-accurate seeking, seamless segment switching, and adaptive quality
- **Enhanced camera integration** - improved recording with background upload and resume capability
- **Smart error handling** - comprehensive error recovery with automatic retry and progress preservation
- **Intelligent offline mode** - enhanced caching, background sync, and offline challenge creation
- Touch-optimized UI with haptic feedback and global content delivery

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
- **[User Media Guide](docs/USER_MEDIA_GUIDE.md)** - Complete guide for creating and sharing video challenges with enhanced features
- **[Enhanced Upload & Playback Guide](docs/ENHANCED_UPLOAD_PLAYBACK_GUIDE.md)** - Comprehensive guide to server-side processing and advanced streaming
- **[Segment-Based Challenge Flow](docs/SEGMENT_BASED_CHALLENGE_FLOW.md)** - How the new merged video system works

### For Developers  
- **[API Documentation](docs/api.md)** - Full REST endpoint specs and usage examples
- **[Server-Side Video Processing API](docs/SERVER_SIDE_VIDEO_PROCESSING_API.md)** - Complete API reference for server-side video merging and processing
- **[Server-Side Media Flow](docs/SERVER_SIDE_MEDIA_FLOW.md)** - Detailed media processing workflow and implementation guide
- **[Segment-Based Challenge Flow](docs/SEGMENT_BASED_CHALLENGE_FLOW.md)** - Technical documentation for merged video system
- **[Media System Complete Guide](docs/MEDIA_SYSTEM_COMPLETE_GUIDE.md)** - Complete developer guide for video upload and streaming

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