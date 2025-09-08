/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { errorHandlingService, ErrorDetails } from '../services/errorHandlingService';
import { errorRecoveryService } from '../services/errorRecoveryService';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorDetails: ErrorDetails | null;
  recoveryAttempted: boolean;
  recoverySuccess: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      recoveryAttempted: false,
      recoverySuccess: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ERROR_BOUNDARY: Caught error:', error);
    console.error('🚨 ERROR_BOUNDARY: Error info:', errorInfo);

    // Categorize the error using our error handling service
    const errorDetails = errorHandlingService.categorizeError(error, {
      operation: 'general',
      component: 'ErrorBoundary',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });

    // Log the error
    errorHandlingService.logError(errorDetails, 'ErrorBoundary');

    this.setState({
      error,
      errorInfo,
      errorDetails,
    });

    // Call the onError prop if provided
    this.props.onError?.(error, errorInfo);

    // Attempt automated recovery
    this.attemptRecovery(errorDetails);
  }

  private attemptRecovery = async (errorDetails: ErrorDetails) => {
    try {
      console.log('🔧 ERROR_BOUNDARY: Attempting automated recovery...');
      
      const recoveryResult = await errorRecoveryService.attemptAutomatedRecovery(errorDetails);
      
      if (recoveryResult.success) {
        console.log('✅ ERROR_BOUNDARY: Automated recovery succeeded');
        this.setState({
          recoveryAttempted: true,
          recoverySuccess: true,
        });
        
        // Optionally auto-retry after successful recovery
        setTimeout(() => {
          this.handleRetry();
        }, 2000);
      } else {
        console.log('❌ ERROR_BOUNDARY: Automated recovery failed');
        this.setState({
          recoveryAttempted: true,
          recoverySuccess: false,
        });
      }
    } catch (recoveryError) {
      console.error('🔧 ERROR_BOUNDARY: Recovery attempt failed:', recoveryError);
      this.setState({
        recoveryAttempted: true,
        recoverySuccess: false,
      });
    }
  };

  private handleRetry = () => {
    console.log('🔄 ERROR_BOUNDARY: Retrying after error...');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      recoveryAttempted: false,
      recoverySuccess: false,
    });
  };

  private handleReload = () => {
    console.log('🔄 ERROR_BOUNDARY: Reloading app...');
    // In a real app, this might trigger a full app reload
    this.handleRetry();
  };

  private getErrorSummary = (): string => {
    const { error, errorDetails } = this.state;
    
    if (errorDetails) {
      return errorDetails.userMessage;
    }
    
    if (error) {
      return error.message || 'An unexpected error occurred';
    }
    
    return 'Something went wrong';
  };

  private getRecoveryActions = () => {
    const { errorDetails, recoveryAttempted, recoverySuccess } = this.state;
    
    if (!errorDetails) return [];
    
    const actions = [];
    
    // Always show retry option
    actions.push(
      <TouchableOpacity
        key="retry"
        style={[styles.actionButton, styles.primaryButton]}
        onPress={this.handleRetry}
      >
        <Text style={styles.primaryButtonText}>Try Again</Text>
      </TouchableOpacity>
    );
    
    // Show reload option for critical errors
    if (errorDetails.severity === 'critical') {
      actions.push(
        <TouchableOpacity
          key="reload"
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={this.handleReload}
        >
          <Text style={styles.secondaryButtonText}>Reload App</Text>
        </TouchableOpacity>
      );
    }
    
    // Show recovery status
    if (recoveryAttempted) {
      const recoveryText = recoverySuccess 
        ? '✅ Automatic recovery succeeded'
        : '❌ Automatic recovery failed';
      
      actions.push(
        <View key="recovery-status" style={styles.recoveryStatus}>
          <Text style={styles.recoveryStatusText}>{recoveryText}</Text>
        </View>
      );
    }
    
    return actions;
  };

  render() {
    const { hasError, error, errorInfo, errorDetails } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback && error && errorInfo) {
        return fallback(error, errorInfo);
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Text style={styles.title}>🚨 Something Went Wrong</Text>
            
            <Text style={styles.summary}>
              {this.getErrorSummary()}
            </Text>
            
            {errorDetails && (
              <View style={styles.errorDetails}>
                <Text style={styles.detailsTitle}>Error Details:</Text>
                <Text style={styles.detailsText}>Type: {errorDetails.type}</Text>
                <Text style={styles.detailsText}>Severity: {errorDetails.severity}</Text>
                <Text style={styles.detailsText}>Retryable: {errorDetails.retryable ? 'Yes' : 'No'}</Text>
                {errorDetails.timestamp && (
                  <Text style={styles.detailsText}>
                    Time: {errorDetails.timestamp.toLocaleString()}
                  </Text>
                )}
              </View>
            )}
            
            {__DEV__ && error && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Information:</Text>
                <Text style={styles.debugText}>
                  {error.name}: {error.message}
                </Text>
                {error.stack && (
                  <Text style={styles.debugText}>
                    Stack: {error.stack.substring(0, 500)}...
                  </Text>
                )}
                {errorInfo?.componentStack && (
                  <Text style={styles.debugText}>
                    Component Stack: {errorInfo.componentStack.substring(0, 300)}...
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.actionsContainer}>
              {this.getRecoveryActions()}
            </View>
            
            {errorDetails && (
              <View style={styles.helpSection}>
                <Text style={styles.helpTitle}>Need Help?</Text>
                <Text style={styles.helpText}>
                  If this problem continues, try restarting the app or contact support.
                </Text>
                {errorDetails.recoveryActions && errorDetails.recoveryActions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                    {errorDetails.recoveryActions.map((action, index) => (
                      <Text key={index} style={styles.suggestionText}>
                        • {action}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  summary: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorDetails: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  debugInfo: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  recoveryStatus: {
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    marginBottom: 8,
  },
  recoveryStatusText: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
  },
  helpSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default ErrorBoundary;