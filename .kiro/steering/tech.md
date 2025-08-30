---
include: always
---

# Technology Stack - Mobile-First

## Overview  
We use a mobile-first React Native/Expo stack emphasizing native mobile performance, rapid development, and optimal AI-assisted coding with Kiro. The web app has been archived to focus exclusively on mobile development.

## Mobile Frontend  
- **Framework**: React Native with Expo SDK 53+ for maximum native compatibility
- **Language**: TypeScript for reliability and better AI code suggestions
- **UI**: Native mobile components with Expo styling and React Native best practices
- **Navigation**: React Navigation for native mobile navigation patterns
- **State Management**: Redux Toolkit optimized for mobile performance
- **Media**: Expo Camera and Audio APIs for native device recording capabilities
- **Offline**: AsyncStorage and SQLite for offline-first mobile experience

## Backend  
- **Runtime**: Python with FastAPI for REST APIs (mobile-optimized endpoints)
- **Database**: SQLite for development; PostgreSQL for production-scale mobile users
- **Storage**: Cloud storage (S3/Firebase) optimized for mobile media uploads
- **Hosting**: Railway or Render for mobile-optimized backend services
- **API Design**: Mobile-first API patterns with efficient data transfer and offline sync

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