# ReportModal Component Usage Guide

## Overview

The `ReportModal` component provides a user interface for reporting inappropriate content in challenges. It integrates with the backend content moderation system and follows the established design patterns of the mobile app.

## Features

- **Reason Selection**: Dropdown with backend-synchronized moderation reasons
- **Optional Details**: Text input for additional context
- **Form Validation**: Ensures required fields are filled
- **Authentication Check**: Verifies user is logged in before submission
- **Loading States**: Shows submission progress and prevents duplicate submissions
- **Error Handling**: Graceful error handling with user-friendly messages
- **Accessibility**: Full accessibility support with proper labels and hints

## Basic Usage

```tsx
import React, { useState } from 'react';
import { ReportModal, ModerationReason } from '../components/ReportModal';
import { reportService } from '../services/reportService';

const MyComponent = () => {
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReportSubmit = async (reason: ModerationReason, details?: string) => {
    try {
      setIsSubmitting(true);
      await reportService.reportChallenge('challenge-id', { reason, details });
      // Handle success (show toast, update UI, etc.)
    } catch (error) {
      // Handle error
      throw error; // Re-throw so modal can show error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)}>
        <Text>Report Content</Text>
      </TouchableOpacity>
      
      <ReportModal
        visible={showModal}
        challengeId="challenge-id"
        onClose={() => setShowModal(false)}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
};
```

## Integration with ReportButton

For a complete reporting workflow, use the `ReportingExample` component which integrates the `ReportButton` and `ReportModal`:

```tsx
import { ReportingExample } from '../components/ReportingExample';

const ChallengeCard = ({ challenge }) => {
  return (
    <View>
      {/* Challenge content */}
      <ReportingExample 
        challengeId={challenge.id}
        onReportSubmitted={() => {
          // Handle successful report submission
          console.log('Challenge reported successfully');
        }}
      />
    </View>
  );
};
```

## Props

### ReportModal Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | Yes | Controls modal visibility |
| `challengeId` | `string` | Yes | ID of the challenge being reported |
| `onClose` | `() => void` | Yes | Called when modal should be closed |
| `onSubmit` | `(reason: ModerationReason, details?: string) => Promise<void>` | Yes | Called when report is submitted |
| `isSubmitting` | `boolean` | No | Shows loading state during submission |

## ModerationReason Enum

The component uses the `ModerationReason` enum which matches the backend values:

```tsx
enum ModerationReason {
  INAPPROPRIATE_LANGUAGE = 'inappropriate_language',
  SPAM = 'spam',
  PERSONAL_INFO = 'personal_info',
  VIOLENCE = 'violence',
  HATE_SPEECH = 'hate_speech',
  ADULT_CONTENT = 'adult_content',
  COPYRIGHT = 'copyright',
  MISLEADING = 'misleading',
  LOW_QUALITY = 'low_quality',
}
```

## Error Handling

The modal handles various error scenarios:

- **Authentication Required**: Shows alert if user is not logged in
- **Missing Reason**: Shows alert if no reason is selected
- **Network Errors**: Displays appropriate error messages
- **Duplicate Reports**: Handles already reported content
- **Validation Errors**: Shows validation error messages

## Accessibility

The component includes comprehensive accessibility features:

- Proper `accessibilityLabel` and `accessibilityHint` attributes
- `accessibilityRole` for interactive elements
- `accessibilityState` for radio button selection
- Screen reader friendly text and navigation

## Styling

The component uses a consistent design system:

- Modal presentation with slide animation
- Header with cancel/submit buttons
- Scrollable content area
- Radio button selection for reasons
- Text input with character counter
- Proper spacing and typography

## Testing

Unit tests are provided in `__tests__/ReportModal.test.tsx` covering:

- Component rendering
- User interactions
- Form validation
- Error handling
- Authentication checks
- Submission workflow

## Backend Integration

The component integrates with the backend through the `reportService`:

- **Endpoint**: `POST /api/v1/challenges/{id}/report`
- **Authentication**: JWT token required
- **Request Body**: `{ reason: string, details?: string }`
- **Response**: `{ report_id: number, message: string, challenge_id: string }`

## State Management

The component manages local state for:

- Selected reason
- Details text
- Submission status
- Form validation

For global state management, integrate with Redux through the parent component.