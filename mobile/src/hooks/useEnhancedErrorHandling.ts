/**
 * Enhanced Error Handling Hook
 * Comprehensive error handling with recovery, retry logic, and user feedback
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { enhancedErrorHandlingService, ErrorDetails, ErrorRecoveryAction } from '../services/enhancedErrorHandlingService';

export interface UseEnhancedErrorHandlingOptions {
  showAlert?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  provideFeedback?: boolean;
  trackMetrics?: boolean;
  onError?: (error: ErrorDetails) => void;
  onRetry?: (retryCount: number) => void;
  onRecovery?: (wasSuccessful: boolean) => void;
  onMaxRetriesReached?: (error: ErrorDetails) => void;
}

export interface UseEnhancedErrorHandlingReturn {
  error: ErrorDetails | null;
  isRetrying: boolean;
  retryCount: number;
  recoveryActions: ErrorRecoveryAction[];
  handleError: (error: any, context?: string, errorContext?: any) => Promise<void>;
  clearError: () => void;
  retry: () => Promise<void>;
  canRetry: boolean;
  executeRecoveryAction: (action: ErrorRecoveryAction) => Promise<void>;
  getErrorSummary: () => string;
}

export const useEnhancedErrorHandling = (
  retryFunction?: () => Promise<void>,
  options: UseEnhancedErrorHandlingOptions = {}
): UseEnhancedErrorHandlingReturn => {
  const {
    showAlert = false,
    autoRetry = false,
    maxRetries = 3,
    retryDelay = 2000,
    provideFeedback = true,
    trackMetrics = true,
    onError,
    onRetry,
    onRecovery,
    onMaxRetriesReached,
  } = options;

  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [recoveryActions, setRecoveryActions] = useState<ErrorRecoveryAction[]>([]);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handleError = useCallback(async (err: any, contextString?: string, errorContext?: any) => {
    if (isUnmountedRef.current) return;

    console.log('🚨 ENHANCED_ERROR_HOOK: Error handling triggered');
    console.log('🚨 ENHANCED_ERROR_HOOK: Context:', contextString);
    console.log('🚨 ENHANCED_ERROR_HOOK: Error:', err?.message || err);
    
    try {
      // Create error context if provided
      let context;
      if (errorContext) {
        context = {
          operation: errorContext.operation || 'general',
          component: errorContext.component,
          userId: errorContext.userId,
          sessionId: errorContext.sessionId,
          additionalData: errorContext.additionalData,
        };
      }
      
      const errorDetails = await enhancedErrorHandlingService.categorizeError(err, context);
      console.log('🚨 ENHANCED_ERROR_HOOK: Categorized as:', errorDetails.type);
      
      setError(errorDetails);
      setRetryCount(prev => prev + 1);
      
      // Get recovery actions
      const actions = enhancedErrorHandlingService.getRecoveryActions(errorDetails);
      setRecoveryActions(actions);
      
      // Provide haptic/visual feedback
      if (provideFeedback) {
        await enhancedErrorHandlingService.provideFeedback(errorDetails);
      }
      
      // Notify callback
      onError?.(errorDetails);
      
      // Show alert if needed
      if (showAlert && enhancedErrorHandlingService.shouldNotifyUser(errorDetails)) {
        showErrorAlert(errorDetails, actions);
      }
      
      // Auto-retry logic
      if (autoRetry && errorDetails.retryable && retryCount < maxRetries && retryFunction) {
        const delay = errorDetails.retryDelay || retryDelay;
        console.log(`🔄 ENHANCED_ERROR_HOOK: Auto-retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        retryTimeoutRef.current = setTimeout(async () => {
          if (!isUnmountedRef.current) {
            await retry();
          }
        }, delay);
      } else if (retryCount >= maxRetries) {
        console.log('🚫 ENHANCED_ERROR_HOOK: Max retries reached');
        onMaxRetriesReached?.(errorDetails);
      }
      
    } catch (categorizeError) {
      console.error('🚨 ENHANCED_ERROR_HOOK: Failed to categorize error:', categorizeError);
      // Fallback to basic error handling
      setError({
        type: 'unknown',
        message: err?.message || 'Unknown error',
        userMessage: 'An unexpected error occurred. Please try again.',
        retryable: !!retryFunction,
        severity: 'medium',
        timestamp: new Date(),
      });
    }
  }, [retryCount, maxRetries, autoRetry, retryDelay, provideFeedback, showAlert, onError, onMaxRetriesReached, retryFunction]);

  const clearError = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setError(null);
    setIsRetrying(false);
    setRetryCount(0);
    setRecoveryActions([]);
  }, []);

  const retry = useCallback(async () => {
    if (!retryFunction || isRetrying || isUnmountedRef.current) {
      return;
    }

    setIsRetrying(true);
    onRetry?.(retryCount);

    try {
      console.log(`🔄 ENHANCED_ERROR_HOOK: Executing retry attempt ${retryCount + 1}`);
      await retryFunction();
      
      // Success - clear error and track recovery
      if (error && trackMetrics) {
        await enhancedErrorHandlingService.trackRecoverySuccess(error.type);
      }
      
      clearError();
      onRecovery?.(true);
      
      console.log('✅ ENHANCED_ERROR_HOOK: Retry successful');
    } catch (retryError) {
      console.log('❌ ENHANCED_ERROR_HOOK: Retry failed:', retryError);
      
      // Update retry count and potentially try again
      setRetryCount(prev => prev + 1);
      
      // If we haven't exceeded max retries, handle the new error
      if (retryCount + 1 < maxRetries) {
        await handleError(retryError, 'retry', { operation: error?.operation });
      } else {
        onMaxRetriesReached?.(error!);
        onRecovery?.(false);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [retryFunction, isRetrying, retryCount, maxRetries, error, trackMetrics, onRetry, onRecovery, onMaxRetriesReached, handleError, clearError]);

  const executeRecoveryAction = useCallback(async (action: ErrorRecoveryAction) => {
    try {
      console.log('🔧 ENHANCED_ERROR_HOOK: Executing recovery action:', action.label);
      
      if (action.type === 'retry' && retryFunction) {
        await retry();
      } else {
        await action.action();
        
        // For non-retry actions, clear the error if successful
        if (action.type !== 'cancel') {
          clearError();
          
          if (error && trackMetrics) {
            await enhancedErrorHandlingService.trackRecoverySuccess(error.type);
          }
          
          onRecovery?.(true);
        }
      }
    } catch (actionError) {
      console.error('🚨 ENHANCED_ERROR_HOOK: Recovery action failed:', actionError);
      onRecovery?.(false);
      
      // Handle the error from the recovery action
      await handleError(actionError, 'recovery_action', { 
        operation: error?.operation,
        recoveryAction: action.label 
      });
    }
  }, [retry, retryFunction, clearError, error, trackMetrics, onRecovery, handleError]);

  const showErrorAlert = useCallback((errorDetails: ErrorDetails, actions: ErrorRecoveryAction[]) => {
    const userMessage = enhancedErrorHandlingService.formatErrorForUser(errorDetails);
    const errorTitle = enhancedErrorHandlingService.getErrorTitle(errorDetails);
    
    // Create alert buttons based on available actions
    const buttons: any[] = [];
    
    // Add cancel/dismiss button
    buttons.push({ 
      text: 'Dismiss', 
      style: 'cancel',
      onPress: () => {
        if (errorDetails.severity === 'critical') {
          clearError();
        }
      }
    });
    
    // Add primary recovery action
    const primaryAction = actions.find(action => action.primary);
    if (primaryAction) {
      buttons.push({
        text: primaryAction.label,
        style: primaryAction.destructive ? 'destructive' : 'default',
        onPress: () => executeRecoveryAction(primaryAction),
      });
    } else if (errorDetails.retryable && retryFunction) {
      buttons.push({
        text: 'Try Again',
        onPress: () => retry(),
      });
    }
    
    // Add settings action for permission errors
    if (errorDetails.type === 'permission') {
      buttons.push({
        text: 'Settings',
        onPress: () => {
          const settingsAction = actions.find(action => action.type === 'settings');
          if (settingsAction) {
            executeRecoveryAction(settingsAction);
          }
        },
      });
    }
    
    Alert.alert(errorTitle, userMessage, buttons);
  }, [executeRecoveryAction, retryFunction, retry, clearError]);

  const getErrorSummary = useCallback((): string => {
    if (!error) return '';
    
    const parts = [
      `Type: ${error.type}`,
      `Severity: ${error.severity}`,
      `Retryable: ${error.retryable ? 'Yes' : 'No'}`,
    ];
    
    if (retryCount > 0) {
      parts.push(`Attempts: ${retryCount}/${maxRetries}`);
    }
    
    if (error.timestamp) {
      parts.push(`Time: ${error.timestamp.toLocaleTimeString()}`);
    }
    
    return parts.join(' • ');
  }, [error, retryCount, maxRetries]);

  const canRetry = Boolean(error?.retryable && retryCount < maxRetries && !!retryFunction && !isRetrying);

  return {
    error,
    isRetrying,
    retryCount,
    recoveryActions,
    handleError,
    clearError,
    retry,
    canRetry,
    executeRecoveryAction,
    getErrorSummary,
  };
};
