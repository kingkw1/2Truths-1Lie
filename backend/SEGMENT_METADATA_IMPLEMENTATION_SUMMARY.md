# Segment Metadata Implementation Summary

## Overview

This document summarizes the implementation of segment metadata support for merged video challenges in the backend system. The implementation allows the backend to store and retrieve detailed segment information for challenges that use merged videos containing multiple statement segments.

## Changes Made

### 1. Enhanced Data Models (`models.py`)

#### New Models Added:

- **`VideoSegmentMetadata`**: Represents metadata for a single video segment within a merged video
  - `start_time`: Start time in seconds within merged video
  - `end_time`: End time in seconds within merged video  
  - `duration`: Duration of segment in seconds
  - `statement_index`: Index of the statement (0-2)
  - Includes validation to ensure end_time > start_time and duration matches calculated duration

- **`MergedVideoMetadata`**: Represents metadata for a complete merged video
  - `total_duration`: Total duration of merged video in seconds
  - `segments`: List of VideoSegmentMetadata for each statement (exactly 3)
  - `video_file_id`: File ID of the merged video
  - `compression_applied`: Whether compression was applied
  - `original_total_duration`: Original duration before compression (optional)
  - Includes validation to ensure segments don't overlap and total duration is consistent

#### Enhanced Existing Models:

- **`Statement`**: Added new segment metadata fields
  - `segment_metadata`: Optional VideoSegmentMetadata for enhanced segment info
  - Retained legacy fields (`segment_start_time`, `segment_end_time`, `segment_duration`) for backward compatibility

- **`Challenge`**: Enhanced merged video support
  - `merged_video_metadata`: Optional MergedVideoMetadata for structured segment info
  - `legacy_merged_metadata`: Optional Dict for backward compatibility with old metadata format

- **`CreateChallengeRequest`**: Updated to support new metadata structure
  - `merged_video_metadata`: Optional MergedVideoMetadata
  - `legacy_merged_metadata`: Optional Dict for legacy support

### 2. Enhanced Challenge Service (`services/challenge_service.py`)

#### New Methods Added:

- **`get_challenge_segment_metadata(challenge_id)`**: Retrieves segment metadata for playback
  - Returns structured segment data for merged video challenges
  - Supports both new structured format and legacy formats
  - Returns None for non-merged video challenges

- **`get_challenge_stats(challenge_id)`**: Enhanced to include segment metadata information
  - Added `has_segment_metadata` field to indicate if challenge has segment data
  - Added `is_merged_video` field to stats response

#### Enhanced Existing Methods:

- **`create_challenge()`**: Enhanced to handle segment metadata
  - Validates merged video metadata when `is_merged_video` is True
  - Ensures segment metadata exists for all 3 statements when using structured format
  - Creates Statement objects with both legacy and new segment metadata
  - Validates segment indices are 0, 1, 2

### 3. Enhanced API Endpoints (`api/challenge_endpoints.py`)

#### New Endpoints Added:

- **`GET /api/v1/challenges/{challenge_id}/segments`**: Retrieve segment metadata
  - Returns detailed segment information for merged video challenges
  - Supports authentication via JWT token
  - Returns 404 for non-existent or non-merged video challenges
  - Response includes:
    - `is_merged_video`: Boolean indicating if this is a merged video
    - `total_duration`: Total duration of merged video
    - `segments`: Array of segment metadata with start/end times and statement info
    - `video_file_id`: ID of the merged video file
    - `compression_applied`: Whether compression was applied

## API Response Formats

### Segment Metadata Response

```json
{
  "is_merged_video": true,
  "total_duration": 25.0,
  "segments": [
    {
      "statement_id": "stmt-123",
      "statement_index": 0,
      "start_time": 0.0,
      "end_time": 8.5,
      "duration": 8.5,
      "statement_type": "truth"
    },
    {
      "statement_id": "stmt-456", 
      "statement_index": 1,
      "start_time": 8.5,
      "end_time": 17.2,
      "duration": 8.7,
      "statement_type": "lie"
    },
    {
      "statement_id": "stmt-789",
      "statement_index": 2, 
      "start_time": 17.2,
      "end_time": 25.0,
      "duration": 7.8,
      "statement_type": "truth"
    }
  ],
  "video_file_id": "merged-video-abc123",
  "compression_applied": true
}
```

### Legacy Format Support

For challenges using legacy metadata formats, the response includes:

```json
{
  "is_merged_video": true,
  "legacy_format": true,
  "segments": [...],
  "metadata": {...}
}
```

## Validation Features

### Segment Metadata Validation

- **Time Consistency**: Ensures end_time > start_time for all segments
- **Duration Accuracy**: Validates that duration matches calculated time difference
- **No Overlaps**: Ensures segments don't overlap in time
- **Complete Coverage**: Validates that segments cover the full video duration
- **Index Validation**: Ensures statement indices are exactly 0, 1, 2

### Challenge Creation Validation

- **Required Metadata**: When `is_merged_video` is True, metadata must be provided
- **Segment Count**: Exactly 3 segments must be provided for merged videos
- **Index Coverage**: All statement indices (0, 1, 2) must be present
- **Consistency**: Validates that segment metadata is consistent with statement data

## Backward Compatibility

The implementation maintains full backward compatibility:

- **Legacy Fields**: Original segment fields in Statement model are preserved
- **Legacy Metadata**: Supports old metadata format in Challenge model
- **Graceful Fallback**: API endpoints fall back to legacy data when new format unavailable
- **Migration Support**: Existing challenges continue to work without modification

## Usage Examples

### Creating a Merged Video Challenge

```python
from models import CreateChallengeRequest, VideoSegmentMetadata, MergedVideoMetadata

# Create segment metadata
segments = [
    VideoSegmentMetadata(start_time=0.0, end_time=8.5, duration=8.5, statement_index=0),
    VideoSegmentMetadata(start_time=8.5, end_time=17.2, duration=8.7, statement_index=1),
    VideoSegmentMetadata(start_time=17.2, end_time=25.0, duration=7.8, statement_index=2)
]

merged_metadata = MergedVideoMetadata(
    total_duration=25.0,
    segments=segments,
    video_file_id="merged-video-123",
    compression_applied=True
)

# Create challenge request
request = CreateChallengeRequest(
    title="My Merged Video Challenge",
    statements=[...],  # Statement data with media_file_id
    lie_statement_index=1,
    is_merged_video=True,
    merged_video_metadata=merged_metadata
)
```

### Retrieving Segment Metadata

```python
# Get segment metadata for playback
segment_data = await challenge_service.get_challenge_segment_metadata("challenge-123")

if segment_data:
    for segment in segment_data['segments']:
        print(f"Statement {segment['statement_index']}: {segment['start_time']}s - {segment['end_time']}s")
```

## Testing

The implementation includes comprehensive validation:

- **Model Validation**: Tests for VideoSegmentMetadata and MergedVideoMetadata validation
- **Service Integration**: Tests for challenge creation and retrieval with segment metadata
- **API Functionality**: Tests for segment metadata API endpoints
- **Legacy Compatibility**: Tests for backward compatibility with existing data formats
- **Error Handling**: Tests for proper validation error handling

## Requirements Satisfied

This implementation satisfies the following requirements from the media upload specification:

✅ **Requirement 6**: Composite Challenge Video with Segmented Metadata
- Stores segment metadata as part of challenge record in backend
- Supports JSON array with {start, end} fields for each statement
- Enables playback of individual statements by seeking to corresponding segments
- Allows replay and out-of-order viewing of segments

✅ **Backend Data Model Enhancement**
- Enhanced challenge data model to store segment metadata
- Added validation for segment consistency and completeness
- Provided API endpoints for retrieving segment information

✅ **Cross-Device Accessibility**
- Segment metadata is stored server-side and accessible across devices
- API endpoints support authenticated access to segment information
- Backward compatibility ensures existing challenges remain accessible

## Next Steps

The backend is now ready to:

1. **Accept merged video uploads** with segment metadata from mobile clients
2. **Store and validate** segment information for challenge playback
3. **Serve segment metadata** to mobile clients for video playback control
4. **Support migration** of existing challenges to new format if needed

The mobile client can now be updated to use the new `/segments` endpoint to retrieve playback information for merged video challenges.