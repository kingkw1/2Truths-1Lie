# Content Moderation - MVP Requirements

## Current Implementation Status
**Note**: The project already has a comprehensive backend moderation service with content filtering, moderation statuses, and extensive test coverage. Challenge model includes moderation status fields. This spec focuses on completing the missing API endpoints and mobile UI for user reporting.

## User Story: Reporting Inappropriate Content

WHEN a user is viewing a video challenge
THE SYSTEM SHALL display a "Report" option accessible via context menu or long-press

WHEN a user selects the "Report" option for a specific video
THE SYSTEM SHALL record that a report has been submitted for that challenge ID
AND THE SYSTEM SHALL update the challenge status to include moderation flag
AND THE SYSTEM SHALL trigger an alert for administrative review
AND THE SYSTEM SHALL display a confirmation message to the user acknowledging their report has been received

## User Story: Administrative Review

WHEN an administrator checks for reported content
THE SYSTEM SHALL provide a list of all challenges that have been reported and are pending moderation

WHEN an administrator reviews a reported challenge
THE SYSTEM SHALL allow the administrator to manually take action, such as approving, rejecting, or removing the content
AND THE SYSTEM SHALL update the challenge status accordingly

## Non-Goals for MVP

* Automatic or AI-driven content moderation
* Detecting or analyzing sophisticated abuse
* Flows for users to be blocked or banned
* Mechanisms for users to appeal a moderation decision