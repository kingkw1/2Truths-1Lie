# 🌐 API Tests

This directory contains tests for all REST API endpoints and HTTP request/response handling.

## 📋 Test Categories

### Authentication & Security
- `test_auth_security.py` - JWT token validation and security measures
- `test_authenticated_*.py` - Protected endpoint access control
- `test_security_compliance.py` - Security policy compliance tests

### Challenge API
- `test_challenge_api*.py` - Core challenge CRUD operations
- `test_challenge_endpoint.py` - Challenge endpoint functionality
- `test_challenge_rate_limiting.py` - Rate limiting on challenge creation
- `test_challenge_video_*.py` - Video-related challenge operations

### Media & Upload API
- `test_media_upload_api.py` - File upload endpoint testing
- `test_direct_upload_endpoint.py` - Direct upload flow validation
- `test_s3_api_client.py` - AWS S3 integration via API

### Content Moderation
- `test_moderation_api.py` - Content moderation endpoint testing
- `test_strict_validation.py` - Input validation and sanitization

## 🚀 Running Tests

```bash
# Run all API tests
pytest backend/tests/api/

# Run specific test category
pytest backend/tests/api/test_challenge_api.py

# Run with coverage
pytest backend/tests/api/ --cov=backend/api
```

## 🎯 Focus Areas

- **HTTP Status Codes**: Correct response codes for all scenarios
- **Request Validation**: Input sanitization and error handling
- **Authentication**: JWT token validation and permissions
- **Rate Limiting**: Endpoint throttling and abuse prevention
- **Error Responses**: Consistent error message formatting