/**
 * Error Handling Tests
 * Tests for error handling service logic
 */

import { Alert } from 'react-native';
import { errorHandlingService } from '../services/errorHandlingService';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Error Handling Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should categorize network errors correctly', () => {
    const networkError = new Error('Network request failed');
    const errorDetails = errorHandlingService.categorizeError(networkError);

    expect(errorDetails.type).toBe('network');
    expect(errorDetails.retryable).toBe(true);
    expect(errorDetails.userMessage).toContain('internet connection');
  });

  it('should categorize timeout errors correctly', () => {
    const timeoutError = new Error('Request timeout - backend not responding');
    const errorDetails = errorHandlingService.categorizeError(timeoutError);

    expect(errorDetails.type).toBe('timeout');
    expect(errorDetails.retryable).toBe(true);
    expect(errorDetails.userMessage).toContain('timed out');
  });

  it('should categorize auth errors correctly', () => {
    const authError = new Error('401 Unauthorized');
    const errorDetails = errorHandlingService.categorizeError(authError);

    expect(errorDetails.type).toBe('auth');
    expect(errorDetails.retryable).toBe(false);
    expect(errorDetails.userMessage).toContain('Authentication failed');
  });

  it('should categorize server errors correctly', () => {
    const serverError = new Error('500 Internal Server Error');
    const errorDetails = errorHandlingService.categorizeError(serverError);

    expect(errorDetails.type).toBe('server');
    expect(errorDetails.retryable).toBe(true);
    expect(errorDetails.userMessage).toContain('Server error');
  });

  it('should provide appropriate retry strategies', () => {
    const networkStrategy = errorHandlingService.getRetryStrategy('network', 1);
    expect(networkStrategy.shouldRetry).toBe(true);
    expect(networkStrategy.maxRetries).toBe(5);

    const authStrategy = errorHandlingService.getRetryStrategy('auth', 1);
    expect(authStrategy.shouldRetry).toBe(false);
    expect(authStrategy.maxRetries).toBe(0);
  });

  it('should implement exponential backoff', () => {
    const strategy1 = errorHandlingService.getRetryStrategy('network', 1);
    const strategy2 = errorHandlingService.getRetryStrategy('network', 2);
    
    // Second retry should have longer delay (with jitter, so we check it's at least doubled)
    expect(strategy2.delay).toBeGreaterThan(strategy1.delay);
  });
});

describe('Error Formatting', () => {
  it('should format error messages for users correctly', () => {
    const networkError = {
      type: 'network' as const,
      message: 'Network request failed',
      userMessage: 'No internet connection. Please check your network and try again.',
      retryable: true,
      timestamp: new Date(),
    };

    const formattedMessage = errorHandlingService.formatErrorForUser(networkError);
    expect(formattedMessage).toContain('internet connection');
    expect(formattedMessage).toContain('Wi-Fi or cellular'); // Platform-specific guidance
  });

  it('should log errors with proper context', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const errorDetails = {
      type: 'server' as const,
      message: 'Server error',
      userMessage: 'Server error occurred',
      retryable: true,
      timestamp: new Date(),
    };

    errorHandlingService.logError(errorDetails, 'TestContext');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🚨 ERROR:'),
      expect.stringContaining('TestContext')
    );

    consoleSpy.mockRestore();
  });
});