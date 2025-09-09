# End-to-End Testing Documentation

## Overview

This document describes the comprehensive end-to-end testing suite that covers the complete user workflow from video capture through upload, merge, challenge creation, and playback. The tests validate all aspects of the server-side video processing specification.

## Test Coverage

### Complete User Journey
- **Video Capture**: Recording three individual statement videos
- **Multi-Video Upload**: Uploading videos to backend merge endpoint
- **Server-Side Merging**: Asynchronous video merging with FFmpeg
- **Challenge Creation**: Creating challenges with merged video metadata
- **Challenge Retrieval**: Fetching challenges with segment information
- **Segmented Playback**: Playing specific video segments
- **Guess Submission**: Submitting and validating user guesses
- **Data Persistence**: Ensuring data consistency across operations

### Error Handling & Recovery
- **Upload Failures**: Network errors, chunk failures, hash mismatches
- **Resume Functionality**: Resuming interrupted uploads
- **Merge Failures**: FFmpeg errors, timeout handling
- **Authentication Errors**: Token validation, authorization failures
- **Validation Errors**: Invalid data, malformed requests
- **Session Management**: Cancellation, cleanup, timeout handling

### Cross-Platform Compatibility
- **iOS-Specific**: File system access, video processing
- **Android-Specific**: Content URIs, media library integration
- **Device Variations**: Different screen sizes, capabilities
- **Network Conditions**: Slow connections, intermittent connectivity

### Performance & Scalability
- **Concurrent Uploads**: Multiple users uploading simultaneously
- **Large File Handling**: Videos up to maximum size limits
- **Memory Management**: Efficient chunk processing
- **Resource Cleanup**: Temporary file management

## Test Structure

### Backend Tests (`backend/tests/`)

#### `test_complete_e2e_workflow.py`
Complete end-to-end workflow tests covering:
- Multi-video upload and merge workflow
- Upload failure recovery and resume
- Concurrent multi-user uploads
- Validation and error handling
- Session cancellation and cleanup

**Key Test Classes:**
- `TestCompleteE2EWorkflow`: Main workflow tests
- `TestUploadFailureRecovery`: Error recovery scenarios
- `TestConcurrentUsers`: Multi-user scenarios
- `TestValidationAndErrors`: Input validation tests

#### `test_multi_video_upload_merge_integration.py`
Integration tests for multi-video upload and merge:
- Complete workflow from initiation to completion
- Upload failure and recovery scenarios
- Merge session cancellation
- Individual upload cancellation
- Merge initiation failure handling
- Concurrent upload scenarios
- Upload status monitoring
- Quick merge completion scenarios

#### `test_challenge_video_api.py`
API endpoint tests for challenge video functionality:
- Multi-video upload initiation
- Video chunk upload for merge
- Upload completion and merge triggering
- Merge session status monitoring
- Upload and merge session cancellation
- Error handling for various failure scenarios

### Mobile Tests (`mobile/src/__tests__/`)

#### `CompleteE2EWorkflow.test.tsx`
Complete mobile end-to-end workflow tests:
- Multi-video upload and merge workflow
- Upload failure recovery in mobile context
- Challenge playback and interaction
- Cross-platform compatibility (iOS/Android)
- Error handling and recovery
- Data persistence and consistency

**Key Test Suites:**
- `Complete Multi-Video Upload and Merge Workflow`
- `Challenge Playback and Interaction Workflow`
- `Cross-Platform Compatibility Tests`
- `Error Handling and Recovery`
- `Data Persistence and Consistency`

#### `EndToEndIntegration.test.tsx`
Existing comprehensive integration tests:
- Challenge creation workflow
- Upload error handling and retry
- Challenge retrieval and display
- Cross-device accessibility
- Guess submission and results
- Network error handling

## Test Execution

### Backend Tests

#### Prerequisites
```bash
cd backend
pip install -r test-requirements.txt
```

#### Run All E2E Tests
```bash
python run_e2e_tests.py
```

#### Run Specific Test Files
```bash
# Complete E2E workflow
python -m pytest tests/test_complete_e2e_workflow.py -v

# Multi-video integration
python -m pytest tests/test_multi_video_upload_merge_integration.py -v

# Challenge video API
python -m pytest tests/test_challenge_video_api.py -v
```

#### Run Specific Test Classes
```bash
# Complete workflow tests
python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow -v

# Upload failure recovery
python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow::test_upload_failure_recovery_and_resume -v
```

### Mobile Tests

#### Prerequisites
```bash
cd mobile
npm install
```

#### Run All E2E Tests
```bash
node run_e2e_tests.js
```

#### Run Specific Test Files
```bash
# Complete E2E workflow
npm test -- --testPathPattern=CompleteE2EWorkflow.test.tsx --verbose

# Existing E2E integration
npm test -- --testPathPattern=EndToEndIntegration.test.tsx --verbose
```

#### Run with Coverage
```bash
npm run test:coverage -- --testPathPattern=.*E2E.*
```

## Test Data and Mocking

### Backend Test Data
- **Sample Video Files**: Mock MP4 data with proper headers
- **User Authentication**: Test tokens for different users
- **Cloud Storage**: Mocked S3 operations
- **FFmpeg Operations**: Mocked video merge operations
- **Database Operations**: Temporary file-based storage

### Mobile Test Data
- **File System**: Mocked Expo FileSystem operations
- **Camera Access**: Mocked Expo Camera permissions and recording
- **Network Requests**: Mocked fetch operations with realistic responses
- **Platform Detection**: iOS/Android specific behavior mocking
- **Redux Store**: Pre-configured test store states

## Test Scenarios

### Happy Path Scenarios

#### Complete Multi-Video Workflow
1. **Initiate Upload**: Create merge session for 3 videos
2. **Upload Videos**: Upload all chunks for each video
3. **Complete Uploads**: Finalize each video upload
4. **Trigger Merge**: Last video completion triggers merge
5. **Monitor Merge**: Check merge status until completion
6. **Create Challenge**: Use merged video data for challenge
7. **Retrieve Challenge**: Fetch challenge with segment metadata
8. **Submit Guess**: Make guess and verify result
9. **Verify Stats**: Check updated challenge statistics

#### Cross-Platform Compatibility
1. **iOS Workflow**: Test with iOS-specific file URIs and behaviors
2. **Android Workflow**: Test with Android content URIs and behaviors
3. **Device Variations**: Test across different device capabilities
4. **Network Conditions**: Test with various network scenarios

### Error Scenarios

#### Upload Failures
1. **Network Interruption**: Simulate network failure during upload
2. **Chunk Corruption**: Test hash mismatch detection
3. **Server Errors**: Handle 5xx responses gracefully
4. **Authentication Expiry**: Handle token expiration during upload
5. **File Access Errors**: Handle file system permission issues

#### Merge Failures
1. **FFmpeg Unavailable**: Handle missing video processing tools
2. **Insufficient Storage**: Handle disk space issues
3. **Corrupted Input**: Handle invalid video files
4. **Timeout Scenarios**: Handle long-running merge operations
5. **Resource Exhaustion**: Handle system resource limits

#### Recovery Scenarios
1. **Resume Upload**: Continue interrupted upload from last chunk
2. **Retry Logic**: Automatic retry with exponential backoff
3. **Session Recovery**: Restore upload session after app restart
4. **Cleanup Operations**: Proper cleanup of failed operations
5. **User Notification**: Appropriate error messaging

### Performance Scenarios

#### Concurrent Operations
1. **Multiple Users**: Simultaneous uploads from different users
2. **Large Files**: Upload videos at maximum size limits
3. **High Frequency**: Rapid successive operations
4. **Resource Contention**: Multiple operations competing for resources
5. **Scalability Limits**: Test system limits and graceful degradation

## Validation Criteria

### Functional Requirements
- ✅ All three videos upload successfully
- ✅ Videos merge into single file with correct segments
- ✅ Challenge created with accurate segment metadata
- ✅ Playback works with segment navigation
- ✅ Guess submission and validation works correctly
- ✅ Data persists correctly across operations

### Non-Functional Requirements
- ✅ Upload completes within reasonable time limits
- ✅ Merge operation completes within expected timeframe
- ✅ System handles concurrent users appropriately
- ✅ Error recovery works reliably
- ✅ Memory usage remains within acceptable bounds
- ✅ Temporary files are cleaned up properly

### Security Requirements
- ✅ Authentication required for all operations
- ✅ Users can only access their own sessions
- ✅ File validation prevents malicious uploads
- ✅ Proper authorization for challenge operations
- ✅ Secure handling of temporary files

## Continuous Integration

### GitHub Actions Integration
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  backend-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r test-requirements.txt
      - name: Run E2E tests
        run: |
          cd backend
          python run_e2e_tests.py
  
  mobile-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: |
          cd mobile
          npm install
      - name: Run E2E tests
        run: |
          cd mobile
          node run_e2e_tests.js
```

### Local Development
```bash
# Run all tests before committing
./run_all_e2e_tests.sh

# Run specific test suites
./run_backend_e2e_tests.sh
./run_mobile_e2e_tests.sh
```

## Troubleshooting

### Common Issues

#### Backend Tests
- **FFmpeg Not Found**: Install FFmpeg or mock the service
- **Port Conflicts**: Ensure test ports are available
- **File Permissions**: Check temporary directory permissions
- **Database Locks**: Ensure proper test isolation

#### Mobile Tests
- **Node Modules**: Clear and reinstall if tests fail to run
- **Jest Cache**: Clear Jest cache with `--no-cache` flag
- **Mock Issues**: Verify all required modules are properly mocked
- **Timeout Issues**: Increase timeout for slow operations

### Debug Mode
```bash
# Backend debug mode
python -m pytest tests/test_complete_e2e_workflow.py -v -s --tb=long

# Mobile debug mode
npm test -- --testPathPattern=CompleteE2EWorkflow.test.tsx --verbose --no-cache --detectOpenHandles
```

### Performance Profiling
```bash
# Backend profiling
python -m pytest tests/test_complete_e2e_workflow.py --profile

# Mobile profiling
npm test -- --testPathPattern=CompleteE2EWorkflow.test.tsx --verbose --logHeapUsage
```

## Maintenance

### Regular Updates
- **Test Data**: Update mock data to reflect API changes
- **Dependencies**: Keep test dependencies up to date
- **Scenarios**: Add new test scenarios for new features
- **Documentation**: Update documentation with new test cases

### Performance Monitoring
- **Execution Time**: Monitor test execution times
- **Resource Usage**: Track memory and CPU usage during tests
- **Success Rates**: Monitor test success rates over time
- **Coverage Metrics**: Maintain high test coverage

### Quality Assurance
- **Code Review**: All test changes require review
- **Test Reliability**: Ensure tests are deterministic and reliable
- **Documentation**: Keep test documentation current
- **Best Practices**: Follow testing best practices and patterns

## Conclusion

This comprehensive end-to-end testing suite ensures that the complete user workflow from video capture through challenge playback works correctly across all platforms and scenarios. The tests provide confidence in the system's reliability, performance, and user experience while catching regressions early in the development process.