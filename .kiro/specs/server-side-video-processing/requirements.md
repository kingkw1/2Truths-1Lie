# Media Upload and Challenge Playback Requirements

## Recording & Upload

- The app shall allow users to record three separate video statements.
- Videos shall be compressed client-side to reduce upload sizes while preserving quality.
- Users shall confirm submission before any uploads occur.
- The app shall upload these three videos as separate files to the backend merge endpoint.

## Backend Video Processing

- The backend shall accept multiple uploaded videos per challenge.
- The backend shall merge and compress videos using FFmpeg in an asynchronous workflow.
- The backend shall generate and store accurate segment metadata indicating each statement's start and end times within the merged video.
- The backend shall upload the merged video to persistent cloud storage and delete original videos to optimize costs.

## Challenge Data & API

- Challenges shall persist merged video URL and segment metadata in cloud-backed storage.
- The backend shall provide authenticated REST API endpoints to create, list, and retrieve challenges with all necessary data.
- The backend shall support real-time synchronization to ensure prompt client visibility of new challenges.

## Playback & UI

- The client app shall fetch merged video URLs and segment metadata for each challenge.
- Playback UI shall allow navigation between segments, replay of individual clips, and flexible ordering.
- Playback controls shall support accurate seeking within merged media based on server-provided segment timestamps.

## Security & Compliance

- All uploads and data exchanges shall be authenticated and authorized.
- Video content shall be validated and scanned to prevent malicious uploads.
- Data storage shall comply with privacy best practices including encryption and minimal retention.

## Scalability & Reliability

- The system shall handle concurrent uploads and merges efficiently.
- Uploads shall support resumability and network fault tolerance.
- Backend processing shall include monitoring, error handling, and alerting mechanisms.

## Future Extensions

- Support user-driven video quality selection.
- Add migration utilities for legacy separate videos.
- Integrate CDN and adaptive bitrate streaming.
