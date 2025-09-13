# Content Moderation - MVP Implementation Tasks

## Implementation Status
**Backend Service**: ✅ Complete - Comprehensive `ModerationService` with content filtering, status enums, and extensive test coverage  
**Data Models**: ✅ Complete - Challenge model includes moderation status fields (`PENDING_MODERATION`, `MODERATED`)  
**Missing**: API endpoints for reporting and admin review, plus mobile UI for user reporting

### Tasks Kiro Can Automate (API Implementation, UI Integration, Testing)

- [ ] Create `POST /api/v1/challenges/{challenge_id}/report` endpoint with existing ModerationService integration
- [ ] Create `GET /api/v1/admin/moderation/reports` endpoint to fetch challenges pending moderation
- [ ] Create `PUT /api/v1/admin/moderation/challenges/{challenge_id}` endpoint for admin review actions
- [ ] Integrate reporting API endpoints with existing challenge status workflow and database models
- [ ] Add report button/menu option to existing FullscreenGuessScreen and GameScreen video players
- [ ] Create report reason selection modal component matching backend ModerationReason enum values
- [ ] Generate API client functions in mobile app for challenge reporting and status checking
- [ ] Create report confirmation UI with user-friendly feedback messaging
- [ ] Generate comprehensive API tests for all moderation endpoints with existing ModerationService integration
- [ ] Generate mobile UI tests for report button functionality and confirmation flows

### Tasks To Perform Manually (UX Decisions, Admin Workflow, Security Review)

- [ ] Design the optimal user experience for reporting - context menu vs button vs long-press gesture
- [ ] Determine report reason categories and validation rules for user-friendly reporting flow
- [ ] Set up admin notification system and alerting for new reports (email, Slack, etc.)
- [ ] Define and document the internal admin review process and escalation procedures
- [ ] Configure admin authentication and authorization for moderation endpoints
- [ ] Test end-to-end reporting flow on physical devices with actual video content
- [ ] Establish process for monitoring report volume and identifying false positives
- [ ] Review and validate integration with existing Railway deployment and production monitoring