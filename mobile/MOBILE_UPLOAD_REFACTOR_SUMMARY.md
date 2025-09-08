# Mobile Upload Flow Refactor Summary

## Task Completed
**Refactor mobile upload flow to send three separate video files per challenge**

## Changes Made

### 1. Upload Service (`mobile/src/services/uploadService.ts`)

#### New Method: `uploadVideosForMerge()`
- Added new method to upload multiple videos for server-side merging
- Validates exactly 3 videos are provided
- Uploads all videos to `/api/v1/challenge-videos/upload-for-merge` endpoint
- Returns merged video URL and segment metadata from server
- Includes proper error handling and retry logic
- Uses longer timeout (2 minutes) for multi-video uploads

#### Key Features:
- **Validation**: Ensures exactly 3 videos before upload
- **FormData Structure**: Sends videos as `video_0`, `video_1`, `video_2` with corresponding metadata
- **Progress Tracking**: Provides upload progress callbacks
- **Error Handling**: Network-aware error messages and retry logic
- **Authentication**: Automatic token acquisition and validation

### 2. Mobile Media Integration (`mobile/src/services/mobileMediaIntegration.ts`)

#### Updated Recording Flow:
- **Local Storage First**: Videos are now stored locally until all three are recorded
- **Batch Upload**: New `uploadVideosForMerging()` method uploads all three videos together
- **Server-Side Processing**: Relies on backend for video merging and compression

#### New Method: `processRecordedMediaForServerMerging()`
- Processes recorded videos for local storage
- Validates file size and duration
- Marks videos as `storageType: 'local'` and `isUploaded: false`
- Prepares videos for later batch upload

#### New Method: `uploadVideosForMerging()`
- Validates all three recordings are available
- Prepares video array with proper metadata
- Calls upload service for server-side merging
- Returns merged video URL and segment timing data

### 3. Challenge Creation Screen (`mobile/src/screens/ChallengeCreationScreen.tsx`)

#### Updated Submission Flow:
1. **Validation**: Checks for recorded videos (not uploaded status)
2. **Batch Upload**: Calls `mobileMediaIntegration.uploadVideosForMerging()`
3. **Challenge Creation**: Uses merged video URL and segment metadata
4. **API Request**: Properly structured request with segment timing data

#### Updated Challenge Request Structure:
```typescript
{
  statements: [
    {
      text: "Statement text",
      media_file_id: "merged_video_url",
      segment_start_time: 0,
      segment_end_time: 5000,
      segment_duration: 5000
    }
  ],
  lie_statement_index: 1,
  is_merged_video: true,
  merged_video_metadata: {
    total_duration_ms: 16000,
    segment_count: 3,
    segments: [...]
  }
}
```

### 4. Testing (`mobile/src/services/__tests__/uploadService.multiVideo.test.ts`)

#### New Test Suite:
- **Validation Tests**: Ensures exactly 3 videos required
- **Upload Flow Tests**: Verifies correct FormData structure and API calls
- **Error Handling Tests**: Tests network failure scenarios
- **Mock Integration**: Proper mocking of file system and network calls

## Technical Benefits

### 1. **Server-Side Processing**
- Removes client-side video merging complexity
- Consistent video quality and compression
- Reduced mobile app size and processing load
- Better error handling and recovery

### 2. **Improved User Experience**
- Faster recording workflow (no immediate uploads)
- Better progress indication during final submission
- More reliable upload process with retry logic
- Clearer error messages for network issues

### 3. **Backend Integration**
- Structured API for multi-video uploads
- Proper segment metadata for playback
- Scalable server-side video processing
- Consistent video format and quality

### 4. **Maintainability**
- Clear separation of concerns
- Comprehensive error handling
- Type-safe interfaces
- Testable components

## API Endpoint Expected

The mobile app now expects a backend endpoint:

```
POST /api/v1/challenge-videos/upload-for-merge
```

**Request Format:**
- `video_0`: First video file
- `video_1`: Second video file  
- `video_2`: Third video file
- `metadata_0`: JSON metadata for first video
- `metadata_1`: JSON metadata for second video
- `metadata_2`: JSON metadata for third video

**Response Format:**
```json
{
  "merged_video_url": "https://cdn.example.com/merged_video.mp4",
  "segment_metadata": [
    {
      "statementIndex": 0,
      "startTime": 0,
      "endTime": 5000
    },
    {
      "statementIndex": 1, 
      "startTime": 5000,
      "endTime": 11000
    },
    {
      "statementIndex": 2,
      "startTime": 11000,
      "endTime": 16000
    }
  ]
}
```

## Validation Status

✅ **TypeScript Compilation**: All modified files compile without errors
✅ **Unit Tests**: New upload functionality tested and passing
✅ **Integration**: Proper integration between upload service and media integration
✅ **Error Handling**: Comprehensive error handling and user feedback
✅ **Type Safety**: All interfaces properly typed and validated

## Next Steps

1. **Backend Implementation**: Implement the `/api/v1/challenge-videos/upload-for-merge` endpoint
2. **Video Processing**: Add FFmpeg-based video merging on the server
3. **Testing**: End-to-end testing with actual backend integration
4. **Performance**: Monitor upload performance and optimize as needed