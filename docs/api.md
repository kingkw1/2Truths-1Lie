# 📋 API Documentation

## Overview
RESTful API documentation for the 2Truths-1Lie backend server. All endpoints are optimized for mobile usage with efficient data transfer and offline-first capabilities.

## Base URL
- **Development**: `http://192.168.50.111:8001/api/v1`
- **Production (Railway)**: `https://2truths-1lie-production.up.railway.app/api/v1`

## Interactive Documentation
The deployed backend provides comprehensive interactive documentation:

- **Swagger UI**: https://2truths-1lie-production.up.railway.app/docs
  - Interactive API testing and exploration
  - Request/response examples
  - Authentication testing
  
- **ReDoc**: https://2truths-1lie-production.up.railway.app/redoc  
  - Clean, readable documentation
  - Detailed schema information

- **OpenAPI Spec**: https://2truths-1lie-production.up.railway.app/openapi.json
  - Machine-readable API specification

## Authentication
Most endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

## 🔐 Authentication Endpoints

### POST `/auth/register`
Register a new user account.

**Request:**
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "user_123",
    "username": "user123",
    "email": "user@example.com"
  }
}
```

### POST `/auth/login`
Authenticate existing user.

**Request:**
```json
{
  "username": "user123",
  "password": "securepassword"
}
```

**Response:** Same as register

### POST `/auth/refresh`
Refresh expired JWT token.

**Request:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

## 📁 Media Upload Endpoints

### POST `/media/upload/start`
Initialize chunked upload session.

**Request:**
```json
{
  "filename": "video_statement_1.mp4",
  "file_size": 5242880,
  "chunk_size": 1048576,
  "file_hash": "sha256_hash",
  "media_type": "video"
}
```

**Response:**
```json
{
  "upload_session_id": "upload_123456",
  "chunk_urls": [
    "https://signed-url-chunk-1",
    "https://signed-url-chunk-2"
  ],
  "total_chunks": 5
}
```

### POST `/media/upload/chunk`
Upload individual file chunk.

**Request:** Binary chunk data to signed URL

**Response:**
```json
{
  "chunk_number": 1,
  "status": "uploaded",
  "etag": "chunk_etag"
}
```

### POST `/media/upload/complete`
Complete chunked upload and finalize file.

**Request:**
```json
{
  "upload_session_id": "upload_123456",
  "chunks": [
    {"chunk_number": 1, "etag": "etag1"},
    {"chunk_number": 2, "etag": "etag2"}
  ]
}
```

**Response:**
```json
{
  "media_file_id": "media_789",
  "url": "https://cdn.example.com/video.mp4",
  "duration_seconds": 10.5,
  "file_size": 5242880,
  "status": "ready"
}
```

### GET `/media/{media_file_id}`
Get media file information.

**Response:**
```json
{
  "media_file_id": "media_789",
  "url": "https://cdn.example.com/video.mp4",
  "thumbnail_url": "https://cdn.example.com/thumb.jpg",
  "duration_seconds": 10.5,
  "file_size": 5242880,
  "media_type": "video",
  "created_at": "2025-09-10T12:00:00Z"
}
```

## 🎬 Video Processing Endpoints

### POST `/merged-video/create`
Create merged video from multiple statement videos.

**Request:**
```json
{
  "video_files": [
    {"media_file_id": "media_1", "statement_index": 0},
    {"media_file_id": "media_2", "statement_index": 1},
    {"media_file_id": "media_3", "statement_index": 2}
  ],
  "merge_config": {
    "transition_duration": 0.5,
    "output_quality": "high"
  }
}
```

**Response:**
```json
{
  "merged_video_id": "merged_456",
  "status": "processing",
  "estimated_completion": "2025-09-10T12:05:00Z"
}
```

### GET `/merged-video/{merged_video_id}`
Get merged video information and segment metadata.

**Response:**
```json
{
  "merged_video_id": "merged_456",
  "url": "https://cdn.example.com/merged_video.mp4",
  "status": "ready",
  "total_duration": 31.5,
  "segments": [
    {
      "statement_index": 0,
      "start_time": 0.0,
      "end_time": 10.5,
      "media_file_id": "media_1"
    },
    {
      "statement_index": 1,
      "start_time": 11.0,
      "end_time": 23.0,
      "media_file_id": "media_2"
    },
    {
      "statement_index": 2,
      "start_time": 23.5,
      "end_time": 32.0,
      "media_file_id": "media_3"
    }
  ],
  "created_at": "2025-09-10T12:00:00Z"
}
```

## 🎮 Challenge Endpoints

### POST `/challenges`
Create a new challenge.

**Request:**
```json
{
  "title": "My Challenge",
  "statements": [
    {
      "text": "I once met a celebrity",
      "media_file_id": "media_1",
      "duration_seconds": 10.5
    },
    {
      "text": "I can speak 5 languages",
      "media_file_id": "media_2",
      "duration_seconds": 12.0
    },
    {
      "text": "I've been to space",
      "media_file_id": "media_3",
      "duration_seconds": 8.5
    }
  ],
  "lie_statement_index": 2,
  "merged_video_id": "merged_456",
  "tags": ["personal", "funny"],
  "is_public": true
}
```

**Response:**
```json
{
  "challenge_id": "challenge_789",
  "title": "My Challenge",
  "status": "published",
  "created_at": "2025-09-10T12:00:00Z",
  "creator": {
    "user_id": "user_123",
    "username": "user123"
  },
  "video_url": "https://cdn.example.com/merged_video.mp4",
  "segments": [...] // Same as merged video segments
}
```

### GET `/challenges`
List public challenges with pagination.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `tags` (comma-separated)
- `sort` (newest, popular, trending)

**Response:**
```json
{
  "challenges": [
    {
      "challenge_id": "challenge_789",
      "title": "My Challenge",
      "creator_username": "user123",
      "thumbnail_url": "https://cdn.example.com/thumb.jpg",
      "tags": ["personal", "funny"],
      "stats": {
        "total_guesses": 25,
        "correct_guesses": 8,
        "success_rate": 0.32
      },
      "created_at": "2025-09-10T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "has_next": true
  }
}
```

### GET `/challenges/{challenge_id}`
Get detailed challenge information.

**Response:**
```json
{
  "challenge_id": "challenge_789",
  "title": "My Challenge",
  "creator": {
    "user_id": "user_123",
    "username": "user123"
  },
  "statements": [
    {
      "statement_index": 0,
      "text": "I once met a celebrity"
    },
    {
      "statement_index": 1,
      "text": "I can speak 5 languages"
    },
    {
      "statement_index": 2,
      "text": "I've been to space"
    }
  ],
  "video_url": "https://cdn.example.com/merged_video.mp4",
  "segments": [...],
  "stats": {
    "total_guesses": 25,
    "correct_guesses": 8,
    "success_rate": 0.32
  },
  "tags": ["personal", "funny"],
  "created_at": "2025-09-10T12:00:00Z"
}
```

### POST `/challenges/{challenge_id}/guess`
Submit a guess for a challenge.

**Request:**
```json
{
  "guessed_lie_index": 1,
  "confidence": 0.8,
  "reasoning": "The voice seemed nervous on statement 2"
}
```

**Response:**
```json
{
  "guess_id": "guess_456",
  "correct": false,
  "actual_lie_index": 2,
  "points_earned": 0,
  "feedback": {
    "message": "Good try! The lie was actually statement 3.",
    "explanation": "Statement 2 was true - they really do speak 5 languages!"
  },
  "stats": {
    "your_success_rate": 0.65,
    "challenge_success_rate": 0.32
  }
}
```

## 📊 Analytics Endpoints

### GET `/analytics/user/stats`
Get user performance statistics.

**Response:**
```json
{
  "user_stats": {
    "challenges_created": 15,
    "total_guesses": 120,
    "correct_guesses": 78,
    "success_rate": 0.65,
    "points_earned": 1560,
    "rank": "Expert Detector"
  },
  "recent_activity": [
    {
      "activity_type": "guess",
      "challenge_id": "challenge_789",
      "correct": true,
      "points": 50,
      "timestamp": "2025-09-10T11:30:00Z"
    }
  ]
}
```

## 🔧 Utility Endpoints

### GET `/health`
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-10T12:00:00Z",
  "version": "1.0.0"
}
```

### GET `/health/database`
Database connectivity check.

### GET `/health/s3`
S3 storage connectivity check.

## 📱 Mobile-Specific Considerations

### Offline Support
- Media files cached locally until upload possible
- Challenge data stored in AsyncStorage
- Queue system for pending operations

### Error Handling
All endpoints return consistent error format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "statements",
      "reason": "Must contain exactly 3 statements"
    }
  },
  "timestamp": "2025-09-10T12:00:00Z"
}
```

### Rate Limiting
- Authentication: 5 requests/minute
- Media Upload: 10 uploads/hour
- Challenge Creation: 5 challenges/hour
- Guessing: 100 guesses/hour

## 🔗 Related Documentation
- [Backend Development Guide](BACKEND_GUIDE.md)
- [Mobile Development Guide](MOBILE_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)
