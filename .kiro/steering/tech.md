---
include: always
---

# Technology Stack - Mobile-First

## Overview  
We use a mobile-first React Native/Expo stack emphasizing native mobile performance, rapid development, and optimal AI-assisted coding with Kiro. The project is production-ready with full backend integration on Railway.

**Production Status**: Complete end-to-end functionality operational - Record → Upload → Store → Retrieve → Play workflow fully functional.

## Mobile Frontend  
- **Framework**: React Native with Expo SDK 53+ for maximum native compatibility
- **Language**: TypeScript for reliability and better AI code suggestions
- **UI**: Native mobile components with Expo styling and React Native best practices
- **Navigation**: React Navigation for native mobile navigation patterns
- **State Management**: Redux Toolkit optimized for mobile performance
- **Media**: Expo Camera and Audio APIs for native device recording capabilities
- **Video Processing**: FFmpeg for React Native or platform-specific compression libraries
- **Offline**: AsyncStorage and SQLite for offline-first mobile experience

## Backend  
- **Runtime**: Python with FastAPI for REST APIs (mobile-optimized endpoints)
- **Database**: SQLite for development; production-ready for scaling to PostgreSQL
- **Storage**: Railway cloud hosting with integrated file storage for mobile media uploads
- **Media Processing**: Server-side video merging, validation and metadata extraction using FFmpeg
- **Hosting**: Railway production deployment - fully operational backend services
- **API Design**: Mobile-first API patterns with efficient data transfer and offline sync
- **Production Status**: Complete backend deployed and operational on Railway infrastructure

## Mobile Development & Tools  
- **Development**: Expo Go for rapid mobile iteration and testing
- **Testing**: Jest + React Native Testing Library for mobile component testing
- **Device Testing**: iOS Simulator, Android Emulator, and real device testing
- **Build**: EAS Build for production iOS and Android app builds
- **Deployment**: App Store Connect and Google Play Console deployment pipelines
- **Performance**: Flipper and React Native performance monitoring

## Mobile AI & Emotion Analytics  
- **On-Device Processing**: Optimized ML models for mobile emotion recognition
- **Camera Integration**: Real-time emotion analysis during native video recording
- **Mobile SDKs**: Lightweight mobile-specific AI libraries
- **Privacy**: On-device processing to maintain user privacy on mobile devices

## Mobile-Specific Constraints  
- **Native Performance**: Prioritize 60fps animations and smooth mobile UX
- **Battery Optimization**: Efficient background processing and camera usage
- **App Store Compliance**: Follow iOS and Android app store guidelines
- **Mobile-Only APIs**: Focus on native mobile capabilities (camera, storage, notifications)
- **AI Integration**: Optimized for mobile AI assistant development with Kiro  