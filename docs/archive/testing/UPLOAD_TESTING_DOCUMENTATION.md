<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/TESTING_GUIDE.md for current testing information -->

# Upload Testing Documentation

## Overview

This document describes the comprehensive test suite for the upload process and error handling functionality. The test suite covers unit tests, integration tests, regression tests, and end-to-end tests across both backend and mobile platforms.

## Test Structure

### Backend Tests

#### 1. Core Upload Service Tests (`test_upload_service.py`)
- **Purpose**: Test core chunked upload functionality
- **Coverage**:
  - Upload session initiation
  - Chunk upload and validation
  - Upload completion and file assembly
  - Progress tracking
  - Session management

#### 2. Upload Service Error Handling (`test_upload_service_error_handling.py`)
- **Purpose**: Test comprehensive error handling scenarios
- **Coverage**:
  - Validation errors (file size, format, duration)
  - Network and storage errors
  - Session timeout and expiration
  - Quota management
  - Hash validation failures

#### 3. Media Upload API Tests (`test_media_upload_api.py`)
- **Purpose**: Test API endpoints for media upload
- **Coverage**:
  - Upload initiation endpoint
  - Chunk upload endpoints
  - Upload completion endpoint
  - Media streaming endpoint
  - Authentication and authorization

#### 4. Upload Regression Tests (`test_upload_regression.py`)
- **Purpose**: Prevent previously fixed issues from reoccurring
- **Coverage**:
  - Race condition fixes
  - Memory leak prevention
  - Security vulnerability patches
  - Performance regression prevention
  - Data corruption fixes

#### 5. End-to-End Upload Tests (`test_upload_end_to_end.py`)
- **Purpose**: Test complete upload workflow integration
- **Coverage**:
  - Full upload lifecycle
  - Cloud storage integration
  - Concurrent uploads
  - Resume functionality
  - Performance benchmarks

### Mobile Tests

#### 1. Upload Service Tests (`uploadService.test.ts`)
- **Purpose**: Test mobile upload service functionality
- **Coverage**:
  - Service initialization
  - File validation
  - Upload configuration
  - Basic error handling

#### 2. Upload Service Validation (`uploadServiceValidation.test.ts`)
- **Purpose**: Test client-side validation logic
- **Coverage**:
  - File extension validation
  - File size validation
  - Duration validation
  - Security validation (dangerous files)

#### 3. Upload Manager Hook Tests (`useUploadManager.test.ts`)
- **Purpose**: Test React hook for upload state management
- **Coverage**:
  - State management
  - Progress tracking
  - Error handling
  - Retry logic

#### 4. Enhanced Upload UI Tests (`EnhancedUploadUI.test.tsx`)
- **Purpose**: Test upload UI components
- **Coverage**:
  - User interactions
  - Progress display
  - Error states
  - Accessibility

#### 5. Upload Integration Comprehensive (`UploadIntegrationComprehensive.test.tsx`)
- **Purpose**: Test complete mobile upload integration
- **Coverage**:
  - End-to-end upload flow
  - Network interruption handling
  - Cross-platform compatibility
  - Performance testing

#### 6. Upload Error Handling Comprehensive (`UploadErrorHandlingComprehensive.test.ts`)
- **Purpose**: Test comprehensive error scenarios on mobile
- **Coverage**:
  - Network errors
  - Server errors
  - File system errors
  - Validation errors
  - Recovery mechanisms

## Test Categories

### Unit Tests
- Test individual functions and methods in isolation
- Mock external dependencies
- Fast execution
- High code coverage

### Integration Tests
- Test interaction between components
- Test API endpoints with real services
- Test database interactions
- Medium execution time

### End-to-End Tests
- Test complete user workflows
- Test across multiple systems
- Test real-world scenarios
- Slower execution but high confidence

### Regression Tests
- Test previously fixed bugs
- Prevent regressions
- Test edge cases and security issues
- Critical for maintaining quality

### Performance Tests
- Test upload speed and throughput
- Test memory usage
- Test concurrent upload handling
- Test large file handling

## Error Scenarios Covered

### Network Errors
- Connection timeout
- Connection refused
- DNS resolution failures
- Intermittent connectivity
- Rate limiting
- Server unavailability

### File System Errors
- File not found
- Permission denied
- Corrupted files
- Insufficient storage
- File locked by another process

### Validation Errors
- Invalid file extensions
- File too large/small
- Video too long/short
- Malicious file detection
- Path traversal attempts

### Server Errors
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 413 Payload Too Large
- 429 Rate Limited
- 500 Internal Server Error
- 503 Service Unavailable

### Security Errors
- MIME type spoofing
- Filename injection
- Hash manipulation
- Session hijacking
- Authentication bypass

## Test Data and Fixtures

### Sample Files
- Valid video files (MP4, MOV, WebM)
- Invalid file types (TXT, EXE, PDF)
- Corrupted files
- Large files (near size limits)
- Small files (below minimum)

### Mock Responses
- Successful upload responses
- Error responses with various codes
- Partial responses (for testing resume)
- Malformed responses

### Test Users
- Valid authenticated users
- Expired token users
- Rate-limited users
- Quota-exceeded users

## Running Tests

### Backend Tests

#### Run All Upload Tests
```bash
cd backend
python tests/run_upload_tests.py
```

#### Run Individual Test Files
```bash
# Core upload service tests
python -m pytest tests/test_upload_service.py -v

# Error handling tests
python -m pytest tests/test_upload_service_error_handling.py -v

# API tests
python -m pytest tests/test_media_upload_api.py -v

# Regression tests
python -m pytest tests/test_upload_regression.py -v

# End-to-end tests
python -m pytest tests/test_upload_end_to_end.py -v
```

#### Run with Coverage
```bash
python -m pytest tests/test_upload_*.py --cov=services.upload_service --cov=services.media_upload_service --cov-report=html
```

### Mobile Tests

#### Run All Upload Tests
```bash
cd mobile
node src/__tests__/runUploadTests.js
```

#### Run Individual Test Files
```bash
# Upload service tests
npm test -- src/services/__tests__/uploadService.test.ts --watchAll=false

# Validation tests
npm test -- src/services/__tests__/uploadServiceValidation.test.ts --watchAll=false

# Integration tests
npm test -- src/__tests__/UploadIntegrationComprehensive.test.tsx --watchAll=false

# Error handling tests
npm test -- src/__tests__/UploadErrorHandlingComprehensive.test.ts --watchAll=false
```

#### Run with Coverage
```bash
npm test -- --coverage --watchAll=false --collectCoverageFrom="src/services/uploadService.ts"
```

## Test Configuration

### Environment Variables
```bash
# Backend
export TEST_DATABASE_URL="sqlite:///test.db"
export TEST_UPLOAD_DIR="/tmp/test_uploads"
export TEST_MAX_FILE_SIZE="50MB"

# Mobile
export NODE_ENV="test"
export REACT_NATIVE_PACKAGER_HOSTNAME="localhost"
```

### Test Settings
- Maximum file size: 50MB
- Chunk size: 1MB
- Upload timeout: 5 minutes
- Retry attempts: 3
- Rate limit: 10 uploads/minute

## Coverage Requirements

### Minimum Coverage Targets
- Backend upload services: 90%
- Mobile upload services: 85%
- API endpoints: 95%
- Error handling: 100%

### Critical Paths (100% Coverage Required)
- File validation logic
- Security checks
- Error handling paths
- Authentication/authorization
- Data integrity checks

## Continuous Integration

### Pre-commit Hooks
- Run unit tests
- Check code coverage
- Lint code
- Security scan

### CI Pipeline
1. Run all unit tests
2. Run integration tests
3. Run regression tests
4. Generate coverage report
5. Run security scans
6. Performance benchmarks

### Test Environments
- **Development**: Local testing with mocks
- **Staging**: Integration testing with real services
- **Production**: Smoke tests and monitoring

## Debugging Failed Tests

### Common Issues
1. **Network timeouts**: Increase timeout values
2. **File permissions**: Check test file permissions
3. **Mock failures**: Verify mock configurations
4. **Race conditions**: Add proper synchronization
5. **Memory issues**: Check for resource leaks

### Debug Commands
```bash
# Run with verbose output
python -m pytest tests/test_upload_service.py -v -s

# Run specific test
python -m pytest tests/test_upload_service.py::TestClass::test_method -v

# Run with debugger
python -m pytest tests/test_upload_service.py --pdb

# Run with coverage and debug
python -m pytest tests/test_upload_service.py --cov --cov-report=term-missing -v
```

## Performance Benchmarks

### Upload Speed Targets
- Small files (< 5MB): < 10 seconds
- Medium files (5-25MB): < 30 seconds  
- Large files (25-50MB): < 60 seconds

### Memory Usage Targets
- Peak memory increase: < 50MB per upload
- Memory cleanup: Complete within 30 seconds
- Concurrent uploads: Linear memory scaling

### Throughput Targets
- Single upload: > 1MB/s
- Concurrent uploads: > 0.5MB/s per upload
- Server capacity: > 100 concurrent uploads

## Security Testing

### Security Test Cases
- File type validation bypass attempts
- Path traversal attacks
- MIME type spoofing
- Hash collision attacks
- Session hijacking attempts
- Authentication bypass attempts

### Security Tools
- Static analysis (bandit, semgrep)
- Dependency scanning
- OWASP ZAP integration
- Custom security test cases

## Maintenance

### Regular Tasks
- Update test data monthly
- Review and update error scenarios
- Performance benchmark updates
- Security test case reviews
- Documentation updates

### Test Data Refresh
- Generate new sample files
- Update mock responses
- Refresh test user accounts
- Update security test vectors

## Troubleshooting

### Common Test Failures

#### "File not found" errors
- Check test file paths
- Verify test data setup
- Check file permissions

#### "Network timeout" errors
- Increase timeout values
- Check network connectivity
- Verify mock configurations

#### "Memory errors" during tests
- Check for resource leaks
- Verify cleanup in teardown
- Monitor memory usage

#### "Permission denied" errors
- Check file/directory permissions
- Verify user privileges
- Check temporary directory access

### Getting Help
- Check test logs for detailed error messages
- Review test documentation
- Contact development team
- File bug reports with reproduction steps