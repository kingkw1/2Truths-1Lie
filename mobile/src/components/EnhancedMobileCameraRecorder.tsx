/**
 * Enhanced Mobile Camera Recorder with Comprehensive Error Handling
 * Improved error handling, recovery flows, and user feedback
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  BackHandler,
  AppState,
  Linking,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  startMediaRecording,
  stopMediaRecording,
  setMediaRecordingError,
  pauseMediaRecording,
  resumeMediaRecording,
  updateRecordingDuration,
  resetMediaState,
} from '../store/slices/challengeCreationSlice';
import { useEnhancedErrorHandling } from '../hooks/useEnhancedErrorHandling';
import { CameraErrorHandler } from './CameraErrorHandler';
import { enhancedErrorHandlingService } from '../services/enhancedErrorHandlingService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced error types for better categorization
enum CameraErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  STORAGE_FULL = 'STORAGE_FULL',
  RECORDING_FAILED = 'RECORDING_FAILED',
  HARDWARE_ERROR = 'HARDWARE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  BACKGROUND_INTERRUPTED = 'BACKGROUND_INTERRUPTED',
  QUALITY_ERROR = 'QUALITY_ERROR',
  CODEC_ERROR = 'CODEC_ERROR',
}

interface EnhancedCameraError {
  type: CameraErrorType;
  message: string;
  recoverable: boolean;
  retryAction?: () => void;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: any;
}

interface EnhancedMobileCameraRecorderProps {
  statementIndex: number;
  onRecordingComplete: (videoUri: string) => void;
  onError?: (message: string) => void;
  onCancel: () => void;
  maxDuration?: number;
  minDuration?: number;
  quality?: 'low' | 'medium' | 'high';
}

export const EnhancedMobileCameraRecorder: React.FC<EnhancedMobileCameraRecorderProps> = ({
  statementIndex,
  onRecordingComplete,
  onError,
  onCancel,
  maxDuration = 30,
  minDuration = 1,
  quality = 'medium',
}) => {
  const dispatch = useAppDispatch();
  const recordingState = useAppSelector(
    (state) => state.challengeCreation.mediaRecordingState[statementIndex]
  );

  // Camera refs and state
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storageCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRecordingRef = useRef<Promise<any> | null>(null);

  // Component state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [currentError, setCurrentError] = useState<EnhancedCameraError | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Enhanced error handling hook
  const {
    error: enhancedError,
    isRetrying,
    retryCount: errorRetryCount,
    handleError: handleEnhancedError,
    clearError,
    retry: retryLastAction,
    canRetry,
    executeRecoveryAction,
  } = useEnhancedErrorHandling(
    async () => {
      // Default retry action - attempt to reinitialize camera
      await initializeCamera();
    },
    {
      showAlert: false, // We'll handle alerts manually
      autoRetry: false, // Manual retry control
      maxRetries: 3,
      provideFeedback: true,
      trackMetrics: true,
      onError: (error) => {
        console.log('🚨 ENHANCED_CAMERA: Error tracked:', error.type);
        setCurrentError({
          type: error.type as CameraErrorType,
          message: error.userMessage,
          recoverable: error.retryable,
          severity: error.severity,
          context: error,
        });
      },
      onRecovery: (wasSuccessful) => {
        if (wasSuccessful) {
          setCurrentError(null);
          clearError();
        }
      },
    }
  );

  // Get Redux state safely
  const isRecordingFromRedux = recordingState?.isRecording || false;
  const isPausedFromRedux = recordingState?.isPaused || false;
  const recordingError = recordingState?.error || null;

  // Permission checking and initialization
  useEffect(() => {
    initializeCamera();
  }, []);

  // Storage monitoring
  useEffect(() => {
    checkStorageSpace();
    
    // Check storage every 10 seconds during recording
    if (isRecordingFromRedux) {
      storageCheckIntervalRef.current = setInterval(() => {
        checkStorageSpace();
      }, 10000);
    } else {
      if (storageCheckIntervalRef.current) {
        clearInterval(storageCheckIntervalRef.current);
        storageCheckIntervalRef.current = null;
      }
    }

    return () => {
      if (storageCheckIntervalRef.current) {
        clearInterval(storageCheckIntervalRef.current);
      }
    };
  }, [isRecordingFromRedux]);

  // Recording duration tracking
  useEffect(() => {
    let durationInterval: NodeJS.Timeout | null = null;

    if (isRecordingFromRedux && !isPausedFromRedux) {
      durationInterval = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          dispatch(updateRecordingDuration({ statementIndex, duration: newDuration }));
          
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [isRecordingFromRedux, isPausedFromRedux, maxDuration, statementIndex, dispatch]);

  // App state and hardware back button handling
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isRecordingFromRedux) {
        handleBackgroundInterruption();
      }
    };

    const handleBackPress = () => {
      if (isRecordingFromRedux) {
        Alert.alert(
          'Stop Recording?',
          'You are currently recording. Do you want to stop and discard the recording?',
          [
            { text: 'Continue Recording', style: 'cancel' },
            { 
              text: 'Stop & Discard', 
              style: 'destructive',
              onPress: () => {
                stopRecording();
                onCancel();
              }
            },
          ]
        );
        return true;
      }
      return false;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      appStateSubscription?.remove();
      backHandler.remove();
    };
  }, [isRecordingFromRedux, onCancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (storageCheckIntervalRef.current) {
      clearInterval(storageCheckIntervalRef.current);
      storageCheckIntervalRef.current = null;
    }
    activeRecordingRef.current = null;
  }, []);

  const checkStorageSpace = async () => {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      
      const storageData = {
        available: freeSpace,
        total: totalSpace,
        isLowStorage: freeSpace < 500 * 1024 * 1024, // Less than 500MB
        canRecord: freeSpace > 100 * 1024 * 1024, // At least 100MB for recording
      };

      setStorageInfo(storageData);

      // Warn if storage is low during recording
      if (isRecordingFromRedux && storageData.isLowStorage) {
        await handleEnhancedError(
          new Error('Low storage space detected during recording'),
          'storage_check',
          {
            operation: 'recording',
            component: 'EnhancedMobileCameraRecorder',
            additionalData: { storageInfo: storageData },
          }
        );
      }

      return storageData;
    } catch (error) {
      console.warn('Failed to check storage space:', error);
      return null;
    }
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setIsLoading(true);

    try {
      console.log('🎬 ENHANCED_CAMERA: Initializing camera...');
      
      // Request permissions
      const { status } = await requestPermission();
      const { status: audioStatus } = await requestMicPermission();
      
      if (status !== 'granted' || audioStatus !== 'granted') {
        const permissionError = new Error(`Camera permission: ${status}, Audio permission: ${audioStatus}`);
        await handleEnhancedError(permissionError, 'permission_request', {
          operation: 'recording',
          component: 'EnhancedMobileCameraRecorder',
          additionalData: { cameraStatus: status, audioStatus },
        });
        setHasPermission(false);
        return;
      }

      setHasPermission(true);
      
      // Check storage
      const storage = await checkStorageSpace();
      if (storage && !storage.canRecord) {
        const storageError = new Error('Insufficient storage space for recording');
        await handleEnhancedError(storageError, 'storage_check', {
          operation: 'recording',
          component: 'EnhancedMobileCameraRecorder',
          additionalData: { storageInfo: storage },
        });
        return;
      }

      // Clear any previous errors
      setCurrentError(null);
      clearError();
      dispatch(setMediaRecordingError({ statementIndex, error: null }));

      console.log('✅ ENHANCED_CAMERA: Camera initialized successfully');
      
    } catch (error: any) {
      console.error('🚨 ENHANCED_CAMERA: Initialization failed:', error);
      await handleEnhancedError(error, 'camera_initialization', {
        operation: 'recording',
        component: 'EnhancedMobileCameraRecorder',
      });
    } finally {
      setIsInitializing(false);
      setIsLoading(false);
    }
  };

  const handleBackgroundInterruption = useCallback(async () => {
    if (isRecordingFromRedux) {
      await stopRecording();
      const interruptionError = new Error('Recording was interrupted when the app went to background');
      await handleEnhancedError(interruptionError, 'background_interruption', {
        operation: 'recording',
        component: 'EnhancedMobileCameraRecorder',
        additionalData: { recordingDuration },
      });
    }
  }, [isRecordingFromRedux, recordingDuration, handleEnhancedError]);

  const startRecording = async () => {
    if (!cameraRef.current || !hasPermission || isRecordingFromRedux) {
      console.log('🚨 ENHANCED_CAMERA: Cannot start recording:', {
        cameraReady: !!cameraRef.current,
        hasPermission,
        isRecording: isRecordingFromRedux
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('🎬 ENHANCED_CAMERA: Starting recording...');

      // Final storage check
      const storage = await checkStorageSpace();
      if (storage && !storage.canRecord) {
        throw new Error('Insufficient storage space to start recording');
      }

      // Update Redux state
      dispatch(startMediaRecording({ 
        statementIndex, 
        mediaType: 'video' 
      }));

      // Start camera recording with quality settings
      const recordingOptions = {
        quality: quality === 'high' ? '720p' :
                quality === 'medium' ? '480p' :
                '4:3',
        maxDuration: maxDuration,
        maxFileSize: storage ? Math.min(storage.available * 0.1, 100 * 1024 * 1024) : 50 * 1024 * 1024, // 10% of available or 100MB max
        mute: false,
      };

      const recordingPromise = cameraRef.current.recordAsync(recordingOptions);
      activeRecordingRef.current = recordingPromise;

      // Set up auto-stop timeout
      recordingTimeoutRef.current = setTimeout(() => {
        console.log('🚨 ENHANCED_CAMERA: Auto-stopping recording due to timeout');
        stopRecording();
      }, (maxDuration + 5) * 1000); // Add 5 second buffer

      // Reset duration
      setRecordingDuration(0);

      // Provide success feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      console.log('✅ ENHANCED_CAMERA: Recording started successfully');

    } catch (error: any) {
      console.error('🚨 ENHANCED_CAMERA: Failed to start recording:', error);
      
      // Clean up state
      dispatch(stopMediaRecording({ statementIndex }));
      activeRecordingRef.current = null;
      
      await handleEnhancedError(error, 'start_recording', {
        operation: 'recording',
        component: 'EnhancedMobileCameraRecorder',
        additionalData: { 
          retryCount,
          storageInfo,
          quality,
        },
      });
      
      setRetryCount(prev => prev + 1);
      
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecordingFromRedux) {
      console.log('🚨 ENHANCED_CAMERA: Cannot stop recording:', {
        cameraReady: !!cameraRef.current,
        isRecording: isRecordingFromRedux
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('🎬 ENHANCED_CAMERA: Stopping recording...');

      // Clear timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      // Stop camera recording
      cameraRef.current.stopRecording();

      // Wait for recording to complete
      if (activeRecordingRef.current) {
        const result = await activeRecordingRef.current;
        activeRecordingRef.current = null;

        if (result && result.uri) {
          await handleRecordingComplete(result.uri);
        } else {
          throw new Error('No recording result received');
        }
      }

      // Update Redux state
      dispatch(stopMediaRecording({ statementIndex }));

      // Success feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      console.log('✅ ENHANCED_CAMERA: Recording stopped successfully');

    } catch (error: any) {
      console.error('🚨 ENHANCED_CAMERA: Failed to stop recording:', error);
      
      // Clean up state anyway
      dispatch(stopMediaRecording({ statementIndex }));
      activeRecordingRef.current = null;
      
      await handleEnhancedError(error, 'stop_recording', {
        operation: 'recording',
        component: 'EnhancedMobileCameraRecorder',
        additionalData: { recordingDuration },
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordingComplete = async (uri: string) => {
    try {
      console.log('🎬 ENHANCED_CAMERA: Processing completed recording:', uri);

      // Validate file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file does not exist');
      }

      if (fileInfo.size === 0) {
        throw new Error('Recording file is empty');
      }

      // Check minimum duration
      if (recordingDuration < minDuration) {
        throw new Error(`Recording too short. Minimum duration is ${minDuration} seconds.`);
      }

      // Check maximum duration (30 seconds)
      if (recordingDuration > 30) {
        throw new Error('DURATION_TOO_LONG');
      }

      // All validation passed
      onRecordingComplete(uri);
      
      console.log('✅ ENHANCED_CAMERA: Recording processing completed successfully');

    } catch (error: any) {
      console.error('🚨 ENHANCED_CAMERA: Failed to process recording:', error);
      
      // Special handling for duration exceeded error
      if (error.message === 'DURATION_TOO_LONG') {
        Alert.alert(
          '⏱️ Recording Too Long',
          'Please keep your videos under 30 seconds to avoid large file uploads. Please record this statement again.',
          [
            { 
              text: 'Record Again', 
              style: 'default',
              onPress: () => {
                // Reset recording state to allow re-recording
                dispatch(resetMediaState({ statementIndex }));
                // Don't call onRecordingComplete since we want to stay on this statement
              }
            }
          ],
          { cancelable: false }
        );
        return;
      }
      
      await handleEnhancedError(error, 'process_recording', {
        operation: 'recording',
        component: 'EnhancedMobileCameraRecorder',
        additionalData: { 
          uri,
          recordingDuration,
          minDuration,
        },
      });
    }
  };

  const switchCamera = useCallback(() => {
    setCameraType(current => 
      current === 'back' ? 'front' : 'back'
    );
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashMode(current => 
      current === 'off' ? 'on' : 'off'
    );
  }, []);

  const handlePermissionRequest = useCallback(async () => {
    await initializeCamera();
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const handleReduceQuality = useCallback(() => {
    // This would need to be handled by parent component
    Alert.alert(
      'Reduce Quality',
      'Try recording in lower quality to save storage space.',
      [{ text: 'OK' }]
    );
  }, []);

  // Render error state
  if (currentError || enhancedError) {
    const errorToShow = currentError || {
      type: enhancedError?.type as CameraErrorType,
      message: enhancedError?.userMessage || 'Unknown error',
      recoverable: enhancedError?.retryable || false,
      severity: enhancedError?.severity || 'medium',
      context: enhancedError,
    };

    return (
      <CameraErrorHandler
        error={enhancedError}
        isRetrying={isRetrying}
        retryCount={errorRetryCount}
        maxRetries={3}
        availableStorage={storageInfo?.available}
        onRetry={retryLastAction}
        onCancel={onCancel}
        onRequestPermissions={handlePermissionRequest}
        onSwitchCamera={switchCamera}
        onReduceQuality={handleReduceQuality}
        onOpenSettings={handleOpenSettings}
      />
    );
  }

  // Render permission request state
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionMessage}>
            This app needs access to your camera and microphone to record videos.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handlePermissionRequest}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render loading state
  if (isInitializing || hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      </View>
    );
  }

  // Main camera interface
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Recording overlay */}
        {isRecordingFromRedux && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </Text>
            </View>
            
            {/* Storage warning */}
            {storageInfo?.isLowStorage && (
              <View style={styles.storageWarning}>
                <Text style={styles.storageWarningText}>
                  ⚠️ Low storage: {Math.round(storageInfo.available / (1024 * 1024 * 1024) * 10) / 10}GB
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Controls overlay */}
        <View style={styles.controlsOverlay}>
          {/* Top controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.controlButtonText}>✕</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={switchCamera}
              disabled={isLoading || isRecordingFromRedux}
            >
              <Text style={styles.controlButtonText}>🔄</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleFlash}
              disabled={isLoading || cameraType === 'front'}
            >
              <Text style={styles.controlButtonText}>
                {flashMode === 'on' ? '⚡' : '🔦'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecordingFromRedux && styles.recordButtonActive,
                isLoading && styles.recordButtonDisabled,
              ]}
              onPress={isRecordingFromRedux ? stopRecording : startRecording}
              disabled={isLoading || !cameraReady}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={[
                  styles.recordButtonInner,
                  isRecordingFromRedux && styles.recordButtonInnerActive,
                ]} />
              )}
            </TouchableOpacity>
          </View>

          {/* Duration indicator */}
          {isRecordingFromRedux && (
            <View style={styles.durationIndicator}>
              <View 
                style={[
                  styles.durationBar,
                  { width: `${(recordingDuration / maxDuration) * 100}%` }
                ]} 
              />
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionMessage: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  storageWarning: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  storageWarningText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    zIndex: 5,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  recordButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#dc3545',
  },
  recordButtonInnerActive: {
    borderRadius: 4,
    width: 20,
    height: 20,
  },
  durationIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  durationBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
});
