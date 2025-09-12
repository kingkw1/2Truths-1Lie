/**
 * Network-Resilient Camera Component
 * Enhanced camera recorder with comprehensive network resilience features
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAppDispatch } from '../store/hooks';
import { useNetwork, useNetworkAwareUpload } from '../hooks/useNetwork';
import { NetworkResilientUploadProgress } from '../services/networkResilientUploadService';
import { 
  startMediaRecording, 
  stopMediaRecording, 
  setUploadState,
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
} from '../store/slices/challengeCreationSlice';

interface NetworkResilientCameraRecorderProps {
  statementIndex: number;
  isVisible: boolean;
  onRecordingComplete: (uri: string, duration: number) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const NetworkResilientCameraRecorder: React.FC<NetworkResilientCameraRecorderProps> = ({
  statementIndex,
  isVisible,
  onRecordingComplete,
  onError,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Network state
  const {
    isOnline,
    networkState,
    connectionStrength,
    shouldShowOfflineIndicator,
    shouldShowPoorConnectionWarning,
    offlineQueueLength,
    retryOfflineQueue,
    dismissNetworkAlerts,
  } = useNetwork({ 
    showAlerts: false, // Handle alerts manually for better UX
    autoRetryQueue: true,
  });

  const {
    canUpload,
    shouldWarnBeforeUpload,
    getUploadSettings,
  } = useNetworkAwareUpload();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<NetworkResilientUploadProgress | null>(null);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  // Animation values
  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const networkIndicatorAnimation = useRef(new Animated.Value(0)).current;

  // Timer for recording duration
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Request camera permissions
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Handle network state changes
  useEffect(() => {
    if (shouldShowOfflineIndicator || shouldShowPoorConnectionWarning) {
      setShowNetworkModal(true);
    }
  }, [shouldShowOfflineIndicator, shouldShowPoorConnectionWarning]);

  // Animate network indicator
  useEffect(() => {
    Animated.timing(networkIndicatorAnimation, {
      toValue: (!isOnline || connectionStrength === 'poor') ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, connectionStrength, networkIndicatorAnimation]);

  // Start recording animation
  const startRecordingAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(recordingAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [recordingAnimation]);

  // Stop recording animation
  const stopRecordingAnimation = useCallback(() => {
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(0);
  }, [recordingAnimation]);

  // Start recording with network awareness
  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    // Check network conditions before recording
    if (!isOnline) {
      Alert.alert(
        'Offline Mode',
        'You\'re currently offline. Your recording will be saved locally and uploaded when connection is restored.',
        [
          { text: 'Continue Recording', onPress: () => startRecording() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (shouldWarnBeforeUpload) {
      Alert.alert(
        'Poor Connection Detected',
        `Your ${connectionStrength} connection may cause upload issues. Continue recording?`,
        [
          { text: 'Record Anyway', onPress: () => startRecording() },
          { text: 'Wait for Better Connection', style: 'cancel' },
        ]
      );
      return;
    }

    startRecording();
  }, [isRecording, isOnline, shouldWarnBeforeUpload, connectionStrength]);

  // Actually start recording
  const startRecording = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      dispatch(startMediaRecording({
        statementIndex,
        mediaType: 'video',
      }));

      const recording = await cameraRef.current?.recordAsync({
        maxDuration: 120, // 2 minutes max
      });

      if (recording) {
        setIsRecording(true);
        setRecordingDuration(0);
        startRecordingAnimation();

        // Start duration timer
        recordingTimer.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      onError('Failed to start recording. Please try again.');
    }
  }, [dispatch, statementIndex, getUploadSettings, startRecordingAnimation, onError]);

  // Stop recording
  const handleStopRecording = useCallback(async () => {
    if (!isRecording || !cameraRef.current) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      stopRecordingAnimation();

      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      dispatch(stopMediaRecording({ statementIndex }));

    } catch (error) {
      console.error('Failed to stop recording:', error);
      onError('Failed to stop recording. Please try again.');
    }
  }, [isRecording, statementIndex, dispatch, stopRecordingAnimation, onError]);

  // Handle recording completion
  const handleRecordingFinished = useCallback(async (recording: any) => {
    if (!recording?.uri) {
      onError('Recording failed - no file created');
      return;
    }

    const duration = recordingDuration * 1000; // Convert to milliseconds
    
    // Check if we should upload immediately or queue for later
    if (!canUpload) {
      // Save locally and queue for upload
      Alert.alert(
        'Recording Saved Locally',
        'Your recording has been saved and will be uploaded when connection improves.',
        [
          { text: 'OK', onPress: () => onRecordingComplete(recording.uri, duration) }
        ]
      );
      return;
    }

    // Proceed with immediate upload
    setShowUploadProgress(true);
    
    try {
      // Import the network-resilient upload service
      const { networkResilientUploadService } = await import('../services/networkResilientUploadService');
      
      const sessionId = `upload_${Date.now()}_${statementIndex}`;
      
      dispatch(startUpload({
        statementIndex,
        sessionId,
      }));

      const uploadOptions = {
        ...getUploadSettings(),
        priority: 'high' as const,
        adaptToConnection: true,
        offlineQueue: true,
      };

      const result = await networkResilientUploadService.uploadVideoWithResilience(
        recording.uri,
        `statement_${statementIndex}_${Date.now()}.mp4`,
        duration,
        uploadOptions,
        (progress: NetworkResilientUploadProgress) => {
          setUploadProgress(progress);
          dispatch(updateUploadProgress({
            statementIndex,
            progress: progress.progress,
          }));
        }
      );

      if (result.success) {
        dispatch(completeUpload({
          statementIndex,
          fileUrl: result.streamingUrl || '',
          mediaCapture: {
            type: 'video',
            url: recording.uri,
            streamingUrl: result.streamingUrl || '',
            duration,
            fileSize: result.fileSize || 0,
            isUploaded: true,
            uploadTime: uploadProgress?.startTime ? Date.now() - uploadProgress.startTime : 0,
            cloudStorageKey: result.cloudStorageKey,
            storageType: result.storageType || 'cloud',
            mediaId: result.mediaId,
          },
        }));

        onRecordingComplete(recording.uri, duration);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload failed:', error);
      
      dispatch(setUploadError({
        statementIndex,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));

      // Still complete the recording locally
      Alert.alert(
        'Upload Failed',
        'Your recording was saved locally. We\'ll try uploading again when your connection improves.',
        [
          { text: 'OK', onPress: () => onRecordingComplete(recording.uri, duration) }
        ]
      );
    } finally {
      setShowUploadProgress(false);
      setUploadProgress(null);
    }
  }, [
    recordingDuration, 
    canUpload, 
    onRecordingComplete, 
    dispatch, 
    statementIndex, 
    getUploadSettings
  ]);

  // Get network status display
  const getNetworkStatusDisplay = useCallback(() => {
    if (!isOnline) {
      return { text: 'Offline', color: '#ff4444', icon: '📶❌' };
    }
    
    switch (connectionStrength) {
      case 'excellent':
        return { text: 'Excellent', color: '#00cc44', icon: '📶💚' };
      case 'good':
        return { text: 'Good', color: '#88cc00', icon: '📶🟢' };
      case 'fair':
        return { text: 'Fair', color: '#ffcc00', icon: '📶🔶' };
      case 'poor':
        return { text: 'Poor', color: '#ff8800', icon: '📶🔸' };
      default:
        return { text: 'Unknown', color: '#888888', icon: '📶❓' };
    }
  }, [isOnline, connectionStrength]);

  const networkStatus = getNetworkStatusDisplay();

  if (permission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Network Status Indicator */}
      <Animated.View 
        style={[
          styles.networkIndicator,
          {
            opacity: networkIndicatorAnimation,
            backgroundColor: networkStatus.color,
          }
        ]}
      >
        <Text style={styles.networkIndicatorText}>
          {networkStatus.icon} {networkStatus.text}
        </Text>
      </Animated.View>

      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
      >
        {/* Recording Duration */}
        {isRecording && (
          <View style={styles.durationContainer}>
            <Animated.View
              style={[
                styles.recordingIndicator,
                {
                  opacity: recordingAnimation,
                }
              ]}
            />
            <Text style={styles.durationText}>
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}

        {/* Recording Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
            ]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
          >
            <View style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonInnerActive,
            ]} />
          </TouchableOpacity>

          {/* Offline Queue Status */}
          {offlineQueueLength > 0 && (
            <TouchableOpacity
              style={styles.queueButton}
              onPress={() => setShowNetworkModal(true)}
            >
              <Text style={styles.queueButtonText}>
                📥 {offlineQueueLength}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>

      {/* Network Status Modal */}
      <Modal
        visible={showNetworkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Network Status</Text>
            
            <View style={styles.networkStatusContainer}>
              <Text style={styles.networkStatusText}>
                {networkStatus.icon} Connection: {networkStatus.text}
              </Text>
              
              {!isOnline && (
                <Text style={styles.offlineMessage}>
                  You're currently offline. Recordings will be saved locally and uploaded when connection is restored.
                </Text>
              )}
              
              {connectionStrength === 'poor' && isOnline && (
                <Text style={styles.warningMessage}>
                  Your connection is slow. Uploads may take longer than usual or fail.
                </Text>
              )}
              
              {offlineQueueLength > 0 && (
                <View style={styles.queueStatus}>
                  <Text style={styles.queueStatusText}>
                    {offlineQueueLength} items queued for upload
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      retryOfflineQueue();
                      setShowNetworkModal(false);
                    }}
                  >
                    <Text style={styles.retryButtonText}>Retry Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  dismissNetworkAlerts();
                  setShowNetworkModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        visible={showUploadProgress}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Uploading Video</Text>
            
            {uploadProgress && (
              <View style={styles.uploadProgressContainer}>
                <Text style={styles.uploadStageText}>
                  {uploadProgress.stage.charAt(0).toUpperCase() + uploadProgress.stage.slice(1)}
                </Text>
                
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { width: `${uploadProgress.progress}%` }
                    ]} 
                  />
                </View>
                
                <Text style={styles.progressText}>
                  {Math.round(uploadProgress.progress)}%
                </Text>
                
                {uploadProgress.retryCount !== undefined && (
                  <Text style={styles.retryText}>
                    Retry {uploadProgress.retryCount}/{uploadProgress.maxRetries}
                  </Text>
                )}
                
                {uploadProgress.speedMbps !== undefined && (
                  <Text style={styles.speedText}>
                    {uploadProgress.speedMbps.toFixed(1)} Mbps
                  </Text>
                )}
                
                {uploadProgress.estimatedTimeRemaining !== undefined && (
                  <Text style={styles.timeRemainingText}>
                    ~{Math.round(uploadProgress.estimatedTimeRemaining)}s remaining
                  </Text>
                )}
              </View>
            )}
            
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  networkIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  networkIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  durationContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  durationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff4444',
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    backgroundColor: '#ff2222',
  },
  queueButton: {
    backgroundColor: 'rgba(255, 140, 0, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  queueButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  networkStatusContainer: {
    marginBottom: 20,
  },
  networkStatusText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  offlineMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  warningMessage: {
    fontSize: 14,
    color: '#ff8800',
    textAlign: 'center',
    marginBottom: 10,
  },
  queueStatus: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  queueStatusText: {
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadProgressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadStageText: {
    fontSize: 16,
    marginBottom: 10,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  retryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  speedText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  timeRemainingText: {
    fontSize: 12,
    color: '#666',
  },
});

export default NetworkResilientCameraRecorder;
