# Media Upload – Design

## Architecture

- App compresses and prepares video after challenge recording; upload initiated via backend API (e.g., FastAPI `POST /api/upload`).
- Backend receives, authenticates, and validates each upload, storing video securely in cloud storage (e.g., S3, Firebase), linked to user/challenge.
- Upon success, backend returns a streaming URL or signed access URL for client reference.
- Challenge remains unpublished until upload is complete and verified.
- Uploads can resume automatically if interrupted and support backgrounding.
- **Server-side merging approach:**  
  - Mobile uploads the three individual video files separately to a backend endpoint (e.g., `/api/v1/challenge-videos/upload-for-merge`).  
  - Backend merges videos server-side using FFmpeg.  
  - Only the merged video is stored long-term in S3; temporary files are deleted to optimize AWS usage.  
  - Backend returns merged video URL and segment metadata to the mobile app.

## Data Flow

1. User records individual challenge videos locally.
2. Optionally, app compresses individual videos before upload.
3. Mobile uploads individual videos to backend "upload-for-merge" endpoint.
4. Backend validates uploads, stores temp videos, merges using FFmpeg.
5. Backend uploads merged video to S3 and deletes originals.
6. Backend persists challenge record with merged video URL and accurate segment metadata.
7. Mobile app receives merged video URL and metadata for playback UI.
8. Playback components use segment metadata to seek/play specific statements.
9. Playback uses mobile native player and adaptive streaming.

## Interfaces

- `POST /api/v1/challenge-videos/upload-for-merge` (auth required): Receives multiple video files, merges server-side, returns merged video URL plus segment metadata.
- `GET /api/v1/challenges` (auth required): Lists challenges with media URLs and segment metadata.
- `GET /api/media/:id` (auth/public): Streams/retrieves video content.
- Client-side progress tracking and upload management.
- Backend file management with cloud provider SDK/config and secure access policies.
- Redux/context updates for uploaded media URLs.

## Security & Performance

- All uploads rate-limited, authenticated, and scanned for safety.
- Use resumable/multipart uploads for connection resilience.
- Use server-side secured FFmpeg processing to reduce client complexity and ensure consistency.
- Serve media with cache-control and CDN integration for optimized delivery.
- Strict validation (format, duration, resolution, file size) per device/OS and on backend.
- Temporary server storage is encrypted and removed promptly post-merge for privacy.

## Challenge Data Persistence and API Routing

- Challenges, including all statements and their associated merged media URLs and segment metadata, are stored in a database or persistent JSON store.
- Backend exposes authenticated REST APIs under `/api/v1/challenges` for challenge listing and retrieval.
- API handlers validate authentication tokens and permissions before returning challenge data.
- Cache policies and pagination implemented for efficiency and scalability.
- Data synchronization mechanisms ensure newly created challenges are immediately visible to all clients.

## Compression Integration in Media Upload Workflow

- Compression is performed asynchronously on individual videos prior to upload.
- Backend merging compresses the final combined video using FFmpeg settings optimized for mobile playback quality and file size.
- Compression parameters include adjustable bitrate, resolution, and codec settings tuned for mobile device capabilities.
- Compression progress and errors are reported back to the app UI to maintain good user feedback.
- Segment start/end timestamps are recalculated post-compression to ensure playback accuracy.
- Compression tooling is standardized and abstracted within backend media services.
