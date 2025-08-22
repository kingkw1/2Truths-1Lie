# Challenge API Documentation

This document describes the server-side APIs for receiving and storing challenges and media in the 2Truths-1Lie game.

## Overview

The Challenge API provides endpoints for:
- Creating challenges with video statements
- Publishing challenges for gameplay
- Browsing and retrieving challenges
- Submitting guesses and receiving feedback
- Managing user's own challenges

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header, except for:
- `GET /api/v1/challenges` (public challenge listing)
- `GET /api/v1/challenges/{challenge_id}` (public challenge viewing)

## Endpoints

### 1. Create Challenge

**POST** `/api/v1/challenges`

Creates a new challenge with three video statements.

**Request Body:**
```json
{
  "title": "My Challenge Title",
  "statements": [
    {
      "media_file_id": "upload-session-id-1",
      "duration_seconds": 10.5
    },
    {
      "media_file_id": "upload-session-id-2", 
      "duration_seconds": 12.0
    },
    {
      "media_file_id": "upload-session-id-3",
      "duration_seconds": 8.5
    }
  ],
  "lie_statement_index": 1,
  "tags": ["funny", "personal"]
}
```

**Response:**
```json
{
  "challenge_id": "uuid-string",
  "status": "draft",
  "created_at": "2024-01-01T12:00:00Z",
  "statements": [
    {
      "statement_id": "uuid-string",
      "statement_type": "truth",
      "media_url": "/api/v1/files/session-id_filename.mp4",
      "media_file_id": "upload-session-id-1",
      "duration_seconds": 10.5,
      "created_at": "2024-01-01T12:00:00Z"
    }
    // ... 2 more statements
  ]
}
```

### 2. Publish Challenge

**POST** `/api/v1/challenges/{challenge_id}/publish`

Publishes a draft challenge to make it available for guessing.

**Response:**
```json
{
  "challenge_id": "uuid-string",
  "status": "published",
  "published_at": "2024-01-01T12:00:00Z"
}
```

### 3. Get Challenge

**GET** `/api/v1/challenges/{challenge_id}`

Retrieves a specific published challenge. Increments view count.

**Response:**
```json
{
  "challenge_id": "uuid-string",
  "creator_id": "user-id",
  "title": "Challenge Title",
  "statements": [...],
  "lie_statement_id": "uuid-string",
  "status": "published",
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T12:00:00Z",
  "published_at": "2024-01-01T12:00:00Z",
  "view_count": 42,
  "guess_count": 15,
  "correct_guess_count": 8
}
```

### 4. List Challenges

**GET** `/api/v1/challenges`

Lists published challenges with pagination and filtering.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 20)
- `creator_id` (string): Filter by creator
- `status` (string): Filter by status
- `tags` (string): Comma-separated tags to filter by

**Response:**
```json
{
  "challenges": [...],
  "total_count": 100,
  "page": 1,
  "page_size": 20,
  "has_next": true
}
```

### 5. Submit Guess

**POST** `/api/v1/challenges/{challenge_id}/guess`

Submits a guess for a challenge.

**Request Body:**
```json
{
  "guessed_lie_statement_id": "uuid-string",
  "response_time_seconds": 15.5
}
```

**Response:**
```json
{
  "guess_id": "uuid-string",
  "is_correct": true,
  "correct_lie_statement_id": "uuid-string",
  "points_earned": 130,
  "submitted_at": "2024-01-01T12:00:00Z"
}
```

### 6. Get My Challenges

**GET** `/api/v1/users/me/challenges`

Gets all challenges created by the authenticated user.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 20)
- `status` (string): Filter by status (draft, published, etc.)

### 7. Get My Guesses

**GET** `/api/v1/users/me/guesses`

Gets all guesses made by the authenticated user.

**Response:**
```json
{
  "guesses": [
    {
      "guess_id": "uuid-string",
      "challenge_id": "uuid-string",
      "user_id": "user-id",
      "guessed_lie_statement_id": "uuid-string",
      "is_correct": true,
      "submitted_at": "2024-01-01T12:00:00Z",
      "response_time_seconds": 15.5
    }
  ]
}
```

### 8. Get Challenge Guesses (Creator Only)

**GET** `/api/v1/challenges/{challenge_id}/guesses`

Gets all guesses for a specific challenge (only accessible by the challenge creator).

### 9. Delete Challenge

**DELETE** `/api/v1/challenges/{challenge_id}`

Deletes a draft challenge (only draft challenges can be deleted).

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `500` - Internal Server Error

Error response format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

## Data Models

### Challenge Status
- `draft` - Challenge created but not published
- `published` - Challenge available for guessing
- `moderated` - Under content moderation
- `rejected` - Rejected by moderation
- `archived` - No longer active

### Statement Type
- `truth` - A true statement
- `lie` - The false statement

## Integration with Upload Service

Challenges are created using media files that have been uploaded via the chunked upload service. The `media_file_id` in challenge creation requests must correspond to completed upload sessions.

## Scoring System

Points are awarded for correct guesses:
- Base points: 100
- Time bonus: Up to 60 additional points for responses under 30 seconds
- Formula: `100 + max(0, (30 - response_time) * 2)`

## Rate Limiting

The API includes built-in protections:
- Users can only guess once per challenge
- Challenge creation is limited by upload quotas
- Duplicate guess attempts are rejected

## Example Workflow

1. **Upload Media**: Use the upload service to upload 3 video files
2. **Create Challenge**: POST to `/api/v1/challenges` with the upload session IDs
3. **Publish Challenge**: POST to `/api/v1/challenges/{id}/publish`
4. **Players Guess**: Other users POST to `/api/v1/challenges/{id}/guess`
5. **View Results**: GET `/api/v1/challenges/{id}/guesses` (creator only)

## Testing

A test token can be generated for development:
```python
from services.auth_service import create_test_token
token = create_test_token("test-user-id")
```

Use this token in the Authorization header: `Bearer {token}`