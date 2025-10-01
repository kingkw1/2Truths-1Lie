# 📋 API Documentation

## Overview
Production-ready RESTful API documentation for the **2Truths-1Lie** backend server. Built with **FastAPI** and optimized for React Native mobile clients with efficient video processing, challenge management, and RevenueCat monetization integration.

> **💰 RevenueCat Integration**: This API includes comprehensive monetization endpoints for subscription management, premium features, and revenue tracking as part of the RevenueCat Shipaton program. All endpoints have been validated against production mobile usage patterns.

## Base URLs
- **Production (Railway)**: `https://2truths-1lie-production.up.railway.app`
- **Development**: `http://localhost:8001`

## Interactive Documentation
The production backend provides comprehensive interactive API documentation:

- **🚀 Live Swagger UI**: https://2truths-1lie-production.up.railway.app/docs
  - Interactive API testing with real production data
  - Request/response examples with authentication
  - Schema validation and error handling demos
  
- **📖 ReDoc Documentation**: https://2truths-1lie-production.up.railway.app/redoc  
  - Clean, professional API documentation
  - Detailed schema and model information
  - Mobile-optimized responsive design

- **🔧 OpenAPI Specification**: https://2truths-1lie-production.up.railway.app/openapi.json
  - Machine-readable API specification for client generation

## Authentication
All protected endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

**Token Lifecycle:**
- **Access Token Duration**: 24 hours
- **Format**: JSON Web Token (JWT)
- **Encoding**: HS256 algorithm
- **Claims**: User ID, username, expiration

## 🔐 Authentication Endpoints

### POST `/api/auth/register`
Register a new user account for challenge creation and gameplay.

**Request Body:**
```json
{
  "username": "player123",
  "email": "player@example.com", 
  "password": "SecurePass123!"
}
```

**Success Response (201):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "player123",
    "email": "player@example.com"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data or username already exists
- `422 Unprocessable Entity`: Validation errors

### POST `/api/auth/login`
Authenticate existing user and receive access token.

**Request Body:**
```json
{
  "username": "player123",
  "password": "SecurePass123!"
}
```

**Success Response (200):** Same format as registration
**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `422 Unprocessable Entity`: Missing required fields

## 🎥 Video Processing Endpoints

### POST `/api/challenge-videos/upload`
Upload individual statement videos for challenge creation.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (Multipart):**
```
file: <video_file.mp4>  # Required: Video file (max 100MB)
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "statement_video.mp4",
  "size": 5242880,
  "duration": 8.5,
  "format": "mp4",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file format or corrupted video
- `413 Payload Too Large`: File exceeds 100MB limit
- `422 Unprocessable Entity`: Video validation failed

### POST `/api/challenge-videos/merge`
Merge three statement videos into a single challenge video with segment metadata.
**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "video_ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002", 
    "550e8400-e29b-41d4-a716-446655440003"
  ],
  "statements": [
    "I have traveled to 15 different countries",
    "I once met a famous celebrity at a coffee shop",
    "I can speak 4 languages fluently"
  ],
  "lie_index": 2
}
```

**Success Response (200):**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "merged_video_id": "550e8400-e29b-41d4-a716-446655440004",
  "segments": [
    {
      "start_time": 0.0,
      "end_time": 8.5,
      "statement_index": 0,
      "statement": "I have traveled to 15 different countries"
    },
    {
      "start_time": 8.5,
      "end_time": 17.0,
      "statement_index": 1,
      "statement": "I once met a famous celebrity at a coffee shop"
    },
    {
      "start_time": 17.0,
      "end_time": 25.5,
      "statement_index": 2,
      "statement": "I can speak 4 languages fluently"
    }
  ],
  "total_duration": 25.5,
  "created_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid video IDs or missing videos
- `422 Unprocessable Entity`: Video processing failed or FFmpeg error

### GET `/api/challenge-videos/{video_id}/download`
Download processed video file.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```
Content-Type: video/mp4
Content-Disposition: attachment; filename="challenge_video.mp4"
Content-Length: 15728640

<binary video data>
```

**Error Responses:**
- `404 Not Found`: Video does not exist
- `403 Forbidden`: No access to video

## 🎯 Challenge Management Endpoints

### GET `/api/challenges`
List all available challenges with pagination support.

**Query Parameters:**
```
page: integer = 1           # Page number (1-based)
per_page: integer = 10      # Items per page (max 50)
user_id: integer = null     # Filter by creator (optional)
```

**Success Response (200):**
```json
{
  "challenges": [
    {
      "id": 1,
      "creator": {
        "id": 1,
        "username": "player123"
      },
      "created_at": "2024-01-15T10:35:00Z",
      "statements": [
        "I have traveled to 15 different countries",
        "I once met a famous celebrity at a coffee shop", 
        "I can speak 4 languages fluently"
      ],
      "video_url": "/api/challenge-videos/550e8400-e29b-41d4-a716-446655440004/download",
      "segments": [
        {"start_time": 0.0, "end_time": 8.5, "statement_index": 0},
        {"start_time": 8.5, "end_time": 17.0, "statement_index": 1},
        {"start_time": 17.0, "end_time": 25.5, "statement_index": 2}
      ],
      "guesses": [],
      "total_duration": 25.5
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 1,
    "pages": 1
  }
}
```

### POST `/api/challenges`
Create a new challenge using merged video.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "merged_video_id": "550e8400-e29b-41d4-a716-446655440004"
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "creator": {
    "id": 1,
    "username": "player123"
  },
  "created_at": "2024-01-15T10:35:00Z",
  "statements": [
    "I have traveled to 15 different countries",
    "I once met a famous celebrity at a coffee shop",
    "I can speak 4 languages fluently"
  ],
  "video_url": "/api/challenge-videos/550e8400-e29b-41d4-a716-446655440004/download",
  "segments": [
    {"start_time": 0.0, "end_time": 8.5, "statement_index": 0},
    {"start_time": 8.5, "end_time": 17.0, "statement_index": 1},
    {"start_time": 17.0, "end_time": 25.5, "statement_index": 2}
  ],
  "guesses": [],
  "total_duration": 25.5
}
```

**Error Responses:**
- `400 Bad Request`: Invalid merged video ID
- `409 Conflict`: Challenge already exists for this video

### GET `/api/challenges/{challenge_id}`
Get specific challenge details.

**Success Response (200):** Same format as challenge list item
**Error Responses:**
- `404 Not Found`: Challenge does not exist

### POST `/api/challenges/{challenge_id}/guess`
Submit a guess for which statement is the lie.
**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "guess": 2,  # Index of the statement you think is the lie (0-based)
  "reasoning": "The claim about speaking 4 languages seems exaggerated"  # Optional
}
```

**Success Response (200):**
```json
{
  "guess_id": "550e8400-e29b-41d4-a716-446655440005",
  "challenge_id": 1,
  "user_id": 2,
  "guess": 2,
  "reasoning": "The claim about speaking 4 languages seems exaggerated",
  "is_correct": true,
  "submitted_at": "2024-01-15T11:00:00Z",
  "reveal": {
    "lie_index": 2,
    "lie_statement": "I can speak 4 languages fluently",
    "explanation": "I actually only speak 2 languages fluently"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid guess index (must be 0, 1, or 2)
- `404 Not Found`: Challenge does not exist
- `409 Conflict`: User has already guessed on this challenge

## 📊 Data Models

### User Model
```json
{
  "id": 1,
  "username": "player123",
  "email": "player@example.com",
  "created_at": "2024-01-15T09:00:00Z"
}
```

### Challenge Model
```json
{
  "id": 1,
  "creator": {
    "id": 1,
    "username": "player123"
  },
  "created_at": "2024-01-15T10:35:00Z",
  "statements": [
    "Statement 1 (Truth)",
    "Statement 2 (Truth)",
    "Statement 3 (Lie)"
  ],
  "lie_index": 2,
  "video_url": "/api/challenge-videos/{video_id}/download",
  "segments": [
    {"start_time": 0.0, "end_time": 8.5, "statement_index": 0},
    {"start_time": 8.5, "end_time": 17.0, "statement_index": 1},
    {"start_time": 17.0, "end_time": 25.5, "statement_index": 2}
  ],
  "total_duration": 25.5,
  "guesses": [
    {
      "user": {"id": 2, "username": "guesser456"},
      "guess": 2,
      "is_correct": true,
      "submitted_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### Video Model
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "statement_video.mp4",
  "size": 5242880,
  "duration": 8.5,
  "format": "mp4",
  "created_at": "2024-01-15T10:30:00Z",
  "upload_user_id": 1
}
```

## ⚠️ Error Handling

### Standard Error Response Format
```json
{
  "detail": "Error description",
  "error_code": "SPECIFIC_ERROR_CODE",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### Common HTTP Status Codes
- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data or parameters
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Valid token but insufficient permissions
- **404 Not Found**: Requested resource does not exist
- **409 Conflict**: Resource conflict (e.g., duplicate guess)
- **413 Payload Too Large**: File upload exceeds size limit
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server processing error

### Validation Errors (422)
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 8 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

## 🔧 Client Integration

### React Native Usage Example
```typescript
// Authentication
const loginUser = async (username: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  return data.access_token;
};

// Video Upload
const uploadVideo = async (videoUri: string, token: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: videoUri,
    type: 'video/mp4',
    name: 'statement.mp4',
  } as any);

  const response = await fetch(`${API_BASE_URL}/api/challenge-videos/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  return response.json();
};

// Challenge Creation
const createChallenge = async (videoIds: string[], statements: string[], lieIndex: number, token: string) => {
  const mergeResponse = await fetch(`${API_BASE_URL}/api/challenge-videos/merge`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_ids: videoIds,
      statements,
      lie_index: lieIndex,
    }),
  });

  const mergeData = await mergeResponse.json();
  
  const challengeResponse = await fetch(`${API_BASE_URL}/api/challenges`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merged_video_id: mergeData.merged_video_id,
    }),
  });

  return challengeResponse.json();
};
```

## 🚀 Performance Considerations

### Rate Limiting
- **Authentication Endpoints**: 10 requests per minute per IP
- **Video Upload**: 50MB per minute per user
- **Challenge Creation**: 5 challenges per hour per user
- **Guess Submission**: 100 guesses per hour per user

### Video Processing
- **Maximum File Size**: 100MB per video
- **Supported Formats**: MP4, MOV, AVI (converted to MP4)
- **Processing Time**: ~30 seconds for 3-video merge
- **Concurrent Processing**: 5 simultaneous merge operations

### Caching
- **Challenge List**: Cached for 5 minutes
- **Video Downloads**: CDN cached with 24-hour TTL
- **User Authentication**: Token validation cached for 1 minute

## 🔗 Related Documentation
- [Backend Development Guide](BACKEND_GUIDE.md) - Server setup and development
- [Mobile Integration Guide](MOBILE_GUIDE.md) - React Native client implementation
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md) - System architecture overview
- [Main README](../README.md) - Project overview and RevenueCat integration

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
