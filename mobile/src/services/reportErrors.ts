/**
 * Report Error Types and Classes
 * Shared error definitions for content reporting
 */

export enum ReportErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_REPORT = 'DUPLICATE_REPORT',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ReportError extends Error {
  public readonly type: ReportErrorType;
  public readonly statusCode?: number;
  public readonly userMessage: string;

  constructor(
    type: ReportErrorType,
    message: string,
    userMessage: string,
    statusCode?: number
  ) {
    super(message);
    this.name = 'ReportError';
    this.type = type;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
  }
}