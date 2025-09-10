<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Video Merge Service Documentation

## Overview

The Video Merge Service provides asynchronous video merging functionality using FFmpeg. It takes multiple uploaded video files and merges them into a single video with accurate segment metadata for playback navigation.

## Features

- **Asynchronous Processing**: Videos are merged in the background without blocking the API
- **FFmpeg Integration**: Uses FFmpeg for professional-quality video processing
- **Automatic Compression**: Applies optimal compression settings for web delivery
- **Segment Metadata**: Generates precise timing information for each video segment
- **Cloud Storage Support**: Uploads merged videos to cloud storage (S3) or local storage
- **Progress Tracking**: Real-time progress updates during merge operations
- **Error Handling**: Comprehensive error handling with retry capabilities
- **Cleanup**: Automatic cleanup of temporary files after processing

## Architecture

### Core Components

1. **VideoMergeService**: Main service class handling merge operations
2. **Upload Integration**: Works with ChunkedUploadService for video input
3. **FFmpeg Pipeline**: Multi-stage video processing pipeline
4. **Storage Integration**: Supports both local and cloud storage backends

### Processing Pipeline

1. **Video Analysis**: Analyze input videos using FFprobe
2. **Preparation**: Normalize video formats and resolutions
3. **Merging**: Concatenate videos using FFmpeg
4. **Compression**: Apply compression for optimal file size
5. **Upload**: Store merged video in configured storage backend
6. **Metadata**: Generate segment timing information

## API Integration

### Automatic Triggering

The merge service is automatically triggered when all videos in a merge session are uploaded:

```python
# In challenge_video_endpoints.py
readiness = await merge_service.check_merge_readiness(merge_session_id, user_id)
if readiness["ready"]:
    merge_result = await merge_service.initiate_merge(merge_session_id, user_id)
```

### Manual Triggering

Merges can also be triggered manually via API:

```http
POST /api/v1/challenge-videos/merge-session/{merge_session_id}/trigger
```

### Status Monitoring

Check merge progress and status:

```http
GET /api/v1/challenge-videos/merge-session/{merge_session_id}/status
GET /api/v1/challenge-videos/merge-session/{merge_session_id}/result
```

## Configuration

### FFmpeg Requirements

The service requires FFmpeg to be installed and accessible in the system PATH:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Settings

Key configuration options in `config.py`:

```python
# Cloud storage (optional)
USE_CLOUD_STORAGE = True
AWS_S3_BUCKET_NAME = "your-bucket"
AWS_S3_REGION = "us-east-1"

# Video processing
MAX_VIDEO_DURATION_SECONDS = 300  # 5 minutes
MAX_FILE_SIZE = 100_000_000  # 100MB
```

## Usage Examples

### Basic Merge Workflow

```python
from services.video_merge_service import VideoMergeService

merge_service = VideoMergeService()

# Check if videos are ready for merging
readiness = await merge_service.check_merge_readiness(merge_session_id, user_id)

if readiness["ready"]:
    # Initiate merge
    result = await merge_service.initiate_merge(merge_session_id, user_id)
    print(f"Merge initiated: {result['status']}")
    
    # Monitor progress
    while True:
        status = await merge_service.get_merge_status(merge_session_id)
        if status["status"] == "completed":
            print(f"Merge completed: {status['merged_video_url']}")
            break
        elif status["status"] == "failed":
            print(f"Merge failed: {status['error_message']}")
            break
        
        await asyncio.sleep(5)  # Check every 5 seconds
```

### Segment Metadata

The service generates detailed segment metadata for video navigation:

```json
{
  "segments": [
    {
      "start_time": 0.0,
      "end_time": 5.2,
      "duration": 5.2,
      "statement_index": 0
    },
    {
      "start_time": 5.2,
      "end_time": 10.8,
      "duration": 5.6,
      "statement_index": 1
    },
    {
      "start_time": 10.8,
      "end_time": 15.5,
      "duration": 4.7,
      "statement_index": 2
    }
  ],
  "total_duration": 15.5,
  "compression_applied": true
}
```

## Error Handling

### Common Errors

- **FFMPEG_NOT_FOUND**: FFmpeg is not installed or not in PATH
- **NOT_READY**: Not all videos are uploaded yet
- **ANALYSIS_ERROR**: Failed to analyze input videos
- **MERGE_ERROR**: FFmpeg merge operation failed
- **COMPRESSION_ERROR**: Video compression failed
- **STORAGE_ERROR**: Failed to upload to storage backend

### Retry Logic

Most errors are retryable. The service provides error codes to determine retry eligibility:

```python
try:
    await merge_service.initiate_merge(merge_session_id, user_id)
except VideoMergeError as e:
    if e.retryable:
        # Retry after delay
        await asyncio.sleep(30)
        await merge_service.initiate_merge(merge_session_id, user_id)
    else:
        # Handle non-retryable error
        logger.error(f"Non-retryable merge error: {e}")
```

## Performance Considerations

### Processing Time

Merge time depends on several factors:

- **Video Duration**: ~0.8 seconds per second of input video
- **File Size**: ~0.2 seconds per MB of input data
- **Base Processing**: ~30 seconds overhead
- **Compression**: Additional 10-20% of merge time

### Resource Usage

- **CPU**: High during FFmpeg processing
- **Memory**: ~100-200MB per concurrent merge
- **Disk**: Temporary files require 2-3x input video size
- **Network**: Upload bandwidth for cloud storage

### Optimization Tips

1. **Concurrent Limits**: Limit concurrent merges based on server capacity
2. **Cleanup**: Regular cleanup of old merge sessions and temp files
3. **Monitoring**: Monitor disk space and processing times
4. **Caching**: Consider caching frequently accessed merged videos

## Testing

### Unit Tests

Run the video merge service tests:

```bash
cd backend
python test_video_merge_service.py
```

### Integration Tests

Test the complete upload and merge workflow:

```bash
cd backend
python test_merge_integration.py
```

### Manual Testing

Use the provided test endpoints to manually test merge functionality:

```bash
# Upload videos using the challenge video endpoints
curl -X POST "http://localhost:8000/api/v1/challenge-videos/upload-for-merge/initiate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video_count=3" \
  -F "video_filenames=[\"video1.mp4\",\"video2.mp4\",\"video3.mp4\"]" \
  # ... other parameters

# Trigger merge manually
curl -X POST "http://localhost:8000/api/v1/challenge-videos/merge-session/SESSION_ID/trigger" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl -X GET "http://localhost:8000/api/v1/challenge-videos/merge-session/SESSION_ID/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring and Maintenance

### Logging

The service provides comprehensive logging:

- **INFO**: Merge initiation, completion, and major milestones
- **DEBUG**: Detailed processing steps and FFmpeg commands
- **ERROR**: Failures and exceptions with stack traces
- **WARNING**: Non-fatal issues and fallbacks

### Cleanup Tasks

Regular maintenance tasks:

```python
# Clean up old merge sessions (run periodically)
await merge_service.cleanup_old_sessions(max_age_hours=24)

# Clean up expired upload sessions
await upload_service.cleanup_expired_sessions()
```

### Health Checks

Monitor service health:

```python
# Verify FFmpeg availability
try:
    merge_service._verify_ffmpeg()
    print("FFmpeg is available")
except VideoMergeError as e:
    print(f"FFmpeg issue: {e}")

# Check storage connectivity
if merge_service.use_cloud_storage:
    # Test cloud storage connection
    pass
```

## Security Considerations

### Input Validation

- All video files are validated before processing
- File size and duration limits are enforced
- MIME type validation prevents malicious uploads

### Access Control

- User authentication required for all operations
- Merge sessions are isolated by user ID
- Temporary files are cleaned up after processing

### Resource Limits

- Maximum concurrent merges per user
- Processing timeouts to prevent resource exhaustion
- Disk space monitoring and cleanup

## Future Enhancements

### Planned Features

1. **Advanced Compression**: User-selectable quality settings
2. **Batch Processing**: Process multiple merge sessions in parallel
3. **Resume Support**: Resume interrupted merge operations
4. **Webhook Notifications**: Notify clients when merges complete
5. **Analytics**: Detailed processing metrics and performance data

### Scalability Improvements

1. **Distributed Processing**: Support for multiple worker nodes
2. **Queue Management**: Redis-based job queue for merge operations
3. **Load Balancing**: Distribute merge operations across servers
4. **Caching**: Cache frequently accessed merged videos

## Troubleshooting

### Common Issues

1. **FFmpeg Not Found**
   - Install FFmpeg: `sudo apt install ffmpeg`
   - Verify PATH: `which ffmpeg`

2. **Merge Fails with "No video stream"**
   - Check input video format
   - Verify video files are not corrupted

3. **Out of Disk Space**
   - Clean up temporary files
   - Increase disk space or add cleanup automation

4. **Slow Processing**
   - Check server resources (CPU, memory)
   - Consider reducing concurrent merge limit
   - Optimize FFmpeg settings

### Debug Mode

Enable debug logging for detailed troubleshooting:

```python
import logging
logging.getLogger("services.video_merge_service").setLevel(logging.DEBUG)
```

This will show detailed FFmpeg commands and processing steps.