# Content Moderation - MVP Implementation Tasks

### Tasks Kiro Can Automate (Spec-to-Code, Testing, API Generation)

- [ ] Extend the `Video` data model to include a `status` field with possible values 'live', 'reported', 'removed'
- [ ] Generate the `POST /api/videos/{id}/report` API endpoint to update a video's status to 'reported'
- [ ] Generate the admin-only `GET /api/admin/reports` endpoint to fetch all videos with a 'reported' status
- [ ] Implement a basic notification trigger (e.g., logging a message or emitting an event) when a video is reported
- [ ] Generate the "Report" button component for the frontend video player/challenge screen
- [ ] Generate the API client function in the mobile app to call the report endpoint
- [ ] Create a basic confirmation modal UI that appears after the user taps the report button
- [ ] Generate backend unit and integration tests for both the public report endpoint and the admin reports endpoint
- [ ] Generate frontend tests to verify the report button's presence and the confirmation flow

### Tasks To Perform Manually (Configuration, Deployment, Review)

- [ ] Configure the admin notification system (e.g., set up email transport or log monitoring)
- [ ] Define and document the internal process for reviewing and acting on reported content
- [ ] Deploy the updated API and frontend application
- [ ] Manually test the end-to-end reporting flow on physical devices.
- [ ] Establish the process for manually removing content (e.g., a secure script or direct database access procedure)
- [ ] Monitor the volume and nature of reports post-launch