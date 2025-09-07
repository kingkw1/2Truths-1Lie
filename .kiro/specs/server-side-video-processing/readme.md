# Server-Side Video Merging and Playback Workflow

## Objective
Transition video merging responsibility from mobile client to backend server to simplify client logic, improve reliability, and reduce AWS usage through merged video storage.

## Requirements

- The backend shall accept multiple individual video uploads per challenge and merge them server-side using FFmpeg.
- Merged video shall be compressed and stored in cloud storage, deleting original individual uploads to minimize storage.
- The backend shall calculate and store accurate segment start/end times within the merged video for segmented playback.
- The client shall upload individual videos to the backend merge endpoint, receive merged video URL and segment metadata.
- The client shall play the merged video with UI to select and replay individual statements by seeking segment timestamps.
- The merge process shall be asynchronous with optional client polling or push for merge completion status.

## API Endpoints

- POST `/api/v1/challenges/upload-for-merge`  
  Accepts multiple video uploads; returns merged video URL and segment metadata.

- GET `/api/v1/challenges`  
  Returns list of challenges with merged media and playback info.

- POST `/api/v1/challenges`  
  Creates a challenge record referencing merged media and metadata.

## Data Models

- Challenge includes merged video URL, and segment metadata containing start time, end time, and statement index (in seconds).

## Workflow

1. User records three individual videos on client.
2. Client uploads these raw videos to backend upload-for-merge endpoint.
3. Backend merges and compresses videos, stores final merged output.
4. Backend deletes individual source uploads.
5. Backend stores merged video URL and segment metadata in challenge record.
6. Client fetches challenge data including merged media info.
7. Client playback UI seeks and plays merged video segments accordingly.

## Testing Strategy

- Backend unit and integration tests for upload, merge, compression, metadata accuracy.
- End-to-end tests from mobile upload through playback.
- Cross-platform client playback UI verification for segmented video navigation.
