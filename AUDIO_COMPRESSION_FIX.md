# Audio Loss in Video Recordings - Compression Issue Fix

## Problem Description
Video recordings in the main React app were capturing both video and audio tracks correctly during recording, but the audio was being stripped out during the compression phase, resulting in silent videos when played back.

## Root Cause Analysis

### Evidence from Console Logs:
- ✅ Audio tracks were being captured: `Audio track 0: HD Webcam C910 Analog Stereo`
- ✅ Video+audio codec was used: `video/webm;codecs=vp8,opus`
- ✅ Audio was present in chunks: `hasAudioCodec: true` and `hasAudioChunks: true`
- ❌ BUT: Audio was lost after compression during playback

### Technical Root Cause:
The `MediaCompressor` class in `/src/utils/mediaCompression.ts` has flawed audio handling:

1. **Problematic Audio Processing**: The audio track addition is attempted in an `onloadstart` event handler that doesn't execute reliably
2. **AudioContext Issues**: Uses `AudioContext.createMediaElementSource()` which can cause audio routing problems
3. **Timing Issues**: Audio track addition happens asynchronously and may not complete before compression

```typescript
// Problematic code in MediaCompressor:
video.onloadstart = async () => {
  try {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(video);
    // ... this approach is unreliable
  } catch (error) {
    console.warn('Could not add audio track:', error);
  }
};
```

## Solution Implemented

### Immediate Fix: Disable Compression
Disabled compression by default in all relevant hooks and components to preserve audio:

**Files Modified:**
1. `/src/hooks/useMediaRecording.ts` - Changed `enableCompression = false`
2. `/src/hooks/useReduxMediaRecording.ts` - Changed `enableCompression = false`
3. `/src/components/MediaRecorder.tsx` - Changed `enableCompression = false`
4. `/src/components/StatementWithMedia.tsx` - Changed `enableCompression: false`

### Result:
- ✅ Video recordings now preserve both video and audio tracks
- ✅ No "compressing" message appears (as expected)
- ✅ Playback includes audio
- ⚠️ Larger file sizes (trade-off for audio preservation)

## Future Improvements

To re-enable compression while preserving audio, the `MediaCompressor` class needs to be rewritten to:

1. **Proper Audio Handling**: Use `MediaRecorder` with both video and audio streams from the start
2. **Unified Stream Processing**: Don't separate video and audio processing
3. **Test Audio Preservation**: Ensure audio tracks are maintained through the compression pipeline

## Verification Steps

1. Record a video in the main app
2. Check console logs for: `✅ Audio tracks detected in video!`
3. Play back the recorded video
4. Verify audio is audible
5. Confirm no "compressing" message appears

## Related Files
- `/src/utils/mediaCompression.ts` - Needs audio handling fix for future compression re-enabling
- `/public/video-audio-test.html` - Reference implementation without compression (works correctly)
