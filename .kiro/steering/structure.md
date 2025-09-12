---
include: always
---

# Project Structure - Mobile-First

## General Layout  

The project uses a mobile-first modular structure to clearly separate concerns between mobile app components, backend API, and utilities to ensure maintainability and scalability for React Native/Expo development.

2Truths-1Lie/
├── .git/ # Git version control metadata
├── .kiro/ # Kiro AI assistant configurations and steering files
│ └── steering/ # Contains all steering markdowns
├── mobile/ # Main mobile application (React Native/Expo) - FLATTENED STRUCTURE
│ ├── src/
│ │ ├── components/ # Reusable mobile UI components (React Native)
│ │ ├── screens/ # Main screens/views of the mobile app
│ │ ├── game/ # Core game logic and rules for mobile
│ │ ├── services/ # API client and mobile services
│ │ ├── store/ # Redux state management
│ │ ├── media/ # Video compression, merging, and segment processing
│ │ └── utils/ # Helper functions and mobile utilities
│ ├── assets/ # Mobile-specific assets: images, fonts, icons
│ ├── android/ # Android native configuration and builds
│ ├── ios/ # iOS native configuration and builds
│ ├── app.json # Expo app configuration
│ └── package.json # Mobile dependencies and scripts
├── backend/ # Python FastAPI backend for mobile clients
│ ├── services/ # Backend business logic and APIs
│ ├── media/ # Video processing, storage, and CDN integration
│ ├── models.py # Database models including media metadata
│ ├── main.py # FastAPI application entry point
│ └── requirements.txt # Python dependencies
├── docs/ # Mobile development documentation and API specs
├── package.json # Root project configuration (mobile-focused)
└── README.md # Mobile app overview and setup instructions

## Project Structure Status
**Current Reality**: The project structure has been flattened - the mobile app code is directly in the `mobile/` directory, not nested in `mobile/src/` as originally planned. The actual structure reflects a production-ready mobile app with backend integration completed.

## Mobile-Specific Structure  
- React Native components use `.tsx` extensions with TypeScript
- Navigation structure follows React Navigation patterns
- Native modules and configs in `android/` and `ios/` directories
- Expo-specific configuration in `app.json` and `eas.json`
- Mobile assets optimized for different screen densities

## Naming Conventions  
- Use kebab-case for folder names and utility filenames (e.g., `game-logic/`, `auth-utils.ts`)  
- PascalCase for React Native components (e.g., `GameBoard.tsx`)  
- camelCase for helper functions and variables  
- Lowercase for config files (e.g., `app.json`, `package.json`)  
- Screen components suffixed with "Screen" (e.g., `GameScreen.tsx`)

## Architectural Principles  
- Mobile-first design with native performance optimization
- Keep UI and business logic separated within mobile app structure
- Encapsulate game rules strictly within `mobile/src/game/`  
- API endpoints optimized for mobile clients with efficient data transfer
- Follow React Native and Expo best practices consistently
- Tests co-located with mobile components for easy maintenance
- Native modules abstracted through service layer