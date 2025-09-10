# 🎭 2Truths-1Lie Project Overview

## Project Summary
**2Truths-1Lie** is an AI-powered mobile social game where players create video statements (2 truths, 1 lie) and use emotion recognition to detect lies. Built with React Native/Expo and Python FastAPI.

## Key Features
- 📱 **Mobile-First**: Native camera recording with React Native
- 🎥 **Video Processing**: Server-side video merging and segmentation
- 🤖 **AI Integration**: Emotion recognition for lie detection
- 🔒 **Secure**: JWT auth, rate limiting, content moderation
- ⚡ **Performance**: CDN delivery, optimized uploads

## Current Status: **Enhanced Media System Production Ready** ✅
- ✅ Video recording, upload, and processing pipeline
- ✅ Segment-based playback with frame-accurate seeking  
- ✅ Mobile-backend integration with error handling
- ✅ S3 storage with global CDN
- 🎯 **Next**: Challenge browsing and gameplay UI

## Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  📱 Mobile App  │    │  🌐 Backend API │    │ 🤖 AI Services │
│ React Native    │◄──►│ Python FastAPI  │◄──►│ Emotion Model   │
│ Expo + Redux    │    │ SQLite + S3     │    │ Video Analysis  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Tech Stack
- **Frontend**: React Native 0.79, Expo SDK 53, TypeScript, Redux
- **Backend**: Python 3.12, FastAPI, SQLite/PostgreSQL
- **Infrastructure**: AWS S3, CDN, Docker deployment ready
- **AI/ML**: TensorFlow.js, emotion recognition models

## Repository Structure
```
├── mobile/           # React Native app
├── backend/          # Python FastAPI server  
├── docs/            # Consolidated documentation
├── assets/          # App icons and graphics
└── android/         # Android build configuration
```

## Quick Links
- [🚀 Developer Quick Start](../DEVELOPER_QUICK_START.md)
- [🏗 Technical Architecture](../ARCHITECTURE.md) 
- [📋 API Documentation](api.md)
- [📱 Mobile Development](MOBILE_GUIDE.md)
- [🖥 Backend Development](BACKEND_GUIDE.md)
- [🧪 Testing Guide](TESTING_GUIDE.md)
