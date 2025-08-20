# Media Capture - Design

## Architecture

- Frontend uses browser WebRTC or native mobile APIs (e.g., MediaRecorder API) for video and audio capture  
- Captured media buffered locally to enable user preview before uploading  
- Implement client-side media compression or encoding to optimize upload size and speed  
- Backend exposes chunked upload API endpoints that support resumable uploads  
- Media stored securely in cloud storage (Firebase Storage, Supabase Storage, or equivalent) with appropriate access controls  

## Components

- RecordingControl: Controls to start, pause, resume, and cancel media recording  
- MediaPreview: Component to play back recorded media before submission  
- UploadProgress: Visual progress bar with status messages and user cancel option

## Data Flow

1. User initiates media capture on the client  
2. Recorded media stored locally and available for preview  
3. On confirmation, media compressed to optimize size without significant quality loss  
4. Media uploaded asynchronously with progress feedback  
5. Backend validates and stores media securely, returning media URL for association with challenge data
