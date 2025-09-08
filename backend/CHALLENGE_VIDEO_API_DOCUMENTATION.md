# Challenge Video API Documentation

## Overview

The Challenge Video API provides endpoints for uploading multiple videos that will be merged server-side using FFmpeg. This API supports the new server-side video processing workflow where clients upload 3 separate video files that are then merged into a single video with segment metadata.

## Base URL

```
/api/v1/challenge-videos
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Initiate Multi-Video Upload

**POST** `/upload-for-merge/initiate`

Initiates a multi-video upload session for server-side merging.

#### Request Parameters (Form Data)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_count` | integer | Yes | Number of videos (must be 3) |
| `video_filenames` | string | Yes | JSON array of filenames |
| `video_file_sizes` | string | Yes | JSON array of file sizes in bytes |
| `video_durations` | string | Yes | JSON array of durations in seconds |
| `video_mime_types` | string | Yes | JSON array of MIME types |
| `challenge_title` | string | No | Optional challenge title |

#### Example Request

```bash
curl -X POST "/api/v1/challenge-videos/upload-for-merge/initiate" \
  -H "Authorization: Bearer <token>" \
  -F "video_count=3" \
  -F 'video_filenames=["statement1.mp4", "statement2.mp4", "statement3.mp4"]' \
  -F 'video_file_sizes=[5000000, 4500000, 5500000]' \
  -F 'video_durations=[15.0, 12.5, 18.2]' \
  -F 'video_mime_types=["video/mp4", "video/mp4", "video/mp4"]' \
  -F "challenge_title=My Challenge"
```

#### Response

```json
{
  "merge_session_id": "uuid-string",
  "upload_sessions": [
    {
      "video_index": 0,
      "session_id": "uuid-string",
      "filename": "statement1.mp4",
      "file_size": 5000000,
      "duration_seconds": 15.0,
      "upload_url": "/api/v1/challenge-videos/upload/{session_id}/chunk",
      "chunk_size": 1048576,
      "total_chunks": 5
    },
    // ... 2 more sessions
  ],
  "total_videos": 3,
  "total_duration_seconds": 45.7,
  "total_file_size_bytes": 15000000,
  "estimated_merge_time_seconds": 34.28,
  "status": "initiated",
  "created_at": "2024-01-01T12:00:00Z"
}
```

### 2. Upload Video Chunk

**POST** `/upload/{session_id}/chunk/{chunk_number}`

Uploads a video chunk for a merge session.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Upload session ID |
| `chunk_number` | integer | Chunk number (0-based) |

#### Request Body (Multipart Form)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Chunk data |
| `chunk_hash` | string | No | SHA-256 hash of chunk |

#### Response

```json
{
  "session_id": "uuid-string",
  "merge_session_id": "uuid-string",
  "video_index": 0,
  "chunk_number": 1,
  "status": "uploaded",
  "uploaded_chunks": [0, 1],
  "remaining_chunks": [2, 3, 4],
  "progress_percent": 40.0,
  "updated_at": "2024-01-01T12:00:00Z"
}
```

### 3. Complete Video Upload

**POST** `/upload/{session_id}/complete`

Completes the upload of a single video within a merge session.

#### Request Body (Form Data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_hash` | string | No | SHA-256 hash for verification |

#### Response

```json
{
  "session_id": "uuid-string",
  "merge_session_id": "uuid-string",
  "video_index": 0,
  "video_count": 3,
  "status": "completed",
  "file_path": "/path/to/uploaded/file",
  "file_size": 5000000,
  "completed_at": "2024-01-01T12:00:00Z",
  "ready_for_merge": true,
  "merge_status": "pending"
}
```

### 4. Get Upload Status

**GET** `/upload/{session_id}/status`

Gets the status of a specific video upload session.

#### Response

```json
{
  "session_id": "uuid-string",
  "merge_session_id": "uuid-string",
  "video_index": 0,
  "video_count": 3,
  "is_merge_video": true,
  "filename": "statement1.mp4",
  "file_size": 5000000,
  "status": "in_progress",
  "progress_percent": 60.0,
  "uploaded_chunks": [0, 1, 2],
  "remaining_chunks": [3, 4],
  "total_chunks": 5,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:05:00Z",
  "completed_at": null
}
```

### 5. Get Merge Session Status

**GET** `/merge-session/{merge_session_id}/status`

Gets the overall status of a merge session including all videos.

#### Response

```json
{
  "merge_session_id": "uuid-string",
  "overall_status": "partially_uploaded",
  "overall_progress_percent": 60.0,
  "total_videos": 3,
  "completed_videos": 1,
  "failed_videos": 0,
  "videos": [
    {
      "session_id": "uuid-string",
      "video_index": 0,
      "filename": "statement1.mp4",
      "status": "completed",
      "progress_percent": 100.0,
      "completed_at": "2024-01-01T12:05:00Z"
    },
    // ... other videos
  ],
  "ready_for_merge": false,
  "merge_triggered": false
}
```

### 6. Cancel Video Upload

**DELETE** `/upload/{session_id}`

Cancels a specific video upload session.

#### Response

```json
{
  "message": "Video upload cancelled successfully",
  "session_id": "uuid-string",
  "merge_session_id": "uuid-string",
  "video_index": 0
}
```

### 7. Cancel Merge Session

**DELETE** `/merge-session/{merge_session_id}`

Cancels an entire merge session and all associated video uploads.

#### Response

```json
{
  "message": "Merge session cancelled successfully",
  "merge_session_id": "uuid-string",
  "total_sessions": 3,
  "cancelled_sessions": 3
}
```

## Status Values

### Upload Status
- `pending` - Upload session created but no chunks uploaded
- `in_progress` - Some chunks uploaded
- `completed` - All chunks uploaded and file assembled
- `failed` - Upload failed
- `cancelled` - Upload cancelled by user

### Overall Merge Status
- `uploading` - Videos are still being uploaded
- `partially_uploaded` - Some videos completed, others in progress
- `ready_for_merge` - All videos uploaded, ready for merging
- `failed` - One or more videos failed to upload

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Exactly 3 videos are required for challenge creation"
}
```

### 403 Forbidden
```json
{
  "detail": "Access denied to this upload session"
}
```

### 404 Not Found
```json
{
  "detail": "Upload session not found"
}
```

### 410 Gone
```json
{
  "detail": "Upload session has expired"
}
```

### 429 Too Many Requests
```json
{
  "detail": "User has reached maximum concurrent uploads limit"
}
```

## Validation Rules

### Video Count
- Must be exactly 3 videos
- All metadata arrays must have the same length

### File Size
- Each video: 0 < size ≤ 100MB (configurable)
- Total size: ≤ 300MB (3x single file limit)

### Duration
- Each video: 0 < duration ≤ 300 seconds (configurable)
- Total duration: ≤ 900 seconds (3x single duration limit)

### MIME Types
- Supported: `video/mp4`, `video/webm`, `video/ogg`, `video/avi`, `video/mov`

## Usage Flow

1. **Initiate Upload**: Call `/upload-for-merge/initiate` with video metadata
2. **Upload Chunks**: For each video, upload chunks using `/upload/{session_id}/chunk/{chunk_number}`
3. **Complete Videos**: Complete each video upload with `/upload/{session_id}/complete`
4. **Monitor Progress**: Check status with `/merge-session/{merge_session_id}/status`
5. **Merge Processing**: Once all videos are complete, server-side merge will be triggered (next task)

## Notes

- All uploads use chunked upload for reliability and resumability
- Merge session IDs are used to group related video uploads
- Video index (0-2) determines the order in the final merged video
- Estimated merge time is calculated based on total duration and file size
- Temporary files are cleaned up after successful upload completion
- Failed or cancelled uploads automatically clean up temporary files

## Next Steps

This endpoint prepares videos for merging. The actual FFmpeg merging logic will be implemented in the next task: "Develop backend logic to merge videos using FFmpeg asynchronously."