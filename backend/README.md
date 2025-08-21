# 2Truths-1Lie Backend API

Secure chunked upload API with resumable support for the 2Truths-1Lie game.

## Features

- **Chunked Upload**: Large files are split into manageable chunks for reliable upload
- **Resumable Uploads**: Failed uploads can be resumed from where they left off
- **Security**: JWT authentication and file type validation
- **Integrity Checking**: SHA-256 hash verification for data integrity
- **Rate Limiting**: Prevents abuse with configurable limits
- **Progress Tracking**: Real-time upload progress monitoring

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# For development/testing
pip install -r test-requirements.txt
```

### Running the Server

```bash
# Development server with auto-reload
python run.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Authentication

All upload endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

For testing, you can create a test token:

```python
from services.auth_service import create_test_token
token = create_test_token("your_user_id")
```

### Upload Workflow

#### 1. Initiate Upload

```http
POST /api/v1/upload/initiate
Content-Type: application/json
Authorization: Bearer <token>

{
  "filename": "video.mp4",
  "file_size": 10485760,
  "mime_type": "video/mp4",
  "chunk_size": 1048576,
  "file_hash": "sha256_hash_optional"
}
```

Response:
```json
{
  "session_id": "uuid",
  "upload_url": "/api/v1/upload/{session_id}/chunk",
  "chunk_size": 1048576,
  "total_chunks": 10,
  "expires_at": "2024-01-01T12:00:00Z"
}
```

#### 2. Upload Chunks

```http
POST /api/v1/upload/{session_id}/chunk/{chunk_number}
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <chunk_data>
chunk_hash: <optional_sha256_hash>
```

Response:
```json
{
  "session_id": "uuid",
  "chunk_number": 0,
  "status": "uploaded",
  "uploaded_chunks": [0, 1, 2],
  "remaining_chunks": [3, 4, 5, 6, 7, 8, 9],
  "progress_percent": 30.0
}
```

#### 3. Check Status

```http
GET /api/v1/upload/{session_id}/status
Authorization: Bearer <token>
```

#### 4. Complete Upload

```http
POST /api/v1/upload/{session_id}/complete
Content-Type: application/json
Authorization: Bearer <token>

{
  "session_id": "uuid",
  "file_hash": "final_sha256_hash_optional"
}
```

#### 5. Cancel Upload

```http
DELETE /api/v1/upload/{session_id}
Authorization: Bearer <token>
```

## Configuration

Environment variables (create `.env` file):

```env
# Upload settings
MAX_FILE_SIZE=104857600  # 100MB
MAX_CHUNK_SIZE=10485760  # 10MB
DEFAULT_CHUNK_SIZE=1048576  # 1MB
UPLOAD_SESSION_TIMEOUT=3600  # 1 hour

# Security
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Directories
UPLOAD_DIR=uploads
TEMP_DIR=temp
```

## Supported File Types

- **Video**: mp4, webm, ogg, avi, mov
- **Audio**: mp3, wav, ogg, aac, webm
- **Images**: jpeg, png, gif, webp

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_upload_service.py

# Run with coverage
pytest --cov=. tests/
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (access denied)
- `404`: Not Found (session not found)
- `500`: Internal Server Error

## Security Features

- JWT token authentication
- File type validation
- File size limits
- Hash verification for data integrity
- Rate limiting (configurable)
- Secure file storage with unique names

## Performance Considerations

- Chunked uploads reduce memory usage
- Temporary files are cleaned up automatically
- Session data is persisted to disk
- Expired sessions are cleaned up periodically

## Integration with Frontend

The frontend should:

1. Compress media files before upload (already implemented)
2. Calculate file hash for integrity checking
3. Handle chunk upload failures with retry logic
4. Show progress to users
5. Allow cancellation of uploads

Example frontend integration:

```javascript
// Initiate upload
const response = await fetch('/api/v1/upload/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    filename: file.name,
    file_size: file.size,
    mime_type: file.type,
    chunk_size: 1024 * 1024 // 1MB chunks
  })
});

const { session_id, total_chunks, chunk_size } = await response.json();

// Upload chunks
for (let i = 0; i < total_chunks; i++) {
  const start = i * chunk_size;
  const end = Math.min(start + chunk_size, file.size);
  const chunk = file.slice(start, end);
  
  const formData = new FormData();
  formData.append('file', chunk);
  
  await fetch(`/api/v1/upload/${session_id}/chunk/${i}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
}

// Complete upload
await fetch(`/api/v1/upload/${session_id}/complete`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ session_id })
});
```