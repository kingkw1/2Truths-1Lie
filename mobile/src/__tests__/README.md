# Mobile Media Capture Testing Suite

## Overview

This directory contains comprehensive unit and integration tests for mobile media capture scenarios and permission flows in the Two Truths and a Lie mobile application.

## Test Files

### 1. PermissionFlows.test.tsx
**Purpose**: Tests all permission scenarios for mobile media capture

**Test Coverage**:
- Initial permission requests (camera and media library)
- Permission denial and recovery workflows
- Permission revocation during recording
- Multiple permission types handling
- Platform-specific permission behaviors (iOS/Android)
- Permission state persistence across component lifecycle
- Error callback integration for permission failures

**Key Scenarios**:
- ✅ Camera permission granted/denied flows
- ✅ Media library permission granted/denied flows
- ✅ Mixed permission states (one granted, one denied)
- ✅ Permission recovery after initial denial
- ✅ Permission revocation during active recording
- ✅ Platform-specific permission UI adaptations
- ✅ Error handling with user-friendly messages

### 2. MobileMediaCaptureScenarios.test.tsx
**Purpose**: Tests comprehensive mobile-specific media capture scenarios

**Test Coverage**:
- Recording lifecycle management (start, stop, pause, resume)
- Storage space monitoring and error handling
- Hardware error scenarios and recovery
- Background interruption handling
- Platform-specific behaviors (iOS vs Android)
- File validation and processing
- Performance optimization scenarios
- Error recovery and retry logic

**Key Scenarios**:
- ✅ Complete recording lifecycle with state transitions
- ✅ Storage space detection and monitoring during recording
- ✅ Camera hardware unavailable/busy error handling
- ✅ App backgrounding and phone call interruptions
- ✅ iOS-specific recording formats (QuickTime) vs Android (MP4)
- ✅ File existence, size, and duration validation
- ✅ Memory pressure and resource cleanup
- ✅ Retry logic with attempt counting and exponential backoff

### 3. MobileChallengeCreationIntegration.test.tsx
**Purpose**: Tests end-to-end mobile challenge creation workflow integration

**Test Coverage**:
- Complete challenge creation flow from start to finish
- Integration between ChallengeCreationScreen and MobileCameraRecorder
- Redux state management across components
- Modal navigation and state persistence
- Error handling across the entire workflow
- Mobile-specific UI interactions

**Key Scenarios**:
- ✅ Sequential recording of three video statements
- ✅ Lie selection after recording completion
- ✅ Challenge preview and submission workflow
- ✅ Error handling integration across components
- ✅ State management consistency during navigation
- ✅ Modal opening/closing with state preservation
- ✅ User experience flow with clear feedback

### 4. MobileReduxIntegration.test.tsx
**Purpose**: Tests Redux state management integration for mobile media capture

**Test Coverage**:
- Challenge creation slice state management
- Media recording state synchronization
- Cross-component state sharing
- State persistence and recovery
- Action dispatching and state updates
- Error state management

**Key Scenarios**:
- ✅ Challenge initialization and state setup
- ✅ Recording state management per statement index
- ✅ Media data storage and retrieval
- ✅ Lie statement selection and validation
- ✅ Challenge validation with comprehensive error checking
- ✅ Submission state management (start, success, failure)
- ✅ Preview mode state transitions
- ✅ State recovery from error conditions

## Test Setup and Configuration

### Jest Configuration
- **Environment**: jsdom for React Native component testing
- **Setup**: Custom setupTests.ts with Expo module mocks
- **Coverage**: Comprehensive coverage collection from src/ directory
- **Transform**: TypeScript and JavaScript transformation support

### Mock Strategy
- **Expo Camera**: Mocked with controllable permission states
- **Expo Media Library**: Mocked with permission simulation
- **Expo File System**: Mocked with storage space simulation
- **React Native**: Platform-specific behavior mocking
- **Redux Store**: Configurable test store for state management testing

### Test Utilities
- **@testing-library/react-native**: Component rendering and interaction
- **Redux Test Store**: Isolated store instances for each test
- **Mock Functions**: Comprehensive callback and error simulation
- **Timer Mocking**: Controlled time advancement for duration testing

## Running Tests

### Prerequisites
```bash
npm install
```

### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories

#### Unit Tests
- Individual component behavior
- Redux action and reducer logic
- Utility function validation
- Error handling mechanisms

#### Integration Tests
- Component interaction workflows
- State management across components
- End-to-end user scenarios
- Cross-platform behavior validation

## Test Scenarios Covered

### Permission Management
- [x] Initial permission requests for camera and media library
- [x] Permission denial handling with user-friendly messages
- [x] Permission recovery workflows with retry mechanisms
- [x] Permission revocation during active recording sessions
- [x] Platform-specific permission UI and behavior differences
- [x] Mixed permission states (partial grants)
- [x] Permission state persistence across app lifecycle

### Media Recording
- [x] Recording start, stop, pause, and resume functionality
- [x] Recording duration tracking and timeout handling
- [x] Storage space monitoring and insufficient space detection
- [x] Camera hardware availability and error handling
- [x] Background interruption and recovery (calls, app switching)
- [x] Platform-specific recording formats and quality settings
- [x] File validation (existence, size, duration, format)
- [x] Memory management and resource cleanup

### State Management
- [x] Challenge creation state initialization and management
- [x] Recording state synchronization across components
- [x] Media data storage and retrieval per statement
- [x] Lie statement selection and validation
- [x] Challenge validation with comprehensive error checking
- [x] Submission workflow state management
- [x] Error state handling and recovery mechanisms
- [x] State persistence and recovery across component lifecycle

### User Experience
- [x] Sequential recording workflow for three statements
- [x] Modal navigation with state preservation
- [x] Error feedback with actionable recovery options
- [x] Platform-specific UI adaptations (iOS/Android)
- [x] Loading states and progress indicators
- [x] Accessibility considerations and touch target sizing
- [x] Haptic feedback integration for mobile interactions

### Error Handling
- [x] Permission errors with clear recovery instructions
- [x] Hardware errors with retry mechanisms
- [x] Storage errors with space management guidance
- [x] Network errors with offline capability
- [x] Validation errors with specific field feedback
- [x] Submission errors with retry options
- [x] Graceful degradation for unsupported features

## Quality Assurance

### Code Coverage Targets
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Test Quality Metrics
- **Comprehensive Scenarios**: All major user flows covered
- **Error Conditions**: All error states tested with recovery
- **Platform Coverage**: iOS and Android specific behaviors
- **State Management**: Complete Redux integration testing
- **Performance**: Memory and resource management validation

### Accessibility Testing
- **Touch Targets**: Minimum 44pt touch target validation
- **Screen Reader**: Accessibility label and hint testing
- **Platform Compliance**: iOS and Android accessibility standards
- **Error Communication**: Clear error messaging for assistive technologies

## Maintenance and Updates

### Adding New Tests
1. Follow existing test file naming conventions
2. Use appropriate test categories (unit vs integration)
3. Include comprehensive error scenario coverage
4. Add platform-specific test cases where applicable
5. Update this README with new test coverage

### Mock Updates
- Update mocks when Expo SDK versions change
- Maintain compatibility with React Native updates
- Ensure mock behavior matches real API responses
- Test mock accuracy against actual device behavior

### Performance Considerations
- Keep test execution time reasonable (<30s total)
- Use appropriate mocking to avoid external dependencies
- Clean up resources in test teardown
- Monitor memory usage during test execution

## Conclusion

This comprehensive test suite ensures the mobile media capture functionality is robust, user-friendly, and handles all edge cases gracefully. The tests cover the complete user journey from permission requests through successful challenge creation, with thorough error handling and platform-specific optimizations.

The test suite serves as both validation for current functionality and documentation for expected behavior, making it easier to maintain and extend the mobile media capture features in the future.