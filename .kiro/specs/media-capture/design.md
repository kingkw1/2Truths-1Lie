# Media Capture - Design

## Architecture

- Frontend uses browser WebRTC or native mobile APIs for video/audio capture  
- Local preview buffers recorded media for user confirmation  
- Backend API endpoints handle chunked uploads and storage to Firebase/Supabase  
- Use media compression to optimize file size before upload

## Components

- RecordingControl: Start/stop/pause/cancel controls  
- MediaPreview: Playback of recorded media  
- UploadProgress: Visual feedback during media upload

## Data Flow

1. User initiates recording on client  
2. Media buffered locally until completion or cancellation  
3. On confirmation, media is compressed and uploaded asynchronously  
4. Server returns media URL for association with challenge
