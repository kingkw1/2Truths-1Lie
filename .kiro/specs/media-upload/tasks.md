# Media Upload – Implementation Tasks

## Core Tasking
- [x] Design and implement backend API endpoints for secure video upload and streaming retrieval  
- [x] Integrate cloud storage provider (AWS S3, Firebase, or equivalent) for persistent, scalable media storage  
- [x] Update client logic to record, compress, and upload video to backend with progress feedback  
- [x] Refactor challenge data model to store persistent server URLs post-upload  
- [x] Implement robust frontend upload UI (progress, cancel, retry, error states)  
- [x] Enforce strict server/client validation (file format, size, duration) before acceptance  
- [x] Ensure cross-device accessibility for uploaded videos (iOS/Android, multi-login)  
- [x] Add secure authentication/authorization flow to uploads and downloads  
- [x] Provide migration for legacy blob/video references to new URLs  
- [x] Write complete unit/integration/regression tests for upload process and error handling  
- [x] Update developer and user documentation to describe persistent media workflow  
- [x] (Optional) Integrate CDN and signed URL support for global scalable delivery

## Combined Uploads
- [x] Update mobile client to record segment start/end time while merging three recorded videos
- [ ] Implement video merging logic on device for three statements
- [ ] Update upload workflow to send merged video file plus segment metadata to backend
- [ ] Modify backend and challenge data model to store and retrieve segment metadata with each challenge
- [ ] Update challenge creation API to accept merged video and segment timecodes
- [ ] Update mobile playback UI to present three selectable statement segments and seek/play video segment as needed
- [ ] Test new upload, metadata, and segment playback workflows cross-platform
- [ ] Update developer and user documentation to describe new segment-based challenge flow

## Compression Integration
- [ ] Research and select reliable video compression libraries compatible with React Native for Android/iOS.
- [ ] Implement automated compression of individual video statements before final merge.
- [ ] Implement compression of the merged video file prior to upload initiation.
- [ ] Update upload service to wait for compression completion before starting upload.
- [ ] Adjust metadata capture logic to recalculate segment timestamps post-compression.
- [ ] Enhance UI to display compression progress and handle compression errors gracefully.
- [ ] Conduct cross-platform testing focusing on quality vs. compression ratio trade-offs.
- [ ] Update documentation explaining compression process and its impact on upload and playback.
