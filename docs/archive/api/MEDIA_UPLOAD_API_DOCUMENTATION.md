<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Media Upload API Documentation

## Overview

The Media Upload API provides secure video upload and streaming retrieval endpoints for the 2Truths-1Lie application. It supports chunked uploads for large video files and provides streaming capabilities with range request support.

### New Features: CDN Integration & Global Delivery

- **Global CDN Delivery**: CloudFront integration for worldwide content delivery
- **Signed URLs**: Secure, time-limited access with cryptographic signatures  
- **Device Optimization**: Adaptive caching and format recommendations
- **Cache Management**: Selective invalidation and performance analytics

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_token>
```

## Endpoints

### 1. Initiate Video Upload

**POST** `/api/v1/media/upload/initiate`

Initiates a new video upload session with validation.

**Request Body (Form Data):**
- `filename` (string, required): Original filename with extension
- `file_size` (integer, required): Total file size in bytes
- `duration_seconds` (float, required): Video duration in seconds
- `mime_type` (string, required): MIME type of the video file
- `file_hash` (string, optional): SHA-256 hash for integrity verification

**Response:**
```json
{
  "session_id": "uuid-string",
  "upload_url": "/api/v1/media/upload/{session_id}",
  "chunk_size": 1048576,
  "total_chunks": 5,
  "expires_at": "2023-01-01T01:00:00"
}
```

**Headers:**
- `X-Upload-Session-ID`: Session identifier
- `X-Chunk-Size`: Chunk size in bytes
- `X-Total-Chunks`: Total number of chunks

### 2. Upload Video Chunk

**POST** `/api/v1/media/upload/{session_id}/chunk/{chunk_number}`

Uploads a single chunk of the video file.

**Path Parameters:**
- `session_id`: Upload session identifier
- `chunk_number`: Zero-based chunk index

**Request Body (Form Data):**
- `file` (file, required): Chunk data
- `chunk_hash` (string, optional): SHA-256 hash of chunk data

**Response:**
```json
{
  "session_id": "uuid-string",
  "chunk_number": 0,
  "status": "uploaded",
  "uploaded_chunks": [0, 1, 2],
  "remaining_chunks": [3, 4],
  "progress_percent": 60.0
}
```

### 3. Complete Video Upload

**POST** `/api/v1/media/upload/{session_id}/complete`

Completes the upload by assembling chunks and generating streaming URL.

**Path Parameters:**
- `session_id`: Upload session identifier

**Request Body (Form Data):**
- `file_hash` (string, optional): Final file hash for verification

**Response:**
```json
{
  "media_id": "uuid-string",
  "streaming_url": "/api/v1/media/stream/{media_id}",
  "file_size": 5000000,
  "duration_seconds": 30.0,
  "mime_type": "video/mp4",
  "completed_at": "2023-01-01T00:30:00"
}
```

**Headers:**
- `X-Media-ID`: Generated media identifier
- `X-Streaming-URL`: Streaming URL for the media

### 4. Stream Video

**GET** `/api/v1/media/stream/{media_id}`

Streams video content with range request support for progressive download.

**Path Parameters:**
- `media_id`: Media identifier

**Headers (Optional):**
- `Range`: Byte range for partial content (e.g., "bytes=0-1023")

**Response:**
- Content-Type: Video MIME type
- Accept-Ranges: bytes
- Content-Length: Content size
- Content-Range: Byte range (for partial content)
- Cache-Control: public, max-age=3600

**Status Codes:**
- 200: Full content
- 206: Partial content (range request)
- 404: Media not found

### 5. Get Media Information

**GET** `/api/v1/media/info/{media_id}`

Retrieves metadata about a media file.

**Path Parameters:**
- `media_id`: Media identifier

**Response:**
```json
{
  "media_id": "uuid-string",
  "filename": "original_video.mp4",
  "file_size": 5000000,
  "mime_type": "video/mp4",
  "created_at": "2023-01-01T00:00:00",
  "modified_at": "2023-01-01T00:00:00"
}
```

### 6. Delete Media

**DELETE** `/api/v1/media/delete/{media_id}`

Deletes a media file (with authorization check).

**Path Parameters:**
- `media_id`: Media identifier

**Response:**
```json
{
  "message": "Media deleted successfully"
}
```

### 7. Validate Video File

**POST** `/api/v1/media/validate`

Validates video file before upload initiation.

**Request Body (Form Data):**
- `filename` (string, required): Filename with extension
- `file_size` (integer, required): File size in bytes

**Response:**
```json
{
  "valid": true,
  "mime_type": "video/mp4",
  "file_extension": ".mp4"
}
```

Or for invalid files:
```json
{
  "valid": false,
  "error": "Invalid file extension .txt. Allowed: {'.mp4', '.webm', '.ogg', '.avi', '.mov'}"
}
```

### 8. Get Upload Status

**GET** `/api/v1/media/upload/{session_id}/status`

Gets the current status of an upload session.

**Path Parameters:**
- `session_id`: Upload session identifier

**Response:**
```json
{
  "session_id": "uuid-string",
  "status": "in_progress",
  "progress_percent": 60.0,
  "uploaded_chunks": [0, 1, 2],
  "remaining_chunks": [3, 4],
  "created_at": "2023-01-01T00:00:00",
  "updated_at": "2023-01-01T00:15:00"
}
```

### 9. Cancel Upload

**DELETE** `/api/v1/media/upload/{session_id}`

Cancels an active upload session.

**Path Parameters:**
- `session_id`: Upload session identifier

**Response:**
```json
{
  "message": "Upload cancelled successfully"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- **400 Bad Request**: Validation errors, invalid parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Access denied to resource
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side errors

Error response format:
```json
{
  "detail": "Error message describing the issue"
}
```

## File Validation

### Supported Video Formats
- MP4 (video/mp4)
- WebM (video/webm)
- OGG (video/ogg)
- AVI (video/avi)
- MOV (video/mov)

### Limits
- Maximum file size: 100MB
- Maximum duration: 5 minutes (300 seconds)
- Maximum chunk size: 10MB
- Default chunk size: 1MB

## Security Features

1. **Authentication**: All endpoints require valid authentication
2. **File validation**: Strict MIME type and extension checking
3. **Size limits**: Enforced file and chunk size limits
4. **Hash verification**: Optional integrity checking with SHA-256
5. **Session isolation**: Users can only access their own upload sessions
6. **Rate limiting**: Upload rate limiting per user
7. **Secure streaming**: Range request support for efficient streaming

## Usage Example

```python
import requests

# 1. Validate file
validation = requests.post(
    "http://localhost:8000/api/v1/media/validate",
    data={"filename": "video.mp4", "file_size": 5000000},
    headers={"Authorization": "Bearer your_token"}
)

# 2. Initiate upload
initiate = requests.post(
    "http://localhost:8000/api/v1/media/upload/initiate",
    data={
        "filename": "video.mp4",
        "file_size": 5000000,
        "duration_seconds": 30.0,
        "mime_type": "video/mp4"
    },
    headers={"Authorization": "Bearer your_token"}
)

session_id = initiate.json()["session_id"]

# 3. Upload chunks (example for first chunk)
with open("video.mp4", "rb") as f:
    chunk_data = f.read(1048576)  # 1MB chunk
    
chunk_upload = requests.post(
    f"http://localhost:8000/api/v1/media/upload/{session_id}/chunk/0",
    files={"file": chunk_data},
    headers={"Authorization": "Bearer your_token"}
)

# 4. Complete upload
complete = requests.post(
    f"http://localhost:8000/api/v1/media/upload/{session_id}/complete",
    headers={"Authorization": "Bearer your_token"}
)

media_id = complete.json()["media_id"]

# 5. Stream video
stream_url = f"http://localhost:8000/api/v1/media/stream/{media_id}"
```

## CDN & Global Delivery Endpoints

### 10. Generate CDN Signed URL

**POST** `/api/v1/media/cdn/signed-url/{media_id}`

Generates a CloudFront signed URL for secure global delivery.

**Path Parameters:**
- `media_id`: Media identifier

**Request Body:**
```json
{
  "expires_in": 7200
}
```

**Response:**
```json
{
  "signed_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=...",
  "expires_in": 7200,
  "expires_at": "2024-01-01T14:00:00Z",
  "cloud_key": "media/user123/video456/video.mp4",
  "delivery_type": "cdn_signed",
  "optimization": {
    "cdn_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4",
    "cache_control": "public, max-age=43200",
    "optimizations": ["mobile_cache_optimization", "mobile_user_agent_detected"]
  },
  "supports_range": true,
  "global_delivery": true
}
```

### 11. Get Optimized Streaming URL

**GET** `/api/v1/media/optimized/{media_id}?device_type=mobile&prefer_signed=true`

Returns the best streaming URL based on client capabilities and CDN availability.

**Path Parameters:**
- `media_id`: Media identifier

**Query Parameters:**
- `device_type`: Device type (mobile, tablet, desktop)
- `prefer_signed`: Whether to prefer signed URLs (default: true)

**Response:**
```json
{
  "streaming_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=...",
  "delivery_type": "cdn_signed",
  "optimization": {
    "suggested_formats": ["video/mp4", "video/webm"],
    "cache_control": "public, max-age=43200"
  },
  "global_delivery": true,
  "supports_range": true
}
```

### 12. Invalidate CDN Cache

**POST** `/api/v1/media/cdn/invalidate/{media_id}`

Invalidates CDN cache for specific media (admin only).

**Path Parameters:**
- `media_id`: Media identifier

**Response:**
```json
{
  "message": "CDN cache invalidated for media video456",
  "media_id": "video456",
  "invalidated_at": "2024-01-01T12:00:00Z"
}
```

### 13. CDN Health Check

**GET** `/api/v1/media/cdn/health`

Checks CDN service health and configuration.

**Response:**
```json
{
  "cdn_configured": true,
  "cdn_enabled": true,
  "distribution_id": true,
  "private_key_configured": true,
  "key_pair_configured": true,
  "signed_urls_available": true,
  "cloud_storage_enabled": true,
  "overall_status": "healthy",
  "distribution_status": "Deployed",
  "distribution_enabled": true,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 14. Global Delivery Statistics

**GET** `/api/v1/media/cdn/stats`

Get CDN analytics and performance metrics (admin only).

**Response:**
```json
{
  "cdn_enabled": true,
  "distribution": {
    "id": "E123456789ABCD",
    "domain_name": "d123456789.cloudfront.net",
    "status": "Deployed",
    "enabled": true,
    "origins": [
      {
        "id": "S3-mybucket",
        "domain_name": "mybucket.s3.amazonaws.com",
        "origin_path": ""
      }
    ],
    "cache_behaviors": 1,
    "price_class": "PriceClass_All"
  },
  "analytics": {
    "distribution_id": "E123456789ABCD",
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-02T00:00:00Z"
    },
    "metrics": {
      "requests": "N/A - Requires CloudWatch integration",
      "bytes_downloaded": "N/A - Requires CloudWatch integration",
      "cache_hit_rate": "N/A - Requires CloudWatch integration"
    }
  },
  "edge_locations": ["us-east-1", "eu-west-1", "ap-southeast-1"],
  "cache_settings": {
    "default_ttl": "public, max-age=86400",
    "signed_url_expiry": 7200
  }
}
```

## CDN Configuration

To enable CDN features, configure the following environment variables:

```bash
# CDN Configuration
CDN_BASE_URL=https://d123456789.cloudfront.net
CDN_DISTRIBUTION_ID=E123456789ABCD
CDN_PRIVATE_KEY_PATH=/path/to/cloudfront-private-key.pem
CDN_KEY_PAIR_ID=KEYPAIRID123
ENABLE_GLOBAL_CDN=true

# Cache Settings
CDN_CACHE_CONTROL=public, max-age=86400
CDN_SIGNED_URL_EXPIRY=7200
```

See `CDN_INTEGRATION_GUIDE.md` for detailed setup instructions.

## Performance Benefits

### Global Delivery
- **Reduced Latency**: Content served from edge locations closest to users
- **Improved Throughput**: CDN edge servers optimized for media delivery
- **Bandwidth Optimization**: Automatic compression and format optimization

### Device Optimization
- **Mobile**: 12-hour cache, optimized formats (MP4, WebM)
- **Desktop**: 24-hour cache, extended format support
- **Adaptive Streaming**: Format recommendations based on client capabilities

### Security Features
- **Signed URLs**: Time-limited access with cryptographic signatures
- **IP Restrictions**: Optional geographic or network-based access control
- **Secure Headers**: CORS and security headers for cross-origin access```