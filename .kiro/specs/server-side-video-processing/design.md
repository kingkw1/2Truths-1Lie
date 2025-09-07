# Media Upload & Challenge Management Design

## Architecture Overview

- Mobile app records three individual challenge videos.
- Videos are optionally compressed client-side to reduce upload size.
- Mobile uploads the raw video files to a backend endpoint (`/api/v1/challenge-videos/upload-for-merge`).
- Backend stores these temporarily, then asynchronously merges and compresses them using FFmpeg.
- The final merged video is uploaded to AWS S3, and original files are deleted promptly.
- Backend persists challenge data including merged video URL and precise segment metadata (start/end times in seconds).
- Mobile app receives finalized merged video URL and segment metadata for accurate playback.
- Playback UI allows users to select, replay, and navigate between individual segments within the merged video.
  
## Data Flow

1. User records three individual videos locally.
2. Videos are compressed on the device before upload.
3. Mobile uploads all three videos to backend merge endpoint.
4. Backend merges videos asynchronously using FFmpeg, compresses the output.
5. Backend uploads merged video to S3, deletes inputs.
6. Challenge metadata including segment timing is stored persistently and provided via API.
7. Mobile fetches challenge list and individual challenge metadata.
8. Playback UI uses segment data for seamless segmented navigation and replay.
9. Transcoding and compression parameters are standardized with flexibility for future tuning.

## Interfaces Summary

- **POST /api/v1/challenge-videos/upload-for-merge**  
  Accepts multiple videos and returns merged video URL plus segment metadata.

- **POST /api/v1/challenges**  
  Creates a challenge referencing merged video and segments.

- **GET /api/v1/challenges**  
  Lists all available challenges with metadata.

- **GET /api/v1/media/{id}**  
  Streams the requested media asset securely.

## Security & Performance Considerations

- Authenticate all endpoints; reject unauthorized access.
- Validate video format, size, and duration on both client and server.
- Throttle upload/request rates to prevent abuse.
- Encrypt temporary storage; remove media files after processing.
- Employ signed URLs and CDN for secure, performant playback.
- Implement resumable uploads and background task support.
