---
include: conditional
pattern: "backend/**/*"
---

# Mobile API Standards

## General Principles
- All backend routes follow RESTful conventions optimized for mobile clients:
  - `GET` for fetching data with efficient mobile payload sizes
  - `POST` for creating resources or executing actions (mobile game submissions)
  - `PUT`/`PATCH` for updates with minimal data transfer
  - `DELETE` for removal

## Mobile-Optimized URL Naming
- Use plural nouns for resource names: e.g., `/mobile/v1/games`, `/mobile/v1/users`, `/mobile/v1/sessions`
- Nest URIs logically for mobile navigation: e.g., `/mobile/v1/users/{userId}/games`
- Include mobile-specific endpoints for efficient data loading

## Mobile Requests & Responses
- All responses use JSON format optimized for mobile bandwidth
- Standardize mobile response structure:

```json
{
  "success": true,
  "data": {...},
  "error": null,
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "mobile/v1"
  }
}
```

- On error, provide meaningful HTTP status codes (400, 401, 404, 500) with mobile-friendly error messages
- Validate all mobile client inputs server-side; handle offline/network retry scenarios
- Implement request compression and response caching for mobile performance

## Mobile Authentication & Authorization
- Use JWT tokens optimized for mobile storage and security
- Support mobile-specific auth flows (biometric, device-based authentication)
- Include middleware for mobile token refresh and validation
- Handle mobile app backgrounding and token expiration gracefully

## Mobile API Versioning & Compatibility
- Include mobile API version in base route (e.g., `/mobile/v1/`)
- Maintain backward compatibility for mobile app store approval cycles
- Support graceful degradation for older mobile app versions

## Mobile-Specific Endpoints
- `POST /mobile/v1/statements` - Submit new statements with mobile media uploads
- `GET /mobile/v1/games/{gameId}` - Retrieve mobile-optimized game data
- `POST /mobile/v1/games/{gameId}/guess` - Submit mobile game guesses with device context
- `POST /mobile/v1/media/upload` - Handle mobile merged video uploads with segment metadata
- `GET /mobile/v1/media/{mediaId}` - Stream/retrieve compressed video content with CDN support
- `POST /mobile/v1/challenges` - Create challenges with merged video and segment timecodes
- `GET /mobile/v1/health` - Mobile app health check and feature flags

## Mobile Performance Considerations
- Implement pagination for list endpoints to reduce mobile data usage
- Use efficient media encoding and compression for mobile merged video uploads
- Support offline-first patterns with eventual consistency for uploaded media
- Include request/response compression for mobile bandwidth optimization
- Support resumable uploads for large merged video files
- Implement background upload support for mobile app lifecycle management

---