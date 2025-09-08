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

  const handleError = useCallback((err: any, contextString?: string, errorContext?: any) => {
    console.log('🚨 ERROR_HOOK: ================== ERROR HANDLING TRIGGERED ==================');
    console.log('🚨 ERROR_HOOK: Context:', contextString);
    console.log('🚨 ERROR_HOOK: Error type:', typeof err);
    console.log('🚨 ERROR_HOOK: Error message:', err?.message || 'No message');
    
    // Create error context if provided
    let context;
    if (errorContext) {
      context = errorHandlingService.createErrorContext(
        errorContext.operation || 'general',
        errorContext.component,
        errorContext.additionalData
      );
    }
    
    const errorDetails = errorHandlingService.categorizeError(err, context);
    console.log('🚨 ERROR_HOOK: Error category:', errorDetails.type);
    console.log('🚨 ERROR_HOOK: Error retryable:', errorDetails.retryable);
    console.log('🚨 ERROR_HOOK: Error severity:', errorDetails.severity);
    
    errorHandlingService.logError(errorDetails, contextString);
    
    setError(errorDetails);
    setRetryCount(prev => prev + 1);
    
    // Show alert based on error severity and user preferences
    if (showAlert && errorHandlingService.shouldNotifyUser(errorDetails)) {
      const userMessage = errorHandlingService.formatErrorForUser(errorDetails);
      const errorTitle = errorHandlingService.getErrorTitle(errorDetails);
      const recoveryActions = errorHandlingService.getRecoveryActions(errorDetails);
      
      // Create alert buttons
      const buttons = [];
      
      if (errorDetails.retryable && retryFunction) {
        buttons.push({ text: 'Cancel', style: 'cancel' as const });
        buttons.push({ text: 'Retry', onPress: () => retry() });
      } else if (recoveryActions.length > 0) {
        buttons.push({ text: 'OK', style: 'cancel' as const });
        // Add primary recovery action if available
        const primaryAction = recoveryActions.find(action => action.primary);
        if (primaryAction) {
          buttons.push({ 
            text: primaryAction.label, 
            onPress: () => primaryAction.action() 
          });
        }
      } else {
        buttons.push({ text: 'OK' });
      }
      
      Alert.alert(errorTitle, userMessage, buttons);
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

  // Auto-retry logic with enhanced strategy
  useEffect(() => {
    if (error && error.retryable && autoRetry && retryCount <= maxRetries && retryFunction) {
      const context = error.context ? { operation: error.context as any } : undefined;
      const retryStrategy = errorHandlingService.getRetryStrategy(error.type, retryCount, context);
      
      if (retryStrategy.shouldRetry) {
        console.log(`🔄 AUTO_RETRY: Scheduling retry ${retryCount}/${retryStrategy.maxRetries} in ${retryStrategy.delay}ms`);
        
        const timeoutId = setTimeout(() => {
          retry();
        }, retryStrategy.delay);

        return () => clearTimeout(timeoutId);
      } else {
        console.log(`❌ AUTO_RETRY: Max retries reached for ${error.type} error`);
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