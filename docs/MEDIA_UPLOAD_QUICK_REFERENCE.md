# Media Upload Quick Reference

## Quick Start for Developers

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Mobile Setup
```bash
cd mobile
npm install
npm start
```

## Key Components

### Backend Services
- `MediaUploadService` - Core upload logic
- `ChunkedUploadService` - Chunked upload handling
- `AuthService` - Authentication and authorization
- `ValidationService` - File validation and security

### Mobile Services
- `UploadService` - Client-side upload management
- `MobileMediaIntegration` - Redux integration
- `AuthService` - Mobile authentication
- `MediaMigrationService` - Legacy media migration

### UI Components
- `UploadProgressIndicator` - Progress display
- `EnhancedUploadUI` - Complete upload interface
- `MobileCameraRecorder` - Camera integration
- `useUploadManager` - Upload state management hook

## API Endpoints

### Upload Flow
```http
POST /api/v1/media/upload/initiate
POST /api/v1/media/upload/{session_id}/chunk/{chunk_number}
POST /api/v1/media/upload/{session_id}/complete
```

### Media Management
```http
GET /api/v1/media/stream/{media_id}
GET /api/v1/media/info/{media_id}
DELETE /api/v1/media/delete/{media_id}
```

### Validation & Status
```http
POST /api/v1/media/validate
GET /api/v1/media/upload/{session_id}/status
DELETE /api/v1/media/upload/{session_id}
```

## Code Examples

### Mobile Upload
```typescript
import { UploadService } from '../services/uploadService';

const uploadService = UploadService.getInstance();
const result = await uploadService.uploadVideo(
  videoUri, 
  filename, 
  duration,
  {
    compress: true,
    onProgress: (progress) => console.log(progress.percentage)
  }
);
```

### Backend Integration
```python
from services.media_upload_service import MediaUploadService

service = MediaUploadService()
session = await service.initiate_upload(
    filename="video.mp4",
    file_size=5000000,
    duration_seconds=30.0,
    user_id="user123"
)
```

### Redux Integration
```typescript
// Progress updates
dispatch(setMediaUploadProgress({
  statementIndex: 0,
  progress: 45,
  stage: 'uploading'
}));

// Completion
dispatch(updateMediaCapture({
  statementIndex: 0,
  mediaId: 'uuid',
  streamingUrl: '/api/v1/media/stream/uuid'
}));
```

## Configuration

### Backend Config
```python
# config.py
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_VIDEO_DURATION_SECONDS = 300    # 5 minutes
DEFAULT_CHUNK_SIZE = 1024 * 1024    # 1MB
```

### Mobile Config
```typescript
const config = {
  maxFileSize: 50 * 1024 * 1024,     // 50MB
  compressionThreshold: 25 * 1024 * 1024, // 25MB
  maxDuration: 60,                    // 60 seconds
};
```

## Testing

### Run Backend Tests
```bash
cd backend
pytest tests/test_media_upload_api.py -v
```

### Run Mobile Tests
```bash
cd mobile
npm test -- --testPathPattern=upload
```

### Integration Test
```bash
cd backend
python test_media_integration.py
```

## Common Issues

### Upload Failures
- Check authentication token
- Verify file size limits
- Ensure network connectivity
- Check server logs for errors

### Streaming Issues
- Verify media ID exists
- Check file permissions
- Test range request support
- Validate MIME types

### Performance Issues
- Enable compression for large files
- Use appropriate chunk sizes
- Monitor memory usage
- Check network bandwidth

## File Locations

### Backend Files
```
backend/
├── services/media_upload_service.py
├── api/media_endpoints.py
├── tests/test_media_upload_api.py
└── MEDIA_UPLOAD_API_DOCUMENTATION.md
```

### Mobile Files
```
mobile/src/
├── services/uploadService.ts
├── components/UploadProgressIndicator.tsx
├── hooks/useUploadManager.ts
└── __tests__/UploadIntegrationComprehensive.test.tsx
```

## Environment Variables

### Backend
```env
MAX_FILE_SIZE=104857600
MAX_CHUNK_SIZE=10485760
UPLOAD_SESSION_TIMEOUT=3600
SECRET_KEY=your-secret-key
```

### Mobile
```env
API_BASE_URL=http://localhost:8000
UPLOAD_CHUNK_SIZE=1048576
MAX_RETRY_ATTEMPTS=3
```

## Debugging

### Enable Debug Logging
```typescript
// Mobile
UploadService.setDebugMode(true);

// Backend
import logging
logging.getLogger('media_upload').setLevel(logging.DEBUG)
```

### Check Upload Status
```typescript
const status = await uploadService.getUploadStatus(sessionId);
console.log('Upload status:', status);
```

### Monitor Progress
```typescript
const uploadManager = useUploadManager(0, {
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.percentage}%`);
  }
});
```

## Security Checklist

- [ ] Authentication required for all endpoints
- [ ] File type validation enabled
- [ ] File size limits enforced
- [ ] Hash verification implemented
- [ ] Rate limiting configured
- [ ] Session timeouts set
- [ ] User isolation verified

## Performance Checklist

- [ ] Chunked uploads implemented
- [ ] Compression enabled for large files
- [ ] Progress tracking optimized
- [ ] Background upload support
- [ ] Memory management implemented
- [ ] Error recovery configured
- [ ] Streaming optimization enabled

For complete documentation, see:
- [Persistent Media Workflow](PERSISTENT_MEDIA_WORKFLOW.md)
- [Media Upload API Documentation](../backend/MEDIA_UPLOAD_API_DOCUMENTATION.md)
- [Upload UI Components](../mobile/src/components/UPLOAD_UI_README.md)