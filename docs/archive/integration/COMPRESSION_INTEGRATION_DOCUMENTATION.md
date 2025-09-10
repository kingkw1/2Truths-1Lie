<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Video Compression Integration Documentation

## Overview

The video merge service now includes integrated compression with configurable quality presets and standard parameters. This enhancement provides optimized video compression during the merge pipeline to reduce file sizes while maintaining quality.

## Features

### Configurable Quality Presets

Three quality presets are available:

- **High Quality**: Best quality, larger file size
  - CRF: 18
  - Preset: slow
  - Max bitrate: 5M
  - Audio bitrate: 192k

- **Medium Quality**: Balanced quality and file size (default)
  - CRF: 23
  - Preset: medium
  - Max bitrate: 2M
  - Audio bitrate: 128k

- **Low Quality**: Smaller file size, lower quality
  - CRF: 28
  - Preset: fast
  - Max bitrate: 1M
  - Audio bitrate: 96k

### Standard Compression Parameters

All compressed videos use these standard parameters for compatibility:

- **Video Codec**: H.264 (libx264)
- **Audio Codec**: AAC
- **Pixel Format**: yuv420p (ensures broad compatibility)
- **Profile**: High (better compression efficiency)
- **Level**: 4.0 (broad device compatibility)
- **Fast Start**: Enabled (optimized for web streaming)

## Configuration

### Settings (config.py)

```python
# Video compression settings
VIDEO_COMPRESSION_PRESET: str = "medium"
VIDEO_COMPRESSION_CRF: int = 23
VIDEO_MAX_BITRATE: str = "2M"
VIDEO_BUFFER_SIZE: str = "4M"
AUDIO_BITRATE: str = "128k"
AUDIO_CODEC: str = "aac"
VIDEO_CODEC: str = "libx264"

# Quality presets
COMPRESSION_QUALITY_PRESETS: dict = {
    "high": {...},
    "medium": {...},
    "low": {...}
}
```

## API Usage

### Get Available Presets

```http
GET /api/v1/challenge-videos/compression/presets
```

Response:
```json
{
  "available_presets": {
    "high": {
      "name": "high",
      "description": "CRF 18, slow preset, 5M max bitrate",
      "crf": 18,
      "preset": "slow",
      "max_bitrate": "5M",
      "audio_bitrate": "192k",
      "recommended_for": "Best quality, larger file size"
    },
    ...
  },
  "default_preset": "medium",
  "codec_info": {
    "video_codec": "libx264",
    "audio_codec": "aac"
  }
}
```

### Trigger Merge with Quality Preset

```http
POST /api/v1/challenge-videos/merge-session/{merge_session_id}/trigger
Content-Type: application/x-www-form-urlencoded

quality_preset=high
```

## Implementation Details

### Compression Pipeline

1. **Video Analysis**: Analyze input videos to determine optimal parameters
2. **Video Preparation**: Normalize format and resolution
3. **Video Merging**: Concatenate videos without re-encoding
4. **Compression**: Apply compression with selected quality preset
5. **Finalization**: Upload to storage and generate metadata

### Progress Monitoring

The compression step includes intelligent progress monitoring:

- Parses FFmpeg stderr output for real-time progress
- Falls back to time-based estimation if parsing fails
- Reports progress through callback mechanism

### Error Handling

Comprehensive error handling for compression failures:

- **COMPRESSION_ERROR**: General compression failures
- **FFMPEG_NOT_FOUND**: FFmpeg not available
- **VALIDATION_ERROR**: Invalid quality preset

## Performance Characteristics

### Compression Times (Approximate)

- **High Quality**: ~2-3x video duration
- **Medium Quality**: ~1-2x video duration  
- **Low Quality**: ~0.5-1x video duration

### File Size Reduction

Typical compression ratios:

- **High Quality**: 10-30% reduction
- **Medium Quality**: 20-50% reduction
- **Low Quality**: 40-70% reduction

*Actual results depend on source video characteristics*

## Testing

### Test Coverage

- Unit tests for compression settings
- Integration tests for quality presets
- End-to-end tests for compression pipeline
- Parameter validation tests

### Running Tests

```bash
# Basic compression functionality
python test_video_merge_service.py

# Compression integration
python test_compression_integration.py

# End-to-end compression
python test_compression_end_to_end.py
```

## Monitoring and Logging

### Log Messages

- Compression initiation with quality preset
- Progress updates during compression
- File size comparison (original vs compressed)
- Compression completion with statistics

### Metrics

- Compression ratio
- Processing time
- File size reduction
- Quality preset usage

## Best Practices

### Quality Preset Selection

- **High**: Use for important content, when file size is not a concern
- **Medium**: Default choice for most use cases
- **Low**: Use when bandwidth/storage is limited

### Performance Optimization

- Use appropriate quality preset for use case
- Monitor compression times and adjust if needed
- Consider caching compressed videos for repeated access

## Troubleshooting

### Common Issues

1. **FFmpeg Not Found**
   - Install FFmpeg: `sudo apt install ffmpeg`
   - Verify installation: `ffmpeg -version`

2. **Compression Fails**
   - Check input video format compatibility
   - Verify sufficient disk space
   - Check FFmpeg error logs

3. **Poor Quality Results**
   - Try higher quality preset
   - Check source video quality
   - Verify compression parameters

### Debug Information

Enable debug logging to see:
- FFmpeg command parameters
- Compression progress details
- File size comparisons
- Error details

## Future Enhancements

### Planned Features

- Custom quality preset creation
- Adaptive bitrate compression
- Hardware-accelerated encoding
- Advanced progress monitoring
- Compression analytics

### Configuration Extensions

- Per-user quality preferences
- Dynamic quality selection based on content
- Bandwidth-aware compression
- Storage optimization modes