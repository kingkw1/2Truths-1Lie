# API Configuration Update - Railway Deployment

## Overview
The mobile app has been updated to use the production backend deployed on Railway at:
**https://2truths-1lie-production.up.railway.app**

## Changes Made

### 1. Centralized API Configuration
Created `/mobile/src/config/apiConfig.ts` to centralize all API URL configuration:
- Production URL: `https://2truths-1lie-production.up.railway.app`
- Development URL: `http://192.168.50.111:8001` (for local development)

### 2. Updated Services
Updated all mobile app services to use the centralized configuration:
- ✅ `apiService.ts` - Main API service
- ✅ `authService.ts` - Authentication service  
- ✅ `uploadService.ts` - Video upload service
- ✅ `realChallengeAPI.ts` - Challenge API service

### 3. Backend Documentation Access
The FastAPI backend automatically provides Swagger documentation at:
- **Swagger UI**: https://2truths-1lie-production.up.railway.app/docs
- **ReDoc**: https://2truths-1lie-production.up.railway.app/redoc

## API Documentation

### Accessing the API Documentation
The deployed backend exposes comprehensive API documentation via FastAPI's built-in documentation generators:

1. **Interactive Swagger UI**: 
   - URL: https://2truths-1lie-production.up.railway.app/docs
   - Features: Interactive API testing, request/response examples, authentication
   
2. **ReDoc Documentation**:
   - URL: https://2truths-1lie-production.up.railway.app/redoc  
   - Features: Clean, readable documentation with detailed schemas

### API Base URL
All mobile app API calls now point to:
```
https://2truths-1lie-production.up.railway.app/api/v1
```

### Key Endpoints
- **Health Check**: `GET /`
- **Detailed Health**: `GET /health`
- **Authentication**: `POST /api/v1/auth/*`
- **Upload**: `POST /api/v1/upload/*`
- **Challenges**: `GET|POST /api/v1/challenges/*`
- **Users**: `GET|PUT /api/v1/users/*`

## Environment Configuration

The mobile app now uses a centralized configuration system that can be easily switched between environments:

```typescript
// In /mobile/src/config/apiConfig.ts
const productionConfig = {
  baseUrl: 'https://2truths-1lie-production.up.railway.app',
  version: 'v1',
  timeout: 30000
};
```

## Testing the Integration

1. **Test the backend directly**:
   ```bash
   curl https://2truths-1lie-production.up.railway.app/health
   ```

2. **Access Swagger documentation**:
   Open https://2truths-1lie-production.up.railway.app/docs in your browser

3. **Test mobile app**:
   - Run the mobile app
   - Check console logs for "🌐 Using production Railway URL" messages
   - Verify API calls are made to the Railway domain

## Deployment Notes

- The Railway backend URL is now used for all production builds
- Local development can be switched by modifying the `apiConfig.ts` file
- All services log which URL they're using for easy debugging
- The configuration supports easy switching between dev/staging/production environments

## Next Steps

1. Test the mobile app with the new backend URL
2. Verify all API endpoints work correctly
3. Monitor the Railway deployment logs for any issues
4. Consider implementing environment-based configuration (dev/staging/prod) in the future
