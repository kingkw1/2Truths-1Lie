# Enhanced Challenge Creation Component Usage Guide

## Overview

The `EnhancedChallengeCreation` component provides a complete workflow for creating challenges with video segment recording and merging functionality.

## Components Available

### 1. `EnhancedChallengeCreation` (Direct)
The main component with full functionality.

### 2. `SafeEnhancedChallengeCreation` (Recommended)
A wrapped version with error boundaries and safety checks.

## Usage

### Basic Usage (Recommended)

```typescript
import { SafeEnhancedChallengeCreation } from '../components';

// In your screen/component
<SafeEnhancedChallengeCreation
  onChallengeComplete={(challengeData) => {
    console.log('Challenge created:', challengeData);
    // Handle challenge completion
    navigation.navigate('ChallengeList');
  }}
  onCancel={() => {
    // Handle cancellation
    navigation.goBack();
  }}
/>
```

### Advanced Usage (Direct Component)

```typescript
import { EnhancedChallengeCreation } from '../components';

// In your screen/component
<EnhancedChallengeCreation
  onChallengeComplete={(challengeData) => {
    // challengeData contains:
    // - statements: Array of statement objects
    // - mediaData: Array with merged video containing segments
    // - other challenge metadata
    
    const mergedVideo = challengeData.mediaData[0];
    console.log('Merged video segments:', mergedVideo.segments);
    
    // Process the challenge data
    handleChallengeCreation(challengeData);
  }}
  onCancel={() => {
    // Handle user cancellation
    handleCancel();
  }}
/>
```

## Props

### `onChallengeComplete?: (challengeData: any) => void`
Called when the user completes the challenge creation process.

**challengeData structure:**
```typescript
{
  statements: Statement[],           // Array of 3 statements
  mediaData: MediaCapture[],        // Array with 1 merged video
  // ... other challenge properties
}
```

**MediaCapture structure for merged video:**
```typescript
{
  type: 'video',
  url: string,                      // Local video URL
  streamingUrl?: string,            // Server streaming URL
  duration: number,                 // Total duration in ms
  fileSize: number,                 // File size in bytes
  isMergedVideo: true,             // Flag indicating merged video
  segments: VideoSegment[],        // Array of 3 segments
  isUploaded: boolean,             // Upload status
  // ... other properties
}
```

**VideoSegment structure:**
```typescript
{
  statementIndex: number,          // 0, 1, or 2
  startTime: number,               // Start time in ms
  endTime: number,                 // End time in ms
  duration: number,                // Segment duration in ms
}
```

### `onCancel?: () => void`
Called when the user cancels the challenge creation process.

## Workflow Steps

1. **Statements Input**: User enters 3 statements and selects which is the lie
2. **Individual Recording**: User records video for each statement
3. **Video Merging**: Automatic merging of 3 videos with progress tracking
4. **Preview**: Shows merged video information and segment metadata
5. **Completion**: Returns challenge data with merged video

## Error Handling

The `SafeEnhancedChallengeCreation` component includes:

- Error boundaries to catch React errors
- Service initialization checks
- Redux state validation
- Platform compatibility checks
- Graceful error messages for users

## Requirements

### Redux Store
The component requires the following Redux slices:
- `challengeCreation` - for managing challenge state
- Proper store configuration with the challenge creation reducer

### Services
- `mobileMediaIntegration` - for video recording and merging
- `videoMergingService` - for video processing
- `uploadService` - for uploading merged videos

### Permissions
The component will request:
- Camera permission
- Microphone permission
- Media library permission

## Example Integration

```typescript
// In your navigation screen
import React from 'react';
import { SafeEnhancedChallengeCreation } from '../components';

const CreateChallengeScreen = ({ navigation }) => {
  const handleChallengeComplete = (challengeData) => {
    // Save challenge to backend
    saveChallengeToBackend(challengeData);
    
    // Navigate to success screen
    navigation.navigate('ChallengeCreated', { 
      challengeId: challengeData.id 
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeEnhancedChallengeCreation
      onChallengeComplete={handleChallengeComplete}
      onCancel={handleCancel}
    />
  );
};

export default CreateChallengeScreen;
```

## Troubleshooting

### Common Issues

1. **"Service not initialized" errors**
   - Use `SafeEnhancedChallengeCreation` which handles initialization
   - Ensure Redux store is properly configured

2. **Permission errors**
   - Component will guide user through permission requests
   - Ensure app has proper permission configurations

3. **Video merging failures**
   - Component shows error messages and retry options
   - Check device storage space
   - Ensure stable network connection for upload

4. **"window is not defined" errors**
   - Use `SafeEnhancedChallengeCreation` for better error handling
   - Ensure running in React Native environment, not web

### Debug Mode

Enable debug logging by setting `__DEV__` to true:
```typescript
if (__DEV__) {
  console.log('Challenge creation debug info');
}
```

## Performance Notes

- Video merging is performed locally before upload
- Progress tracking provides user feedback during processing
- Temporary files are automatically cleaned up
- Component uses React.useMemo for performance optimization