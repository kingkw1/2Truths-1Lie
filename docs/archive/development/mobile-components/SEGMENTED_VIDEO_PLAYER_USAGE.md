# Segmented Video Player Usage Guide

## Overview

The `SegmentedVideoPlayer` component handles merged videos with segment metadata for precise navigation between different statements in a challenge. This component is used when the backend provides a single merged video file with timing information for each statement segment.

## Features

- **Merged Video Playback**: Plays a single video file containing multiple statement segments
- **Segment Navigation**: Allows users to jump directly to specific statement segments
- **Visual Progress Tracking**: Shows current playback position and segment boundaries
- **Auto-Detection**: Automatically detects which segment is currently playing
- **Custom Controls**: Provides play/pause and seeking functionality
- **Responsive UI**: Adapts to different screen sizes and orientations

## Usage

### Basic Implementation

```tsx
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';
import { MediaCapture, VideoSegment } from '../types';

const MyComponent = () => {
  const mergedVideo: MediaCapture = {
    type: 'video',
    streamingUrl: 'https://example.com/merged-video.mp4',
    duration: 30000, // 30 seconds in milliseconds
    mediaId: 'merged-123',
    isMergedVideo: true,
    isUploaded: true,
  };

  const segments: VideoSegment[] = [
    {
      statementIndex: 0,
      startTime: 0,        // 0 seconds
      endTime: 10000,      // 10 seconds
      duration: 10000,     // 10 seconds duration
    },
    {
      statementIndex: 1,
      startTime: 10000,    // 10 seconds
      endTime: 20000,      // 20 seconds
      duration: 10000,     // 10 seconds duration
    },
    {
      statementIndex: 2,
      startTime: 20000,    // 20 seconds
      endTime: 30000,      // 30 seconds
      duration: 10000,     // 10 seconds duration
    },
  ];

  const statementTexts = [
    'I have traveled to 15 countries',
    'I can speak 4 languages fluently',
    'I have never broken a bone',
  ];

  return (
    <SegmentedVideoPlayer
      mergedVideo={mergedVideo}
      segments={segments}
      statementTexts={statementTexts}
      onSegmentSelect={(segmentIndex) => {
        console.log(`User selected segment ${segmentIndex}`);
      }}
      autoPlay={false}
    />
  );
};
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `mergedVideo` | `MediaCapture` | Yes | The merged video file with streaming URL |
| `segments` | `VideoSegment[]` | Yes | Array of segment metadata with timing information |
| `onSegmentSelect` | `(segmentIndex: number) => void` | No | Callback when user selects a segment |
| `statementTexts` | `string[]` | No | Array of statement texts to display |
| `autoPlay` | `boolean` | No | Whether to auto-play the video on load (default: false) |

### Data Structure Requirements

#### MediaCapture for Merged Video

```tsx
interface MediaCapture {
  type: 'video';
  streamingUrl: string;           // Required: URL to the merged video file
  duration?: number;              // Total duration in milliseconds
  mediaId?: string;               // Unique identifier
  isMergedVideo: true;           // Must be true for segmented player
  isUploaded: boolean;           // Upload status
  segments?: VideoSegment[];      // Optional: can be passed separately
}
```

#### VideoSegment Structure

```tsx
interface VideoSegment {
  statementIndex: number;         // 0-based index (0, 1, 2)
  startTime: number;             // Start time in milliseconds
  endTime: number;               // End time in milliseconds
  duration: number;              // Segment duration in milliseconds
}
```

## Integration with GameScreen

The `GameScreen` automatically detects whether to use the `SegmentedVideoPlayer` or `SimpleVideoPlayer` based on the media data structure:

```tsx
// In GameScreen.tsx
const mediaData = selectedChallenge?.mediaData || [];

// Check for merged video with segments
const mergedVideo = mediaData.find(media => media.isMergedVideo && media.segments);
const hasMergedVideo = !!mergedVideo;

// Use SegmentedVideoPlayer for merged videos
if (hasMergedVideo && mergedVideo) {
  return (
    <SegmentedVideoPlayer
      mergedVideo={mergedVideo}
      segments={mergedVideo.segments || []}
      statementTexts={statementTexts}
      onSegmentSelect={handleSegmentSelect}
    />
  );
}
```

## Backend Integration

The component expects segment metadata from the backend in this format:

```json
{
  "merged_video_metadata": {
    "total_duration": 30.0,
    "segments": [
      {
        "statement_index": 0,
        "start_time": 0.0,
        "end_time": 10.0,
        "duration": 10.0
      },
      {
        "statement_index": 1,
        "start_time": 10.0,
        "end_time": 20.0,
        "duration": 10.0
      },
      {
        "statement_index": 2,
        "start_time": 20.0,
        "end_time": 30.0,
        "duration": 10.0
      }
    ]
  }
}
```

The frontend converts this to milliseconds for internal use.

## Error Handling

The component handles several error scenarios:

- **No Video URL**: Shows "No merged video available" message
- **No Segments**: Shows "No segment data available" message
- **Video Load Errors**: Displays error overlay with retry options
- **Playback Errors**: Shows error messages and logs to console

## Performance Considerations

- **Single Video Load**: Only loads one video file instead of multiple individual files
- **Efficient Seeking**: Uses native video seeking for smooth segment transitions
- **Memory Management**: Properly cleans up video resources on unmount
- **Network Optimization**: Leverages video streaming and caching

## Accessibility

- **Screen Reader Support**: All interactive elements have proper labels
- **Keyboard Navigation**: Supports keyboard interaction for segment selection
- **High Contrast**: Uses sufficient color contrast for visibility
- **Text Scaling**: Respects system text size preferences

## Testing

The component includes comprehensive tests covering:

- Rendering with valid data
- Error states handling
- Segment selection functionality
- Time formatting
- Integration with parent components

Run tests with:
```bash
npm test -- --testPathPattern=SegmentedVideoPlayer
```

## Troubleshooting

### Common Issues

1. **Video Not Loading**
   - Check that `streamingUrl` is valid and accessible
   - Verify network connectivity
   - Ensure video format is supported (MP4 recommended)

2. **Segments Not Working**
   - Verify segment times are in milliseconds
   - Check that segments don't overlap
   - Ensure `statementIndex` values are correct

3. **Performance Issues**
   - Use compressed video files
   - Implement proper video caching
   - Consider video quality optimization

### Debug Information

The component logs debug information to help with troubleshooting:

```javascript
console.log('🎬 SEGMENTED_PLAYER: Loading merged video:', mergedVideo.streamingUrl);
console.log('🎬 SEGMENTED_PLAYER: Selecting segment', segmentIndex);
```

Enable debug logging by checking the browser/device console.