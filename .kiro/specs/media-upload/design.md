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

***
