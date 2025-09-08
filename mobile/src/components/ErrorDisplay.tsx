/**
 * ErrorDisplay Component
 * Reusable component for displaying errors with consistent styling and behavior
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ErrorDetails } from '../services/errorHandlingService';

export interface ErrorDisplayProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  lastSuccessfulUpdate?: Date;
  onRetry?: () => void;
  style?: any;
  compact?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  lastSuccessfulUpdate,
  onRetry,
  style,
  compact = false,
}) => {
  if (!error) return null;

  const getErrorIcon = (type: ErrorDetails['type']): string => {
    switch (type) {
      case 'network': return '📡';
      case 'timeout': return '⏱️';
      case 'server': return '🔧';
      case 'auth': return '🔐';
      case 'validation': return '⚠️';
      case 'upload': return '📤';
      case 'playback': return '🎥';
      case 'merge': return '🔄';
      case 'storage': return '💾';
      default: return '❌';
    }
  };

  const getErrorTitle = (type: ErrorDetails['type']): string => {
    switch (type) {
      case 'network': return 'Connection Problem';
      case 'timeout': return 'Request Timeout';
      case 'server': return 'Server Error';
      case 'auth': return 'Authentication Required';
      case 'validation': return 'Invalid Request';
      case 'upload': return 'Upload Failed';
      case 'playback': return 'Playback Error';
      case 'merge': return 'Video Processing Failed';
      case 'storage': return 'Storage Full';
      default: return 'Something Went Wrong';
    }
  };

  const containerStyle = [
    styles.errorContainer,
    error.type === 'network' && styles.networkErrorContainer,
    error.type === 'auth' && styles.authErrorContainer,
    error.type === 'validation' && styles.validationErrorContainer,
    error.type === 'upload' && styles.uploadErrorContainer,
    error.type === 'playback' && styles.playbackErrorContainer,
    error.type === 'merge' && styles.mergeErrorContainer,
    error.type === 'storage' && styles.storageErrorContainer,
    error.severity === 'critical' && styles.criticalErrorContainer,
    error.severity === 'high' && styles.highSeverityContainer,
    compact && styles.compactContainer,
    style,
  ];

  return (
    <View style={containerStyle}>
      {!compact && (
        <Text style={styles.errorIcon}>
          {getErrorIcon(error.type)}
        </Text>
      )}
      
      <Text style={[styles.errorTitle, compact && styles.compactTitle]}>
        {compact ? getErrorIcon(error.type) + ' ' : ''}{getErrorTitle(error.type)}
      </Text>
      
      <Text style={[styles.errorText, compact && styles.compactText]}>
        {error.userMessage}
      </Text>
      
      {isRetrying && (
        <View style={styles.autoRetryContainer}>
          <ActivityIndicator size="small" color="#4a90e2" />
          <Text style={styles.autoRetryText}>
            Retrying... ({retryCount}/{maxRetries})
          </Text>
        </View>
      )}
      
      {error.retryable && !isRetrying && onRetry && (
        <TouchableOpacity 
          style={[styles.retryButton, compact && styles.compactRetryButton]} 
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}

      {lastSuccessfulUpdate && !compact && (
        <Text style={styles.lastUpdateText}>
          Last updated: {lastSuccessfulUpdate.toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  compactContainer: {
    padding: 12,
    marginVertical: 5,
  },
  networkErrorContainer: {
    backgroundColor: '#e3f2fd',
    borderColor: '#bbdefb',
  },
  authErrorContainer: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffcc02',
  },
  validationErrorContainer: {
    backgroundColor: '#f3e5f5',
    borderColor: '#ce93d8',
  },
  uploadErrorContainer: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  playbackErrorContainer: {
    backgroundColor: '#e8f5e8',
    borderColor: '#81c784',
  },
  mergeErrorContainer: {
    backgroundColor: '#e1f5fe',
    borderColor: '#4fc3f7',
  },
  storageErrorContainer: {
    backgroundColor: '#fce4ec',
    borderColor: '#f48fb1',
  },
  criticalErrorContainer: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 2,
  },
  highSeverityContainer: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    borderWidth: 2,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  compactText: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  autoRetryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  autoRetryText: {
    fontSize: 12,
    color: '#4a90e2',
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  compactRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  lastUpdateText: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});