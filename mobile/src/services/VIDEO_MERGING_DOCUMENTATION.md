# Video Merging with Segment Metadata - Implementation Documentation

## Overview

This implementation adds the capability to record individual statement videos and merge them into a single video file with segment metadata tracking. This allows for efficient storage and playback while maintaining the ability to play individual statements.

## Key Components

### 1. VideoMergingService (`videoMergingService.ts`)

Handles the core video merging functionality:

- **mergeStatementVideos()**: Merges three individual videos into one
- **createMergedMediaCapture()**: Creates MediaCapture object with segment metadata
- **getSegmentPlaybackInfo()**: Provides playback timing for individual segments
- **extractSegmentForPlayback()**: Prepares segments for playback
- **cleanupTempFiles()**: Manages temporary file cleanup

#### Key Features:
- Automatic segment timing calculation
- Compression support for large files
- Progress tracking during merge
- Error handling and validation
- Cross-platform compatibility (iOS/Android)

### 2. Enhanced MediaCapture Interface

Extended the `MediaCapture` interface to support merged videos:

```typescript
interface VideoSegment {
  statementIndex: number; // 0, 1, or 2
  startTime: number; // milliseconds
  endTime: number; // milliseconds  
  duration: number; // milliseconds
}

interface MediaCapture {
  // ... existing properties
  segments?: VideoSegment[]; // Segment metadata
  isMergedVideo?: boolean; // Flag for merged videos
}
```

### 3. Mobile Media Integration Updates

Enhanced `MobileMediaIntegrationService` with:

- **Individual recording storage**: Tracks recordings before merging
- **Automatic merging workflow**: Triggers merge when all recordings complete
- **Upload integration**: Uploads merged video to backend
- **Segment playback support**: Provides timing info for UI

### 4. Redux State Management

Added new state management for:

```typescript
interface ChallengeCreationState {
  // Individual recordings before merging
  individualRecordings: {
    [statementIndex: number]: MediaCapture | null;
  };
  
  // Video merging progress
  videoMerging: {
    isInProgress: boolean;
    progress: number;
    stage: 'preparing' | 'merging' | 'compressing' | 'finalizing' | null;
    currentSegment: number | null;
    error: string | null;
  };
  
  // Final merged video
  mergedVideo: MediaCapture | null;
}
```

### 5. Enhanced Challenge Creation Component

`EnhancedChallengeCreation.tsx` provides a complete workflow:

- Statement text input
- Individual video recording
- Lie selection
- Automatic video merging
- Progress tracking
- Challenge completion

## Workflow

### 1. Individual Recording Phase

```typescript
// User records each statement individually
for (let i = 0; i < 3; i++) {
  const recording = await mobileMediaIntegration.stopRecording(i, uri, duration);
  // Stored as individual recording, not uploaded yet
}
```

### 2. Video Merging Phase

```typescript
// When all recordings complete
const mergedVideo = await mobileMediaIntegration.mergeStatementVideos(individualRecordings);

// Creates segments like:
// [
//   { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
//   { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
//   { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 }
// ]
```

### 3. Upload and Storage

```typescript
// Merged video is uploaded to backend
const uploadedVideo = await uploadMergedVideo(mergedVideo);
// Individual recordings are cleaned up
// Challenge uses single merged video with segment metadata
```

### 4. Playback

```typescript
// Get playback info for specific statement
const playbackInfo = mobileMediaIntegration.getSegmentPlaybackInfo(mergedVideo, 1);
// { startTime: 5000, endTime: 10000, duration: 5000 }

// Video player seeks to startTime and plays until endTime
```

## Benefits

### Storage Efficiency
- Single video file instead of three separate files
- Reduced storage requirements
- Simplified backup and sync

### Network Efficiency  
- Single upload instead of three uploads
- Reduced bandwidth usage
- Faster challenge creation

### Playback Flexibility
- Can play individual statements by seeking to segments
- Maintains user experience of separate videos
- Supports random access to any statement

### Metadata Preservation
- Tracks exact timing of each statement
- Enables precise playback control
- Supports future features like statement highlighting

## Implementation Notes

### Current Limitations
- Video merging is simulated (copies first video as placeholder)
- In production, would use FFmpeg or platform-specific APIs
- Compression is basic (would use proper video codecs)

### Production Considerations
- Implement actual video concatenation using FFmpeg
- Add proper video compression with quality controls
- Handle different video formats and resolutions
- Add audio synchronization
- Implement resume capability for interrupted merges

### Testing
- Comprehensive unit tests for all components
- Integration tests for complete workflow
- Mock implementations for video processing
- Progress tracking validation
- Error handling verification

## Usage Example

```typescript
import { EnhancedChallengeCreation } from '../components/EnhancedChallengeCreation';

// Complete challenge creation with video merging
<EnhancedChallengeCreation
  onChallengeComplete={(challengeData) => {
    // challengeData.mediaData[0] contains merged video with segments
    console.log('Segments:', challengeData.mediaData[0].segments);
  }}
  onCancel={() => navigation.goBack()}
/>
```

## Future Enhancements

1. **Advanced Compression**: Implement quality-based compression
2. **Transition Effects**: Add smooth transitions between segments  
3. **Audio Processing**: Handle audio normalization and sync
4. **Batch Processing**: Support multiple challenge creation
5. **Cloud Processing**: Offload merging to server-side processing
6. **Format Support**: Support multiple video formats and codecs
7. **Quality Assessment**: Automatic quality analysis and optimization

This implementation provides a solid foundation for efficient video storage while maintaining the flexibility of individual statement playback.