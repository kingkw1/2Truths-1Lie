/**
 * Enhanced Error Display Component
 * Comprehensive error display with recovery actions and user guidance
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { ErrorDetails, ErrorRecoveryAction } from '../services/enhancedErrorHandlingService';

export interface EnhancedErrorDisplayProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  recoveryActions?: ErrorRecoveryAction[];
  onRetry?: () => void;
  onExecuteAction?: (action: ErrorRecoveryAction) => void;
  onDismiss?: () => void;
  compact?: boolean;
  showDetails?: boolean;
  style?: any;
}

export const EnhancedErrorDisplay: React.FC<EnhancedErrorDisplayProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  recoveryActions = [],
  onRetry,
  onExecuteAction,
  onDismiss,
  compact = false,
  showDetails = false,
  style,
}) => {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '📡';
      case 'storage':
        return '💾';
      case 'recording':
        return '🎥';
      case 'upload':
        return '⬆️';
      case 'playback':
        return '▶️';
      case 'permission':
        return '🔒';
      case 'hardware':
        return '📱';
      default:
        return '⚠️';
    }
  };

  const getErrorColor = () => {
    switch (error.severity) {
      case 'critical':
        return '#dc3545';
      case 'high':
        return '#fd7e14';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  };

  const getSeverityLabel = () => {
    switch (error.severity) {
      case 'critical':
        return 'Critical Error';
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Error';
      case 'low':
        return 'Minor Issue';
      default:
        return 'Error';
    }
  };

  const getContextualHelp = () => {
    const tips = [];
    
    switch (error.type) {
      case 'network':
        tips.push('• Check your Wi-Fi or cellular connection');
        tips.push('• Try switching between Wi-Fi and cellular data');
        tips.push('• Move to an area with better signal strength');
        break;
        
      case 'storage':
        tips.push('• Delete old photos and videos');
        tips.push('• Clear app cache in device settings');
        tips.push('• Consider using cloud storage');
        break;
        
      case 'recording':
        tips.push('• Make sure the app has camera permission');
        tips.push('• Close other camera apps');
        tips.push('• Keep the app in the foreground while recording');
        break;
        
      case 'upload':
        tips.push('• Check your internet connection');
        tips.push('• Try recording a shorter video');
        tips.push('• Ensure you have enough storage space');
        break;
        
      case 'playback':
        tips.push('• Check your internet connection for streaming');
        tips.push('• Try reloading the video');
        tips.push('• Ensure the video format is supported');
        break;
        
      case 'permission':
        tips.push('• Go to device Settings > Apps > 2Truths-1Lie');
        tips.push('• Enable Camera and Microphone permissions');
        tips.push('• Restart the app after granting permissions');
        break;
        
      case 'hardware':
        tips.push('• Restart your device');
        tips.push('• Close other apps using the camera');
        tips.push('• Check if your device camera is working in other apps');
        break;
    }
    
    return tips;
  };

  const renderCompactView = () => (
    <View style={[styles.compactContainer, { borderLeftColor: getErrorColor() }, style]}>
      <View style={styles.compactHeader}>
        <Text style={styles.errorIcon}>{getErrorIcon()}</Text>
        <Text style={[styles.compactMessage, { color: getErrorColor() }]}>
          {error.userMessage}
        </Text>
      </View>
      
      <View style={styles.compactActions}>
        {error.retryable && onRetry && (
          <TouchableOpacity
            style={[styles.compactButton, styles.retryButton]}
            onPress={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.retryButtonText}>Try Again</Text>
            )}
          </TouchableOpacity>
        )}
        
        {onDismiss && (
          <TouchableOpacity
            style={[styles.compactButton, styles.dismissButton]}
            onPress={onDismiss}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderFullView = () => (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      {/* Error Header */}
      <View style={styles.header}>
        <Text style={styles.errorIcon}>{getErrorIcon()}</Text>
        <View style={styles.headerText}>
          <Text style={styles.errorTitle}>{getSeverityLabel()}</Text>
          <Text style={[styles.errorType, { color: getErrorColor() }]}>
            {error.type.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Error Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.userMessage}>{error.userMessage}</Text>
      </View>

      {/* Progress/Status */}
      {isRetrying && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={getErrorColor()} />
          <Text style={styles.statusText}>
            Retrying... (Attempt {retryCount}/{maxRetries})
          </Text>
        </View>
      )}

      {/* Contextual Help */}
      {getContextualHelp().length > 0 && (
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>💡 How to fix this:</Text>
          {getContextualHelp().map((tip, index) => (
            <Text key={index} style={styles.helpTip}>
              {tip}
            </Text>
          ))}
        </View>
      )}

      {/* Recovery Actions */}
      {recoveryActions.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Actions:</Text>
          <View style={styles.actionButtons}>
            {recoveryActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  action.primary && styles.primaryActionButton,
                  action.destructive && styles.destructiveActionButton,
                ]}
                onPress={() => onExecuteAction?.(action)}
                disabled={isRetrying}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    action.primary && styles.primaryActionButtonText,
                    action.destructive && styles.destructiveActionButtonText,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Manual Retry Button */}
      {error.retryable && onRetry && !recoveryActions.some(a => a.type === 'retry') && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: getErrorColor() }]}
          onPress={onRetry}
          disabled={isRetrying || retryCount >= maxRetries}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.retryButtonText}>
              {retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Error Details (if requested) */}
      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Technical Details:</Text>
          <Text style={styles.detailsText}>Error Type: {error.type}</Text>
          <Text style={styles.detailsText}>Severity: {error.severity}</Text>
          <Text style={styles.detailsText}>Retryable: {error.retryable ? 'Yes' : 'No'}</Text>
          <Text style={styles.detailsText}>Component: {error.component || 'Unknown'}</Text>
          <Text style={styles.detailsText}>Operation: {error.operation || 'Unknown'}</Text>
          {error.timestamp && (
            <Text style={styles.detailsText}>
              Time: {error.timestamp.toLocaleString()}
            </Text>
          )}
          {error.errorCode && (
            <Text style={styles.detailsText}>Code: {error.errorCode}</Text>
          )}
          <Text style={styles.detailsText}>
            Original: {error.message.length > 100 ? error.message.substring(0, 100) + '...' : error.message}
          </Text>
        </View>
      )}

      {/* Dismiss Button */}
      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  return compact ? renderCompactView() : renderFullView();
};

const styles = StyleSheet.create({
  // Compact View Styles
  compactContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  compactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },

  // Full View Styles
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  errorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  errorType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  helpContainer: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 8,
  },
  helpTip: {
    fontSize: 13,
    color: '#004499',
    lineHeight: 18,
    marginBottom: 4,
  },
  actionsContainer: {
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  destructiveActionButton: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  primaryActionButtonText: {
    color: '#fff',
  },
  destructiveActionButtonText: {
    color: '#fff',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dismissButton: {
    backgroundColor: '#6c757d',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
