/**
 * Playback Error Handler Component
 * Specialized error handling for video playback operations
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
import { ErrorDetails } from '../services/errorHandlingService';
import { ErrorDisplay } from './ErrorDisplay';

export interface PlaybackErrorHandlerProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  videoUrl?: string;
  videoId?: string;
  currentTime?: number;
  duration?: number;
  onRetry?: () => void;
  onReload?: () => void;
  onSkip?: () => void;
  onReportIssue?: () => void;
  style?: any;
}

export const PlaybackErrorHandler: React.FC<PlaybackErrorHandlerProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  videoUrl,
  videoId,
  currentTime = 0,
  duration = 0,
  onRetry,
  onReload,
  onSkip,
  onReportIssue,
  style,
}) => {
  if (!error) return null;

  const getPlaybackSpecificActions = () => {
    const actions = [];

    // Video not found
    if (error.message.toLowerCase().includes('not found') || 
        error.message.toLowerCase().includes('404')) {
      actions.push(
        <TouchableOpacity
          key="reload"
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={onReload}
        >
          <Text style={styles.primaryActionButtonText}>Reload Video List</Text>
        </TouchableOpacity>
      );
    }

    // Format/codec issues
    if (error.message.toLowerCase().includes('codec') || 
        error.message.toLowerCase().includes('format')) {
      actions.push(
        <TouchableOpacity
          key="skip"
          style={[styles.actionButton, styles.warningActionButton]}
          onPress={onSkip}
        >
          <Text style={styles.warningActionButtonText}>Skip This Video</Text>
        </TouchableOpacity>
      );
    }

    // Network/loading issues
    if (['network', 'timeout'].includes(error.type) || 
        error.message.toLowerCase().includes('loading') ||
        error.message.toLowerCase().includes('buffering')) {
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

      actions.push(
        <TouchableOpacity
          key="reload"
          style={[styles.actionButton, styles.secondaryActionButton]}
          onPress={onReload}
        >
          <Text style={styles.secondaryActionButtonText}>Reload Video</Text>
        </TouchableOpacity>
      );
    }

    // General playback errors
    if (error.type === 'playback') {
      actions.push(
        <TouchableOpacity
          key="report"
          style={[styles.actionButton, styles.infoActionButton]}
          onPress={() => {
            Alert.alert(
              'Report Issue',
              'Would you like to report this playback issue to help us improve the app?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', onPress: onReportIssue },
              ]
            );
          }}
        >
          <Text style={styles.infoActionButtonText}>Report Issue</Text>
        </TouchableOpacity>
      );
    }

    return actions;
  };

  const getPlaybackInfo = () => {
    return (
      <View style={styles.playbackInfo}>
        <Text style={styles.playbackInfoTitle}>Playback Details:</Text>
        {videoId && (
          <Text style={styles.playbackInfoText}>• Video ID: {videoId}</Text>
        )}
        {duration > 0 && (
          <Text style={styles.playbackInfoText}>
            • Progress: {Math.round(currentTime)}s / {Math.round(duration)}s
          </Text>
        )}
        <Text style={styles.playbackInfoText}>
          • Error Type: {error.type}
        </Text>
        <Text style={styles.playbackInfoText}>
          • Retry Count: {retryCount}/{maxRetries}
        </Text>
        {error.timestamp && (
          <Text style={styles.playbackInfoText}>
            • Time: {error.timestamp.toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  };

  const getNetworkStatus = () => {
    if (error.type === 'network') {
      return (
        <View style={styles.networkStatus}>
          <Text style={styles.networkStatusTitle}>🌐 Network Status</Text>
          <Text style={styles.networkStatusText}>
            Check your internet connection and try again. Video streaming requires a stable connection.
          </Text>
        </View>
      );
    }
    return null;
  };

  const getVideoQualityTip = () => {
    if (['network', 'timeout'].includes(error.type)) {
      return (
        <View style={styles.qualityTip}>
          <Text style={styles.qualityTipTitle}>💡 Tip</Text>
          <Text style={styles.qualityTipText}>
            If you're on a slow connection, try switching to a lower video quality or wait for a better connection.
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, style]}>
      <ErrorDisplay
        error={error}
        isRetrying={isRetrying}
        retryCount={retryCount}
        maxRetries={maxRetries}
        onRetry={onRetry}
        compact={false}
      />

      {getPlaybackInfo()}
      {getNetworkStatus()}
      {getVideoQualityTip()}

      <View style={styles.actionsContainer}>
        {getPlaybackSpecificActions()}
      </View>

      {isRetrying && (
        <View style={styles.retryingIndicator}>
          <ActivityIndicator size="small" color="#4a90e2" />
          <Text style={styles.retryingText}>
            Retrying playback... ({retryCount}/{maxRetries})
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
  playbackInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  playbackInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  playbackInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  networkStatus: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  networkStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  networkStatusText: {
    fontSize: 12,
    color: '#1976d2',
    lineHeight: 16,
  },
  qualityTip: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  qualityTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f57c00',
    marginBottom: 4,
  },
  qualityTipText: {
    fontSize: 12,
    color: '#f57c00',
    lineHeight: 16,
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
  secondaryActionButton: {
    backgroundColor: '#6c757d',
  },
  secondaryActionButtonText: {
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
  infoActionButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoActionButtonText: {
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

export default PlaybackErrorHandler;