# Mobile App Railway Integration - Issue Resolution

## Problem Summary
When testing the mobile app after updating the API configuration to point to Railway backend, you encountered these errors:

1. **Video merge failed**: `Error compressing merged video: Failed to compress merged video`
2. **Video playback failed**: `Response code: 404` when trying to play challenge videos

## Root Cause Analysis

### Issue 1: FFmpeg Compression Hanging
The Railway environment has different hardware characteristics than the local development environment. The original FFmpeg compression settings were too aggressive for Railway's container environment:

- **Problem**: Used high H.264 profile with 34 threads
- **Result**: FFmpeg hung at frame=0, causing compression timeouts

### Issue 2: Local File Path Fallback
The mobile app was designed to fall back to local file paths when server uploads failed:

- **Problem**: When video merge failed, app used `file:///data/user/0/host.exp.exponent/cache/...` as media URLs
- **Result**: Backend tried to generate S3 signed URLs for local file paths, causing 404 errors

## Solutions Implemented

### 1. Fixed FFmpeg Compression for Railway ✅
**File**: `/backend/services/video_merge_service.py`

Updated compression parameters for Railway environment:
```python
# Railway-optimized conservative settings
ffmpeg_cmd = [
    'ffmpeg',
    '-i', str(input_path),
    '-c:v', 'libx264',
    '-profile:v', 'baseline',    # Conservative profile 
    '-preset', 'fast',           # Fast preset for Railway
    '-crf', '28',               # Balanced quality/size
    '-maxrate', '1000k',        # Reasonable bitrate
    '-bufsize', '2000k',
    '-threads', '2',            # Limited threads for Railway
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    str(output_path)
]
```

Added compression timeout:
```python
process = await asyncio.create_subprocess_exec(
    *ffmpeg_cmd,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE
)

# Wait for completion with timeout
await asyncio.wait_for(process.wait(), timeout=300)  # 5 minute timeout
```

### 2. Removed Local File Path Fallback ✅
**File**: `/mobile/src/services/mobileMediaIntegration.ts`

Changed error handling to propagate failures instead of using local paths:
```typescript
} catch (uploadError) {
  console.error('❌ MERGE: Upload/merge failed:', uploadError);
  
  // Don't fall back to local paths - let the error propagate
  return {
    success: false,
    error: uploadError instanceof Error ? uploadError.message : 'Failed to upload and merge videos on server',
  };
}
```

### 3. Added Local Path Validation ✅
**File**: `/mobile/src/screens/ChallengeCreationScreen.tsx`

Added validation to reject local file paths:
```typescript
// Ensure we have a proper server URL, not a local file path
if (!mergeResult.mergedVideoUrl || mergeResult.mergedVideoUrl.startsWith('file://')) {
  throw new Error('Server did not return a valid merged video URL. Please try again.');
}
```

### 4. Verified Railway Backend Configuration ✅

Confirmed Railway backend is working properly:
- ✅ Health endpoint: `/health`
- ✅ Swagger docs: `/docs` 
- ✅ FFmpeg available: Compression presets endpoint working
- ✅ Video upload security: Properly authenticated endpoints

## API Configuration Summary

The mobile app now uses:
- **Base URL**: `https://2truths-1lie-production.up.railway.app`
- **Centralized config**: `/mobile/src/config/apiConfig.ts`
- **All services updated**: apiService, authService, uploadService, etc.

## Expected Behavior Now

### ✅ Success Case
1. User records 3 videos in mobile app
2. App uploads videos to Railway backend
3. Backend merges videos using conservative FFmpeg settings
4. Backend uploads merged video to S3
5. Backend returns proper S3 URL
6. Challenge created with valid S3 URLs
7. Video playback works with signed URLs

### ✅ Failure Case  
1. User records 3 videos in mobile app
2. App uploads videos to Railway backend
3. If merge/compression fails, user sees proper error message
4. No challenge is created with broken local file paths
5. User can retry the process

## Next Steps

1. **Test the updated mobile app** - Video compression should now work on Railway
2. **Monitor for any remaining errors** - The improved error handling will show real issues
3. **Consider adding progress indicators** - Users will see upload/merge progress
4. **Add retry logic** - Could automatically retry failed uploads

## Files Modified

### Backend
- `/backend/services/video_merge_service.py` - Fixed FFmpeg compression for Railway

### Mobile App  
- `/mobile/src/services/mobileMediaIntegration.ts` - Removed local path fallback
- `/mobile/src/screens/ChallengeCreationScreen.tsx` - Added local path validation
- `/mobile/src/config/apiConfig.ts` - Centralized Railway URL configuration
- `/mobile/src/services/apiService.ts` - Updated to use centralized config
- `/mobile/src/services/authService.ts` - Updated to use centralized config  
- `/mobile/src/services/uploadService.ts` - Updated to use centralized config
- `/mobile/src/services/realChallengeAPI.ts` - Updated to use centralized config

The mobile app should now work properly with the Railway backend deployment!
