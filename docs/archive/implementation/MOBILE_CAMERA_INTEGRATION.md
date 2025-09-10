<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Mobile Camera Integration Documentation

## Overview

This document describes the mobile-specific camera integration implemented for the Two Truths and a Lie mobile app using Expo Camera module. The integration provides seamless video recording capabilities with permissions management, real-time preview, and recording controls.

## Architecture

### Components

#### MobileCameraRecorder
- **Location**: `src/components/MobileCameraRecorder.tsx`
- **Purpose**: Core camera recording component with full mobile optimization
- **Features**:
  - Expo Camera integration with video recording
  - Permission management (camera and media library)
  - Real-time recording preview
  - Recording controls (start, stop, pause)
  - Error handling and recovery
  - Redux state integration

#### ChallengeCreationScreen
- **Location**: `src/screens/ChallengeCreationScreen.tsx`
- **Purpose**: Mobile-optimized challenge creation workflow
- **Features**:
  - Step-by-step recording process
  - Video recording for all three statements
  - Lie selection interface
  - Preview and submission workflow
  - Modal-based camera integration

### Redux Integration

#### Challenge Creation Slice
- **Location**: `src/store/slices/challengeCreationSlice.ts`
- **State Management**:
  - Recording state per statement
  - Media data storage
  - Permission status tracking
  - Error handling
  - Upload progress (optional)

## Key Features

### 1. Permission Management
```typescript
// Automatic permission checking and requesting
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
```

### 2. Video Recording
```typescript
// Recording with quality and duration controls
const recordingOptions = {
  quality: '720p' as const,
  maxDuration: 60, // 60 seconds max
  mute: false,
};

const recording = await cameraRef.current.recordAsync(recordingOptions);
```

### 3. Real-time Preview
- Live camera preview during recording
- Recording indicator with duration timer
- Camera flip functionality (front/back)
- Touch-optimized controls

### 4. Error Handling
- Permission denied scenarios
- Camera hardware unavailability
- Recording interruptions
- Storage limitations
- Network connectivity issues

### 5. State Synchronization
- Redux integration for cross-component state
- Recording progress tracking
- Media data persistence
- Challenge validation

## Usage

### Basic Implementation
```typescript
import { MobileCameraRecorder } from '../components/MobileCameraRecorder';

<MobileCameraRecorder
  statementIndex={0}
  onRecordingComplete={(media) => {
    // Handle completed recording
    console.log('Recording complete:', media);
  }}
  onError={(error) => {
    // Handle recording errors
    console.error('Recording error:', error);
  }}
/>
```

### Integration with Challenge Creation
```typescript
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';

<Modal visible={showChallengeCreation} presentationStyle="fullScreen">
  <ChallengeCreationScreen
    onComplete={() => {
      // Handle challenge completion
      setShowChallengeCreation(false);
    }}
    onCancel={() => {
      // Handle cancellation
      setShowChallengeCreation(false);
    }}
  />
</Modal>
```

## Technical Requirements

### Dependencies
- `expo-camera`: ^16.1.11 - Camera access and recording
- `expo-media-library`: ^17.1.7 - Media storage permissions
- `expo-permissions`: ^14.4.0 - Permission management
- `@reduxjs/toolkit`: ^2.8.2 - State management
- `react-redux`: ^9.2.0 - React-Redux integration

### Permissions Required
- **Camera**: Required for video recording
- **Media Library**: Required for saving recordings
- **Microphone**: Automatically included with camera permission

### Platform Support
- **iOS**: Full support with native camera integration
- **Android**: Full support with native camera integration
- **Expo Go**: Supported for development and testing

## Testing

### Unit Tests
- Component rendering with permissions
- Error state handling
- Redux state integration
- Recording lifecycle management

### Integration Tests
- End-to-end recording workflow
- Permission flow testing
- State synchronization validation
- Error recovery scenarios

### Manual Testing Checklist
- [ ] Camera permission request and handling
- [ ] Video recording start/stop functionality
- [ ] Camera flip (front/back) operation
- [ ] Recording duration tracking
- [ ] Error handling for various scenarios
- [ ] Challenge creation workflow completion
- [ ] Redux state updates during recording
- [ ] Media data persistence and validation

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Camera component loaded only when needed
2. **Memory Management**: Proper cleanup of recording resources
3. **State Efficiency**: Minimal Redux state updates during recording
4. **File Handling**: Local blob URLs for immediate playback

### Resource Management
- Automatic cleanup of recording timers
- Proper disposal of camera resources
- Memory-efficient media handling
- Background task management

## Error Scenarios and Handling

### Common Error Cases
1. **Permission Denied**: Show permission request UI
2. **Camera Unavailable**: Display error message with retry option
3. **Storage Full**: Alert user and suggest cleanup
4. **Recording Interrupted**: Auto-save partial recording
5. **Network Issues**: Local storage with sync on reconnect

### Recovery Mechanisms
- Automatic retry for transient errors
- Graceful degradation for hardware issues
- User-friendly error messages
- Clear recovery instructions

## Future Enhancements

### Planned Features
1. **Video Compression**: Client-side compression before storage
2. **Cloud Upload**: Optional backend integration
3. **Recording Quality Settings**: User-configurable quality options
4. **Batch Recording**: Record multiple statements in sequence
5. **Preview Playback**: In-app video playback before submission

### Performance Improvements
1. **Background Recording**: Continue recording when app backgrounded
2. **Streaming Upload**: Upload while recording for large files
3. **Adaptive Quality**: Automatic quality adjustment based on device
4. **Caching Strategy**: Intelligent media caching and cleanup

## Troubleshooting

### Common Issues
1. **Black Camera Screen**: Check permissions and restart app
2. **Recording Not Starting**: Verify camera availability
3. **Audio Issues**: Check microphone permissions
4. **File Not Saving**: Verify media library permissions
5. **App Crashes**: Check device storage and memory

### Debug Information
- Enable Redux DevTools for state inspection
- Use Expo development tools for debugging
- Check device logs for native errors
- Monitor memory usage during recording

## Conclusion

The mobile camera integration provides a robust, user-friendly video recording experience optimized for the Two Truths and a Lie game. The implementation follows React Native and Expo best practices while maintaining seamless integration with the existing Redux state management system.

The modular architecture allows for easy maintenance and future enhancements while ensuring reliable performance across different mobile devices and platforms.