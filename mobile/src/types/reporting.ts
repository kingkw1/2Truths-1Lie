/**
 * Reporting types shared across the application
 * Separated from components to avoid native dependencies in tests
 */

// ModerationReason enum values from backend
export enum ModerationReason {
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

export interface ReportRequest {
  reason: ModerationReason;
  details?: string;
}

export interface ReportResponse {
  report_id: number;
  message: string;
  challenge_id: string;
}