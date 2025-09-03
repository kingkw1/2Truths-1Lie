/**
 * Enhanced Upload UI Component
 * Comprehensive upload interface with progress, cancel, retry, and error states
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
  cancelUpload,
  setUploadState,
} from '../store/slices/challengeCreationSlice';
import { videoUploadService, UploadProgress } from '../services/uploadService';
import UploadProgressIndicator from './UploadProgressIndicator';

interface EnhancedUploadUIProps {
  statementIndex: number;
  videoUri: string;
  filename: string;
  duration: number;
  onUploadComplete?: (result: any) => void;
  onUploadError?: (error: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
  showModal?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const EnhancedUploadUI: React.FC<EnhancedUploadUIProps> = ({
  statementIndex,
  videoUri,
  filename,
  duration,
  onUploadComplete,
  onUploadError,
  onCancel,
  autoStart = false,
  showModal = false,
}) => {
  const dispatch = useAppDispatch();
  const uploadState = useAppSelector(
    (state) => state.challengeCreation.uploadState[statementIndex]
  );

  const [modalVisible, setModalVisible] = useState(showModal);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const maxRetryAttempts = 3;

  // Auto-start upload if requested
  useEffect(() => {
    if (autoStart && !uploadState?.isUploading && !uploadState?.uploadError) {
      startUpload();
    }
  }, [autoStart]);

  // Show modal animation
  useEffect(() => {
    if (modalVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible]);

  const startUpload = useCallback(async () => {
    try {
      const sessionId = `session_${Date.now()}_${statementIndex}`;
      const startTime = Date.now();
      
      setUploadStartTime(startTime);
      setRetryAttempts(prev => prev + 1);
      
      // Initialize upload state
      dispatch(startUpload({ statementIndex, sessionId }));

      // Start the actual upload
      const result = await videoUploadService.uploadVideo(
        videoUri,
        filename,
        duration,
        {
          compress: true,
          compressionQuality: 0.8,
          maxFileSize: 50 * 1024 * 1024, // 50MB
          chunkSize: 1024 * 1024, // 1MB chunks
          retryAttempts: 3,
          timeout: 300000, // 5 minutes
        },
        (progress: UploadProgress) => {
          // Update Redux state with progress
          dispatch(updateUploadProgress({
            statementIndex,
            progress: progress.progress,
          }));

          // Update upload state with additional progress info
          dispatch(setUploadState({
            statementIndex,
            uploadState: {
              bytesUploaded: progress.bytesUploaded,
              totalBytes: progress.totalBytes,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
              startTime: progress.startTime || startTime,
            },
          }));
        }
      );

      if (result.success) {
        // Upload completed successfully
        dispatch(completeUpload({
          statementIndex,
          fileUrl: result.streamingUrl || result.mediaId || videoUri,
          mediaCapture: {
            type: 'video',
            url: result.streamingUrl || videoUri,
            streamingUrl: result.streamingUrl,
            cloudStorageKey: result.cloudStorageKey,
            storageType: result.storageType || 'cloud',
            duration,
            fileSize: result.fileSize,
            compressionRatio: result.compressionRatio,
            uploadTime: result.uploadTime,
            mimeType: Platform.select({
              ios: 'video/quicktime',
              android: 'video/mp4',
            }) || 'video/mp4',
          },
        }));

        onUploadComplete?.(result);
        
        // Show success message
        Alert.alert(
          '✅ Upload Complete',
          `Video uploaded successfully!\n\nSize: ${formatBytes(result.fileSize || 0)}\nTime: ${formatDuration(result.uploadTime || 0)}${result.compressionRatio ? `\nCompression: ${Math.round((1 - result.compressionRatio) * 100)}%` : ''}`,
          [{ text: 'OK', onPress: () => setModalVisible(false) }]
        );
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      
      const errorMessage = getErrorMessage(error);
      dispatch(setUploadError({ statementIndex, error: errorMessage }));
      onUploadError?.(errorMessage);
    }
  }, [videoUri, filename, duration, statementIndex, dispatch, onUploadComplete, onUploadError]);

  const handleRetry = useCallback(() => {
    if (retryAttempts >= maxRetryAttempts) {
      Alert.alert(
        'Maximum Retries Reached',
        'The upload has failed multiple times. Please check your connection and try again later.',
        [
          { text: 'Cancel', onPress: handleCancel },
          { text: 'Try Again', onPress: () => {
            setRetryAttempts(0);
            startUpload();
          }},
        ]
      );
      return;
    }

    startUpload();
  }, [retryAttempts, startUpload]);

  const handleCancel = useCallback(() => {
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
            setModalVisible(false);
            onCancel?.();
          },
        },
      ]
    );
  }, [dispatch, statementIndex, onCancel]);

  const getErrorMessage = (error: any): string => {
    const message = error.message || error.toString();
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (message.includes('timeout')) {
      return 'Upload timed out. Please try again with a better connection.';
    }
    if (message.includes('storage') || message.includes('space')) {
      return 'Insufficient storage space. Please free up some space and try again.';
    }
    if (message.includes('permission')) {
      return 'Permission denied. Please check your app permissions.';
    }
    if (message.includes('file') && message.includes('not found')) {
      return 'Video file not found. Please record again.';
    }
    if (message.includes('size') || message.includes('large')) {
      return 'File is too large. Please try recording a shorter video.';
    }
    
    return `Upload failed: ${message}`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const renderUploadContent = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Uploading Video</Text>
        <Text style={styles.subtitle}>
          {filename} • {formatDuration(duration)}
        </Text>
      </View>

      <UploadProgressIndicator
        statementIndex={statementIndex}
        visible={true}
        onRetry={handleRetry}
        onCancel={handleCancel}
        allowCancel={true}
        allowRetry={retryAttempts < maxRetryAttempts}
      />

      {!uploadState?.isUploading && !uploadState?.uploadError && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={startUpload}
          >
            <Text style={styles.primaryButtonText}>Start Upload</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCancel}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploadState?.uploadError && retryAttempts >= maxRetryAttempts && (
        <View style={styles.finalErrorContainer}>
          <Text style={styles.finalErrorTitle}>Upload Failed</Text>
          <Text style={styles.finalErrorText}>
            The upload has failed after {maxRetryAttempts} attempts. 
            Please check your connection and try recording again.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              setRetryAttempts(0);
              setModalVisible(false);
              onCancel?.();
            }}
          >
            <Text style={styles.primaryButtonText}>Record Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (showModal) {
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCancel}
      >
        <Animated.View 
          style={[styles.modalOverlay, { opacity: fadeAnim }]}
        >
          <View style={styles.modalContent}>
            {renderUploadContent()}
          </View>
        </Animated.View>
      </Modal>
    );
  }

  return renderUploadContent();
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    maxWidth: screenWidth - 32,
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    maxWidth: screenWidth - 32,
    width: '90%',
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#cccccc',
    fontSize: 16,
    fontWeight: '500',
  },
  finalErrorContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  finalErrorTitle: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  finalErrorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});

export default EnhancedUploadUI;