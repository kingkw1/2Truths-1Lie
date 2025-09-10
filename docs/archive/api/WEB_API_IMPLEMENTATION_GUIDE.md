<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Web API Implementation Guide

This document outlines how to implement your web API and storage when you're ready to deploy to web platforms.

## Current Architecture

The app is set up with platform-agnostic abstractions that automatically switch between:
- **Mobile**: Mock data + AsyncStorage (current deployment)
- **Web**: Real API + localStorage (future implementation)

## Implementation Steps

### 1. Storage (Ready for Web)

The storage abstraction in `src/utils/storage.ts` automatically detects the platform:

```typescript
// Already works for both platforms
import { storage } from '../utils/storage';

// Usage (same for mobile and web)
await storage.setItem('key', 'value');
const value = await storage.getItem('key');
```

### 2. Media Compression (Ready for Web)

The media compression in `src/utils/mediaCompression.ts` has separate implementations:

```typescript
// Already switches based on platform
import { MediaCompressor } from '../utils/mediaCompression';

// Usage (same API for both platforms)
const result = await MediaCompressor.compressMedia(input, options);
```

### 3. API Service (Ready for Implementation)

The API service in `src/services/apiService.ts` provides the interface you need:

```typescript
// Currently returns mock data on mobile
// Ready for your real API implementation on web
import { apiService } from '../services/apiService';

const challenges = await apiService.getChallenges();
const newChallenge = await apiService.createChallenge(challengeData);
```

## To Implement Your Web API

### Step 1: Update WebAPIService

Edit `src/services/apiService.ts` and update the `WebAPIService` class:

```typescript
class WebAPIService implements APIServiceInterface {
  constructor(baseURL: string = 'https://your-actual-api.com') {
    this.baseURL = baseURL;
  }
  
  // The methods are already implemented with fetch()
  // Just update the baseURL to your real API
}
```

### Step 2: Add Authentication

Add auth headers to the WebAPIService:

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<APIResponse<T>> {
  const token = await storage.getItem('authToken');
  
  return fetch(`${this.baseURL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
    ...options,
  });
}
```

### Step 3: Implement Backend Endpoints

Your backend should implement these endpoints:

```
GET    /challenges           - List challenges
GET    /challenges/:id       - Get single challenge
POST   /challenges          - Create challenge
PUT    /challenges/:id      - Update challenge
DELETE /challenges/:id      - Delete challenge

POST   /media/upload        - Upload media files
DELETE /media              - Delete media files

GET    /users/:id           - Get user profile
PUT    /users/:id           - Update user profile
```

### Step 4: Environment Configuration

Add environment-specific configs:

```typescript
// src/config/environment.ts
export const config = {
  apiBaseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  cdnBaseURL: process.env.REACT_APP_CDN_URL || 'http://localhost:3000',
  environment: process.env.NODE_ENV || 'development',
};
```

### Step 5: Real Media Upload

Implement actual media upload in WebAPIService:

```typescript
async uploadMedia(file: Blob, metadata: any): Promise<APIResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));

  return this.request<{ url: string }>('/media/upload', {
    method: 'POST',
    body: formData,
    headers: {}, // Don't set Content-Type for FormData
  });
}
```

## Current Mock Data

The mock service provides realistic test data:

- 2 sample challenges with different difficulty levels
- Simulated network delays (300ms-2s)
- Proper error handling
- Realistic response structures

## Migration Benefits

✅ **Zero Breaking Changes**: Your Redux slices, components, and business logic don't need to change

✅ **Gradual Migration**: You can implement endpoints one by one

✅ **Platform Independence**: Mobile continues working with mock data while web uses real APIs

✅ **Type Safety**: Full TypeScript support for all API responses

✅ **Error Handling**: Consistent error handling across platforms

## Example Backend (Node.js/Express)

```javascript
// Example backend structure
app.get('/challenges', async (req, res) => {
  const challenges = await Challenge.findAll();
  res.json(challenges);
});

app.post('/challenges', async (req, res) => {
  const challenge = await Challenge.create(req.body);
  res.json(challenge);
});

app.post('/media/upload', upload.single('file'), (req, res) => {
  const url = `${CDN_URL}/${req.file.filename}`;
  res.json({ url });
});
```

## Testing

The current mobile app is fully functional with mock data. When you implement your web API:

1. **Mobile** continues using MockAPIService (no changes needed)
2. **Web** automatically switches to WebAPIService
3. **Development** can use either mock or real data via environment variables

This architecture ensures your mobile deployment works today while preparing for future web functionality.
