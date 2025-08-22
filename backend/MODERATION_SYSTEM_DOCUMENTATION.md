# Content Moderation System Documentation

## Overview

The content moderation system provides automated and manual review capabilities for user-generated challenges in the 2Truths-1Lie game. It filters inappropriate material and maintains community standards.

## Features

### Automated Moderation

The system automatically analyzes challenges for:

- **Inappropriate Language**: Profanity, offensive terms, hate speech
- **Spam Content**: Promotional links, repetitive content, commercial spam
- **Personal Information**: SSNs, phone numbers, email addresses, credit cards
- **Violence/Threats**: Violent language, threats, harmful content
- **Media Quality**: File size, duration, format validation

### Manual Moderation

- **Flagging System**: Users can flag inappropriate content for review
- **Admin Review**: Moderators can manually approve, reject, or flag content
- **Review Queue**: Centralized queue for pending and flagged content

### Moderation Statuses

- `pending` - Awaiting initial moderation
- `approved` - Content approved for publication
- `rejected` - Content rejected and blocked
- `flagged` - Content flagged for manual review

## API Endpoints

### Flag Challenge
```
POST /api/v1/challenges/{challenge_id}/flag
```
Allows users to flag inappropriate content.

### Get Moderation Status
```
GET /api/v1/challenges/{challenge_id}/moderation
```
Returns moderation status and details for a challenge.

### Admin Endpoints

#### Get Challenges for Moderation
```
GET /api/v1/admin/moderation/challenges
```
Returns challenges needing moderation review.

#### Manual Review
```
POST /api/v1/admin/moderation/challenges/{challenge_id}/review
```
Allows moderators to manually review and decide on flagged content.

#### Moderation Statistics
```
GET /api/v1/admin/moderation/stats
```
Returns moderation statistics and metrics.

## Integration with Challenge Workflow

1. **Challenge Creation**: Challenges start in `draft` status
2. **Publishing**: When published, challenges undergo automatic moderation
3. **Moderation Results**:
   - `approved` → Challenge becomes `published`
   - `rejected` → Challenge becomes `rejected`
   - `flagged` → Challenge becomes `pending_moderation`
4. **Manual Review**: Moderators can review flagged content and make final decisions

## Content Analysis Rules

### Text Analysis
- Pattern matching for inappropriate language
- Spam detection using common promotional phrases
- PII detection using regex patterns
- Violence/threat detection

### Media Analysis
- Duration validation (1-300 seconds)
- File size limits (max 50MB)
- MIME type validation (video/audio formats only)
- Quality assessment based on metadata

## Configuration

The moderation service can be configured through:
- Pattern updates for content detection
- Threshold adjustments for confidence scoring
- Custom rules for specific content types

## Monitoring and Metrics

The system tracks:
- Total moderated content
- Approval/rejection rates
- Flag counts and reasons
- Moderator activity
- Response times

## Future Enhancements

- AI-powered content analysis integration
- Image/video content analysis
- Community-based moderation features
- Advanced spam detection
- Automated appeals process