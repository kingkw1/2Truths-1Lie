# Emotion Analysis - Design

## Architecture

- Media uploaded to backend triggers async emotion recognition pipeline  
- AffectLink service processes video/audio/text for multimodal emotion features  
- Scores stored and linked with the user’s game session  
- Frontend subscribes to updates and overlays emotion feedback visually

## Data Flow

1. Completion of media upload triggers emotion scoring job  
2. AffectLink returns detailed embeddings and confidence values  
3. Backend updates game state and broadcasts results to clients via WebSocket  
4. UI reflects emotion overlays during gameplay
