# Segment-Based Challenge System - Developer Integration Guide

## Quick Start

### 1. Understanding the Architecture

The segment-based system records three individual statement videos and merges them into a single video file with precise timing metadata. This provides:

- **Storage Efficiency**: One file instead of three
- **Network Efficiency**: Single upload instead of three
- **Playback Flexibility**: Individual statement playback via seeking

### 2. Key Components

```typescript
// Video Merging Service
import { videoMergingService } from '../services/videoMergingService';

// Segmented Video Player
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';

// Enhanced Challenge Creation
import { EnhancedChallengeCreation } from '../components/EnhancedChallengeCreation';
```

### 3. Basic Implementation

#### Recording and Merging
```typescript
// Record individual statements
const recordings = await Promise.all([
  recordStatement(0, "Statement 1 text"),
  recordStatement(1, "Statement 2 text"), 
  recordStatement(2, "Statement 3 text")
]);

// Merge videos with progress tracking
const mergeResult = await videoMergingService.mergeStatementVideos(
  [recordings[0].uri, recordings[1].uri, recordings[2].uri],
  {
    compressionQuality: 0.8,
    maxOutputSize: 50 * 1024 * 1024 // 50MB
  },
  (progress) => {
    console.log(`${progress.stage}: ${progress.progress}%`);
  }
);

// Create MediaCapture with segment metadata
const mergedMedia = videoMergingService.createMergedMediaCapture(
  mergeResult,
  recordings
);
```

#### Playback Implementation
```typescript
// In your component
<SegmentedVideoPlayer
  mergedVideo={challengeVideo}
  statementTexts={["Statement 1", "Statement 2", "Statement 3"]}
  onSegmentSelect={(segmentIndex) => {
    console.log(`Playing statement ${segmentIndex + 1}`);
  }}
  onPlaybackComplete={() => {
    console.log('Video playback completed');
  }}
/>
```

## API Integration

### Backend Endpoints

#### Create Challenge with Merged Video
```http
POST /api/v1/challenges
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "My Challenge",
  "statements": [
    {"text": "Statement 1", "media_file_id": "upload-session-1"},
    {"text": "Statement 2", "media_file_id": "upload-session-1"},
    {"text": "Statement 3", "media_file_id": "upload-session-1"}
  ],
  "lie_statement_index": 1,
  "is_merged_video": true,
  "merged_video_metadata": {
    "total_duration": 25.0,
    "segments": [
      {"start_time": 0.0, "end_time": 8.5, "duration": 8.5, "statement_index": 0},
      {"start_time": 8.5, "end_time": 17.2, "duration": 8.7, "statement_index": 1},
      {"start_time": 17.2, "end_time": 25.0, "duration": 7.8, "statement_index": 2}
    ],
    "video_file_id": "merged-video-abc123",
    "compression_applied": true
  }
}
```

#### Get Segment Metadata
```http
GET /api/v1/challenges/{id}/segments
Authorization: Bearer <token>

Response:
{
  "is_merged_video": true,
  "total_duration": 25.0,
  "segments": [...],
  "video_file_id": "merged-video-abc123"
}
```

### Data Models

#### MediaCapture Interface
```typescript
interface MediaCapture {
  type: 'video';
  url?: string;
  streamingUrl?: string;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
  
  // Segment-specific properties
  isMergedVideo?: boolean;
  segments?: VideoSegment[];
  compressionRatio?: number;
  originalSize?: number;
}

interface VideoSegment {
  statementIndex: number; // 0, 1, or 2
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  duration: number; // milliseconds
  originalDuration?: number; // before compression
}
```

#### Backend Data Model
```python
class MergedVideoMetadata(BaseModel):
    total_duration: float
    segments: List[VideoSegment]
    video_file_id: str
    compression_applied: bool = False
    original_total_duration: Optional[float] = None

class VideoSegment(BaseModel):
    start_time: float
    end_time: float
    duration: float
    statement_index: int
```

## Redux Integration

### State Structure
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

### Actions and Reducers
```typescript
// Actions
export const startVideoMerging = createAsyncThunk(
  'challengeCreation/startVideoMerging',
  async (recordings: MediaCapture[]) => {
    const result = await videoMergingService.mergeStatementVideos(
      recordings.map(r => r.url!),
      { compressionQuality: 0.8 }
    );
    return result;
  }
);

// Reducer
const challengeCreationSlice = createSlice({
  name: 'challengeCreation',
  initialState,
  reducers: {
    updateMergeProgress: (state, action) => {
      state.videoMerging.progress = action.payload.progress;
      state.videoMerging.stage = action.payload.stage;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startVideoMerging.pending, (state) => {
        state.videoMerging.isInProgress = true;
        state.videoMerging.error = null;
      })
      .addCase(startVideoMerging.fulfilled, (state, action) => {
        state.videoMerging.isInProgress = false;
        state.mergedVideo = action.payload;
      });
  },
});
```

## Testing

### Unit Tests
```typescript
describe('VideoMergingService', () => {
  it('should merge three videos with correct segment metadata', async () => {
    const mockVideos = [
      { uri: 'video1.mp4', duration: 5000 },
      { uri: 'video2.mp4', duration: 7000 },
      { uri: 'video3.mp4', duration: 6000 }
    ];
    
    const result = await videoMergingService.mergeStatementVideos(
      mockVideos.map(v => v.uri)
    );
    
    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toEqual({
      statementIndex: 0,
      startTime: 0,
      endTime: 5000,
      duration: 5000
    });
  });
});
```

### Integration Tests
```typescript
describe('Challenge Creation with Merged Video', () => {
  it('should create challenge with segment metadata', async () => {
    // Mock video recordings
    const recordings = await createMockRecordings();
    
    // Merge videos
    const mergeResult = await videoMergingService.mergeStatementVideos(
      recordings.map(r => r.uri)
    );
    
    // Upload and create challenge
    const challenge = await createChallengeWithMergedVideo({
      statements: ['Statement 1', 'Statement 2', 'Statement 3'],
      mergedVideo: mergeResult,
      lieIndex: 1
    });
    
    expect(challenge.is_merged_video).toBe(true);
    expect(challenge.merged_video_metadata.segments).toHaveLength(3);
  });
});
```

## Error Handling

### Common Error Scenarios
```typescript
// Video merging errors
try {
  const result = await videoMergingService.mergeStatementVideos(videoUris);
  if (!result.success) {
    throw new Error(result.error);
  }
} catch (error) {
  if (error.message.includes('file not found')) {
    // Handle missing video files
    showError('One or more video files are missing');
  } else if (error.message.includes('insufficient storage')) {
    // Handle storage issues
    showError('Not enough storage space for video processing');
  } else {
    // Generic error handling
    showError('Failed to process videos. Please try again.');
  }
}

// Playback errors
const handlePlaybackError = (error: string) => {
  if (error.includes('segments')) {
    // Missing or invalid segment metadata
    fallbackToFullVideoPlayback();
  } else if (error.includes('network')) {
    // Network connectivity issues
    showRetryOption();
  } else {
    // Other playback errors
    showGenericError();
  }
};
```

## Performance Optimization

### Video Compression
```typescript
const compressionOptions = {
  // Balance quality vs file size
  compressionQuality: Platform.select({
    ios: 0.8,
    android: 0.7, // Slightly more compression for Android
  }),
  
  // Platform-specific output format
  outputFormat: Platform.select({
    ios: 'mov',
    android: 'mp4',
  }),
  
  // Size limits
  maxOutputSize: 50 * 1024 * 1024, // 50MB
};
```

### Memory Management
```typescript
// Clean up temporary files after merging
useEffect(() => {
  return () => {
    videoMergingService.cleanupTempFiles();
  };
}, []);

// Optimize video loading for playback
const optimizeVideoForPlayback = async (videoUri: string) => {
  // Preload video metadata
  const metadata = await getVideoMetadata(videoUri);
  
  // Cache segment information
  cacheSegmentMetadata(metadata.segments);
  
  return metadata;
};
```

## Migration Guide

### From Legacy System
```typescript
// Check if challenge uses legacy format
const isLegacyChallenge = (challenge: Challenge) => {
  return !challenge.is_merged_video && challenge.statements.length === 3;
};

// Convert legacy challenge for playback
const convertLegacyChallenge = (challenge: Challenge) => {
  if (isLegacyChallenge(challenge)) {
    // Create mock segments for legacy videos
    return {
      ...challenge,
      segments: challenge.statements.map((stmt, index) => ({
        statementIndex: index,
        startTime: 0,
        endTime: stmt.duration || 10000,
        duration: stmt.duration || 10000,
      })),
    };
  }
  return challenge;
};
```

## Troubleshooting

### Common Issues

#### Video Merging Fails
```bash
# Check available storage
adb shell df /data/data/com.yourapp/files

# Monitor merge process
adb logcat | grep "VideoMerging"
```

#### Segment Playback Issues
```typescript
// Debug segment metadata
console.log('Segments:', mergedVideo.segments);
console.log('Total duration:', mergedVideo.duration);

// Validate segment timing
const validateSegments = (segments: VideoSegment[]) => {
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].endTime !== segments[i + 1].startTime) {
      console.warn(`Gap between segments ${i} and ${i + 1}`);
    }
  }
};
```

#### Upload Failures
```typescript
// Retry logic for uploads
const uploadWithRetry = async (videoUri: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadVideo(videoUri);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};
```

## Best Practices

### Video Quality
- Use consistent recording settings across all three statements
- Apply compression after merging to maintain quality
- Test on different devices to ensure compatibility

### User Experience
- Show clear progress indicators during merging
- Provide meaningful error messages
- Allow users to retry failed operations

### Performance
- Clean up temporary files promptly
- Use background processing for video operations
- Implement proper memory management

### Testing
- Test with various video lengths and formats
- Validate segment metadata accuracy
- Test network failure scenarios

This guide provides the essential information for integrating the segment-based challenge system into your development workflow. For more detailed technical documentation, see the [complete technical specification](SEGMENT_BASED_CHALLENGE_FLOW.md).