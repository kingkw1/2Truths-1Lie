# Merged Video Challenge Creation API Documentation

## Overview

The Challenge Creation API (`POST /api/v1/challenges/`) fully supports creating challenges with merged videos and segment timecodes. This allows clients to upload a single merged video file containing all three statements and provide metadata about where each statement segment is located within the merged video.

## API Endpoint

```
POST /api/v1/challenges/
```

**Authentication**: Required (JWT token)

## Request Format

### Basic Challenge Request

```json
{
  "title": "My Challenge Title",
  "statements": [
    {"media_file_id": "upload-session-1", "duration_seconds": 8.5},
    {"media_file_id": "upload-session-2", "duration_seconds": 8.7},
    {"media_file_id": "upload-session-3", "duration_seconds": 7.8}
  ],
  "lie_statement_index": 1,
  "tags": ["fun", "creative"],
  "is_merged_video": false
}
```

### Merged Video Challenge Request

```json
{
  "title": "My Merged Video Challenge",
  "statements": [
    {"media_file_id": "upload-session-1", "duration_seconds": 8.5},
    {"media_file_id": "upload-session-2", "duration_seconds": 8.7},
    {"media_file_id": "upload-session-3", "duration_seconds": 7.8}
  ],
  "lie_statement_index": 1,
  "tags": ["fun", "creative"],
  "is_merged_video": true,
  "merged_video_metadata": {
    "total_duration": 25.0,
    "segments": [
      {
        "start_time": 0.0,
        "end_time": 8.5,
        "duration": 8.5,
        "statement_index": 0
      },
      {
        "start_time": 8.5,
        "end_time": 17.2,
        "duration": 8.7,
        "statement_index": 1
      },
      {
        "start_time": 17.2,
        "end_time": 25.0,
        "duration": 7.8,
        "statement_index": 2
      }
    ],
    "video_file_id": "merged-video-abc123",
    "compression_applied": true,
    "original_total_duration": 30.0
  }
}
```

## Request Fields

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Optional challenge title (max 200 chars) |
| `statements` | array | Yes | Array of exactly 3 statement objects |
| `lie_statement_index` | integer | Yes | Index (0-2) of the lie statement |
| `tags` | array | No | Optional tags for categorization (max 10) |
| `is_merged_video` | boolean | No | Whether this uses a merged video (default: false) |

### Statement Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `media_file_id` | string | Yes | Upload session ID from media upload |
| `duration_seconds` | number | Yes | Duration of the statement video |

### Merged Video Metadata

Required when `is_merged_video` is `true`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `total_duration` | number | Yes | Total duration of merged video in seconds |
| `segments` | array | Yes | Array of exactly 3 segment objects |
| `video_file_id` | string | Yes | File ID of the merged video |
| `compression_applied` | boolean | No | Whether compression was applied (default: false) |
| `original_total_duration` | number | No | Original duration before compression |

### Video Segment Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_time` | number | Yes | Start time in seconds within merged video |
| `end_time` | number | Yes | End time in seconds within merged video |
| `duration` | number | Yes | Duration of segment in seconds |
| `statement_index` | integer | Yes | Index of the statement (0, 1, or 2) |

## Validation Rules

### Merged Video Validation

1. **Segment Count**: Must have exactly 3 segments
2. **Statement Indices**: Must include indices 0, 1, and 2 (one for each statement)
3. **Time Consistency**: `end_time` must be greater than `start_time`
4. **Duration Accuracy**: `duration` must match `end_time - start_time` (within 0.1s tolerance)
5. **No Overlaps**: Segments cannot overlap in time
6. **Total Duration**: Last segment's `end_time` must match `total_duration`

### General Validation

1. **Statement Count**: Must have exactly 3 statements
2. **Lie Index**: `lie_statement_index` must be 0, 1, or 2
3. **Upload Sessions**: All `media_file_id` values must reference completed upload sessions
4. **Authentication**: Valid JWT token required

## Response Format

### Success Response (201 Created)

```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "creator_id": "user-123",
  "title": "My Merged Video Challenge",
  "statements": [
    {
      "statement_id": "stmt-1",
      "statement_type": "truth",
      "media_url": "/api/v1/media/stream/media-123",
      "media_file_id": "upload-session-1",
      "streaming_url": "https://cdn.example.com/video/media-123.mp4",
      "cloud_storage_key": "videos/media-123.mp4",
      "storage_type": "cloud",
      "duration_seconds": 8.5,
      "segment_metadata": {
        "start_time": 0.0,
        "end_time": 8.5,
        "duration": 8.5,
        "statement_index": 0
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
    // ... 2 more statements
  ],
  "lie_statement_id": "stmt-2",
  "status": "draft",
  "tags": ["fun", "creative"],
  "is_merged_video": true,
  "merged_video_metadata": {
    "total_duration": 25.0,
    "segments": [
      {
        "start_time": 0.0,
        "end_time": 8.5,
        "duration": 8.5,
        "statement_index": 0
      },
      {
        "start_time": 8.5,
        "end_time": 17.2,
        "duration": 8.7,
        "statement_index": 1
      },
      {
        "start_time": 17.2,
        "end_time": 25.0,
        "duration": 7.8,
        "statement_index": 2
      }
    ],
    "video_file_id": "merged-video-abc123",
    "compression_applied": true,
    "original_total_duration": 30.0
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "view_count": 0,
  "guess_count": 0,
  "correct_guess_count": 0
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "detail": "Merged video must have segments for indices 0, 1, 2. Got: {0, 1}"
}
```

#### 400 Bad Request - Missing Metadata

```json
{
  "detail": "Merged video metadata is required when is_merged_video is True"
}
```

#### 400 Bad Request - Segment Overlap

```json
{
  "detail": "Segments 0 and 1 overlap"
}
```

#### 401 Unauthorized

```json
{
  "detail": "Not authenticated"
}
```

## Related Endpoints

### Get Segment Metadata

```
GET /api/v1/challenges/{challenge_id}/segments
```

Retrieves segment metadata for playback purposes.

**Response:**
```json
{
  "is_merged_video": true,
  "total_duration": 25.0,
  "segments": [
    {
      "statement_id": "stmt-1",
      "statement_index": 0,
      "start_time": 0.0,
      "end_time": 8.5,
      "duration": 8.5,
      "statement_type": "truth"
    }
    // ... 2 more segments
  ],
  "video_file_id": "merged-video-abc123",
  "compression_applied": true
}
```

### Get Challenge Stats

```
GET /api/v1/challenges/{challenge_id}/stats
```

Includes merged video information in stats.

**Response:**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "view_count": 42,
  "guess_count": 15,
  "correct_guess_count": 8,
  "accuracy_rate": 0.533,
  "status": "published",
  "created_at": "2024-01-15T10:30:00Z",
  "published_at": "2024-01-15T10:35:00Z",
  "is_merged_video": true,
  "has_segment_metadata": true
}
```

## Usage Examples

### JavaScript/TypeScript Client

```typescript
interface MergedVideoMetadata {
  total_duration: number;
  segments: VideoSegment[];
  video_file_id: string;
  compression_applied?: boolean;
  original_total_duration?: number;
}

interface VideoSegment {
  start_time: number;
  end_time: number;
  duration: number;
  statement_index: number;
}

interface CreateChallengeRequest {
  title?: string;
  statements: Array<{
    media_file_id: string;
    duration_seconds: number;
  }>;
  lie_statement_index: number;
  tags?: string[];
  is_merged_video?: boolean;
  merged_video_metadata?: MergedVideoMetadata;
}

// Create a merged video challenge
const createMergedVideoChallenge = async (
  uploadSessionIds: string[],
  segmentTimecodes: VideoSegment[],
  mergedVideoFileId: string
): Promise<Challenge> => {
  const request: CreateChallengeRequest = {
    title: "My Merged Video Challenge",
    statements: uploadSessionIds.map((id, index) => ({
      media_file_id: id,
      duration_seconds: segmentTimecodes[index].duration
    })),
    lie_statement_index: 1,
    tags: ["merged-video"],
    is_merged_video: true,
    merged_video_metadata: {
      total_duration: segmentTimecodes[segmentTimecodes.length - 1].end_time,
      segments: segmentTimecodes,
      video_file_id: mergedVideoFileId,
      compression_applied: true
    }
  };

  const response = await fetch('/api/v1/challenges/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Challenge creation failed: ${response.statusText}`);
  }

  return response.json();
};
```

### Python Client

```python
import requests
from typing import List, Dict, Any

def create_merged_video_challenge(
    auth_token: str,
    upload_session_ids: List[str],
    segment_timecodes: List[Dict[str, Any]],
    merged_video_file_id: str,
    title: str = "My Merged Video Challenge"
) -> Dict[str, Any]:
    """Create a challenge with merged video and segment timecodes"""
    
    request_data = {
        "title": title,
        "statements": [
            {
                "media_file_id": upload_id,
                "duration_seconds": segment["duration"]
            }
            for upload_id, segment in zip(upload_session_ids, segment_timecodes)
        ],
        "lie_statement_index": 1,
        "tags": ["merged-video"],
        "is_merged_video": True,
        "merged_video_metadata": {
            "total_duration": segment_timecodes[-1]["end_time"],
            "segments": segment_timecodes,
            "video_file_id": merged_video_file_id,
            "compression_applied": True
        }
    }
    
    response = requests.post(
        "/api/v1/challenges/",
        json=request_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    response.raise_for_status()
    return response.json()

# Example usage
segment_timecodes = [
    {"start_time": 0.0, "end_time": 8.5, "duration": 8.5, "statement_index": 0},
    {"start_time": 8.5, "end_time": 17.2, "duration": 8.7, "statement_index": 1},
    {"start_time": 17.2, "end_time": 25.0, "duration": 7.8, "statement_index": 2}
]

challenge = create_merged_video_challenge(
    auth_token="your-jwt-token",
    upload_session_ids=["session-1", "session-2", "session-3"],
    segment_timecodes=segment_timecodes,
    merged_video_file_id="merged-video-123"
)
```

## Implementation Status

✅ **COMPLETED**: The challenge creation API fully supports merged video and segment timecodes

- ✅ API endpoint accepts `merged_video_metadata` in request
- ✅ Backend validates segment metadata consistency
- ✅ Challenge service stores segment information
- ✅ Segment metadata retrieval endpoint available
- ✅ Challenge stats include merged video information
- ✅ Full backward compatibility with non-merged video challenges
- ✅ Comprehensive validation and error handling
- ✅ Integration tests passing

The API is ready for mobile clients to use for creating challenges with merged videos and segment timecodes.