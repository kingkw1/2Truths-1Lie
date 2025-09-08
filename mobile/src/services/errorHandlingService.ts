/**
 * Enhanced Error Handling Service
 * Provides comprehensive error handling for upload and playback operations
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface ErrorDetails {
  type: 'network' | 'server' | 'auth' | 'timeout' | 'validation' | 'upload' | 'playback' | 'merge' | 'storage' | 'unknown';
  message: string;
  userMessage: string;
  retryable: boolean;
  retryDelay?: number;
  originalError?: any;
  context?: string;
  timestamp?: Date;
  errorCode?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryActions?: string[];
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => Promise<void> | void;
  primary?: boolean;
}

export interface ErrorContext {
  operation: 'upload' | 'playback' | 'merge' | 'auth' | 'network' | 'general';
  component?: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private isOnline: boolean = true;

  private constructor() {
    this.initializeNetworkListener();
  }

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  public async checkNetworkStatus(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;
      return this.isOnline;
    } catch (error) {
      console.warn('Failed to check network status:', error);
      return false;
    }
  }

  public categorizeError(error: any, context?: ErrorContext): ErrorDetails {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const lowerMessage = errorMessage.toLowerCase();
    const timestamp = new Date();

    // Network errors
    if (!this.isOnline || lowerMessage.includes('network request failed') || 
        lowerMessage.includes('no internet') || lowerMessage.includes('connection failed') ||
        lowerMessage.includes('fetch failed') || lowerMessage.includes('network error')) {
      return {
        type: 'network',
        message: errorMessage,
        userMessage: 'No internet connection. Please check your network and try again.',
        retryable: true,
        retryDelay: 2000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'medium',
        recoveryActions: ['Check internet connection', 'Try again', 'Switch to mobile data'],
      };
    }

    // Upload-specific errors
    if (context?.operation === 'upload' || lowerMessage.includes('upload')) {
      if (lowerMessage.includes('file too large') || lowerMessage.includes('size limit')) {
        return {
          type: 'upload',
          message: errorMessage,
          userMessage: 'File is too large. Please compress the video or record a shorter clip.',
          retryable: false,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'medium',
          recoveryActions: ['Compress video', 'Record shorter clip', 'Check file size'],
        };
      }

      if (lowerMessage.includes('unsupported format') || lowerMessage.includes('invalid format')) {
        return {
          type: 'upload',
          message: errorMessage,
          userMessage: 'Video format not supported. Please record in MP4 format.',
          retryable: false,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'medium',
          recoveryActions: ['Record new video', 'Convert to MP4', 'Check video format'],
        };
      }

      if (lowerMessage.includes('quota') || lowerMessage.includes('storage limit')) {
        return {
          type: 'upload',
          message: errorMessage,
          userMessage: 'Storage quota exceeded. Please free up space or contact support.',
          retryable: false,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'high',
          recoveryActions: ['Delete old videos', 'Contact support', 'Upgrade storage'],
        };
      }

      return {
        type: 'upload',
        message: errorMessage,
        userMessage: 'Upload failed. Please check your connection and try again.',
        retryable: true,
        retryDelay: 3000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'medium',
        recoveryActions: ['Check connection', 'Try again', 'Restart app'],
      };
    }

    // Playback-specific errors
    if (context?.operation === 'playback' || lowerMessage.includes('playback') || 
        lowerMessage.includes('video') || lowerMessage.includes('media')) {
      if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
        return {
          type: 'playback',
          message: errorMessage,
          userMessage: 'Video not found. It may have been deleted or moved.',
          retryable: false,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'medium',
          recoveryActions: ['Refresh list', 'Check video exists', 'Contact support'],
        };
      }

      if (lowerMessage.includes('codec') || lowerMessage.includes('format not supported')) {
        return {
          type: 'playback',
          message: errorMessage,
          userMessage: 'Video format not supported on this device.',
          retryable: false,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'medium',
          recoveryActions: ['Try different video', 'Update app', 'Contact support'],
        };
      }

      if (lowerMessage.includes('buffering') || lowerMessage.includes('loading')) {
        return {
          type: 'playback',
          message: errorMessage,
          userMessage: 'Video is taking too long to load. Check your connection.',
          retryable: true,
          retryDelay: 2000,
          originalError: error,
          context: context?.operation,
          timestamp,
          severity: 'low',
          recoveryActions: ['Check connection', 'Wait and retry', 'Lower video quality'],
        };
      }

      return {
        type: 'playback',
        message: errorMessage,
        userMessage: 'Video playback failed. Please try again.',
        retryable: true,
        retryDelay: 2000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'medium',
        recoveryActions: ['Try again', 'Restart video', 'Check connection'],
      };
    }

    // Merge-specific errors
    if (context?.operation === 'merge' || lowerMessage.includes('merge') || lowerMessage.includes('ffmpeg')) {
      return {
        type: 'merge',
        message: errorMessage,
        userMessage: 'Video merging failed. Please try uploading your videos again.',
        retryable: true,
        retryDelay: 5000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'high',
        recoveryActions: ['Try again', 'Re-record videos', 'Contact support'],
      };
    }

    // Storage errors
    if (lowerMessage.includes('storage') || lowerMessage.includes('disk') || lowerMessage.includes('space')) {
      return {
        type: 'storage',
        message: errorMessage,
        userMessage: 'Insufficient storage space. Please free up space and try again.',
        retryable: false,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'high',
        recoveryActions: ['Free up space', 'Delete old files', 'Clear app cache'],
      };
    }

    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('request timeout') ||
        lowerMessage.includes('backend not responding')) {
      return {
        type: 'timeout',
        message: errorMessage,
        userMessage: 'Request timed out. The server might be busy. Please try again.',
        retryable: true,
        retryDelay: 3000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'medium',
        recoveryActions: ['Try again', 'Check connection', 'Wait and retry'],
      };
    }

    // Authentication errors
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('authentication') || lowerMessage.includes('token')) {
      return {
        type: 'auth',
        message: errorMessage,
        userMessage: 'Authentication failed. Please log in again.',
        retryable: false,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'high',
        recoveryActions: ['Log in again', 'Check credentials', 'Contact support'],
      };
    }

    // Server errors
    if (lowerMessage.includes('500') || lowerMessage.includes('502') || 
        lowerMessage.includes('503') || lowerMessage.includes('server error') ||
        lowerMessage.includes('internal server')) {
      return {
        type: 'server',
        message: errorMessage,
        userMessage: 'Server error occurred. Please try again in a few moments.',
        retryable: true,
        retryDelay: 5000,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'high',
        recoveryActions: ['Try again later', 'Check server status', 'Contact support'],
      };
    }

    // Validation errors
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') ||
        lowerMessage.includes('bad request') || lowerMessage.includes('400')) {
      return {
        type: 'validation',
        message: errorMessage,
        userMessage: 'Invalid request. Please check your input and try again.',
        retryable: false,
        originalError: error,
        context: context?.operation,
        timestamp,
        severity: 'medium',
        recoveryActions: ['Check input', 'Try different values', 'Contact support'],
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: errorMessage,
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true,
      retryDelay: 2000,
      originalError: error,
      context: context?.operation,
      timestamp,
      severity: 'medium',
      recoveryActions: ['Try again', 'Restart app', 'Contact support'],
    };
  }

  public getRetryStrategy(errorType: ErrorDetails['type'], retryCount: number, context?: ErrorContext): {
    shouldRetry: boolean;
    delay: number;
    maxRetries: number;
  } {
    const strategies = {
      network: { maxRetries: 5, baseDelay: 2000 },
      timeout: { maxRetries: 3, baseDelay: 3000 },
      server: { maxRetries: 3, baseDelay: 5000 },
      auth: { maxRetries: 0, baseDelay: 0 },
      validation: { maxRetries: 0, baseDelay: 0 },
      upload: { maxRetries: 3, baseDelay: 2000 },
      playback: { maxRetries: 2, baseDelay: 1000 },
      merge: { maxRetries: 2, baseDelay: 5000 },
      storage: { maxRetries: 0, baseDelay: 0 },
      unknown: { maxRetries: 2, baseDelay: 2000 },
    };

    const strategy = strategies[errorType];
    
    // Adjust retry strategy based on context
    let maxRetries = strategy.maxRetries;
    let baseDelay = strategy.baseDelay;
    
    if (context?.operation === 'upload') {
      // More aggressive retries for uploads
      maxRetries = Math.max(maxRetries, 3);
      baseDelay = Math.max(baseDelay, 2000);
    } else if (context?.operation === 'playback') {
      // Faster retries for playback
      baseDelay = Math.min(baseDelay, 1500);
    }
    
    const shouldRetry = retryCount < maxRetries;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds

    return {
      shouldRetry,
      delay: Math.round(delay),
      maxRetries,
    };
  }

  public formatErrorForUser(errorDetails: ErrorDetails): string {
    let message = errorDetails.userMessage;

    // Add platform-specific guidance
    if (errorDetails.type === 'network') {
      if (Platform.OS === 'ios') {
        message += '\n\nTip: Check your Wi-Fi or cellular connection in Settings.';
      } else {
        message += '\n\nTip: Check your Wi-Fi or mobile data connection.';
      }
    }

    return message;
  }

  public logError(errorDetails: ErrorDetails, context?: string): void {
    const logData = {
      type: errorDetails.type,
      message: errorDetails.message,
      context: context || 'Unknown',
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      retryable: errorDetails.retryable,
    };

    console.error('🚨 ERROR:', JSON.stringify(logData, null, 2));

    // In production, you might want to send this to a logging service
    // like Sentry, Bugsnag, or Firebase Crashlytics
  }

  /**
   * Handle upload-specific errors with detailed context
   */
  public handleUploadError(
    error: any,
    uploadContext: {
      fileName?: string;
      fileSize?: number;
      uploadProgress?: number;
      sessionId?: string;
    }
  ): ErrorDetails {
    const context = this.createErrorContext('upload', 'UploadService', uploadContext);
    return this.categorizeError(error, context);
  }

  /**
   * Handle playback-specific errors with detailed context
   */
  public handlePlaybackError(
    error: any,
    playbackContext: {
      videoUrl?: string;
      currentTime?: number;
      duration?: number;
      videoId?: string;
    }
  ): ErrorDetails {
    const context = this.createErrorContext('playback', 'VideoPlayer', playbackContext);
    return this.categorizeError(error, context);
  }

  /**
   * Handle merge-specific errors with detailed context
   */
  public handleMergeError(
    error: any,
    mergeContext: {
      mergeSessionId?: string;
      videoCount?: number;
      totalDuration?: number;
    }
  ): ErrorDetails {
    const context = this.createErrorContext('merge', 'MergeService', mergeContext);
    return this.categorizeError(error, context);
  }

  /**
   * Create error context for operations
   */
  public createErrorContext(
    operation: ErrorContext['operation'],
    component?: string,
    additionalData?: Record<string, any>
  ): ErrorContext {
    return {
      operation,
      component,
      additionalData,
      // userId and sessionId would be populated by the calling service
    };
  }

  /**
   * Get user-friendly error title based on error type
   */
  public getErrorTitle(errorDetails: ErrorDetails): string {
    const titles = {
      network: 'Connection Problem',
      timeout: 'Request Timeout',
      server: 'Server Error',
      auth: 'Authentication Required',
      validation: 'Invalid Input',
      upload: 'Upload Failed',
      playback: 'Playback Error',
      merge: 'Video Processing Failed',
      storage: 'Storage Full',
      unknown: 'Unexpected Error',
    };

    return titles[errorDetails.type] || 'Error';
  }

  /**
   * Check if error should trigger immediate user notification
   */
  public shouldNotifyUser(errorDetails: ErrorDetails): boolean {
    // Critical errors always notify
    if (errorDetails.severity === 'critical') {
      return true;
    }

    // High severity errors notify unless they're retryable and this is an early retry
    if (errorDetails.severity === 'high') {
      return true;
    }

    // Medium severity errors notify for certain types
    if (errorDetails.severity === 'medium') {
      return ['auth', 'validation', 'upload', 'storage'].includes(errorDetails.type);
    }

    // Low severity errors don't notify immediately
    return false;
  }

  /**
   * Get recovery actions for an error
   */
  public getRecoveryActions(errorDetails: ErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    if (errorDetails.recoveryActions) {
      errorDetails.recoveryActions.forEach((actionLabel, index) => {
        actions.push({
          label: actionLabel,
          action: () => {
            console.log(`Recovery action triggered: ${actionLabel}`);
            // Specific recovery actions would be implemented by the calling component
          },
          primary: index === 0, // First action is primary
        });
      });
    }

    return actions;
  }
}

export const errorHandlingService = ErrorHandlingService.getInstance();