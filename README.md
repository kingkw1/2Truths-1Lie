# 2Truths-1Lie: Mobile Emotion AI Social Game

## Overview
2Truths-1Lie is a mobile social game inspired by the classic icebreaker "Two Truths and a Lie," enhanced with AI-powered emotion recognition. Players post videos or audio clips stating two truths and one lie, while the community guesses the lie and interacts through points and playful feedback.

This mobile app is designed to be both entertaining and a data-generating platform for AffectLink, a multimodal emotion sensing model.

## Features
- Record and post your "Two Truths and a Lie" challenge with video, audio, and text
- Guess lies posted by others and compete for leaderboard points
- Real-time emotion recognition overlays and lie/confidence scoring
- Cosmetic unlocks and premium analytics via in-app purchases
- **Native mobile app** for iOS and Android via Expo/React Native
- Optimized mobile experience with native device features

## Getting Started

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

## API Documentation
See [docs/api.md](docs/api.md) for full REST endpoint specs and usage examples.

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