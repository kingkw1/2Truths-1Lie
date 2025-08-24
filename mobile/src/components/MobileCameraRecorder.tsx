import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
  BackHandler,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startMediaRecording,
  stopMediaRecording,
  pauseMediaRecording,
  resumeMediaRecording,
  setMediaRecordingError,
  setStatementMedia,
  updateRecordingDuration,
} from '../store/slices/challengeCreationSlice';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';

interface MobileCameraRecorderProps {
  statementIndex: number;
  onRecordingComplete?: (media: MediaCapture) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Error types for better error handling
enum CameraErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  STORAGE_FULL = 'STORAGE_FULL',
  RECORDING_FAILED = 'RECORDING_FAILED',
  HARDWARE_ERROR = 'HARDWARE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  BACKGROUND_INTERRUPTED = 'BACKGROUND_INTERRUPTED',
}

interface CameraError {
  type: CameraErrorType;
  message: string;
  recoverable: boolean;
  retryAction?: () => void;
}

export const MobileCameraRecorder: React.FC<MobileCameraRecorderProps> = ({
  statementIndex,
  onRecordingComplete,
  onError,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const recordingState = useAppSelector(
    (state) => state.challengeCreation.mediaRecordingState[statementIndex]
  );

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [microphonePermission, setMicrophonePermission] = useState<any>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [currentError, setCurrentError] = useState<CameraError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [storageInfo, setStorageInfo] = useState<{ available: number; total: number } | null>(null);
  
  const cameraRef = useRef<CameraView>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const maxRetries = 3;
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize component and check permissions
  useEffect(() => {
    initializeCamera();
    checkStorageSpace();
    
    // Handle app state changes (backgrounding)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' && isRecording) {
        handleBackgroundInterruption();
      } else if (nextAppState === 'active') {
        // Refresh permissions when app becomes active again
        setTimeout(() => {
          initializeCamera();
        }, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Handle hardware back button on Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      subscription?.remove();
      backHandler.remove();
      cleanup();
    };
  }, []);

  // Monitor storage space during recording
  useEffect(() => {
    if (isRecording) {
      const storageCheckInterval = setInterval(checkStorageSpace, 5000);
      return () => clearInterval(storageCheckInterval);
    }
  }, [isRecording]);

  // Update recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingTimer.current = setInterval(() => {
        const elapsed = Date.now() - startTime.current;
        setRecordingDuration(elapsed);
        // Use integration service to update duration in Redux
        mobileMediaIntegration.updateDuration(statementIndex, elapsed);
      }, 100);
    } else {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
    }

    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [isRecording, isPaused, dispatch, statementIndex]);

  const initializeCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      const hasPermissions = await checkPermissions();
      if (hasPermissions) {
        setCameraReady(true);
        setCurrentError(null);
        setRetryCount(0);
      }
    } catch (error) {
      console.error('Camera initialization error:', error);
      handleCameraError(CameraErrorType.CAMERA_UNAVAILABLE, `Failed to initialize camera: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkPermissions = async (): Promise<boolean> => {
    try {
      console.log('=== Permission Check Debug ===');
      console.log('Current camera permission:', cameraPermission);
      console.log('Current media permission:', mediaLibraryPermission);
      console.log('Current microphone permission:', microphonePermission);
      
      // Request fresh permissions every time to avoid stale state
      console.log('Requesting fresh camera permission...');
      const cameraStatus = await requestCameraPermission();
      console.log('Camera permission result:', cameraStatus);

      console.log('Requesting fresh microphone permission...');
      const micStatus = await Audio.requestPermissionsAsync();
      console.log('Microphone permission result:', micStatus);
      setMicrophonePermission(micStatus);

      console.log('Requesting fresh media permission...');
      const mediaStatus = await requestMediaLibraryPermission();
      console.log('Media permission result:', mediaStatus);

      // Check camera permission
      if (!cameraStatus.granted) {
        console.log('Camera permission denied');
        handleCameraError(
          CameraErrorType.PERMISSION_DENIED,
          'Camera access is needed to record your video statements. Please check your device settings.',
          true,
          () => requestCameraPermission()
        );
        return false;
      }

      // Check microphone permission 
      if (!micStatus.granted) {
        console.log('Microphone permission denied');
        handleCameraError(
          CameraErrorType.PERMISSION_DENIED,
          'Microphone access is needed to record audio with your video statements. Please check your device settings.',
          true,
          () => Audio.requestPermissionsAsync()
        );
        return false;
      }

      // Check media library permission
      if (!mediaStatus.granted) {
        console.log('Media permission denied');
        handleCameraError(
          CameraErrorType.PERMISSION_DENIED,
          'Media library permission is required to save recordings. Please enable it in your device settings.',
          true,
          () => requestMediaLibraryPermission()
        );
        return false;
      }

      console.log('All permissions granted successfully');
      return true;
    } catch (error) {
      console.error('Permission check error:', error);
      handleCameraError(CameraErrorType.PERMISSION_DENIED, `Permission error: ${error}`);
      return false;
    }
  };

  const checkStorageSpace = useCallback(async () => {
    try {
      const diskSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      
      setStorageInfo({
        available: diskSpace,
        total: totalSpace || diskSpace,
      });

      // Check if we have enough space (at least 100MB for video recording)
      const minRequiredSpace = 100 * 1024 * 1024; // 100MB in bytes
      if (diskSpace < minRequiredSpace) {
        handleCameraError(
          CameraErrorType.STORAGE_FULL,
          'Not enough storage space available. Please free up some space and try again.',
          true,
          checkStorageSpace
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Could not check storage space:', error);
      return true; // Continue anyway if we can't check
    }
  }, []);

  const handleCameraError = useCallback((
    type: CameraErrorType,
    message: string,
    recoverable: boolean = false,
    retryAction?: () => void
  ) => {
    const error: CameraError = {
      type,
      message,
      recoverable,
      retryAction,
    };

    setCurrentError(error);
    dispatch(setMediaRecordingError({ statementIndex, error: message }));
    onError?.(message);

    // Provide haptic feedback on error
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Vibration.vibrate(200);
    }
  }, [dispatch, statementIndex, onError]);

  const handleBackgroundInterruption = useCallback(() => {
    if (isRecording) {
      stopRecording();
      handleCameraError(
        CameraErrorType.BACKGROUND_INTERRUPTED,
        'Recording was interrupted when the app went to background. Please try recording again.',
        true,
        () => setCurrentError(null)
      );
    }
  }, [isRecording]);

  const handleBackPress = useCallback(() => {
    if (isRecording) {
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
              onCancel?.();
            }
          },
        ]
      );
      return true; // Prevent default back action
    }
    return false; // Allow default back action
  }, [isRecording, onCancel]);

  const cleanup = useCallback(() => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    try {
      setIsLoading(true);
      
      // Clear any previous errors first
      setCurrentError(null);
      
      // Always check permissions fresh before recording
      console.log('Checking permissions before recording...');
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) {
        console.log('Permissions check failed');
        return;
      }

      const hasStorage = await checkStorageSpace();
      if (!hasStorage) return;

      if (!cameraRef.current) {
        handleCameraError(CameraErrorType.CAMERA_UNAVAILABLE, 'Camera not ready. Please try again.');
        return;
      }

      if (!cameraReady) {
        handleCameraError(CameraErrorType.CAMERA_UNAVAILABLE, 'Camera is still initializing. Please wait a moment.');
        return;
      }

      console.log('Starting recording...');
      
      // Use mobile media integration service to start recording
      await mobileMediaIntegration.startRecording(statementIndex);
      
      setIsRecording(true);
      setIsPaused(false);
      startTime.current = Date.now();
      setRecordingDuration(0);

      // Set recording timeout (65 seconds to allow for 60s max + buffer)
      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecording) {
          stopRecording();
          handleCameraError(
            CameraErrorType.TIMEOUT_ERROR,
            'Recording stopped automatically after reaching maximum duration.',
            true,
            () => setCurrentError(null)
          );
        }
      }, 65000);

      const recordingOptions = {
        quality: Platform.select({
          ios: '720p' as const,
          android: '720p' as const,
        }),
        maxDuration: 60, // 60 seconds max
        mute: false,
      };

      // Provide haptic feedback on start
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(100);
      }

      console.log('Starting camera recording with options:', recordingOptions);
      const recording = await cameraRef.current.recordAsync(recordingOptions);
      
      if (recording && recording.uri) {
        console.log('Recording completed with URI:', recording.uri);
        await handleRecordingComplete(recording.uri);
      } else {
        throw new Error('Recording failed to produce a valid file');
      }
    } catch (error: any) {
      console.error('Recording error:', error);
      
      let errorType = CameraErrorType.RECORDING_FAILED;
      let errorMessage = `Recording failed: ${error.message || error}`;

      // Categorize specific errors
      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        errorType = CameraErrorType.PERMISSION_DENIED;
        errorMessage = 'Camera permission was revoked during recording. Please grant permission and try again.';
      } else if (error.message?.includes('storage') || error.message?.includes('space')) {
        errorType = CameraErrorType.STORAGE_FULL;
        errorMessage = 'Not enough storage space to complete recording. Please free up space and try again.';
      } else if (error.message?.includes('hardware') || error.message?.includes('camera')) {
        errorType = CameraErrorType.HARDWARE_ERROR;
        errorMessage = 'Camera hardware error. Please restart the app and try again.';
      }

      handleCameraError(errorType, errorMessage, true, () => {
        setRetryCount(prev => prev + 1);
        if (retryCount < maxRetries) {
          setTimeout(() => {
            console.log(`Retrying recording (attempt ${retryCount + 1}/${maxRetries})`);
            startRecording();
          }, 1000);
        }
      });

      setIsRecording(false);
      setIsPaused(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!cameraRef.current || !isRecording) return;

      setIsLoading(true);

      await cameraRef.current.stopRecording();
      dispatch(stopMediaRecording({ statementIndex }));
      setIsRecording(false);
      setIsPaused(false);
      
      cleanup();

      // Provide haptic feedback on stop
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([100, 50, 100]);
      }
    } catch (error: any) {
      console.error('Stop recording error:', error);
      handleCameraError(
        CameraErrorType.RECORDING_FAILED,
        `Failed to stop recording: ${error.message || error}`,
        true,
        () => {
          setIsRecording(false);
          setIsPaused(false);
          cleanup();
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const pauseRecording = async () => {
    try {
      if (!cameraRef.current || !isRecording || isPaused) return;

      // Note: Expo Camera doesn't support pause/resume, so we'll stop and allow restart
      await stopRecording();
      setIsPaused(true);
      dispatch(pauseMediaRecording({ statementIndex }));
    } catch (error) {
      const errorMessage = `Pause recording failed: ${error}`;
      dispatch(setMediaRecordingError({ statementIndex, error: errorMessage }));
      onError?.(errorMessage);
    }
  };

  const handleRecordingComplete = async (uri: string) => {
    try {
      setIsLoading(true);

      // Validate file exists and is accessible
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file was not saved properly');
      }

      // Get file size and validate it's not empty
      const fileSize = fileInfo.size || 0;
      if (fileSize === 0) {
        throw new Error('Recording file is empty');
      }

      // Validate minimum duration (at least 1 second)
      if (recordingDuration < 1000) {
        throw new Error('Recording is too short. Please record for at least 1 second.');
      }

      const mediaCapture: MediaCapture = {
        type: 'video',
        url: uri,
        duration: recordingDuration,
        fileSize,
        mimeType: Platform.select({
          ios: 'video/quicktime',
          android: 'video/mp4',
        }) || 'video/mp4',
      };

      // Update Redux state
      dispatch(setStatementMedia({ index: statementIndex, media: mediaCapture }));
      
      // Call callback
      onRecordingComplete?.(mediaCapture);

      // Show success feedback with platform-specific styling
      const durationText = Math.round(recordingDuration / 1000);
      const sizeText = (fileSize / (1024 * 1024)).toFixed(1);
      
      Alert.alert(
        '✅ Recording Complete',
        `Video recorded successfully!\n\nDuration: ${durationText}s\nSize: ${sizeText}MB`,
        [{ text: 'OK', style: 'default' }],
        { cancelable: false }
      );

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([100, 50, 100, 50, 100]);
      }
    } catch (error: any) {
      console.error('Recording processing error:', error);
      
      let errorMessage = `Processing recording failed: ${error.message || error}`;
      let errorType = CameraErrorType.RECORDING_FAILED;

      if (error.message?.includes('storage') || error.message?.includes('space')) {
        errorType = CameraErrorType.STORAGE_FULL;
        errorMessage = 'Failed to save recording due to insufficient storage space.';
      } else if (error.message?.includes('permission')) {
        errorType = CameraErrorType.PERMISSION_DENIED;
        errorMessage = 'Failed to save recording due to permission issues.';
      }

      handleCameraError(errorType, errorMessage, true, () => {
        // Retry processing if file still exists
        FileSystem.getInfoAsync(uri).then(info => {
          if (info.exists) {
            handleRecordingComplete(uri);
          }
        });
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Show loading state
  if (isLoading && !cameraReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
        <Text style={styles.loadingSubtext}>
          {Platform.OS === 'ios' ? 'Please wait while we prepare your camera' : 'Setting up camera hardware'}
        </Text>
      </View>
    );
  }

  // Show permission request UI
  if (!cameraPermission?.granted || !mediaLibraryPermission?.granted || !microphonePermission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Text style={styles.permissionIconText}>📷🎤</Text>
        </View>
        <Text style={styles.permissionTitle}>Camera & Audio Access Required</Text>
        <Text style={styles.permissionText}>
          To record your video statements, we need access to your camera, microphone, and media library.
        </Text>
        <View style={styles.permissionDetails}>
          <Text style={styles.permissionDetailItem}>
            📹 Camera: Record video statements
          </Text>
          <Text style={styles.permissionDetailItem}>
            🎤 Microphone: Record audio with your video
          </Text>
          <Text style={styles.permissionDetailItem}>
            💾 Media Library: Save your recordings
          </Text>
        </View>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={checkPermissions}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.permissionButtonText}>Grant Permissions</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionSecondaryButton}
          onPress={onCancel}
        >
          <Text style={styles.permissionSecondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show enhanced error state
  if (currentError || recordingState?.error) {
    const error = currentError || { 
      type: CameraErrorType.RECORDING_FAILED, 
      message: recordingState?.error || 'Unknown error',
      recoverable: true 
    };

    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>
            {error.type === CameraErrorType.PERMISSION_DENIED ? '🔒' :
             error.type === CameraErrorType.STORAGE_FULL ? '💾' :
             error.type === CameraErrorType.CAMERA_UNAVAILABLE ? '📷' :
             error.type === CameraErrorType.HARDWARE_ERROR ? '⚠️' : '❌'}
          </Text>
        </View>
        <Text style={styles.errorTitle}>
          {error.type === CameraErrorType.PERMISSION_DENIED ? 'Permission Required' :
           error.type === CameraErrorType.STORAGE_FULL ? 'Storage Full' :
           error.type === CameraErrorType.CAMERA_UNAVAILABLE ? 'Camera Unavailable' :
           error.type === CameraErrorType.HARDWARE_ERROR ? 'Hardware Error' :
           error.type === CameraErrorType.BACKGROUND_INTERRUPTED ? 'Recording Interrupted' :
           'Recording Error'}
        </Text>
        <Text style={styles.errorText}>{error.message}</Text>
        
        {storageInfo && error.type === CameraErrorType.STORAGE_FULL && (
          <View style={styles.storageInfo}>
            <Text style={styles.storageInfoText}>
              Available: {(storageInfo.available / (1024 * 1024 * 1024)).toFixed(1)}GB
            </Text>
          </View>
        )}

        <View style={styles.errorActions}>
          {error.recoverable && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setCurrentError(null);
                dispatch(setMediaRecordingError({ statementIndex, error: null }));
                if (error.retryAction) {
                  error.retryAction();
                } else {
                  initializeCamera();
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.retryButtonText}>
                  {retryCount > 0 ? `Retry (${maxRetries - retryCount} left)` : 'Try Again'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
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

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
          onCameraReady={() => setCameraReady(true)}
        >
          {/* Recording indicator with enhanced mobile design */}
          {isRecording && (
            <View style={[
              styles.recordingIndicator,
              Platform.OS === 'android' && styles.recordingIndicatorAndroid
            ]}>
              <View style={[
                styles.recordingDot,
                { backgroundColor: recordingDuration > 50000 ? '#ff8800' : '#ff4444' }
              ]} />
              <Text style={styles.recordingText}>REC</Text>
              <Text style={styles.durationText}>
                {formatDuration(recordingDuration)}
              </Text>
              {recordingDuration > 50000 && (
                <Text style={styles.warningText}>10s left</Text>
              )}
            </View>
          )}

          {/* Storage indicator */}
          {storageInfo && (
            <View style={styles.storageIndicator}>
              <Text style={styles.storageText}>
                {(storageInfo.available / (1024 * 1024 * 1024)).toFixed(1)}GB free
              </Text>
            </View>
          )}

          {/* Camera controls overlay with platform-specific positioning */}
          <View style={[
            styles.controlsOverlay,
            Platform.OS === 'android' && styles.controlsOverlayAndroid
          ]}>
            {/* Flip camera button */}
            <TouchableOpacity
              style={[
                styles.flipButton,
                isRecording && styles.flipButtonDisabled
              ]}
              onPress={toggleCameraFacing}
              disabled={isRecording || isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.flipButtonText}>
                {facing === 'front' ? '🤳' : '📷'}
              </Text>
            </TouchableOpacity>

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              disabled={isRecording}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Center focus indicator */}
          <View style={styles.focusIndicator}>
            <View style={styles.focusRing} />
          </View>
        </CameraView>
      </View>

      {/* Enhanced bottom controls with platform-specific styling */}
      <View style={[
        styles.bottomControls,
        Platform.OS === 'android' && styles.bottomControlsAndroid
      ]}>
        <Text style={styles.instructionText}>
          Statement {statementIndex + 1}: Record your video
        </Text>
        
        {/* Recording tips */}
        {!isRecording && (
          <Text style={styles.tipsText}>
            💡 {Platform.OS === 'ios' ? 'Tap and hold for best results' : 'Keep your device steady'}
          </Text>
        )}
        
        <View style={styles.recordingControls}>
          {!isRecording ? (
            <TouchableOpacity
              style={[
                styles.recordButton,
                isLoading && styles.recordButtonDisabled
              ]}
              onPress={startRecording}
              disabled={isLoading || !cameraReady}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color="white" />
              ) : (
                <View style={styles.recordButtonInner} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.activeRecordingControls}>
              <TouchableOpacity
                style={[
                  styles.pauseButton,
                  isLoading && styles.controlButtonDisabled
                ]}
                onPress={pauseRecording}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.controlButtonText}>⏸️</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.stopButton,
                  isLoading && styles.controlButtonDisabled
                ]}
                onPress={stopRecording}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.controlButtonText}>⏹️</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Processing indicator with enhanced styling */}
        {(recordingState?.isCompressing || isLoading) && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color="#4a90e2" />
            <Text style={styles.processingText}>
              {recordingState?.isCompressing ? 'Processing video...' : 'Please wait...'}
            </Text>
          </View>
        )}

        {/* Recording progress bar */}
        {isRecording && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${Math.min((recordingDuration / 60000) * 100, 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.max(0, 60 - Math.floor(recordingDuration / 1000))}s remaining
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    color: '#333',
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f5f5f5',
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionIconText: {
    fontSize: 40,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
    lineHeight: 22,
  },
  permissionDetails: {
    marginBottom: 30,
    alignSelf: 'stretch',
  },
  permissionDetailItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    paddingLeft: 10,
  },
  permissionButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionSecondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ccc',
    minWidth: 200,
    alignItems: 'center',
  },
  permissionSecondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f5f5f5',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
    lineHeight: 22,
  },
  storageInfo: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  storageInfoText: {
    fontSize: 14,
    color: '#f57c00',
    textAlign: 'center',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 15,
    alignSelf: 'stretch',
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  recordingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  recordingIndicatorAndroid: {
    top: 50,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 10,
  },
  recordingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  durationText: {
    color: 'white',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  warningText: {
    color: '#ff8800',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  storageIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    flexDirection: 'column',
    gap: 15,
  },
  controlsOverlayAndroid: {
    top: 50,
  },
  flipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  flipButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    opacity: 0.6,
  },
  flipButtonText: {
    fontSize: 24,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  focusIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
  focusRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
  },
  bottomControls: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 35,
    paddingHorizontal: 25,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 35,
  },
  bottomControlsAndroid: {
    paddingBottom: 40,
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  tipsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    fontStyle: 'italic',
  },
  recordingControls: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  recordButtonDisabled: {
    opacity: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  recordButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff4444',
  },
  activeRecordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
  },
  pauseButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  stopButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: 'white',
  },
  controlButtonDisabled: {
    opacity: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  controlButtonText: {
    fontSize: 28,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  processingText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  progressContainer: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 2,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});