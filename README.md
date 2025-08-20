# 2Truths-1Lie: Gamified Emotion AI Social Game

## Overview
2Truths-1Lie is a fun, social game inspired by the classic icebreaker "Two Truths and a Lie," enhanced with AI-powered emotion recognition. Players post videos or audio clips stating two truths and one lie, while the community guesses the lie and interacts through points and playful feedback.

This app is designed to be both entertaining and a data-generating platform for AffectLink, a multimodal emotion sensing model.

## Features
- Record and post your “Two Truths and a Lie” challenge with video, audio, and text.
- Guess lies posted by others and compete for leaderboard points.
- Real-time emotion recognition overlays and lie/confidence scoring.
- Cosmetic unlocks and premium analytics via in-app purchases.
- Responsive design supporting mobile and web.

## Getting Started

### Prerequisites
- Node.js >=14 or Python 3.10 (depending on backend)
- Mobile device or modern browser with camera and microphone
- Apple or Google Play Developer Account for mobile builds

### Installation
```
git clone https://github.com/kingkw1/2Truths1Lie.git
cd 2Truths1Lie
npm install          # for frontend
cd backend
pip install -r requirements.txt  # for backend (if applicable)
```

### Running the App  
**Development mode:**  
On frontend:  
```
npm run dev
```  
Backend:  
```
uvicorn main:app --reload
```

### Testing
```
npm test    # Run unit and integration tests
```

## API Documentation
See [docs/api.md](docs/api.md) for full REST endpoint specs and usage examples.

## Contributing
Contributions welcome! Please open issues or pull requests following our [CONTRIBUTING.md](CONTRIBUTING.md).

## License
Licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Contact  
Project lead: Kingkw | kingkw@example.com  
Follow development: #BuildInPublic on Twitter and Devpost