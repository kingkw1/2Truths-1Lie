# Media Upload – Design

## Architecture

- After challenge media recording and compression, the app initiates upload to a backend API (e.g., FastAPI endpoint)
- Server receives and validates video media, stores it in a managed cloud storage bucket with user association
- Backend returns a persistent URL (public or authenticated) for the file upon successful upload
- Client stores only the server URL (never the blob URL) for persistent challenge playback and metadata
- Challenge publishing is blocked until successful upload; upload resumes in background if interrupted

## Data Flow

1. User records video in challenge creation form  
2. App compresses video and initializes upload (shows progress UI)  
3. API receives video file, performs MIME/size/duration validation  
4. Video stored in cloud storage and associated with user/challenge  
5. Backend returns video URL; client updates challenge with this URL  
6. Challenge is eligible for publishing/guessing

## Interfaces

- `POST /api/upload` (authenticated): Accepts video file, returns video URL  
- `GET /api/media/:id` (authenticated/public): Streams/serves uploaded video  
- Cloud provider SDK configuration and server file management  
- Redux or context state update for media URLs

## Security & Performance Considerations

- All uploads authenticated and rate-limited; files scanned for compliance (if needed)
- Use resumable upload (multipart/chunked) for large files or poor connectivity  
- Serve videos with proper caching headers; support CDN/edge distribution in scale scenarios
