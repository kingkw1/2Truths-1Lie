/**
 * Error Handling Hook
 * Provides reusable error handling logic for React components
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { errorHandlingService, ErrorDetails } from '../services/errorHandlingService';

export interface UseErrorHandlingOptions {
  showAlert?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  onError?: (error: ErrorDetails) => void;
  onRetry?: (retryCount: number) => void;
  onMaxRetriesReached?: (error: ErrorDetails) => void;
}

export interface UseErrorHandlingReturn {
  error: ErrorDetails | null;
  isRetrying: boolean;
  retryCount: number;
  handleError: (error: any, context?: string) => void;
  clearError: () => void;
  retry: () => Promise<void>;
  canRetry: boolean;
}

export const useErrorHandling = (
  retryFunction?: () => Promise<void>,
  options: UseErrorHandlingOptions = {}
): UseErrorHandlingReturn => {
  const {
    showAlert = false,
    autoRetry = false,
    maxRetries = 3,
    onError,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((err: any, context?: string) => {
    console.log('🚨 ERROR_HOOK: ================== ERROR HANDLING TRIGGERED ==================');
    console.log('🚨 ERROR_HOOK: Context:', context);
    console.log('🚨 ERROR_HOOK: Error type:', typeof err);
    console.log('🚨 ERROR_HOOK: Error message:', err?.message || 'No message');
    
    const errorDetails = errorHandlingService.categorizeError(err);
    console.log('🚨 ERROR_HOOK: Error category:', errorDetails.type);
    console.log('🚨 ERROR_HOOK: Error retryable:', errorDetails.retryable);
    
    errorHandlingService.logError(errorDetails, context);
    
    setError(errorDetails);
    setRetryCount(prev => prev + 1);
    
    if (showAlert) {
      const userMessage = errorHandlingService.formatErrorForUser(errorDetails);
      Alert.alert(
        'Error',
        userMessage,
        errorDetails.retryable && retryFunction ? [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => retry() }
        ] : [{ text: 'OK' }]
      );
    }
    
    onError?.(errorDetails);
  }, [showAlert, onError, retryFunction]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  const retry = useCallback(async () => {
    if (!retryFunction || !error?.retryable) return;
    
    try {
      setIsRetrying(true);
      onRetry?.(retryCount);
      await retryFunction();
      clearError();
    } catch (err) {
      handleError(err, 'retry');
    } finally {
      setIsRetrying(false);
    }
  }, [retryFunction, error, retryCount, onRetry, handleError, clearError]);

  // Auto-retry logic
  useEffect(() => {
    if (error && error.retryable && autoRetry && retryCount <= maxRetries && retryFunction) {
      const retryStrategy = errorHandlingService.getRetryStrategy(error.type, retryCount);
      
      if (retryStrategy.shouldRetry) {
        const timeoutId = setTimeout(() => {
          retry();
        }, retryStrategy.delay);

        return () => clearTimeout(timeoutId);
      } else {
        onMaxRetriesReached?.(error);
      }
    }
  }, [error, autoRetry, retryCount, maxRetries, retry, retryFunction, onMaxRetriesReached]);

  const canRetry = Boolean(error?.retryable && retryFunction && !isRetrying);

  return {
    error,
    isRetrying,
    retryCount,
    handleError,
    clearError,
    retry,
    canRetry,
  };
};