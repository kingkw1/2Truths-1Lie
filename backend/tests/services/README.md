# ⚙️ Service Tests

This directory contains unit tests for business logic services and core application functionality.

## 📋 Test Categories

### Challenge Management
- `test_challenge_service*.py` - Challenge creation, retrieval, and management logic
- `test_authenticated_challenge_service.py` - Authentication-protected challenge operations

### Media Processing
- `test_media_processing_service.py` - Video/image processing and optimization
- `test_upload_service*.py` - File upload handling and validation
- `test_video_merge_service.py` - Video merging and concatenation logic

### Content & Security
- `test_moderation_service.py` - Content moderation and filtering
- `test_validation_service.py` - Input validation and sanitization
- `test_rate_limiter.py` - Rate limiting and abuse prevention

## 🚀 Running Tests

```bash
# Run all service tests
pytest backend/tests/services/

# Run specific service tests
pytest backend/tests/services/test_challenge_service.py

# Run with coverage
pytest backend/tests/services/ --cov=backend/services

# Run tests with mocking
pytest backend/tests/services/ --mock-external
```

## 🎯 Focus Areas

- **Business Logic**: Core application rules and workflows
- **Service Isolation**: Testing services independently with mocks
- **Error Handling**: Service-level error scenarios and recovery
- **Performance**: Service method performance and optimization
- **State Management**: Service state consistency and transactions

## 🔧 Service Coverage

### ✅ Implemented Services
- **Challenge Service**: CRUD operations, business rules
- **Upload Service**: File handling, validation, storage
- **Media Processing**: Video/image manipulation
- **Moderation Service**: Content filtering and reporting
- **Rate Limiter**: Request throttling and abuse prevention
- **Validation Service**: Input sanitization and validation
- **Video Merge Service**: Multi-video combining and processing

### 🔄 Future Services
- User management service
- Notification service
- Analytics service
- Caching service

## ⚠️ Prerequisites

- Service dependencies mocked appropriately
- Test configuration for external services
- Database/storage mocks configured