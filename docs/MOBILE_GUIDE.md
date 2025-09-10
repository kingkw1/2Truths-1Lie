# 📱 Mobile Development Guide

## Overview
The 2Truths-1Lie mobile app is built with React Native, Expo, and TypeScript. This guide covers development setup, architecture, testing, and deployment.

## 🚀 Quick Setup

### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- Expo Go app on your mobile device

### Getting Started
```bash
cd mobile
npm install
npm start
# Scan QR code with Expo Go app
```

## 📁 Project Structure
```
mobile/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── store/          # Redux store and slices
│   ├── services/       # API and external services
│   ├── utils/          # Helper functions
│   └── types/          # TypeScript type definitions
├── assets/             # Images, fonts, etc.
├── __tests__/          # Test files
└── app.json           # Expo configuration
```

## 🏗 Architecture

### Tech Stack
- **React Native 0.79** - Cross-platform mobile framework
- **Expo SDK 53** - Development platform and native APIs
- **TypeScript 5.8** - Type safety and better DX
- **Redux Toolkit** - State management
- **React Navigation** - Navigation routing
- **Expo Camera** - Video recording functionality

### Key Features
- 📷 **Camera Recording**: Native video recording with segments
- 🎮 **Challenge Creation**: Record 3 statements, select lie
- 📱 **Responsive UI**: Optimized for iOS and Android
- 🔄 **State Management**: Redux for app state
- 🌐 **API Integration**: Backend connectivity
- 📊 **Analytics**: User engagement tracking

## 🧪 Testing

### Test Coverage: 77.3% (198/256 tests)
We maintain high test coverage focusing on critical user flows.

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Test Categories
1. **Unit Tests**: Component behavior and utilities
2. **Integration Tests**: Redux state management
3. **E2E Tests**: Complete user workflows
4. **Permission Tests**: Camera and storage access

### Key Test Scenarios
- Camera permission flows
- Video recording lifecycle
- Challenge creation workflow
- Redux state management
- Error handling and recovery

## 📦 Building & Deployment

### Development Build
```bash
npx expo build:android --type apk
```

### Production Build
```bash
# Configure app.json for production
npx expo build:android --type app-bundle
```

### Environment Configuration
- **Development**: Points to local backend (192.168.50.111:8001)
- **Production**: Points to production backend

## 🔧 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow React Native best practices
- Implement proper error boundaries
- Use Redux Toolkit for state management

### Component Structure
```typescript
// Example component structure
interface ComponentProps {
  // Define props with TypeScript
}

export const Component: React.FC<ComponentProps> = ({ prop }) => {
  // Component logic
  return (
    // JSX
  );
};
```

### State Management
- Use Redux slices for feature state
- Implement proper action creators
- Use selectors for state access
- Handle async actions with createAsyncThunk

## 🐛 Debugging

### Common Issues
1. **Camera permissions**: Check device settings
2. **Build errors**: Clear cache with `npx expo r -c`
3. **Network issues**: Verify backend connectivity
4. **State issues**: Use Redux DevTools

### Debugging Tools
- **Flipper**: React Native debugger
- **Redux DevTools**: State inspection
- **Expo Dev Tools**: Build and deployment debugging

## 📋 Current Status

### ✅ Completed Features
- Camera recording with segments
- Challenge creation workflow
- Redux state management
- Navigation system
- Basic UI components
- Test infrastructure

### 🎯 In Progress
- Backend integration authentication
- Challenge browsing UI
- Gameplay screens
- Enhanced error handling

### 📅 Upcoming
- AI emotion recognition integration
- Social features (leaderboards, sharing)
- Push notifications
- Offline support
- iOS build and deployment

## 🔗 Related Documentation
- [Backend API](BACKEND_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Deployment Guide](../android-build-deployment-guide.md)
