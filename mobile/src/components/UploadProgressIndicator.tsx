/**
 * Enhanced Upload Progress Indicator Component
 * Shows upload progress with stage information, progress bar, and interactive controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { cancelUpload, setUploadError } from '../store/slices/challengeCreationSlice';
import { videoUploadService } from '../services/uploadService';

interface UploadProgressIndicatorProps {
  statementIndex: number;
  visible?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  allowCancel?: boolean;
  allowRetry?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const UploadProgressIndicator: React.FC<UploadProgressIndicatorProps> = ({
  statementIndex,
  visible = true,
  onRetry,
  onCancel,
  allowCancel = true,
  allowRetry = true,
}) => {
  const dispatch = useAppDispatch();
  const uploadState = useAppSelector(
    (state) => state.challengeCreation.uploadState[statementIndex]
  );

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [retryCount, setRetryCount] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  // Animation effects
  useEffect(() => {
    if (visible && (uploadState?.isUploading || uploadState?.uploadError)) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, uploadState?.isUploading, uploadState?.uploadError]);

  // Calculate estimated time remaining
  useEffect(() => {
    if (uploadState?.isUploading && uploadState.uploadProgress > 0) {
      const progress = uploadState.uploadProgress / 100;
      const elapsed = Date.now() - (uploadState.startTime || Date.now());
      const totalEstimated = elapsed / progress;
      const remaining = totalEstimated - elapsed;
      setEstimatedTimeRemaining(Math.max(0, remaining));
    } else {
      setEstimatedTimeRemaining(null);
    }
  }, [uploadState?.uploadProgress, uploadState?.startTime]);

  if (!visible || (!uploadState?.isUploading && !uploadState?.uploadError)) {
    return null;
  }

  const progress = uploadState.uploadProgress || 0;
  const stage = getStageFromProgress(progress);
  const hasError = !!uploadState.uploadError;

  const handleCancel = () => {
    Alert.alert(
      'Cancel Upload',
      'Are you sure you want to cancel the upload? You will need to record again.',
      [
        { text: 'Continue Upload', style: 'cancel' },
        {
          text: 'Cancel Upload',
          style: 'destructive',
          onPress: () => {
            dispatch(cancelUpload({ statementIndex }));
            videoUploadService.cancelUpload(`upload_${statementIndex}`);
            onCancel?.();
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    dispatch(setUploadError({ statementIndex, error: '' })); // Clear error
    onRetry?.();
  };

  const getStageText = (stage: string, hasError: boolean): string => {
    if (hasError) {
      return getErrorText(uploadState.uploadError || 'Upload failed');
    }
    
    switch (stage) {
      case 'preparing':
        return 'Preparing video...';
      case 'compressing':
        return 'Compressing video...';
      case 'uploading':
        return 'Uploading to server...';
      case 'finalizing':
        return 'Finalizing upload...';
      default:
        return 'Processing...';
    }
  };

  const getStageIcon = (stage: string, hasError: boolean): string => {
    if (hasError) {
      return '❌';
    }
    
    switch (stage) {
      case 'preparing':
        return '📋';
      case 'compressing':
        return '🗜️';
      case 'uploading':
        return '☁️';
      case 'finalizing':
        return '✨';
      default:
        return '⚙️';
    }
  };

  const getErrorText = (error: string): string => {
    if (error.includes('network') || error.includes('connection')) {
      return 'Network connection failed';
    }
    if (error.includes('storage') || error.includes('space')) {
      return 'Insufficient storage space';
    }
    if (error.includes('permission')) {
      return 'Permission denied';
    }
    if (error.includes('timeout')) {
      return 'Upload timed out';
    }
    return 'Upload failed';
  };

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s remaining`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        hasError && styles.errorContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.icon, hasError && styles.errorIcon]}>
          {getStageIcon(stage, hasError)}
        </Text>
        <View style={styles.textContainer}>
          <Text style={[styles.stageText, hasError && styles.errorText]}>
            {getStageText(stage, hasError)}
          </Text>
          {!hasError && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
              {estimatedTimeRemaining && estimatedTimeRemaining > 1000 && (
                <Text style={styles.timeRemainingText}>
                  {formatTimeRemaining(estimatedTimeRemaining)}
                </Text>
              )}
            </View>
          )}
          {hasError && retryCount > 0 && (
            <Text style={styles.retryCountText}>
              Retry attempt {retryCount}
            </Text>
          )}
        </View>
        {!hasError && (
          <ActivityIndicator size="small" color="#4a90e2" />
        )}
      </View>
      
      {!hasError && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                { width: `${progress}%` }
              ]} 
            />
          </View>
          {uploadState.bytesUploaded && uploadState.totalBytes && (
            <View style={styles.bytesInfo}>
              <Text style={styles.bytesText}>
                {formatBytes(uploadState.bytesUploaded)} / {formatBytes(uploadState.totalBytes)}
              </Text>
              {uploadState.currentChunk && uploadState.totalChunks && (
                <Text style={styles.chunkText}>
                  Chunk {uploadState.currentChunk} of {uploadState.totalChunks}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
      
      {/* Action buttons */}
      <View style={styles.actionContainer}>
        {hasError && allowRetry && (
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>🔄 Retry</Text>
          </TouchableOpacity>
        )}
        
        {allowCancel && (uploadState.isUploading || hasError) && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>
              {hasError ? 'Dismiss' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error details */}
      {hasError && uploadState.uploadError && (
        <View style={styles.errorDetailsContainer}>
          <Text style={styles.errorDetailsText}>
            {uploadState.uploadError}
          </Text>
          {uploadState.uploadError.includes('network') && (
            <Text style={styles.errorHintText}>
              💡 Check your internet connection and try again
            </Text>
          )}
          {uploadState.uploadError.includes('storage') && (
            <Text style={styles.errorHintText}>
              💡 Free up some storage space and try again
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

/**
 * Determine upload stage from progress percentage
 */
function getStageFromProgress(progress: number): string {
  if (progress < 10) return 'preparing';
  if (progress < 45) return 'compressing';
  if (progress < 95) return 'uploading';
  return 'finalizing';
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    maxWidth: screenWidth - 32,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
    marginRight: 16,
  },
  errorIcon: {
    fontSize: 32,
  },
  textContainer: {
    flex: 1,
  },
  stageText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    color: '#4a90e2',
    fontSize: 15,
    fontWeight: '600',
  },
  timeRemainingText: {
    color: '#cccccc',
    fontSize: 13,
    fontStyle: 'italic',
  },
  retryCountText: {
    color: '#fbbf24',
    fontSize: 13,
    fontStyle: 'italic',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 4,
    minWidth: 4,
  },
  bytesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bytesText: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '500',
  },
  chunkText: {
    color: '#999999',
    fontSize: 11,
    fontStyle: 'italic',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flex: 1,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '500',
  },
  errorDetailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  errorDetailsText: {
    color: '#ff6b6b',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  errorHintText: {
    color: '#fbbf24',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});

export default UploadProgressIndicator;