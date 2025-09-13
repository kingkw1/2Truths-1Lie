# Content Moderation - MVP Design

## Current Implementation Status
**Existing Infrastructure**: The project has a comprehensive moderation service (`ModerationService`) with content filtering, status enums, and extensive test coverage. Challenge model already includes moderation status fields. User authentication system is fully implemented with user attribution. This design focuses on completing the missing API endpoints and mobile reporting interface.

## Architecture

The moderation system integrates into the existing Railway backend architecture. The comprehensive `ModerationService` provides content filtering capabilities, and the `Challenge` model includes moderation status fields. The user authentication system provides user identification for reporting. Missing components are the reporting API endpoints and mobile UI for user reports.

## Data Model Status

### Challenge (Backend - Moderation Fields Implemented ✅)

* `challenge_id`: UUID (Primary Key)
* `creator_id`: String (Maps to authenticated user ID)
* `status`: ChallengeStatus (Enum includes: 'PENDING_MODERATION', 'MODERATED') ✅
* `created_at`: Timestamp
* `updated_at`: Timestamp

### User (Backend - Authentication Implemented ✅)

* `id`: INTEGER (Primary Key) ✅
* `email`: TEXT (Unique, Indexed) ✅ 
* `name`: TEXT (Display name for attribution) ✅
* `created_at`: TIMESTAMP ✅
* `is_active`: BOOLEAN ✅

### ModerationService (Backend - Implemented ✅)

* `ModerationStatus`: Enum (PENDING, APPROVED, REJECTED, FLAGGED) ✅
* `ModerationReason`: Enum (comprehensive reasons including inappropriate_language, spam, etc.) ✅  
* `ModerationResult`: Class with status, confidence, reasons, details ✅

## API Endpoints (To Be Implemented)

### 1. Report a Challenge

* **Endpoint**: `POST /api/v1/challenges/{challenge_id}/report`
* **Authentication**: Required (JWT token)
* **Request Body**: `{ "reason": "inappropriate_language", "details": "Optional description" }`
* **Success Response (200 OK)**: `{ "message": "Challenge reported successfully", "report_id": "report_uuid" }`
* **Error Response (404 Not Found)**: `{ "detail": "Challenge not found" }`
* **Error Response (409 Conflict)**: `{ "detail": "Challenge already reported by this user" }`
* **Error Response (401 Unauthorized)**: `{ "detail": "Authentication required" }`

### 2. Get Reported Challenges (Admin)

* **Endpoint**: `GET /api/v1/admin/moderation/reports`
* **Authentication**: Required (Admin permission)
* **Query Parameters**: `?status=pending&limit=50&offset=0`
* **Success Response (200 OK)**: `[{ "challenge_id": "...", "creator_name": "User Name", "status": "pending_moderation", "report_count": 3, "created_at": "...", ... }]`
* **Error Response (403 Forbidden)**: `{ "detail": "Admin access required" }`

### 3. Review Reported Content (Admin)

* **Endpoint**: `PUT /api/v1/admin/moderation/challenges/{challenge_id}`
* **Authentication**: Required (Admin permission)
* **Request Body**: `{ "action": "approved", "reason": "content_acceptable", "notes": "Review notes" }`
* **Success Response (200 OK)**: `{ "message": "Moderation action applied", "new_status": "approved" }`

## Mobile Interface Design (To Be Implemented)

### Report Button Component

* **Location**: Challenge browser screen, challenge detail screens
* **UI Element**: Small flag/report icon button next to each challenge
* **Behavior**: 
  - Tap opens a report modal with reason selection
  - Options: "Inappropriate Language", "Spam", "Harassment", "Copyright", "Other"
  - Include optional text field for additional details
  - Success shows toast: "Challenge reported. Thank you for helping keep our community safe."
  - Disable button after reporting to prevent duplicates

### Report Modal Interface

* **Design**: Bottom sheet or overlay modal
* **Content**: 
  - Title: "Report Challenge"
  - Radio button list for report reasons
  - Optional text area: "Additional details (optional)"
  - Cancel and Submit buttons
* **UX Flow**: Modal -> reason selection -> submit -> success toast -> close modal

## Technical Implementation

### Backend Integration Points

* **Existing**: `ModerationService` with comprehensive filtering and status management ✅
* **Missing**: API endpoints for user reporting and admin review workflows
* **Required**: Database tables for user reports (report_id, challenge_id, user_id, reason, details, timestamp)

### Mobile Integration

* **New Components**: `ReportButton`, `ReportModal`, `ReportService` (API calls)
* **Existing Integration**: Use authentication system for user identification ✅
* **State Management**: Add reporting state to Redux store
* **Error Handling**: Network errors, authentication failures, duplicate reports

## Testing Strategy (Moderation Service Tests ✅)

### Backend Testing Status

* **Unit Tests**: ModerationService has comprehensive test coverage ✅
* **Integration Tests**: Challenge moderation workflow tests exist ✅

### Required Mobile Testing

* **Component Tests**: ReportButton, ReportModal rendering and interactions
* **API Integration Tests**: Report submission, error handling, authentication
* **E2E Tests**: Complete reporting workflow from challenge view to submission

## MVP Scope

**Phase 1 (API Implementation)**:
1. Add user reports database table
2. Implement `/api/v1/challenges/{id}/report` endpoint  
3. Add admin moderation endpoints
4. Test API functionality

**Phase 2 (Mobile Implementation)**:
1. Create ReportButton and ReportModal components
2. Add reporting service for API calls
3. Integrate into challenge browser screens
4. Add reporting state to Redux

**Phase 3 (Admin Interface)**:
1. Web-based admin dashboard for reviewing reports
2. Bulk moderation actions
3. Automated content filtering integration

## Success Metrics

* **User Adoption**: Percentage of users who report inappropriate content
* **Moderation Efficiency**: Time from report to resolution
* **Content Quality**: Reduction in inappropriate content remaining visible
* **False Positives**: Rate of incorrectly flagged content

### Existing ModerationService Integration
- Extend existing `ModerationService` methods for API endpoint integration
- Leverage existing moderation status enums and result classes
- Maintain compatibility with current challenge status workflow

### Mobile UI Integration  
- Add report functionality to existing video player components
- Integrate with current navigation and modal patterns
- Preserve existing fullscreen video experience
