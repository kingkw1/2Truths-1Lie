# Integration Testing Guide

## Overview

This document describes the comprehensive end-to-end integration tests that cover the complete workflow from challenge creation through storage, retrieval, and display. These tests validate the entire media upload system including cross-device accessibility and data persistence.

## Test Coverage

### 1. Complete Challenge Creation Workflow
- **Mobile Video Recording**: Tests recording of individual statements and merging into single video
- **Video Upload**: Tests chunked upload with progress tracking, error handling, and resume capability
- **Challenge Creation**: Tests backend challenge creation with merged video and segment metadata
- **Data Persistence**: Validates that challenges are properly stored and retrievable

### 2. Challenge Retrieval and Display
- **Challenge Listing**: Tests authenticated challenge list retrieval with pagination
- **Challenge Details**: Tests specific challenge retrieval with complete metadata
- **Segment Metadata**: Validates segment timing and playback information
- **Cross-Device Access**: Tests challenge accessibility across different devices and sessions

### 3. Media Upload Integration
- **Chunked Upload Flow**: Tests complete upload from initiation through completion
- **Resume Functionality**: Tests upload resume after network interruption
- **Error Handling**: Tests various error scenarios and recovery mechanisms
- **Cloud Storage Integration**: Tests integration with cloud storage providers

### 4. Cross-Platform Compatibility
- **iOS-Specific Handling**: Tests iOS-specific media access patterns and file URIs
- **Android-Specific Handling**: Tests Android-specific media access and content URIs
- **Platform-Agnostic APIs**: Validates consistent API behavior across platforms

### 5. Guess Submission and Results
- **Guess Submission**: Tests guess submission with validation
- **Result Calculation**: Tests correct/incorrect guess handling
- **Statistics Updates**: Tests challenge statistics updates after guesses

### 6. Error Handling and Recovery
- **Network Errors**: Tests graceful handling of network failures
- **Authentication Errors**: Tests proper error handling for auth failures
- **Validation Errors**: Tests server-side validation and error responses
- **Data Consistency**: Tests data integrity across error scenarios

## Test Files

### Mobile Tests
- **`mobile/src/__tests__/EndToEndIntegration.test.tsx`**: Comprehensive mobile integration tests
  - Complete challenge creation workflow
  - Upload progress and error handling
  - Cross-platform compatibility tests
  - UI integration with upload services

### Backend Tests
- **`backend/tests/test_end_to_end_integration.py`**: Backend integration tests
  - Complete API workflow testing
  - Concurrent user scenarios
  - Data validation and integrity
  - Error recovery mechanisms

### Test Runner
- **`test_integration_runner.py`**: Automated test execution script
  - Starts backend server automatically
  - Runs both mobile and backend tests
  - Generates comprehensive test reports
  - Handles cleanup and error recovery

## Running the Tests

### Prerequisites

1. **Backend Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   pip install -r test-requirements.txt
   ```

2. **Mobile Dependencies**:
   ```bash
   cd mobile
   npm install
   ```

3. **Python Dependencies for Test Runner**:
   ```bash
   pip install requests
   ```

### Running All Integration Tests

Use the automated test runner for complete integration testing:

```bash
python test_integration_runner.py
```

This will:
- Start the backend server automatically
- Run cross-platform validation tests
- Execute backend integration tests
- Execute mobile integration tests
- Generate a comprehensive test report
- Clean up resources automatically

### Running Individual Test Suites

#### Backend Tests Only
```bash
cd backend
python -m pytest tests/test_end_to_end_integration.py -v
```

#### Mobile Tests Only
```bash
cd mobile
npm test src/__tests__/EndToEndIntegration.test.tsx
```

### Running Specific Test Categories

#### Upload Workflow Tests
```bash
cd backend
python -m pytest tests/test_end_to_end_integration.py::TestCompleteWorkflowIntegration::test_complete_challenge_lifecycle -v
```

#### Cross-Platform Tests
```bash
cd mobile
npm test -- --testNamePattern="Cross-Device Accessibility"
```

#### Error Handling Tests
```bash
cd backend
python -m pytest tests/test_end_to_end_integration.py::TestCompleteWorkflowIntegration::test_error_recovery_workflow -v
```

## Test Scenarios

### 1. Happy Path Workflow
1. **Video Recording**: User records three statements on mobile device
2. **Video Merging**: App merges statements into single video with segment metadata
3. **Upload**: Chunked upload of merged video to backend with progress tracking
4. **Challenge Creation**: Backend creates challenge with segment metadata
5. **Storage**: Challenge and media stored persistently
6. **Retrieval**: Challenge appears in list and can be retrieved by ID
7. **Playback**: Individual segments can be played back using metadata
8. **Guess Submission**: Users can submit guesses and receive results
9. **Statistics**: Challenge statistics update correctly

### 2. Error Recovery Scenarios
1. **Network Interruption**: Upload resumes after network failure
2. **Server Errors**: Proper error handling and user feedback
3. **Authentication Issues**: Graceful handling of auth failures
4. **Validation Errors**: Clear error messages for invalid data
5. **Storage Failures**: Fallback mechanisms for storage issues

### 3. Cross-Platform Scenarios
1. **iOS Upload**: Tests iOS-specific file handling and permissions
2. **Android Upload**: Tests Android content URI handling
3. **Cross-Device Access**: Challenge created on one device accessible on another
4. **Platform-Specific UI**: Tests platform-specific UI adaptations

### 4. Concurrent User Scenarios
1. **Multiple Uploads**: Multiple users uploading simultaneously
2. **Shared Challenges**: Users accessing each other's challenges
3. **Concurrent Guessing**: Multiple users guessing on same challenge
4. **Resource Contention**: Tests system behavior under load

## Test Data and Mocking

### Mock Strategy
- **File System**: Mocked using `expo-file-system` mocks
- **Network Requests**: Mocked using Jest fetch mocks
- **Cloud Storage**: Mocked cloud storage service responses
- **Authentication**: Test tokens for different user scenarios

### Test Data
- **Sample Video Data**: Realistic video-like binary data with proper headers
- **Challenge Scenarios**: Various challenge configurations for testing
- **User Scenarios**: Multiple test users for concurrent testing
- **Error Scenarios**: Predefined error conditions for testing

## Validation and Assertions

### Data Integrity
- **Upload Completeness**: Verifies all chunks uploaded correctly
- **File Hash Validation**: Ensures uploaded file matches original
- **Segment Metadata**: Validates timing and duration calculations
- **Challenge Structure**: Verifies complete challenge data structure

### API Consistency
- **Request/Response Format**: Validates API contract compliance
- **Error Response Format**: Ensures consistent error responses
- **Authentication Flow**: Validates token handling and permissions
- **Status Code Accuracy**: Ensures appropriate HTTP status codes

### Cross-Platform Consistency
- **Data Format**: Same data format across platforms
- **API Behavior**: Consistent API responses regardless of client
- **Error Handling**: Consistent error handling across platforms
- **Media Handling**: Platform-specific media handling works correctly

## Performance Validation

### Upload Performance
- **Large File Handling**: Tests with files up to size limits
- **Chunk Upload Speed**: Validates reasonable upload speeds
- **Memory Usage**: Ensures memory usage stays within bounds
- **Concurrent Upload Handling**: Tests multiple simultaneous uploads

### API Performance
- **Response Times**: Validates API response times under load
- **Database Performance**: Tests challenge retrieval performance
- **Concurrent Request Handling**: Tests API under concurrent load
- **Resource Cleanup**: Ensures proper resource cleanup

## Troubleshooting

### Common Issues

1. **Backend Server Won't Start**
   - Check if port 8001 is available
   - Verify backend dependencies are installed
   - Check for configuration issues

2. **Mobile Tests Fail**
   - Ensure Node.js and npm are properly installed
   - Verify mobile dependencies are installed
   - Check for Jest configuration issues

3. **Network Connection Issues**
   - Verify backend server is running on correct port
   - Check firewall settings
   - Ensure localhost/IP address is accessible

4. **Test Timeouts**
   - Increase timeout values in test configuration
   - Check for slow network or system performance
   - Verify mock responses are properly configured

### Debug Mode

Run tests with additional debugging:

```bash
# Backend with debug output
cd backend
python -m pytest tests/test_end_to_end_integration.py -v -s --tb=long

# Mobile with debug output
cd mobile
npm test -- --verbose --no-coverage src/__tests__/EndToEndIntegration.test.tsx
```

### Log Analysis

Check logs for detailed error information:
- **Backend Logs**: Server console output during test execution
- **Mobile Logs**: Jest test output and console logs
- **Test Runner Logs**: Integration test runner output

## Continuous Integration

### CI/CD Integration

The integration tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Integration Tests
on: [push, pull_request]
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: |
          cd backend && pip install -r requirements.txt -r test-requirements.txt
          cd ../mobile && npm install
      - name: Run integration tests
        run: python test_integration_runner.py
```

### Test Reporting

The test runner generates detailed reports:
- **JSON Report**: `integration_test_report.json` with detailed results
- **Console Output**: Real-time test progress and results
- **Error Details**: Comprehensive error information for debugging

## Maintenance

### Updating Tests

When adding new features:
1. Add corresponding test scenarios to integration tests
2. Update mock data and responses as needed
3. Verify cross-platform compatibility
4. Update documentation with new test coverage

### Test Data Management

- Keep test data realistic but minimal
- Update mock responses when API changes
- Maintain test user scenarios for different use cases
- Regular cleanup of temporary test files

### Performance Monitoring

- Monitor test execution times
- Track memory usage during tests
- Identify and optimize slow test scenarios
- Regular review of test coverage and effectiveness

## Conclusion

These integration tests provide comprehensive coverage of the complete media upload and challenge management workflow. They ensure that the system works correctly across platforms, handles errors gracefully, and maintains data integrity throughout the entire user journey.

Regular execution of these tests helps maintain system reliability and catch integration issues early in the development process.