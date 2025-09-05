# Segmented Video Player Usage Guide

## Overview

The `SegmentedVideoPlayer` component provides a UI for playing specific segments of a merged video file. It allows users to select and play individual statement segments from a challenge video that contains three merged statements.

## Features

- **Segment Selection**: Display three selectable statement segments with titles and durations
- **Video Seeking**: Automatically seek to the start of selected segments
- **Playback Controls**: Play, pause, and stop controls for video playback
- **Progress Tracking**: Visual progress indicators for each segment
- **Statement Text Display**: Optional display of statement text alongside video segments
- **Error Handling**: Graceful handling of missing video URLs or segments

## Usage

### Basic Usage

```tsx
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';
import { MediaCapture } from '../types';

const mergedVideo: MediaCapture = {
  type: 'video',
  streamingUrl: 'https://example.com/merged-video.mp4',
  duration: 30000, // 30 seconds
  isMergedVideo: true,
  segments: [
    {
      statementIndex: 0,
      startTime: 0,
      endTime: 10000,
      duration: 10000,
    },
    {
      statementIndex: 1,
      startTime: 10000,
      endTime: 20000,
      duration: 10000,
    },
    {
      statementIndex: 2,
      startTime: 20000,
      endTime: 30000,
      duration: 10000,
    },
  ],
};

const statementTexts = [
  'I have climbed Mount Everest',
  'I can speak 4 languages fluently',
  'I once met a famous movie star',
];

<SegmentedVideoPlayer
  mergedVideo={mergedVideo}
  statementTexts={statementTexts}
  onSegmentSelect={(segmentIndex) => {
    console.log(`Playing segment ${segmentIndex}`);
  }}
/>
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mergedVideo` | `MediaCapture` | Yes | - | The merged video with segment metadata |
| `onSegmentSelect` | `(segmentIndex: number) => void` | No | - | Callback when a segment is selected |
| `onPlaybackComplete` | `() => void` | No | - | Callback when video playback completes |
| `showStatementTexts` | `boolean` | No | `true` | Whether to display statement texts |
| `statementTexts` | `string[]` | No | `[]` | Array of statement texts to display |
| `autoPlay` | `boolean` | No | `false` | Whether to auto-play the first segment |

### Integration with GameScreen

The component is integrated into the `GameScreen` to provide video playback for challenges with merged videos:

```tsx
// In GameScreen.tsx
const mergedVideo = selectedChallenge?.mediaData?.find(media => media.isMergedVideo);
const hasSegmentedVideo = mergedVideo && mergedVideo.segments && mergedVideo.segments.length === 3;

{hasSegmentedVideo && (
  <TouchableOpacity
    style={styles.videoToggleButton}
    onPress={() => setShowVideoPlayer(!showVideoPlayer)}
  >
    <Text style={styles.videoToggleText}>
      {showVideoPlayer ? '📝 Hide Video' : '🎥 Watch Statements'}
    </Text>
  </TouchableOpacity>
)}

{showVideoPlayer && hasSegmentedVideo && (
  <SegmentedVideoPlayer
    mergedVideo={mergedVideo}
    statementTexts={currentSession?.statements.map((stmt: any) => stmt.text) || []}
    onSegmentSelect={(segmentIndex) => {
      console.log(`Playing segment ${segmentIndex}`);
    }}
  />
)}
```

## Video Segment Metadata

The component expects the `MediaCapture` object to have the following structure:

```typescript
interface MediaCapture {
  type: 'video';
  streamingUrl?: string; // URL for video playback
  url?: string; // Fallback URL
  duration?: number; // Total video duration in milliseconds
  isMergedVideo?: boolean; // Indicates this is a merged video
  segments?: VideoSegment[]; // Array of segment metadata
}

interface VideoSegment {
  statementIndex: number; // 0, 1, or 2 for the three statements
  startTime: number; // Start time in milliseconds
  endTime: number; // End time in milliseconds
  duration: number; // Segment duration in milliseconds
}
```

## Behavior

1. **Segment Selection**: When a user taps on a segment button, the video seeks to the segment's start time and begins playing
2. **Automatic Stopping**: The video automatically pauses when it reaches the end of the selected segment
3. **Progress Tracking**: A progress bar shows the playback progress within the selected segment
4. **Controls**: Users can pause, resume, or stop playback at any time
5. **Error Handling**: The component displays appropriate error messages if the video URL or segments are missing

## Styling

The component uses a consistent design with:
- Card-based layout for segment buttons
- Blue accent color (#4a90e2) for selected states
- Progress indicators and playback controls
- Responsive text sizing and spacing

## Requirements Fulfilled

This implementation fulfills the requirement:

> "Update mobile playback UI to present three selectable statement segments and seek/play video segment as needed"

The component provides:
- ✅ Three selectable statement segments
- ✅ Video seeking to specific segments
- ✅ Playback controls for each segment
- ✅ Progress tracking and visual feedback
- ✅ Integration with the existing game flow
- ✅ Error handling for edge cases

## Future Enhancements

Potential improvements could include:
- Video thumbnails for each segment
- Scrubbing controls within segments
- Playback speed controls
- Fullscreen video playback
- Accessibility improvements (screen reader support)