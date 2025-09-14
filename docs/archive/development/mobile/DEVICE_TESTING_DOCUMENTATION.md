# Device Camera Testing Documentation

## Overview

This document describes the comprehensive testing suite for mobile camera recording, playback, and re-recording flows on actual devices. The tests validate that the mobile camera integration works correctly across different device types, operating systems, and hardware configurations.

## Test Structure

### Test Files

1. **DeviceCameraRecordingFlow.test.tsx**
   - Tests camera recording functionality
   - Validates permission handling
   - Tests error scenarios and recovery
   - Covers hardware-specific behaviors

2. **DevicePlaybackReRecordingFlow.test.tsx**
   - Tests video playback functionality
   - Validates re-recording workflows
   - Tests preview mode with playback controls
   - Covers accessibility and user experience

3. **DeviceEndToEndCameraFlow.test.tsx**
   - Complete end-to-end workflows
   - Device-specific optimizations
   - Cross-platform compatibility
   - Performance and memory management

### Device Scenarios

The tests simulate different device configurations:

#### iPhone 13 Pro
- **Platform**: iOS
- **Screen**: 390x844 (6.1" OLED)
- **Camera**: 1080p recording
- **Storage**: 50GB available
- **Features**: Haptic feedback, high-quality recording

#### Android Pixel 6
- **Platform**: Android
- **Screen**: 393x851 (6.4" OLED)
- **Camera**: 720p recording
- **Storage**: 20GB available
- **Features**: Vibration feedback, standard quality

#### Low-End Android Device
- **Platform**: Android
- **Screen**: 360x640 (5.5" LCD)
- **Camera**: 480p recording
- **Storage**: 2GB available
- **Features**: Performance constraints, limited resources

#### iPad Pro
- **Platform**: iOS
- **Screen**: 820x1180 (12.9" Liquid Retina)
- **Camera**: 1080p recording
- **Storage**: 100GB available
- **Features**: Tablet-optimized UI, larger files

## Test Categories

### 1. Normal Recording Flow

**Objective**: Validate successful video recording under normal conditions.

**Test Cases**:
- ✅ Camera initialization and readiness
- ✅ Recording start/stop functionality
- ✅ Duration tracking and progress display
- ✅ File creation and validation
- ✅ Success feedback and completion

**Device-Specific Behaviors**:
- iOS: Haptic feedback, "Tap and hold for best results" tip
- Android: Vibration feedback, "Keep your device steady" tip
- Low-end: Longer initialization, smaller file sizes
- Tablet: Larger UI elements, higher quality recordings

### 2. Permission Handling

**Objective**: Ensure proper camera and media library permission management.

**Test Cases**:
- ✅ Camera permission request flow
- ✅ Media library permission request flow
- ✅ Permission denial handling
- ✅ Permission recovery after denial
- ✅ Settings redirect for persistent denials

**Expected Behaviors**:
- Clear permission request UI with explanations
- Graceful handling of permission denials
- Retry mechanisms for permission requests
- User-friendly error messages

### 3. Storage and File Management

**Objective**: Validate storage space checking and file handling.

**Test Cases**:
- ✅ Storage space validation before recording
- ✅ Insufficient storage error handling
- ✅ File existence validation after recording
- ✅ Empty file detection and rejection
- ✅ File size validation and limits

**Storage Thresholds**:
- Minimum required: 100MB free space
- Warning threshold: 500MB free space
- Compression trigger: Files > 50MB

### 4. Hardware and System Errors

**Objective**: Test resilience against hardware failures and system interruptions.

**Test Cases**:
- ✅ Camera hardware unavailability
- ✅ App backgrounding during recording
- ✅ Hardware back button handling (Android)
- ✅ Phone call interruptions
- ✅ Battery optimization interference

**Error Recovery**:
- Automatic retry with exponential backoff
- User-friendly error categorization
- Clear recovery instructions
- Graceful degradation when possible

### 5. Recording Limits and Timeouts

**Objective**: Validate recording duration limits and automatic controls.

**Test Cases**:
- ✅ Maximum duration enforcement (60 seconds)
- ✅ Minimum duration validation (1 second)
- ✅ Automatic stop at time limit
- ✅ Warning display approaching limit
- ✅ Timeout error handling

**Time Limits**:
- Maximum recording: 60 seconds
- Minimum recording: 1 second
- Warning display: At 50 seconds (10s remaining)
- Automatic timeout: 65 seconds (with buffer)

### 6. Video Playback

**Objective**: Test video playback functionality in lie selection and preview modes.

**Test Cases**:
- ✅ Video player initialization
- ✅ Play/pause/stop controls
- ✅ Progress tracking and seeking
- ✅ Duration display
- ✅ Multiple video handling

**Playback Features**:
- Smooth playback controls
- Progress bar with seeking
- Duration display (MM:SS format)
- Memory-efficient multiple video handling

### 7. Re-recording Workflows

**Objective**: Validate the ability to re-record individual statements.

**Test Cases**:
- ✅ Re-recording initiation from lie selection
- ✅ Original recording preservation during re-recording
- ✅ Re-recording completion and replacement
- ✅ Re-recording cancellation
- ✅ Multiple statement re-recording

**Re-recording Flow**:
1. User selects "Retake" on statement card
2. Camera modal opens for re-recording
3. User can record new version or cancel
4. On completion, new recording replaces original
5. User returns to lie selection with updated recording

### 8. Cross-Platform Compatibility

**Objective**: Ensure consistent behavior across iOS and Android platforms.

**Test Cases**:
- ✅ Consistent UI across platforms
- ✅ Platform-specific optimizations
- ✅ File format compatibility
- ✅ Performance scaling by device capability

**Platform Differences**:
- **iOS**: Haptic feedback, .mov files, iOS-specific tips
- **Android**: Vibration feedback, .mp4 files, Android-specific tips
- **File Formats**: Automatic selection based on platform capabilities

### 9. Performance and Memory

**Objective**: Validate efficient resource usage and memory management.

**Test Cases**:
- ✅ Memory usage during multiple recordings
- ✅ Large file handling and compression
- ✅ Background memory cleanup
- ✅ Performance scaling on low-end devices

**Performance Metrics**:
- Memory usage should remain stable across multiple recordings
- Large files (>50MB) should trigger compression
- Low-end devices should receive quality adjustments
- No memory leaks during extended usage

### 10. Accessibility and UX

**Objective**: Ensure accessible and user-friendly camera interface.

**Test Cases**:
- ✅ Accessible control labels
- ✅ Clear visual feedback for recording states
- ✅ Helpful tooltips and guidance
- ✅ Error message clarity
- ✅ Loading state indicators

**Accessibility Features**:
- Screen reader compatible labels
- High contrast recording indicators
- Clear state transitions
- Helpful guidance text

## Running the Tests

### Prerequisites

```bash
# Install dependencies
cd mobile
npm install

# Ensure test environment is set up
npm run test:setup
```

### Running All Tests

```bash
# Run complete test suite
node src/__tests__/runDeviceTests.js

# Run with verbose output
npm test -- --verbose
```

### Running Device-Specific Tests

```bash
# Test specific device scenario
node src/__tests__/runDeviceTests.js --device iphone
node src/__tests__/runDeviceTests.js --device android
node src/__tests__/runDeviceTests.js --device low-end
node src/__tests__/runDeviceTests.js --device ipad

# List available devices
node src/__tests__/runDeviceTests.js --list-devices
```

### Running Individual Test Suites

```bash
# Camera recording tests only
npm test -- --testPathPattern="DeviceCameraRecordingFlow"

# Playback and re-recording tests only
npm test -- --testPathPattern="DevicePlaybackReRecordingFlow"

# End-to-end workflow tests only
npm test -- --testPathPattern="DeviceEndToEndCameraFlow"
```

## Test Results Interpretation

### Success Criteria

A test passes when:
- ✅ All camera operations complete successfully
- ✅ Error handling works as expected
- ✅ User feedback is appropriate and helpful
- ✅ Performance meets device-specific expectations
- ✅ Memory usage remains stable

### Common Failure Scenarios

1. **Permission Issues**
   - Cause: Mock permission setup incorrect
   - Solution: Verify permission mocks in test setup

2. **File System Errors**
   - Cause: File system mocks not properly configured
   - Solution: Check FileSystem mock implementations

3. **Timing Issues**
   - Cause: Async operations not properly awaited
   - Solution: Use proper `waitFor` and `act` wrappers

4. **Device-Specific Failures**
   - Cause: Platform-specific code not properly mocked
   - Solution: Verify Platform.OS and device scenario mocks

## Mock Configuration

### Device Scenario Setup

```javascript
// Set device scenario before tests
global.__DEVICE_SCENARIO__ = 'IPHONE_13';
global.__CAMERA_PERMISSION_GRANTED__ = true;
global.__MEDIA_LIBRARY_PERMISSION_GRANTED__ = true;
```

### Camera Mock Behavior

The camera mock simulates realistic device behaviors:
- Recording delays based on device performance
- File sizes based on device camera quality
- Error scenarios for testing edge cases
- Platform-specific features and limitations

### File System Mock Behavior

The file system mock provides:
- Realistic storage space calculations
- Device-specific file size simulations
- Storage full scenarios for testing
- File existence and validation checks

## Continuous Integration

### GitHub Actions Integration

```yaml
name: Mobile Camera Tests
on: [push, pull_request]
jobs:
  mobile-camera-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd mobile && npm ci
      - run: cd mobile && node src/__tests__/runDeviceTests.js
```

### Test Coverage Requirements

- **Minimum Coverage**: 90% for camera-related components
- **Critical Paths**: 100% coverage for error handling
- **Device Scenarios**: All device types must pass
- **Performance**: Memory usage tests must pass on low-end devices

## Troubleshooting

### Common Issues

1. **Tests Timeout**
   - Increase timeout values in Jest configuration
   - Check for unresolved promises in async operations

2. **Mock Failures**
   - Verify all required modules are properly mocked
   - Check mock implementation matches actual API

3. **Platform-Specific Failures**
   - Ensure Platform.OS mock is correctly set
   - Verify device-specific code paths are tested

4. **Memory Issues**
   - Check for proper cleanup in test teardown
   - Verify mocks don't retain references

### Debug Mode

```bash
# Run tests with debug output
DEBUG=true npm test -- --testPathPattern="DeviceCameraRecordingFlow"

# Run single test with full output
npm test -- --testNamePattern="completes full challenge creation workflow" --verbose
```

## Future Enhancements

### Planned Improvements

1. **Real Device Testing**
   - Integration with Expo EAS Build for device testing
   - Automated testing on physical devices
   - Performance benchmarking on real hardware

2. **Advanced Scenarios**
   - Network connectivity changes during recording
   - Battery level impact on recording quality
   - Temperature-based performance throttling

3. **Accessibility Testing**
   - Screen reader compatibility validation
   - Voice control integration testing
   - High contrast mode validation

4. **Performance Monitoring**
   - Real-time memory usage tracking
   - Frame rate monitoring during recording
   - Battery usage optimization validation

## Conclusion

This comprehensive testing suite ensures that the mobile camera integration works reliably across different devices and scenarios. The tests cover the complete user journey from initial recording through playback and re-recording, with proper error handling and performance optimization for various device capabilities.

Regular execution of these tests helps maintain high quality and reliability of the mobile camera functionality, ensuring a smooth user experience across all supported devices and platforms.