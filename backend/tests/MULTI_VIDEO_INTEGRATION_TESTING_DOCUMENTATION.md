# Multi-Video Upload and Merge Integration Testing Documentation

## Overview

This document describes the comprehensive integration test suite for the multi-video upload and merge endpoints. These tests cover the complete workflow from upload initiation through merge completion, ensuring that all components work together correctly.

## Test File

### test_multi_video_upload_merge_integration.py

This file contains integration tests that test the complete multi-video upload and merge workflow, including:

#### Core Integration Test Classes

1. **TestMultiVideoUploadMergeIntegration** - Main integration test scenarios
2. **TestMultiVideoUploadValidation** - Input validation scenarios  
3. **TestMultiVideoUploadErrorHandling** - Error handling scenarios

## Test Coverage

### Complete Workflow Integration Tests

#### 1. test_complete_workflow_success
Tests the complete happy path workflow:
- **Step 1**: Initiate multi-video upload session
- **Step 2**: Upload chunks for each of the 3 videos
- **Step 3**: Complete uploads for each video
- **Step 4**: Monitor merge session status during processing
- **Step 5**: Verify merge completion with merged video URL and segment metadata

**Key Validations**:
- ✅ Upload session creation for 3 videos
- ✅ Chunk upload progress tracking
- ✅ Upload completion triggers merge when all videos ready
- ✅ Merge status monitoring and progress updates
- ✅ Final merged video URL and segment metadata delivery

#### 2. test_upload_failure_and_recovery
Tests failure scenarios and recovery mechanisms:
- **Failure**: Chunk upload validation error
- **Recovery**: Successful retry of failed chunk upload

**Key Validations**:
- ✅ Proper error handling for chunk validation failures
- ✅ Ability to retry failed operations
- ✅ Successful recovery after initial failure

#### 3. test_merge_session_cancellation
Tests cancellation of entire merge sessions:
- Cancel all upload sessions in a merge session
- Verify cleanup of temporary files and resources

**Key Validations**:
- ✅ Bulk cancellation of all videos in merge session
- ✅ Proper cleanup and resource management
- ✅ Accurate reporting of cancellation results

#### 4. test_individual_upload_cancellation
Tests cancellation of individual video uploads:
- Cancel single video upload within merge session
- Verify session-specific cleanup

**Key Validations**:
- ✅ Individual video upload cancellation
- ✅ Merge session remains intact for other videos
- ✅ Proper metadata tracking after cancellation

#### 5. test_merge_initiation_failure
Tests scenarios where merge initiation fails:
- Upload completion succeeds but merge fails to start
- Proper error reporting and status updates

**Key Validations**:
- ✅ Upload completion independent of merge status
- ✅ Proper error handling when merge cannot be initiated
- ✅ Accurate status reporting for failed merge attempts

#### 6. test_concurrent_uploads
Tests concurrent upload scenarios:
- Multiple videos uploading simultaneously
- Proper handling of concurrent chunk uploads

**Key Validations**:
- ✅ Concurrent chunk uploads for multiple videos
- ✅ Proper session isolation and tracking
- ✅ Accurate progress reporting for concurrent operations

#### 7. test_upload_status_monitoring
Tests status monitoring during upload progress:
- Partial upload progress tracking
- Detailed status information retrieval

**Key Validations**:
- ✅ Accurate progress percentage calculation
- ✅ Chunk tracking (uploaded vs remaining)
- ✅ Merge session metadata preservation
- ✅ Timestamp tracking for status updates

#### 8. test_merge_with_quick_completion
Tests scenarios where merge completes quickly:
- Upload completion triggers merge
- Merge completes before response is sent
- Immediate delivery of merged video URL and metadata

**Key Validations**:
- ✅ Quick merge detection and handling
- ✅ Immediate merged video URL delivery
- ✅ Complete segment metadata in response
- ✅ Proper status transitions from pending to completed

### Input Validation Tests

#### 1. test_invalid_video_count
Tests validation of video count parameter:
- Rejects counts other than 3
- Proper error messaging

#### 2. test_invalid_json_parameters
Tests JSON parameter validation:
- Malformed JSON in request parameters
- Proper error handling and reporting

#### 3. test_mismatched_array_lengths
Tests array length consistency validation:
- Mismatched lengths between video metadata arrays
- Clear error messaging for inconsistent data

#### 4. test_invalid_file_sizes
Tests file size validation:
- Zero or negative file sizes
- File sizes exceeding limits
- Proper validation error reporting

#### 5. test_invalid_mime_types
Tests MIME type validation:
- Unsupported video formats
- Non-video MIME types
- Clear rejection messaging

#### 6. test_invalid_durations
Tests video duration validation:
- Zero or negative durations
- Durations exceeding limits
- Proper validation error responses

### Error Handling Tests

#### 1. test_session_not_found
Tests handling of non-existent sessions:
- Chunk upload to non-existent session
- Status check for non-existent session
- Upload completion for non-existent session
- Cancellation of non-existent session

#### 2. test_access_denied
Tests access control enforcement:
- Operations on sessions belonging to other users
- Proper authentication and authorization checks

#### 3. test_non_merge_session_operations
Tests operation restrictions:
- Prevents merge-specific operations on regular upload sessions
- Proper session type validation

#### 4. test_merge_session_not_found
Tests merge session operations on non-existent sessions:
- Status checks for non-existent merge sessions
- Cancellation attempts for non-existent merge sessions

## API Endpoints Tested

### 1. POST /api/v1/challenge-videos/upload-for-merge/initiate
**Purpose**: Initiate multi-video upload session for server-side merging

**Test Coverage**:
- ✅ Successful initiation with valid parameters
- ✅ Input validation for all parameters
- ✅ Error handling for invalid requests
- ✅ Proper response format and headers

**Key Features Tested**:
- Video count validation (must be exactly 3)
- JSON parameter parsing and validation
- Array length consistency checks
- File size and duration validation
- MIME type validation
- Upload session creation for each video
- Merge session ID generation
- Estimated merge time calculation

### 2. POST /api/v1/challenge-videos/upload/{session_id}/chunk/{chunk_number}
**Purpose**: Upload video chunks for merge sessions

**Test Coverage**:
- ✅ Successful chunk upload with progress tracking
- ✅ Session validation and access control
- ✅ Merge session metadata preservation
- ✅ Error handling for upload failures
- ✅ Concurrent upload support

**Key Features Tested**:
- Session ownership verification
- Merge session type validation
- Chunk data processing
- Progress calculation and reporting
- Merge session metadata tracking

### 3. GET /api/v1/challenge-videos/upload/{session_id}/status
**Purpose**: Get detailed status of merge video upload sessions

**Test Coverage**:
- ✅ Comprehensive status information retrieval
- ✅ Progress tracking and chunk status
- ✅ Merge session metadata inclusion
- ✅ Access control enforcement

**Key Features Tested**:
- Upload progress percentage
- Chunk tracking (uploaded vs remaining)
- Merge session information
- Timestamp tracking
- Status enumeration

### 4. POST /api/v1/challenge-videos/upload/{session_id}/complete
**Purpose**: Complete individual video uploads and trigger merge when ready

**Test Coverage**:
- ✅ Upload completion processing
- ✅ Merge readiness detection
- ✅ Automatic merge initiation
- ✅ Quick merge completion handling
- ✅ Error handling for merge failures

**Key Features Tested**:
- Upload finalization
- File hash verification
- Merge readiness assessment
- Automatic merge triggering
- Merged video URL delivery
- Segment metadata extraction

### 5. GET /api/v1/challenge-videos/merge-session/{merge_session_id}/status
**Purpose**: Get overall status of merge sessions

**Test Coverage**:
- ✅ Multi-video status aggregation
- ✅ Overall progress calculation
- ✅ Merge status monitoring
- ✅ Comprehensive session information

**Key Features Tested**:
- Video completion tracking
- Overall progress calculation
- Merge status reporting
- Session aggregation
- Metadata compilation

### 6. DELETE /api/v1/challenge-videos/upload/{session_id}
**Purpose**: Cancel individual video uploads

**Test Coverage**:
- ✅ Individual session cancellation
- ✅ Resource cleanup
- ✅ Proper status reporting

**Key Features Tested**:
- Session cancellation
- Cleanup operations
- Status reporting
- Access control

### 7. DELETE /api/v1/challenge-videos/merge-session/{merge_session_id}
**Purpose**: Cancel entire merge sessions

**Test Coverage**:
- ✅ Bulk session cancellation
- ✅ Complete resource cleanup
- ✅ Comprehensive status reporting

**Key Features Tested**:
- Multi-session cancellation
- Bulk cleanup operations
- Cancellation result reporting
- Error handling for partial failures

## Test Fixtures and Mocking

### Fixtures

#### client
- FastAPI TestClient configured with challenge video endpoints
- Authentication dependency override for testing

#### temp_settings
- Temporary configuration for isolated testing
- Temporary directories for uploads and processing
- Test-specific limits and configurations

#### sample_video_data
- Mock video data for 3 test videos
- Realistic file sizes, durations, and metadata
- Hash calculations for integrity testing

#### mock_services
- Mocked upload and merge services
- Controlled behavior for predictable testing
- Service dependency injection

### Mocking Strategy

#### Upload Service Mocking
- **Session Management**: Mock session creation, tracking, and cleanup
- **Chunk Processing**: Mock chunk upload and validation
- **Progress Tracking**: Mock progress calculation and reporting
- **Completion Handling**: Mock upload finalization

#### Merge Service Mocking
- **Readiness Checking**: Mock merge readiness assessment
- **Merge Initiation**: Mock merge process startup
- **Status Monitoring**: Mock merge progress and completion
- **Result Delivery**: Mock merged video URL and metadata

#### External Dependencies
- **File System**: Temporary directories for test isolation
- **Cloud Storage**: Disabled for testing (local storage only)
- **FFmpeg**: Mocked to avoid external dependencies
- **Authentication**: Override for consistent test user

## Running the Tests

### Prerequisites
```bash
# Ensure backend dependencies are installed
pip install -r backend/requirements.txt
pip install -r backend/test-requirements.txt
```

### Running Integration Tests
```bash
# Run specific integration test file
cd backend
python -m pytest tests/test_multi_video_upload_merge_integration.py -v

# Run with coverage
python -m pytest tests/test_multi_video_upload_merge_integration.py --cov=api --cov=services --cov-report=html

# Run all merge-related tests including integration tests
python tests/run_merge_tests.py
```

### Test Execution Time
- **Individual Tests**: 0.1-0.5 seconds per test
- **Full Integration Suite**: < 10 seconds
- **All Merge Tests**: < 30 seconds

## Key Test Scenarios

### Happy Path Scenarios
1. **Complete Workflow**: Upload 3 videos → Merge → Get merged video with segments
2. **Quick Merge**: Small videos that merge quickly and return immediately
3. **Concurrent Uploads**: Multiple videos uploading simultaneously
4. **Status Monitoring**: Real-time progress tracking during uploads and merge

### Error Scenarios
1. **Upload Failures**: Chunk validation errors with recovery
2. **Merge Failures**: Merge initiation failures with proper error reporting
3. **Session Not Found**: Operations on non-existent sessions
4. **Access Denied**: Cross-user access attempts
5. **Invalid Parameters**: Malformed requests and validation errors

### Edge Cases
1. **Partial Uploads**: Some videos completed, others in progress
2. **Cancellation**: Individual and bulk session cancellation
3. **Quick Completion**: Merge completing before status check
4. **Concurrent Operations**: Multiple users with concurrent uploads

## Integration with Existing Test Suite

### Test Runner Integration
The integration tests are included in the main test runner (`run_merge_tests.py`):
- Automatic execution with other merge-related tests
- Consistent reporting and error handling
- Integration with CI/CD pipelines

### Coverage Integration
- Comprehensive API endpoint coverage
- Service layer integration testing
- Error handling path coverage
- Authentication and authorization testing

## Maintenance and Updates

### Adding New Tests
1. Follow existing test patterns and naming conventions
2. Use appropriate fixtures for setup and teardown
3. Mock external dependencies for test isolation
4. Include both success and failure scenarios
5. Update documentation with new test coverage

### Test Data Management
- Use fixtures for consistent test data
- Generate test data programmatically
- Clean up resources in fixture teardown
- Avoid hardcoded values and external dependencies

### Performance Considerations
- Tests use mocked dependencies for speed
- Minimal file system operations
- Efficient resource cleanup
- Parallel test execution support

This comprehensive integration test suite ensures the reliability, security, and performance of the multi-video upload and merge functionality, providing confidence in the complete workflow from upload initiation through merge completion.