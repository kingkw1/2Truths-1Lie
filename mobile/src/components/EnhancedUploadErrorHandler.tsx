/**
 * Enhanced Upload Error Handler Component
 * Specialized error handling for upload operations with network-aware recovery
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ProgressBarAndroid,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ErrorDetails } from '../services/enhancedErrorHandlingService';
import { EnhancedErrorDisplay } from './EnhancedErrorDisplay';

export interface EnhancedUploadErrorHandlerProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  uploadProgress?: number;
  fileName?: string;
  fileSize?: number;
  uploadSpeed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
  networkType?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  onSaveForLater?: () => void;
  onCompressVideo?: () => void;
  onSwitchToWifi?: () => void;
  onSelectNewFile?: () => void;
  style?: any;
}

export const EnhancedUploadErrorHandler: React.FC<EnhancedUploadErrorHandlerProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  uploadProgress = 0,
  fileName,
  fileSize,
  uploadSpeed,
  estimatedTimeRemaining,
  networkType,
  onRetry,
  onCancel,
  onSaveForLater,
  onCompressVideo,
  onSwitchToWifi,
  onSelectNewFile,
  style,
}) => {
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkInfo(state);
    });

    // Initial network check
    NetInfo.fetch().then(setNetworkInfo);

    return unsubscribe;
  }, []);

  if (!error) return null;

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${Math.round(bytes / (1024 * 1024) * 10) / 10}MB`;
  };

  const formatUploadSpeed = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return 'Unknown';
    if (bytesPerSecond < 1024) {
      return `${Math.round(bytesPerSecond)}B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${Math.round(bytesPerSecond / 1024)}KB/s`;
    }
    return `${Math.round(bytesPerSecond / (1024 * 1024) * 10) / 10}MB/s`;
  };

  const formatTimeRemaining = (seconds?: number): string => {
    if (!seconds) return 'Unknown';
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${Math.round(seconds / 3600)}h`;
  };

  const checkNetworkSpeed = async () => {
    setIsCheckingNetwork(true);
    try {
      const startTime = Date.now();
      const response = await fetch('https://httpbin.org/bytes/100', {
        method: 'GET',
        cache: 'no-cache',
      });
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const speed = 100 / duration; // bytes per second
      
      let speedCategory = 'Unknown';
      if (speed > 1024 * 1024) { // > 1MB/s
        speedCategory = 'Excellent';
      } else if (speed > 512 * 1024) { // > 512KB/s
        speedCategory = 'Good';
      } else if (speed > 128 * 1024) { // > 128KB/s
        speedCategory = 'Fair';
      } else {
        speedCategory = 'Poor';
      }

      Alert.alert(
        'Network Speed Test',
        `Speed: ${formatUploadSpeed(speed)}\nQuality: ${speedCategory}`,
        [{ text: 'OK' }]
      );
    } catch (testError) {
      Alert.alert(
        'Network Test Failed',
        'Unable to test network speed. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  const getUploadSpecificActions = () => {
    const actions = [];

    // File size issues
    if (error.message.toLowerCase().includes('file too large') || 
        error.message.toLowerCase().includes('size limit')) {
      actions.push(
        <TouchableOpacity
          key="compress"
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={onCompressVideo}
        >
          <Text style={styles.primaryActionButtonText}>Compress Video</Text>
        </TouchableOpacity>
      );

      actions.push(
        <TouchableOpacity
          key="rerecord"
          style={[styles.actionButton, styles.secondaryActionButton]}
          onPress={onSelectNewFile}
        >
          <Text style={styles.secondaryActionButtonText}>Record Shorter Video</Text>
        </TouchableOpacity>
      );
    }

    // Network issues
    if (error.type === 'network' || error.type === 'timeout') {
      if (networkInfo?.type === 'cellular') {
        actions.push(
          <TouchableOpacity
            key="wifi"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => {
              Alert.alert(
                'Switch to Wi-Fi',
                'For better upload reliability, consider connecting to Wi-Fi.',
                [
                  { text: 'Continue with Cellular', style: 'cancel' },
                  { text: 'Open Wi-Fi Settings', onPress: onSwitchToWifi },
                ]
              );
            }}
          >
            <Text style={styles.primaryActionButtonText}>Switch to Wi-Fi</Text>
          </TouchableOpacity>
        );
      }

      actions.push(
        <TouchableOpacity
          key="test"
          style={[styles.actionButton, styles.infoActionButton]}
          onPress={checkNetworkSpeed}
          disabled={isCheckingNetwork}
        >
          {isCheckingNetwork ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.infoActionButtonText}>Test Network Speed</Text>
          )}
        </TouchableOpacity>
      );

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
              {retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    // Server/validation issues
    if (error.type === 'server' || error.type === 'validation') {
      actions.push(
        <TouchableOpacity
          key="save"
          style={[styles.actionButton, styles.warningActionButton]}
          onPress={onSaveForLater}
        >
          <Text style={styles.warningActionButtonText}>Save for Later</Text>
        </TouchableOpacity>
      );
    }

    // General retry for retryable errors
    if (error.retryable && !actions.some(action => action.key === 'retry')) {
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
              {retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </Text>
          )}
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

  const getUploadProgress = () => {
    if (uploadProgress <= 0) return null;

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>Upload Progress:</Text>
        <View style={styles.progressBarContainer}>
          {Platform.OS === 'android' ? (
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={uploadProgress / 100}
              color="#007AFF"
              style={styles.progressBar}
            />
          ) : (
            <View style={styles.progressBarTrack}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${uploadProgress}%` }
                ]} 
              />
            </View>
          )}
          <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
        </View>
        
        {fileName && (
          <Text style={styles.fileInfo}>
            File: {fileName} ({formatFileSize(fileSize)})
          </Text>
        )}
        
        {uploadSpeed && (
          <Text style={styles.speedInfo}>
            Speed: {formatUploadSpeed(uploadSpeed)}
            {estimatedTimeRemaining && ` • ETA: ${formatTimeRemaining(estimatedTimeRemaining)}`}
          </Text>
        )}
      </View>
    );
  };

  const getNetworkInfo = () => {
    if (!networkInfo) return null;

    return (
      <View style={styles.networkContainer}>
        <Text style={styles.networkTitle}>Network Information:</Text>
        <Text style={styles.networkInfo}>
          Type: {networkInfo.type || 'Unknown'}
        </Text>
        <Text style={styles.networkInfo}>
          Connected: {networkInfo.isConnected ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.networkInfo}>
          Internet: {networkInfo.isInternetReachable ? 'Yes' : 'No'}
        </Text>
        
        {networkInfo.details && (
          <>
            {networkInfo.details.ssid && (
              <Text style={styles.networkInfo}>
                Wi-Fi: {networkInfo.details.ssid}
              </Text>
            )}
            {networkInfo.details.strength !== undefined && (
              <Text style={styles.networkInfo}>
                Signal: {networkInfo.details.strength}/100
              </Text>
            )}
            {networkInfo.details.cellularGeneration && (
              <Text style={styles.networkInfo}>
                Cellular: {networkInfo.details.cellularGeneration}
              </Text>
            )}
          </>
        )}
      </View>
    );
  };

  const getUploadTips = () => {
    const tips = [];

    if (networkInfo?.type === 'cellular') {
      tips.push('• Connect to Wi-Fi for faster and more reliable uploads');
      tips.push('• Large uploads may use significant cellular data');
    }

    if (fileSize && fileSize > 50 * 1024 * 1024) { // > 50MB
      tips.push('• Consider compressing the video to reduce file size');
      tips.push('• Record in lower quality for faster uploads');
    }

    if (error.type === 'network') {
      tips.push('• Keep the app in the foreground during upload');
      tips.push('• Move to an area with better signal strength');
      tips.push('• Avoid using other bandwidth-heavy apps during upload');
    }

    if (tips.length === 0) return null;

    return (
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Upload Tips:</Text>
        {tips.map((tip, index) => (
          <Text key={index} style={styles.tipText}>{tip}</Text>
        ))}
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

      {getUploadProgress()}
      {getNetworkInfo()}
      {getUploadTips()}

      {/* Upload-specific actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Upload Actions:</Text>
        <View style={styles.actionButtons}>
          {getUploadSpecificActions()}
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
  progressContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    marginRight: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    minWidth: 35,
  },
  fileInfo: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  speedInfo: {
    fontSize: 12,
    color: '#6c757d',
  },
  networkContainer: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  networkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003d82',
    marginBottom: 8,
  },
  networkInfo: {
    fontSize: 12,
    color: '#003d82',
    lineHeight: 16,
    marginBottom: 2,
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
  cancelActionButton: {
    backgroundColor: '#dc3545',
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
  cancelActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
