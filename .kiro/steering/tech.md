---
include: always
---

# Technology Stack

## Overview  
We use a modern and pragmatic stack emphasizing speed of development, cross-platform capability, maintainability, and scalability. Prioritize tools that enable rapid iteration and Kiro integration.

## Frontend  
- Framework: React (or React Native for mobile) with TypeScript for reliability  
- UI: Component-driven architecture; styled with CSS-in-JS or Tailwind CSS  
- Real-time / Multiplayer: Socket.IO or WebSocket where needed for synchronous gameplay  
- Media: Browser Media APIs for webcam/mic capture and playback; fallbacks as necessary  

## Backend  
- Runtime: Node.js with Express or Fastify, or Python with FastAPI for REST APIs  
- Database: SQLite for development; PostgreSQL planned for production-scale  
- Storage: Firebase Storage or Supabase (start free-tier) for storing uploaded videos/audio securely  
- Hosting: Vercel/Netlify for frontend, Railway or Render for backend services  

## Development & Tools  
- Code Quality: ESLint + Prettier, TypeScript type checking  
- Testing: Jest + React Testing Library for unit and integration tests  
- Deployment: GitHub Actions or similar CI/CD pipelines for automated testing and deployment  
- Documentation: API specs and game design documented clearly in `docs/` folder

## AI & Emotion Analytics  
- Open-source libraries (DeepFace, Vosk) or lightweight ML model embeddings for prototype  
- Ship kit credits for cloud API exploration (ElevenLabs, Bloom, A0.dev)  
- Emotion recognition to be modular and abstracted for easy replacement or enhancement  

## Constraints  
- Keep dependencies minimal at first  
- Prioritize native-like performance for mobile platforms  
- Abstain from costly commercial AI APIs until monetization validated  
- Architect for easy Kiro agent and spec-driven code support  