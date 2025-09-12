/**
 * Enhanced Playback Error Handler Component
 * Specialized error handling for video playback with adaptive quality and fallback options
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ErrorDetails } from '../services/enhancedErrorHandlingService';
import { EnhancedErrorDisplay } from './EnhancedErrorDisplay';

export interface EnhancedPlaybackErrorHandlerProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  videoUrl?: string;
  videoId?: string;
  currentTime?: number;
  duration?: number;
  bufferingPercentage?: number;
  videoQuality?: 'auto' | 'high' | 'medium' | 'low';
  availableQualities?: Array<{ label: string; value: string }>;
  onRetry?: () => void;
  onReload?: () => void;
  onSkip?: () => void;
  onChangeQuality?: (quality: string) => void;
  onDownloadForOffline?: () => void;
  onReportIssue?: () => void;
  onSeekTo?: (time: number) => void;
  style?: any;
}

export const EnhancedPlaybackErrorHandler: React.FC<EnhancedPlaybackErrorHandlerProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  videoUrl,
  videoId,
  currentTime = 0,
  duration = 0,
  bufferingPercentage,
  videoQuality = 'auto',
  availableQualities = [],
  onRetry,
  onReload,
  onSkip,
  onChangeQuality,
  onDownloadForOffline,
  onReportIssue,
  onSeekTo,
  style,
}) => {
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkInfo(state);
    });

    NetInfo.fetch().then(setNetworkInfo);
    return unsubscribe;
  }, []);

  if (!error) return null;

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const testVideoConnection = async () => {
    if (!videoUrl) return;

    setIsTestingConnection(true);
    try {
      const startTime = Date.now();
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        cache: 'no-cache',
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let status = 'Good';
      if (responseTime > 5000) {
        status = 'Poor';
      } else if (responseTime > 2000) {
        status = 'Fair';
      }

      Alert.alert(
        'Video Connection Test',
        `Status: ${response.status}\nResponse Time: ${responseTime}ms\nConnection: ${status}`,
        [{ text: 'OK' }]
      );
    } catch (testError) {
      Alert.alert(
        'Connection Test Failed',
        'Unable to reach video server. Check your internet connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

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

    // Format/codec issues
    else if (error.message.toLowerCase().includes('codec') || 
             error.message.toLowerCase().includes('format')) {
      actions.push(
        <TouchableOpacity
          key="skip"
          style={[styles.actionButton, styles.warningActionButton]}
          onPress={onSkip}
        >
          <Text style={styles.warningActionButtonText}>Skip Video</Text>
        </TouchableOpacity>
      );

      actions.push(
        <TouchableOpacity
          key="report"
          style={[styles.actionButton, styles.infoActionButton]}
          onPress={onReportIssue}
        >
          <Text style={styles.infoActionButtonText}>Report Issue</Text>
        </TouchableOpacity>
      );
    }

    // Network/buffering issues
    else if (['network', 'timeout'].includes(error.type) || 
             error.message.toLowerCase().includes('loading') ||
             error.message.toLowerCase().includes('buffering')) {
      
      // Quality selector
      if (availableQualities.length > 0) {
        actions.push(
          <TouchableOpacity
            key="quality"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => setShowQualitySelector(true)}
          >
            <Text style={styles.primaryActionButtonText}>Change Quality</Text>
          </TouchableOpacity>
        );
      }

      // Suggest lower quality for poor connection
      if (videoQuality !== 'low' && networkInfo?.type === 'cellular') {
        actions.push(
          <TouchableOpacity
            key="lower"
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={() => onChangeQuality?.('low')}
          >
            <Text style={styles.secondaryActionButtonText}>Use Low Quality</Text>
          </TouchableOpacity>
        );
      }

      // Connection test
      actions.push(
        <TouchableOpacity
          key="test"
          style={[styles.actionButton, styles.infoActionButton]}
          onPress={testVideoConnection}
          disabled={isTestingConnection}
        >
          {isTestingConnection ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.infoActionButtonText}>Test Connection</Text>
          )}
        </TouchableOpacity>
      );

      // Offline download option
      if (onDownloadForOffline) {
        actions.push(
          <TouchableOpacity
            key="download"
            style={[styles.actionButton, styles.warningActionButton]}
            onPress={() => {
              Alert.alert(
                'Download for Offline',
                'Download this video to watch later without internet connection?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Download', onPress: onDownloadForOffline },
                ]
              );
            }}
          >
            <Text style={styles.warningActionButtonText}>Download</Text>
          </TouchableOpacity>
        );
      }

      // Retry
      actions.push(
        <TouchableOpacity
          key="retry"
          style={[styles.actionButton, styles.retryActionButton]}
          onPress={onRetry}
          disabled={isRetrying || retryCount >= maxRetries}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.retryActionButtonText}>
              {retryCount >= maxRetries ? 'Max Retries' : 'Try Again'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    // General playback errors
    else {
      actions.push(
        <TouchableOpacity
          key="retry"
          style={[styles.actionButton, styles.retryActionButton]}
          onPress={onRetry}
          disabled={isRetrying || retryCount >= maxRetries}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.retryActionButtonText}>
              {retryCount >= maxRetries ? 'Max Retries' : 'Try Again'}
            </Text>
          )}
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

    return actions;
  };

  const getPlaybackInfo = () => {
    return (
      <View style={styles.playbackInfo}>
        <Text style={styles.playbackInfoTitle}>📺 Video Information:</Text>
        
        {videoId && (
          <Text style={styles.playbackInfoText}>• Video ID: {videoId}</Text>
        )}
        
        {duration > 0 && (
          <Text style={styles.playbackInfoText}>
            • Progress: {formatTime(currentTime)} / {formatTime(duration)} 
            ({Math.round((currentTime / duration) * 100)}%)
          </Text>
        )}
        
        <Text style={styles.playbackInfoText}>
          • Quality: {videoQuality}
        </Text>
        
        {bufferingPercentage !== undefined && (
          <Text style={styles.playbackInfoText}>
            • Buffered: {Math.round(bufferingPercentage)}%
          </Text>
        )}
        
        <Text style={styles.playbackInfoText}>
          • Retry Count: {retryCount}/{maxRetries}
        </Text>
        
        {error.timestamp && (
          <Text style={styles.playbackInfoText}>
            • Error Time: {error.timestamp.toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  };

  const getNetworkStatus = () => {
    if (!networkInfo) return null;

    const getConnectionQuality = () => {
      if (!networkInfo.isConnected) return 'No Connection';
      if (!networkInfo.isInternetReachable) return 'No Internet';
      
      if (networkInfo.type === 'wifi') {
        return 'Wi-Fi Connected';
      } else if (networkInfo.type === 'cellular') {
        const generation = networkInfo.details?.cellularGeneration;
        return generation ? `${generation} Cellular` : 'Cellular Connected';
      }
      
      return 'Connected';
    };

    return (
      <View style={styles.networkStatus}>
        <Text style={styles.networkStatusTitle}>🌐 Network Status:</Text>
        <Text style={styles.networkStatusText}>
          {getConnectionQuality()}
        </Text>
        
        {networkInfo.type === 'cellular' && (
          <Text style={styles.networkWarning}>
            ⚠️ Using cellular data. Video quality may be limited.
          </Text>
        )}
        
        {!networkInfo.isInternetReachable && (
          <Text style={styles.networkError}>
            ❌ No internet access. Check your connection.
          </Text>
        )}
      </View>
    );
  };

  const getPlaybackTips = () => {
    const tips = [];

    if (error.type === 'network') {
      tips.push('• Move to an area with better signal strength');
      tips.push('• Connect to Wi-Fi for better streaming quality');
      tips.push('• Close other apps that might be using bandwidth');
    }

    if (error.message.toLowerCase().includes('buffering')) {
      tips.push('• Wait for the video to buffer before playing');
      tips.push('• Try lowering the video quality');
      tips.push('• Pause and resume to help buffering');
    }

    if (networkInfo?.type === 'cellular') {
      tips.push('• Consider downloading for offline viewing');
      tips.push('• Use Wi-Fi for high-quality streaming');
    }

    if (tips.length === 0) return null;

    return (
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Playback Tips:</Text>
        {tips.map((tip, index) => (
          <Text key={index} style={styles.tipText}>{tip}</Text>
        ))}
      </View>
    );
  };

  const renderQualitySelector = () => {
    if (!showQualitySelector || availableQualities.length === 0) return null;

    return (
      <View style={styles.qualitySelector}>
        <Text style={styles.qualitySelectorTitle}>Select Video Quality:</Text>
        {availableQualities.map((quality) => (
          <TouchableOpacity
            key={quality.value}
            style={[
              styles.qualityOption,
              videoQuality === quality.value && styles.qualityOptionSelected,
            ]}
            onPress={() => {
              onChangeQuality?.(quality.value);
              setShowQualitySelector(false);
            }}
          >
            <Text
              style={[
                styles.qualityOptionText,
                videoQuality === quality.value && styles.qualityOptionTextSelected,
              ]}
            >
              {quality.label}
            </Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity
          style={styles.qualityCancelButton}
          onPress={() => setShowQualitySelector(false)}
        >
          <Text style={styles.qualityCancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getSeekOptions = () => {
    if (duration <= 0 || !onSeekTo) return null;

    const seekPositions = [
      { label: 'Start', time: 0 },
      { label: '25%', time: duration * 0.25 },
      { label: '50%', time: duration * 0.5 },
      { label: '75%', time: duration * 0.75 },
    ];

    return (
      <View style={styles.seekContainer}>
        <Text style={styles.seekTitle}>⏭️ Jump to Position:</Text>
        <View style={styles.seekButtons}>
          {seekPositions.map((position) => (
            <TouchableOpacity
              key={position.label}
              style={styles.seekButton}
              onPress={() => onSeekTo(position.time)}
            >
              <Text style={styles.seekButtonText}>
                {position.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <EnhancedErrorDisplay
        error={error}
        isRetrying={isRetrying}
        retryCount={retryCount}
        maxRetries={maxRetries}
        compact={false}
        showDetails={false}
      />

      {getPlaybackInfo()}
      {getNetworkStatus()}
      {getSeekOptions()}
      {getPlaybackTips()}

      {/* Quality Selector Modal */}
      {renderQualitySelector()}

      {/* Playback-specific actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Playback Actions:</Text>
        <View style={styles.actionButtons}>
          {getPlaybackSpecificActions()}
        </View>
      </View>
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
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
    marginBottom: 4,
  },
  networkStatus: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  networkStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003d82',
    marginBottom: 8,
  },
  networkStatusText: {
    fontSize: 13,
    color: '#003d82',
    marginBottom: 4,
  },
  networkWarning: {
    fontSize: 12,
    color: '#856404',
    marginTop: 4,
  },
  networkError: {
    fontSize: 12,
    color: '#721c24',
    marginTop: 4,
  },
  seekContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  seekTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  seekButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seekButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  seekButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tipsContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
    marginBottom: 4,
  },
  qualitySelector: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  qualitySelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  qualityOption: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  qualityOptionSelected: {
    backgroundColor: '#007AFF',
  },
  qualityOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  qualityOptionTextSelected: {
    fontWeight: 'bold',
  },
  qualityCancelButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  qualityCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
    marginBottom: 8,
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
  },
  secondaryActionButton: {
    backgroundColor: '#6c757d',
  },
  retryActionButton: {
    backgroundColor: '#28a745',
  },
  warningActionButton: {
    backgroundColor: '#ffc107',
  },
  infoActionButton: {
    backgroundColor: '#17a2b8',
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  retryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  warningActionButtonText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '600',
  },
  infoActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
