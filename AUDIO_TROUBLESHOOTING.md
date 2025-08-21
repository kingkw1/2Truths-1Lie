# Audio Recording Troubleshooting Guide

## Quick Test Steps

1. **Open Browser Console** (F12) to see detailed logs
2. **Start Video Recording** - Look for these console messages:
   - ✅ "Audio signal detected!" - Good, microphone is working
   - ⚠️ "No audio signal detected" - Microphone issue
   - ✅ "MediaRecorder created successfully" - Good
   - ❌ "Failed to create MediaRecorder" - Browser compatibility issue

3. **Check Recording Result** - After recording:
   - Play the video in the demo
   - Audio controls should NOT be grayed out
   - You should hear sound when playing

## Common Issues & Solutions

### Issue 1: No Audio Signal Detected
**Symptoms:** Console shows "No audio signal detected after 2 seconds"
**Solutions:**
- Check microphone permissions in browser (click lock icon in address bar)
- Test microphone in other apps (e.g., voice recorder)
- Try different browser (Chrome, Firefox, Edge)
- Check system audio settings

### Issue 2: Audio Controls Grayed Out
**Symptoms:** Video plays but audio controls are disabled/grayed out
**Solutions:**
- This indicates the video file has no audio track
- Check console for MediaRecorder creation errors
- Try different MIME type (check console logs)
- Disable compression temporarily: `enableCompression={false}`

### Issue 3: MediaRecorder Creation Fails
**Symptoms:** Console shows "Failed to create MediaRecorder"
**Solutions:**
- Update browser to latest version
- Try different browser
- Check if HTTPS is being used (required for microphone access)
- Disable browser extensions that might interfere

### Issue 4: MIME Type Not Supported
**Symptoms:** Console shows "MIME type not supported"
**Solutions:**
- Browser doesn't support the preferred format
- The fallback should work, but quality might be different
- Try different browser

## Browser Compatibility

### Chrome/Chromium
- ✅ Best support for WebM with VP8/VP9 + Opus
- ✅ Supports bitrate options
- ✅ Good audio quality

### Firefox
- ✅ Good WebM support
- ⚠️ Limited bitrate option support
- ✅ Good audio quality

### Safari
- ⚠️ Limited WebM support
- ✅ MP4 with H.264 + AAC
- ⚠️ May require different approach

### Edge
- ✅ Similar to Chrome
- ✅ Good WebM support

## Debug Console Commands

Open browser console and run these commands during recording:

```javascript
// Check if MediaRecorder is available
console.log('MediaRecorder available:', typeof MediaRecorder !== 'undefined');

// Check supported MIME types
const types = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus', 
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4'
];
types.forEach(type => {
  console.log(type, ':', MediaRecorder.isTypeSupported(type));
});

// Test microphone access
navigator.mediaDevices.getUserMedia({video: true, audio: true})
  .then(stream => {
    console.log('Stream tracks:', stream.getTracks().map(t => t.kind + ': ' + t.label));
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('Media access error:', err));
```

## Expected Console Output (Success)

When everything works correctly, you should see:
```
🎤 Audio track 0 - enabled: true, muted: false, readyState: live
🔊 Audio signal detected! Average level: 15.2
✅ Using MIME type: video/webm;codecs=vp8,opus
✅ MediaRecorder created successfully
📹 Video metadata loaded
✅ Audio likely detected in video recording
```

## Still Having Issues?

1. **Test in Chrome first** - It has the best WebRTC support
2. **Use HTTPS** - Required for microphone access
3. **Check system permissions** - Ensure browser can access microphone
4. **Try incognito mode** - Rules out extension interference
5. **Test with simple HTML** - Create minimal test case

## Minimal Test HTML

Create this file to test basic functionality:

```html
<!DOCTYPE html>
<html>
<head><title>Audio Test</title></head>
<body>
  <button onclick="startTest()">Test Audio Recording</button>
  <video id="result" controls style="display:none;"></video>
  
  <script>
    async function startTest() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        console.log('Stream tracks:', stream.getTracks().map(t => t.kind));
        
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, {type: 'video/webm'});
          const video = document.getElementById('result');
          video.src = URL.createObjectURL(blob);
          video.style.display = 'block';
          stream.getTracks().forEach(track => track.stop());
        };
        
        recorder.start();
        setTimeout(() => recorder.stop(), 3000);
      } catch (err) {
        console.error('Test failed:', err);
      }
    }
  </script>
</body>
</html>
```