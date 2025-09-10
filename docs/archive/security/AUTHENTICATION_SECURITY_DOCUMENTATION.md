<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Authentication and Authorization Security Implementation

## Overview

This document describes the enhanced secure authentication and authorization flow implemented for the media upload system. The implementation provides comprehensive security features including JWT-based authentication, permission-based authorization, rate limiting, and signed URL access for media files.

## Architecture

### Backend Components

1. **Enhanced Auth Service** (`services/auth_service.py`)
   - JWT token creation and validation
   - Permission-based authorization
   - Rate limiting per user and action
   - Session management and token revocation
   - Signed URL generation for secure media access

2. **Auth Endpoints** (`api/auth_endpoints.py`)
   - User login and guest session creation
   - Token refresh and validation
   - Permission management
   - User information retrieval

3. **Media Security Integration** (`api/media_endpoints.py`)
   - Permission-based endpoint protection
   - Rate limiting for uploads and downloads
   - Signed URL support for direct media access

### Mobile Components

1. **Enhanced Auth Service** (`mobile/src/services/authService.ts`)
   - Backend integration for authentication
   - Token management and refresh
   - Permission checking
   - Secure storage of credentials

2. **Upload Service Integration** (`mobile/src/services/uploadService.ts`)
   - Permission validation before uploads
   - Signed URL generation for media sharing
   - Secure API communication

## Security Features

### 1. JWT Authentication

#### Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "permissions": ["media:read", "media:upload", "media:delete"],
  "aud": "twotruthsalie-mobile",
  "iss": "twotruthsalie-api",
  "exp": 1234567890,
  "iat": 1234567890
}
```

#### Token Validation
- Signature verification using HMAC-SHA256
- Expiration time checking
- Audience and issuer validation
- Active session verification
- Permission validation

### 2. Permission-Based Authorization

#### Permission Types
- `media:read` - View and stream media files
- `media:upload` - Upload new media files
- `media:delete` - Delete owned media files
- `admin` - Full system access (overrides all permissions)

#### Guest vs Authenticated Users
- **Guest Users**: `media:read`, `media:upload` (no delete)
- **Authenticated Users**: `media:read`, `media:upload`, `media:delete`
- **Admin Users**: All permissions

### 3. Rate Limiting

#### Upload Rate Limiting
- 5 uploads per hour per user
- Configurable limits per user type
- Automatic cleanup of expired rate limit data

#### Download Rate Limiting
- 100 downloads per hour per user
- Prevents abuse of streaming endpoints
- Separate limits for different actions

### 4. Signed URLs

#### Purpose
- Secure media access without authentication
- Time-limited access (default 1 hour)
- Tamper-proof URL generation

#### Implementation
```python
def create_signed_url(media_id: str, user_id: str, expires_in: int = 3600) -> str:
    expires_at = int(time.time()) + expires_in
    message = f"{media_id}:{user_id}:{expires_at}"
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"/api/v1/media/stream/{media_id}?user={user_id}&expires={expires_at}&signature={signature}"
```

### 5. Session Management

#### Active Session Tracking
- Server-side session storage
- Token revocation capability
- Session cleanup on logout

#### Token Refresh
- Separate refresh tokens with longer expiration
- Automatic token renewal
- Fallback to guest session on refresh failure

## API Endpoints

### Authentication Endpoints

#### POST `/api/v1/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_info": {
    "platform": "mobile"
  }
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800,
  "permissions": ["media:read", "media:upload", "media:delete"]
}
```

#### POST `/api/v1/auth/guest`
Create anonymous guest session.

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800,
  "permissions": ["media:read", "media:upload"]
}
```

#### POST `/api/v1/auth/refresh`
Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

#### GET `/api/v1/auth/validate`
Validate current token.

**Headers:**
```
Authorization: Bearer eyJ...
```

**Response:**
```json
{
  "valid": true,
  "user_id": "user_123",
  "permissions": ["media:read", "media:upload"],
  "expires_at": 1234567890
}
```

### Media Security Endpoints

#### POST `/api/v1/media/generate-signed-url/{media_id}`
Generate signed URL for secure media access.

**Headers:**
```
Authorization: Bearer eyJ...
```

**Request:**
```json
{
  "expires_in": 3600
}
```

**Response:**
```json
{
  "signed_url": "https://api.example.com/api/v1/media/stream/media123?user=user123&expires=1234567890&signature=abc123",
  "expires_in": 3600,
  "expires_at": 1234567890,
  "media_id": "media123"
}
```

## Mobile Integration

### Initialization
```typescript
import { authService } from './services/authService';

// Initialize auth service
await authService.initialize();

// Check if user is authenticated
if (authService.isAuthenticated()) {
  const user = authService.getCurrentUser();
  console.log('Logged in as:', user?.name);
}
```

### Login Flow
```typescript
try {
  const user = await authService.login('user@example.com', 'password123');
  console.log('Login successful:', user);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### Permission Checking
```typescript
// Check if user can upload
const canUpload = await authService.hasPermission('media:upload');
if (canUpload) {
  // Proceed with upload
} else {
  // Show permission denied message
}
```

### Upload with Authentication
```typescript
import { videoUploadService } from './services/uploadService';

// Initialize with auth token
await videoUploadService.initialize();

// Check permission before upload
const hasPermission = await videoUploadService.checkUploadPermission();
if (!hasPermission) {
  throw new Error('Insufficient permissions for upload');
}

// Upload video
const result = await videoUploadService.uploadVideo(
  videoUri,
  filename,
  duration,
  options,
  onProgress
);
```

## Security Best Practices

### 1. Token Security
- Use HTTPS for all API communication
- Store tokens securely using platform-specific secure storage
- Implement automatic token refresh
- Clear tokens on app uninstall/logout

### 2. Permission Validation
- Always validate permissions on both client and server
- Use principle of least privilege
- Implement role-based access control

### 3. Rate Limiting
- Implement both client and server-side rate limiting
- Use exponential backoff for retry logic
- Monitor and alert on rate limit violations

### 4. Signed URLs
- Use short expiration times (1 hour default)
- Validate signatures server-side
- Log signed URL usage for audit trails

### 5. Error Handling
- Don't expose sensitive information in error messages
- Log security events for monitoring
- Implement graceful degradation for auth failures

## Testing

### Backend Tests
```bash
cd backend
python -m pytest tests/test_auth_security.py -v
```

### Mobile Tests
```bash
cd mobile
npm test src/services/__tests__/authService.simple.test.ts
```

## Configuration

### Backend Configuration (`backend/config.py`)
```python
class Settings(BaseSettings):
    # JWT Settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Rate Limiting
    UPLOAD_RATE_LIMIT: int = 5  # uploads per hour per user
    
    # Signed URL Settings
    SIGNED_URL_EXPIRY: int = 3600  # 1 hour
```

### Mobile Configuration
```typescript
// In production, use environment-specific configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000' 
  : 'https://your-production-api.com';
```

## Monitoring and Logging

### Security Events to Monitor
- Failed login attempts
- Token validation failures
- Permission denied events
- Rate limit violations
- Signed URL access patterns

### Metrics to Track
- Authentication success/failure rates
- Token refresh frequency
- Permission usage patterns
- Rate limit hit rates
- Media access patterns

## Troubleshooting

### Common Issues

1. **Token Expired Errors**
   - Implement automatic token refresh
   - Check system clock synchronization
   - Verify token expiration settings

2. **Permission Denied Errors**
   - Verify user permissions in token
   - Check endpoint permission requirements
   - Ensure proper role assignment

3. **Rate Limit Exceeded**
   - Implement exponential backoff
   - Check rate limit configuration
   - Monitor user behavior patterns

4. **Signed URL Failures**
   - Verify URL hasn't expired
   - Check signature generation/validation
   - Ensure consistent secret key usage

## Future Enhancements

1. **Multi-Factor Authentication (MFA)**
2. **OAuth2/OpenID Connect Integration**
3. **Advanced Role-Based Access Control (RBAC)**
4. **Audit Logging and Compliance**
5. **Biometric Authentication Support**
6. **Device Trust and Management**

## Conclusion

This authentication and authorization system provides a robust security foundation for the media upload functionality. It implements industry best practices including JWT authentication, permission-based authorization, rate limiting, and secure media access through signed URLs. The system is designed to be scalable, maintainable, and secure while providing a smooth user experience across mobile platforms.