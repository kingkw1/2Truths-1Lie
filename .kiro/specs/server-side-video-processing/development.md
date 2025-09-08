# Development and Testing Workflow for Server-Side Merging Feature

## Development Steps:

1. **Backend Setup & Local Testing**
   - Build and run the `/upload-for-merge` endpoint locally.
   - Validate FFmpeg merging with test videos.
   - Confirm video compression executes successfully.
   - Ensure merged video uploads to S3 and originals are deleted.

2. **Client Upload Integration**
   - Modify mobile upload code to use new merge endpoint.
   - Implement UI for showing merge progress or pending state.

3. **Challenge Creation & Playback**
   - Send merged video info in challenge creation request.
   - Update playback components to consume merged video and segment data.
   - Verify segmented navigation and replay functionality.

4. **Full End-to-End Validation**
   - Submit actual challenges with recorded videos from device.
   - Confirm merged video is produced, uploaded, and usable.
   - Confirm challenges appear in listings and playback works seamlessly.

## Testing Milestones:

- **Unit Testing**
  - Backend media processing functions including FFmpeg commands.
  - Client utility functions for metadata handling.

- **Integration Testing**
  - Multi-video upload to merge endpoint.
  - Challenge creation and retrieval endpoints.

- **End-to-End Testing**
  - Full user flow: record videos → upload → merge → create challenge → play challenge.
  - Tests for UI progress indicators and error states.

- **Cross-Platform Testing**
  - Validate feature on both iOS and Android devices/emulators.

- **Performance & Stability**
  - Run stress tests on backend merge processing.
  - Monitor resource use during merging tasks.

## Additional Notes:

- Use mock media files for automated testing.
- Keep logs detailed for debugging.
- Track merge job status and allow clients to poll or receive updates.
- Actively collect user feedback during beta and after launch for improvements.

---

By following this structured workflow, you ensure smooth transition from client-side to server-side merging, faster iteration cycles, and maintain high product quality.

---

If you need runnable sample code snippets, pipeline configs, or test script templates for these steps—just ask!
