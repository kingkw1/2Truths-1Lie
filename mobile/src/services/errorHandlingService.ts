/**
 * Error Handling Service
 * Provides utilities for handling and categorizing errors in the mobile app
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface ErrorDetails {
  type: 'network' | 'server' | 'auth' | 'timeout' | 'validation' | 'unknown';
  message: string;
  userMessage: string;
  retryable: boolean;
  retryDelay?: number;
  originalError?: any;
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

  public categorizeError(error: any): ErrorDetails {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const lowerMessage = errorMessage.toLowerCase();

    // Network errors
    if (!this.isOnline || lowerMessage.includes('network request failed') || 
        lowerMessage.includes('no internet') || lowerMessage.includes('connection failed')) {
      return {
        type: 'network',
        message: errorMessage,
        userMessage: 'No internet connection. Please check your network and try again.',
        retryable: true,
        retryDelay: 2000,
        originalError: error,
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
    };
  }

  public getRetryStrategy(errorType: ErrorDetails['type'], retryCount: number): {
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
      unknown: { maxRetries: 2, baseDelay: 2000 },
    };

    const strategy = strategies[errorType];
    const shouldRetry = retryCount < strategy.maxRetries;
    
    // Exponential backoff with jitter
    const exponentialDelay = strategy.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds

    return {
      shouldRetry,
      delay: Math.round(delay),
      maxRetries: strategy.maxRetries,
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
}

export const errorHandlingService = ErrorHandlingService.getInstance();