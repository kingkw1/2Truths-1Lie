<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/TESTING_GUIDE.md for current testing information -->

# Video Merge Testing Documentation

## Overview

This document describes the comprehensive unit test suite for the backend video merge logic and media processing functionality. The tests cover three main components:

1. **VideoMergeService** - Core video merging and processing logic
2. **MediaUploadService** - Media upload and streaming functionality  
3. **Challenge Video API** - REST API endpoints for multi-video upload and merge

## Test Files

### 1. test_video_merge_service.py

Tests the core video merging functionality including:

#### Core Functionality Tests
- **FFmpeg Verification**: Tests initialization with and without FFmpeg
- **Merge Readiness Checks**: Validates video session completeness and file availability
- **Merge Initiation**: Tests merge session creation and workflow initiation
- **Video Analysis**: Tests FFprobe integration for video metadata extraction
- **Video Preparation**: Tests video normalization and format standardization
- **Video Merging**: Tests FFmpeg-based video concatenation
- **Segment Metadata Calculation**: Tests accurate timestamp calculation for merged segments
- **Progress Tracking**: Tests merge progress updates and status management

#### Error Handling Tests
- FFmpeg not found or not working
- Missing video files or incomplete uploads
- FFprobe analysis failures
- Video processing errors
- Merge operation failures

#### Integration Tests
- Full merge workflow from initiation to completion
- Asynchronous processing with mocked external dependencies
- Cloud storage integration (when enabled)
- Monitoring and logging integration

### 2. test_media_processing_service.py

Tests media upload and streaming functionality including:

#### Upload Management Tests
- **Video Upload Initiation**: Tests session creation with validation
- **Upload Completion**: Tests file finalization and metadata generation
- **Cloud Storage Integration**: Tests S3 upload and fallback mechanisms
- **CDN Integration**: Tests content delivery network functionality

#### Media Streaming Tests
- **Local Storage Streaming**: Tests file serving with range support
- **Cloud Storage Streaming**: Tests signed URL generation
- **Media Information Retrieval**: Tests metadata access
- **Cross-Device Media Access**: Tests media library synchronization

#### Validation Tests
- MIME type validation for video files
- Duration and file size limits
- Device compatibility checks
- Access control and authorization

#### Error Handling Tests
- Invalid file formats and sizes
- Cloud storage failures with local fallback
- Missing media files
- Access denied scenarios

### 3. test_challenge_video_api.py

Tests the REST API endpoints for multi-video upload and merge:

### 4. test_multi_video_upload_merge_integration.py

Comprehensive integration tests for the complete multi-video upload and merge workflow:

#### Multi-Video Upload API Tests
- **Upload Initiation**: Tests `/upload-for-merge/initiate` endpoint
- **Chunk Upload**: Tests video chunk upload for merge sessions
- **Upload Completion**: Tests individual video completion and merge triggering
- **Status Monitoring**: Tests upload and merge progress tracking

#### Session Management Tests
- **Merge Session Status**: Tests overall merge session monitoring
- **Upload Cancellation**: Tests individual and bulk upload cancellation
- **Error Recovery**: Tests handling of failed uploads and merges

#### Validation Tests
- Request parameter validation (video count, file sizes, durations)
- JSON parsing and array length validation
- MIME type and file format validation
- Authentication and authorization

#### Error Handling Tests
- Invalid request parameters
- Upload service errors
- Merge service failures
- Session not found scenarios

#### Complete Workflow Integration Tests
- **End-to-End Workflow**: Tests complete flow from upload initiation through merge completion
- **Upload Failure Recovery**: Tests failure scenarios and recovery mechanisms
- **Session Management**: Tests individual and bulk session cancellation
- **Concurrent Operations**: Tests concurrent uploads and merge operations
- **Status Monitoring**: Tests real-time progress tracking and status updates
- **Quick Merge Completion**: Tests scenarios where merge completes immediately
- **Input Validation**: Tests comprehensive parameter validation
- **Error Handling**: Tests error scenarios across the complete workflow
- **Access Control**: Tests authentication and authorization enforcement

## Test Coverage

### VideoMergeService Coverage
- ✅ Service initialization and FFmpeg verification
- ✅ Merge readiness validation
- ✅ Video analysis with FFprobe
- ✅ Video preparation and normalization
- ✅ Video merging with FFmpeg
- ✅ Segment metadata calculation
- ✅ Progress tracking and status updates
- ✅ Error handling and recovery
- ✅ Cloud storage integration
- ✅ Monitoring and logging

### MediaUploadService Coverage
- ✅ Video upload initiation and validation
- ✅ Upload completion and finalization
- ✅ Local and cloud storage support
- ✅ CDN integration and optimization
- ✅ Media streaming with range support
- ✅ Cross-device media synchronization
- ✅ Access control and security
- ✅ Error handling and fallback mechanisms

### Challenge Video API Coverage
- ✅ Multi-video upload endpoints
- ✅ Chunk upload and progress tracking
- ✅ Merge session management
- ✅ Status monitoring and reporting
- ✅ Request validation and error handling
- ✅ Authentication and authorization
- ✅ Cancellation and cleanup

### Multi-Video Integration Coverage
- ✅ Complete workflow from initiation to merge completion
- ✅ Upload failure and recovery scenarios
- ✅ Concurrent upload handling
- ✅ Session cancellation (individual and bulk)
- ✅ Merge initiation and completion
- ✅ Status monitoring and progress tracking
- ✅ Input validation and error handling
- ✅ Access control and security
- ✅ Quick merge completion scenarios
- ✅ Resource cleanup and management

## Key Test Scenarios

### 1. Happy Path Scenarios
- **Complete Merge Workflow**: Upload 3 videos → Merge → Generate segments → Store result
- **Cloud Storage Upload**: Upload to S3 with CDN optimization
- **Cross-Device Access**: Sync media library across multiple devices
- **Range Request Streaming**: Video playback with seek support

### 2. Error Scenarios
- **FFmpeg Not Available**: Graceful degradation when FFmpeg is missing
- **Cloud Storage Failure**: Automatic fallback to local storage
- **Incomplete Uploads**: Proper handling of missing video files
- **Invalid Video Formats**: Rejection of unsupported file types
- **Network Failures**: Retry mechanisms and error recovery

### 3. Edge Cases
- **Large Video Files**: Handling of files near size limits
- **Very Short/Long Videos**: Duration validation and processing
- **Concurrent Uploads**: Multiple users uploading simultaneously
- **Storage Quota Limits**: Proper error handling when storage is full

## Running the Tests

### Prerequisites
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Ensure FFmpeg is available (for integration tests)
ffmpeg -version
```

### Running Individual Test Suites
```bash
# Video merge service tests
python -m pytest tests/test_video_merge_service.py -v

# Media processing service tests  
python -m pytest tests/test_media_processing_service.py -v

# Challenge video API tests
python -m pytest tests/test_challenge_video_api.py -v

# Multi-video integration tests
python -m pytest tests/test_multi_video_upload_merge_integration.py -v
```

### Running All Tests
```bash
# Run custom test runner
python tests/run_merge_tests.py

# Or use pytest (if available)
python -m pytest tests/test_*merge*.py tests/test_*media*.py tests/test_*challenge*.py tests/test_multi_video*.py -v
```

## Test Configuration

### Mock Dependencies
Tests use extensive mocking to isolate units under test:
- **FFmpeg/FFprobe**: Mocked subprocess calls
- **Cloud Storage**: Mocked S3 operations
- **CDN Services**: Mocked content delivery
- **File System**: Temporary directories for test isolation

### Test Fixtures
- **temp_settings**: Temporary configuration for isolated testing
- **mock_upload_service**: Mocked chunked upload functionality
- **mock_cloud_storage**: Mocked S3 storage operations
- **sample_video_files**: Test video files for processing
- **mock_upload_sessions**: Simulated upload sessions

## Performance Considerations

### Test Execution Time
- **Unit Tests**: < 1 second per test
- **Integration Tests**: < 5 seconds per test
- **Full Suite**: < 30 seconds total

### Resource Usage
- **Memory**: Tests use minimal memory with mocked dependencies
- **Disk**: Temporary files cleaned up automatically
- **Network**: No actual network calls in unit tests

## Continuous Integration

### Test Automation
Tests are designed to run in CI/CD environments:
- No external dependencies required
- Deterministic results with mocked services
- Comprehensive error reporting
- Exit codes for build pipeline integration

### Coverage Reporting
```bash
# Generate coverage report
python -m pytest --cov=services --cov=api tests/ --cov-report=html
```

## Maintenance

### Adding New Tests
1. Follow existing test patterns and naming conventions
2. Use appropriate fixtures for setup and teardown
3. Mock external dependencies to ensure test isolation
4. Include both success and failure scenarios
5. Update this documentation with new test coverage

### Test Data Management
- Use temporary directories for file operations
- Clean up resources in fixture teardown
- Avoid hardcoded paths or external file dependencies
- Generate test data programmatically when possible

## Security Testing

### Authentication Tests
- ✅ User session validation
- ✅ Access control for upload sessions
- ✅ Cross-user access prevention
- ✅ API endpoint authorization

### Input Validation Tests
- ✅ File type and size validation
- ✅ Duration and content limits
- ✅ Malformed request handling
- ✅ SQL injection prevention (where applicable)

### Data Protection Tests
- ✅ Temporary file cleanup
- ✅ Secure URL generation
- ✅ Metadata sanitization
- ✅ Error message information disclosure prevention

This comprehensive test suite ensures the reliability, security, and performance of the backend video merge and media processing functionality.