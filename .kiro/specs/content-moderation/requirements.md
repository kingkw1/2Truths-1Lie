# Content Moderation - MVP Requirements

## User Story: Reporting Inappropriate Content

WHEN a user is viewing a video challenge
THE SYSTEM SHALL display a "Report" option

WHEN a user selects the "Report" option for a specific video
THE SYSTEM SHALL record that a report has been submitted for that video's ID
AND THE SYSTEM SHALL trigger an alert for administrative review
AND THE SYSTEM SHALL display a confirmation message to the user acknowledging their report has been received

## User Story: Administrative Review

WHEN an administrator checks for reported content
THE SYSTEM SHALL provide a list of all videos that have been reported

WHEN an administrator reviews a reported video
THE SYSTEM SHALL allow the administrator to manually take action, such as disabling or deleting the content

## Non-Goals for MVP

* Automatic or AI-driven content moderation
* Detecting or analyzing sophisticated abuse
* Flows for users to be blocked or banned
* Mechanisms for users to appeal a moderation decision