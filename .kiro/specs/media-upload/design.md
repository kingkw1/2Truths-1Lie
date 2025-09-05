# Media Upload – Design

## Architecture

- App compresses and prepares video after challenge recording; upload initiated via backend API (e.g., FastAPI `POST /api/upload`)
- Backend receives, authenticates, and validates each upload, storing video securely in cloud storage (e.g., S3, Firebase), linked to user/challenge
- Upon success, backend returns a streaming URL or signed access URL for client reference
- Challenge remains unpublished until upload is complete and verified
- Uploads can resume automatically if interrupted and support backgrounding

## Data Flow

1. User records/compresses challenge video  
2. App initiates secured upload, showing progress  
3. API validates file, processes metadata  
4. Video stored in cloud, URL returned to app  
5. Challenge updated with server URL, enabling cross-device access and playback  
6. Playback uses mobile native player and adaptive streaming

## Interfaces

- `POST /api/upload` (auth required): Accepts video; returns durable URL  
- `GET /api/media/:id` (auth/public): Streams/retrieves video content  
- Client-side progress tracking and upload management  
- Backend file management with cloud provider SDK/config and secure access policies  
- Redux/context updates for uploaded media URLs

## Security & Performance

- All uploads rate-limited, authenticated, and scanned for safety  
- Use resumable/multipart uploads for connection resilience  
- Serve media with cache-control and CDN integration for optimized delivery  
- Strict validation (format, duration, resolution, file size) per device/os

## Segmented Challenge Video – Updated Design

- Mobile app merges three recorded video statement files into one using client-side processing (e.g., ffmpeg or platform decoder).
- Records segment boundaries: list of {start_time, end_time, statement_index}
- Uploads merged file as before, but includes segment metadata in the payload (in a separate JSON field or as part of the challenge create API).
- Backend stores this merged video as the challenge's media asset.
- Challenge data model is updated to include segment timecodes.
- During playback, the mobile app loads metadata and presents UI controls for each statement, seeking/playing video for only the selected segment based on timecodes.
- Optionally, migration support is added for legacy challenges (three files → merged plus metadata) if needed.

## Challenge Data Persistence and API Routing (Addition)

- Challenges, including all statements and their associated media URLs and segment metadata, are stored in a database or persistent JSON store.
- Backend is responsible for loading challenges from persistent storage and exposing authenticated REST APIs under `/api/v1/challenges`.
- API handlers validate authentication tokens and permissions before returning challenge lists and detail data.
- Cache policies and pagination implemented for efficiency and scalability.
- Data synchronization and consistency mechanisms ensure that newly created challenges become visible to all clients promptly.

## Compression Integration in Media Upload Workflow

- After recording each statement or after merging the statements into a single video, the app will apply video compression using platform-optimized libraries (e.g., FFmpeg for Android/iOS).
- Compression parameters include adjusting bitrate, resolution, and codec settings tuned for mobile device capabilities.
- The compressed video is the final artifact sent for upload via secure API to cloud storage.
- Compression stage updates upload progress UI to inform user.
- Compression step includes recalculation of segment start/end timestamps for accurate playback.
- Compression should be performed asynchronously to prevent UI blocking.
- Compression parameters are currently fixed; plans for future user-controlled quality settings are noted but deferred.
