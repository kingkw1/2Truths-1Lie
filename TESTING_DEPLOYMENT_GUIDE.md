# Testing, Deployment & Mobile Integration Guide

## 🧪 Phase 1: Backend API Testing

### 1.1 Verify S3 Health Check
```bash
# Test S3 connectivity
curl "http://127.0.0.1:8001/api/v1/s3-media/health/s3" | python -m json.tool

# Expected Response:
# {
#   "success": true,
#   "service": "S3 Media Service", 
#   "bucket": "2truths1lie-media-uploads",
#   "region": "us-east-1",
#   "status": "healthy"
# }
```

### 1.2 Test API Documentation
Visit: `http://127.0.0.1:8001/docs`
- Verify all S3 endpoints are listed
- Test the "Try it out" functionality
- Check request/response schemas

### 1.3 Create Test Authentication Token
Since the endpoints require authentication, let's create a simple test token generator:

```bash
# Create a temporary test token (for development only)
cd /home/kevin/Documents/2Truths-1Lie/backend
python -c "
from services.auth_service import create_access_token
from datetime import timedelta
token = create_access_token(
    data={'sub': 'test-user', 'permissions': ['media:upload', 'media:read', 'media:delete']},
    expires_delta=timedelta(hours=24)
)
print('Test Token:', token)
"
```

### 1.4 Test Upload with Authentication
```bash
# Create test video file
echo "FAKE_VIDEO_CONTENT_FOR_TESTING" > /tmp/test_video.mp4

# Test upload (replace <TOKEN> with actual token)
curl -X POST "http://127.0.0.1:8001/api/v1/s3-media/upload" \
     -H "Authorization: Bearer <TOKEN>" \
     -F "file=@/tmp/test_video.mp4;type=video/mp4" \
     | python -m json.tool

# Save the media_id from response for next tests
```

### 1.5 Test Streaming URL Generation
```bash
# Test streaming URL (replace <MEDIA_ID> and <TOKEN>)
curl "http://127.0.0.1:8001/api/v1/s3-media/<MEDIA_ID>" \
     -H "Authorization: Bearer <TOKEN>" \
     | python -m json.tool
```

### 1.6 Test Deletion
```bash
# Test deletion (replace <MEDIA_ID> and <TOKEN>)
curl -X DELETE "http://127.0.0.1:8001/api/v1/s3-media/<MEDIA_ID>" \
     -H "Authorization: Bearer <TOKEN>" \
     | python -m json.tool
```

## 📱 Phase 2: Mobile App Integration

### 2.1 Update Mobile API Configuration

Check your mobile app's API configuration:

```typescript
// mobile/src/config/api.ts (or similar)
const API_CONFIG = {
  BASE_URL: 'http://127.0.0.1:8001', // For local testing
  // BASE_URL: 'https://your-production-domain.com', // For production
  S3_MEDIA_ENDPOINT: '/api/v1/s3-media',
  AUTH_ENDPOINT: '/api/v1/auth'
};
```

### 2.2 Update Media Upload Service

Create/update the mobile media service:

```typescript
// mobile/src/services/mediaService.ts
interface UploadResponse {
  success: boolean;
  media_id: string;
  storage_url: string;
  message: string;
}

export class MediaService {
  async uploadVideo(videoFile: File, authToken: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', videoFile);

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.S3_MEDIA_ENDPOINT}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async getStreamingUrl(mediaId: string, authToken: string): Promise<string> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.S3_MEDIA_ENDPOINT}/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get streaming URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signed_url;
  }
}
```

### 2.3 Test Mobile App Locally

```bash
# Start mobile development server
cd /home/kevin/Documents/2Truths-1Lie/mobile
npm start

# For iOS Simulator (if using Mac)
# npx expo start --ios

# For Android Emulator  
# npx expo start --android

# For physical device
# npx expo start --tunnel
```

## 🚀 Phase 3: Production Deployment

### 3.1 Backend Deployment Options

#### Option A: Railway/Render (Recommended for quick deployment)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option B: AWS EC2/ECS
```bash
# Create production environment file
cp .env .env.production

# Update production values in .env.production:
# - Use production AWS credentials
# - Set secure SECRET_KEY
# - Configure production domain CORS
```

#### Option C: DigitalOcean App Platform
```bash
# Create app.yaml for deployment
cat > app.yaml << EOF
name: 2truths1lie-backend
services:
- name: api
  source_dir: /backend
  github:
    repo: kingkw1/2Truths-1Lie
    branch: feat/mobile-only
  run_command: uvicorn main:app --host 0.0.0.0 --port 8080
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: AWS_ACCESS_KEY_ID
    value: \${AWS_ACCESS_KEY_ID}
  - key: AWS_SECRET_ACCESS_KEY
    value: \${AWS_SECRET_ACCESS_KEY}
  - key: AWS_S3_REGION
    value: us-east-1
  - key: AWS_S3_BUCKET_NAME
    value: 2truths1lie-media-uploads
EOF
```

### 3.2 Mobile App Production Build

#### For iOS (TestFlight/App Store)
```bash
cd /home/kevin/Documents/2Truths-1Lie/mobile

# Update app.json with production API URL
# Configure EAS Build
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

#### For Android (Google Play/APK)
```bash
# Build production APK/AAB
eas build --platform android --profile production

# For direct APK installation
eas build --platform android --profile preview

# Submit to Play Store
eas submit --platform android
```

## 📲 Phase 4: Device Testing

### 4.1 Local Network Testing
```bash
# Find your local IP
ip route get 1.2.3.4 | awk '{print $7}' | head -1

# Update mobile app to use local IP instead of localhost
# Example: http://192.168.1.100:8001
```

### 4.2 Testing Workflow
1. **Start backend server** on local machine
2. **Connect mobile device** to same WiFi network
3. **Update API base URL** to use local IP
4. **Test challenge upload** flow:
   - Record video in app
   - Upload to S3 via backend
   - Verify media appears in S3 bucket
   - Test streaming playback

### 4.3 Production Testing
1. **Deploy backend** to production service
2. **Update mobile app** with production API URL
3. **Build production mobile app**
4. **Install on physical device**
5. **Test complete workflow**

## 🔧 Debugging Tools

### Backend Monitoring
```bash
# Check server logs
cd /home/kevin/Documents/2Truths-1Lie/backend
tail -f uvicorn.log

# Monitor S3 uploads
aws s3 ls s3://2truths1lie-media-uploads/media/videos/ --recursive

# Test database connections
python -c "from config import settings; print('Config loaded successfully')"
```

### Mobile Debugging
```bash
# Check React Native logs
npx react-native log-android  # For Android
npx react-native log-ios      # For iOS

# Debug network requests
# Enable network debugging in React Native Debugger
```

## ✅ Pre-Deployment Checklist

### Backend
- [ ] S3 health check passes
- [ ] All API endpoints tested with authentication
- [ ] Environment variables properly configured
- [ ] CORS configured for production domain
- [ ] SSL/HTTPS configured for production
- [ ] Error logging and monitoring set up

### Mobile App
- [ ] API integration working locally
- [ ] Video upload flow tested
- [ ] Challenge creation workflow complete
- [ ] Authentication flow integrated
- [ ] Production build successful
- [ ] App store metadata prepared

### Infrastructure
- [ ] Production AWS credentials secured
- [ ] S3 bucket properly configured
- [ ] CDN setup (if using)
- [ ] Database backup strategy
- [ ] Monitoring and alerting configured

## 🎯 Recommended Testing Sequence

1. **Start with Phase 1** - Verify backend API completely
2. **Move to Phase 2** - Test mobile integration locally
3. **Deploy Phase 3** - Get backend to production
4. **Complete Phase 4** - Test on actual mobile device

This approach ensures each layer works before moving to the next, making debugging much easier when issues arise.
