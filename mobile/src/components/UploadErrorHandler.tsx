/**
 * Upload Error Handler Component
 * Specialized error handling for upload operations with recovery actions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ErrorDetails, errorHandlingService } from '../services/errorHandlingService';
import { ErrorDisplay } from './ErrorDisplay';

export interface UploadErrorHandlerProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  uploadProgress?: number;
  fileName?: string;
  fileSize?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  onSelectNewFile?: () => void;
  style?: any;
}

export const UploadErrorHandler: React.FC<UploadErrorHandlerProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  uploadProgress = 0,
  fileName,
  fileSize,
  onRetry,
  onCancel,
  onSelectNewFile,
  style,
}) => {
  if (!error) return null;

  const getUploadSpecificActions = () => {
    const actions = [];

    // File size too large
    if (error.message.toLowerCase().includes('file too large') || 
        error.message.toLowerCase().includes('size limit')) {
      actions.push(
        <TouchableOpacity
          key="compress"
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={() => {
            Alert.alert(
              'Compress Video',
              'Try recording a shorter video or compress the current one.',
              [
                { text: 'Record New', onPress: onSelectNewFile },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <Text style={styles.primaryActionButtonText}>Compress Video</Text>
        </TouchableOpacity>
      );
    }

    // Unsupported format
    if (error.message.toLowerCase().includes('format') || 
        error.message.toLowerCase().includes('codec')) {
      actions.push(
        <TouchableOpacity
          key="rerecord"
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={onSelectNewFile}
        >
          <Text style={styles.primaryActionButtonText}>Record New Video</Text>
        </TouchableOpacity>
      );
    }

    // Network or server errors
    if (['network', 'timeout', 'server'].includes(error.type)) {
      actions.push(
        <TouchableOpacity
          key="retry"
          style={[styles.actionButton, styles.retryActionButton]}
          onPress={onRetry}
          disabled={isRetrying || !onRetry}
        >
          <Text style={styles.retryActionButtonText}>
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Text>
        </TouchableOpacity>
      );
    }

    // Storage errors
    if (error.type === 'storage') {
      actions.push(
        <TouchableOpacity
          key="storage"
          style={[styles.actionButton, styles.warningActionButton]}
          onPress={() => {
            Alert.alert(
              'Free Up Space',
              'Delete some files or apps to free up storage space, then try again.',
              [
                { text: 'OK' },
                { text: 'Try Again', onPress: onRetry },
              ]
            );
          }}
        >
          <Text style={styles.warningActionButtonText}>Free Up Space</Text>
        </TouchableOpacity>
      );
    }

    // Always add cancel option
    actions.push(
      <TouchableOpacity
        key="cancel"
        style={[styles.actionButton, styles.cancelActionButton]}
        onPress={onCancel}
      >
        <Text style={styles.cancelActionButtonText}>Cancel Upload</Text>
      </TouchableOpacity>
    );

    return actions;
  };

  const getProgressInfo = () => {
    if (uploadProgress > 0 && uploadProgress < 100) {
      return (
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Upload was {Math.round(uploadProgress)}% complete
          </Text>
          {fileName && (
            <Text style={styles.fileInfo}>
              File: {fileName} ({fileSize ? `${Math.round(fileSize / (1024 * 1024) * 100) / 100}MB` : 'Unknown size'})
            </Text>
          )}
        </View>
      );
    }
    return null;
  };

  const getSeverityIndicator = () => {
    if (error.severity === 'critical') {
      return <Text style={styles.criticalIndicator}>🚨 Critical Error</Text>;
    } else if (error.severity === 'high') {
      return <Text style={styles.highSeverityIndicator}>⚠️ High Priority</Text>;
    }
    return null;
  };

  return (
    <View style={[styles.container, style]}>
      {getSeverityIndicator()}
      
      <ErrorDisplay
        error={error}
        isRetrying={isRetrying}
        retryCount={retryCount}
        maxRetries={maxRetries}
        onRetry={onRetry}
        compact={false}
      />

      {getProgressInfo()}

      {error.type === 'upload' && (
        <View style={styles.uploadSpecificInfo}>
          <Text style={styles.uploadInfoTitle}>Upload Details:</Text>
          <Text style={styles.uploadInfoText}>
            • Error Type: {error.type}
          </Text>
          <Text style={styles.uploadInfoText}>
            • Retryable: {error.retryable ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.uploadInfoText}>
            • Retry Count: {retryCount}/{maxRetries}
          </Text>
          {error.timestamp && (
            <Text style={styles.uploadInfoText}>
              • Time: {error.timestamp.toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actionsContainer}>
        {getUploadSpecificActions()}
      </View>

      {isRetrying && (
        <View style={styles.retryingIndicator}>
          <ActivityIndicator size="small" color="#4a90e2" />
          <Text style={styles.retryingText}>
            Retrying upload... ({retryCount}/{maxRetries})
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  criticalIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 8,
  },
  highSeverityIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff9800',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 12,
    color: '#666',
  },
  uploadSpecificInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  uploadInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  uploadInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  actionsContainer: {
    marginTop: 16,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryActionButton: {
    backgroundColor: '#4a90e2',
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryActionButton: {
    backgroundColor: '#51cf66',
  },
  retryActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningActionButton: {
    backgroundColor: '#ff9800',
  },
  warningActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelActionButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelActionButtonText: {
    color: '#666',
    fontSize: 16,
  },
  retryingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  retryingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
});

export default UploadErrorHandler;