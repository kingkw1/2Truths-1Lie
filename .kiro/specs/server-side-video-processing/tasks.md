# Media Upload Migration to Server-Side Merging — Tasks

## Cleanup & Setup

- [ ] Remove client-side video merging and compression logic.
- [ ] Refactor mobile upload flow to send three separate video files per challenge.

## Backend – Upload & Merge

- [ ] Implement `/api/v1/challenge-videos/upload-for-merge` backend endpoint for multi-video upload.
- [ ] Develop backend logic to merge videos using FFmpeg asynchronously.
- [ ] Integrate video compression in merge pipeline with standard parameters.
- [ ] Upload merged video to S3 and remove individual uploaded videos.
- [ ] Calculate and store segment metadata (start/end times) in challenge records.
- [ ] Return merged video URL and metadata through upload response.

## Backend – Challenge Management

- [ ] Update challenge creation endpoint to accept merged video URL and segment metadata.
- [ ] Implement authenticated `GET /api/v1/challenges` to list challenges with merged data.
- [ ] Build `GET /api/v1/media/{id}` endpoint to serve video assets with secure signed URLs.
- [ ] Set up monitoring and logging for media processing failures.

## Client – Upload & Playback

- [ ] Change mobile upload service to upload individual videos to the merge endpoint.
- [ ] Handle asynchronous merge status updates and display progress to users.
- [ ] Update challenge creation on client to use merged video data.
- [ ] Modify playback UI for segmented video navigation based on server metadata.
- [ ] Implement robust error handling for upload and playback.

## Testing

- [ ] Write unit tests for backend merge logic and media processing.
- [ ] Create integration tests for multi-video upload and merge endpoints.
- [ ] Automate end-to-end tests covering user video capture, upload, challenge creation, and playback.
- [ ] Conduct device testing for playback UI and network resilience.
- [ ] Verify compliance with all security and validation requirements.

## Documentation

- [ ] Update developer documentation with new API definitions and media flow.
- [ ] Revise user guides describing improved upload and playback features.
- [ ] Document monitoring and alerting processes for media pipeline.

## Future Work

- [ ] Research advanced compression options and user quality controls.
- [ ] Plan migration strategy for existing challenges with separate videos.
- [ ] Explore CDN integration for optimal content delivery.
