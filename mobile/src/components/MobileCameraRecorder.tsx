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
import * as FileSystem from 'expo-file-system/legacy';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startMediaRecording,
  stopMediaRecording,
  pauseMediaRecording,
  resumeMediaRecording,
  setMediaRecordingError,
  setStatementMedia,
  updateRecordingDuration,
  resetMediaState,
} from '../store/slices/challengeCreationSlice';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';
import UploadProgressIndicator from './UploadProgressIndicator';

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

    // Use Redux state directly instead of local state for recording status
  const isRecordingFromRedux = recordingState?.isRecording || false;
  const isPausedFromRedux = recordingState?.isPaused || false;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [microphonePermission, setMicrophonePermission] = useState<any>(null);
  const [permissionsChecked, setPermissionsChecked] = useState(false); // Force re-render after permission check
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [currentError, setCurrentError] = useState<CameraError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [storageInfo, setStorageInfo] = useState<{ available: number; total: number } | null>(null);
  const [activeRecording, setActiveRecording] = useState<any>(null); // Track the active recording
  
  const cameraRef = useRef<CameraView>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const maxRetries = 3;
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);
  const isInitializing = useRef(false);

  // Debug effect to track significant Redux state changes
  useEffect(() => {
    // Only log recording state transitions, not every render
    if (isRecordingFromRedux !== prevRecordingState.current) {
      console.log('🔄 Recording state changed:', {
        statementIndex,
        isRecording: isRecordingFromRedux,
        duration: recordingState?.duration || 0
      });
      prevRecordingState.current = isRecordingFromRedux;
    }
  }, [isRecordingFromRedux, statementIndex]);

  const prevRecordingState = useRef(false);

  // Initialize component and check permissions
  useEffect(() => {
    // Only initialize if we haven't already initialized
    if (!initializationRef.current && !isInitializing.current) {
      // Check permissions first, then initializeCamera will be called from checkPermissions if granted
      checkPermissions();
      checkStorageSpace();
    }
    
    // Safety timeout to ensure camera gets marked as ready
    const cameraReadyTimeout = setTimeout(() => {
      console.log('⚠️ Camera ready timeout - forcing ready state and clearing loading');
      setCameraReady(true);
      setIsLoading(false); // Force loading to false
    }, 5000); // Increased to 5 seconds
    
    // Handle app state changes (backgrounding)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' && isRecordingFromRedux) {
        handleBackgroundInterruption();
      } else if (nextAppState === 'active') {
        // Only reinitialize if camera is not ready or there's an error, and not already initializing
        if ((!cameraReady || currentError) && !isInitializing.current) {
          setTimeout(() => {
            initializeCamera();
          }, 500);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Handle hardware back button on Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      clearTimeout(cameraReadyTimeout);
      subscription?.remove();
      backHandler.remove();
      cleanup();
    };
  }, []);

  // Monitor storage space during recording
  useEffect(() => {
    if (isRecordingFromRedux) {
      const storageCheckInterval = setInterval(checkStorageSpace, 5000);
      return () => clearInterval(storageCheckInterval);
    }
  }, [isRecordingFromRedux]);

  // Update recording duration
  useEffect(() => {
    if (isRecordingFromRedux && !isPausedFromRedux) {
      recordingTimer.current = setInterval(() => {
        const elapsed = Date.now() - startTime.current;
        setRecordingDuration(elapsed);
        // Use integration service to update duration in Redux
        mobileMediaIntegration.updateDuration(statementIndex, elapsed);
        
        // Debug log component state every 5 seconds
        if (elapsed % 5000 < 100) {
          console.log('🎬 Recording state debug:', {
            isRecordingFromRedux,
            isLoading,
            isPausedFromRedux,
            elapsed: Math.round(elapsed / 1000) + 's',
            cameraReady
          });
        }
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
  }, [isRecordingFromRedux, isPausedFromRedux, dispatch, statementIndex]);

  const initializeCamera = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (isInitializing.current) {
      console.log('🚫 Camera initialization already in progress, skipping');
      return;
    }
    
    console.log('🎬 Initializing camera... setting loading=true');
    isInitializing.current = true;
    setIsLoading(true);
    
    try {
      console.log('Setting audio mode...');
      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio mode set successfully');
      
      console.log('Requesting permissions...');
      // Check permissions before proceeding with camera initialization
      const cameraStatus = await requestCameraPermission();
      const micStatus = await Audio.requestPermissionsAsync();
      const mediaStatus = await requestMediaLibraryPermission();
      
      const allGranted = cameraStatus.granted && micStatus.granted && mediaStatus.granted;
      
      if (!allGranted) {
        throw new Error(`Permissions required - Camera: ${cameraStatus.granted}, Mic: ${micStatus.granted}, Media: ${mediaStatus.granted}`);
      }
      
      console.log('✅ All permissions verified, proceeding with camera initialization');
      console.log('✅ Camera initialization complete, setting camera ready');
      setCameraReady(true);
      setCurrentError(null);
      setRetryCount(0);
      initializationRef.current = true;
      
      console.log('About to set loading=false in finally block');
    } catch (error) {
      console.error('Camera initialization error:', error);
      setCameraReady(false);
    } finally {
      console.log('🔧 Finally block: setting loading=false');
      setIsLoading(false);
      isInitializing.current = false;
    }
  }, []);

  const checkPermissions = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('=== Permission Check Debug ===');
      
      // Request fresh permissions every time to avoid stale state
      const cameraStatus = await requestCameraPermission();
      const micStatus = await Audio.requestPermissionsAsync();
      const mediaStatus = await requestMediaLibraryPermission();
      
      setMicrophonePermission(micStatus);
      
      // Simple boolean check - let the system handle permission dialogs
      const allGranted = cameraStatus.granted && micStatus.granted && mediaStatus.granted;
      
      console.log('Permission Status:', 
        `Camera: ${cameraStatus.granted}, Mic: ${micStatus.granted}, Media: ${mediaStatus.granted}, All: ${allGranted}`
      );
      
      if (allGranted) {
        console.log('✅ All permissions granted successfully');
        console.log('🔄 Triggering component re-render...');
        setPermissionsChecked(true); // Force re-render
        
        // Force re-initialization after permissions are granted
        console.log('🎥 Initializing camera...');
        await initializeCamera();
        console.log('✅ Camera initialization complete');
      } else {
        console.log('❌ Some permissions not granted');
        
        // If permissions were denied, show detailed info
        Alert.alert(
          'Permissions Required',
          `Please grant all permissions:\n• Camera: ${cameraStatus.granted ? '✅' : '❌'}\n• Microphone: ${micStatus.granted ? '✅' : '❌'}\n• Media Library: ${mediaStatus.granted ? '✅' : '❌'}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => checkPermissions() }
          ]
        );
      }
      
      setIsLoading(false);
      return allGranted;
    } catch (error) {
      console.error('💥 Permission check error:', error);
      setIsLoading(false);
      Alert.alert('Error', `Failed to check permissions: ${error}`);
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
    if (isRecordingFromRedux) {
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
    setActiveRecording(null);
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎬 Start recording requested for statement', statementIndex);
      
      // Early validation 
      if (isRecordingFromRedux) {
        console.log('Already recording, skipping');
        return;
      }
      
      if (!cameraReady) {
        console.log('Camera not ready yet, cameraReady:', cameraReady);
        return;
      }
      
      if (!cameraRef.current) {
        console.log('Camera ref not available');
        return;
      }
      
      // Clear any previous errors first
      setCurrentError(null);
      
      console.log('Starting recording process...');
      
      // Start recording immediately - Redux will handle state
      await mobileMediaIntegration.startRecording(statementIndex);
      
      // Start actual camera recording
      const recordingOptions = {
        quality: '720p' as const,
        maxDuration: 30, // 30 seconds max to prevent large uploads
        maxFileSize: 50 * 1024 * 1024, // 50MB max
        // Remove orientation forcing and stabilization to improve compatibility
        // orientation: 'portrait' as const,
        // stabilization: true,
      };
      
      console.log('📹 Starting camera recording with options:', recordingOptions);
      const recordingPromise = cameraRef.current.recordAsync(recordingOptions);
      setActiveRecording(recordingPromise);
      console.log('🎬 Set activeRecording promise');
      
      startTime.current = Date.now();
      setRecordingDuration(0);
      
      console.log('✅ Recording started successfully');
    } catch (error: any) {
      // Check if this was a manual stop (not an error)
      if (error.message?.includes('Recording stopped') || error.message?.includes('cancelled')) {
        console.log('Recording was stopped by user');
        return; // Don't treat manual stop as an error
      }
      
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
      // Don't clear activeRecording here - it needs to be available for stopRecording
      setIsLoading(false);
    }
  };

  const handleRecordingFinish = async (recording: any) => {
    try {
      console.log('🎬 Recording finished, processing...', { uri: recording.uri });
      setIsLoading(true);

      if (!recording || !recording.uri) {
        throw new Error('No recording data received');
      }

      const uri = recording.uri;

      // Validate file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file was not saved properly');
      }

      // Get file size and validate it's not empty
      const fileSize = fileInfo.size || 0;
      if (fileSize === 0) {
        throw new Error('Recording file is empty');
      }

      // Calculate actual recording duration from start time
      const actualDuration = Date.now() - startTime.current;
      console.log(`Recording duration check: timer=${recordingDuration}ms, actual=${actualDuration}ms`);
      
      // Use the larger of the two duration calculations and validate duration constraints
      const finalDuration = Math.max(recordingDuration, actualDuration);
      if (finalDuration < 500) { // Reduced to 0.5 seconds for more lenient validation
        throw new Error('Recording is too short. Please record for at least 0.5 seconds.');
      }
      
      // Validate maximum duration (30 seconds = 30,000 milliseconds)
      if (finalDuration > 30000) {
        throw new Error('DURATION_TOO_LONG');
      }

      // Process recording with upload through mobile media integration
      const mediaCapture = await mobileMediaIntegration.stopRecording(
        statementIndex,
        uri,
        finalDuration
      );
      
      // Call callback to progress to next statement
      console.log('🎬 Calling onRecordingComplete callback');
      onRecordingComplete?.(mediaCapture);

      // Removed "Recording Complete" pop-up notification as per UI requirements
      // const durationText = Math.round(finalDuration / 1000);
      // const sizeText = (mediaCapture.fileSize! / (1024 * 1024)).toFixed(1);
      // const storageType = mediaCapture.storageType || 'local';
      // 
      // Alert.alert(
      //   '✅ Recording Complete',
      //   `Video ${storageType === 'cloud' ? 'uploaded' : 'recorded'} successfully!\n\nDuration: ${durationText}s\nSize: ${sizeText}MB`,
      //   [{ text: 'OK', style: 'default' }],
      //   { cancelable: false }
      // );

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([100, 50, 100, 50, 100]);
      }
    } catch (error: any) {
      console.error('Recording processing error:', error);
      
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
                setCurrentError(null);
                dispatch(resetMediaState({ statementIndex }));
                // Don't call onRecordingComplete since we want to stay on this statement
              }
            }
          ],
          { cancelable: false }
        );
        return;
      }
      
      let errorMessage = `Processing recording failed: ${error.message || error}`;
      let errorType = CameraErrorType.RECORDING_FAILED;

      if (error.message?.includes('storage') || error.message?.includes('space')) {
        errorType = CameraErrorType.STORAGE_FULL;
        errorMessage = 'Failed to save recording due to insufficient storage space.';
      } else if (error.message?.includes('permission')) {
        errorType = CameraErrorType.PERMISSION_DENIED;
        errorMessage = 'Failed to save recording due to permission issues.';
      } else if (error.message?.includes('upload') || error.message?.includes('network')) {
        errorType = CameraErrorType.NETWORK_ERROR;
        errorMessage = 'Failed to upload recording. Please check your internet connection and try again.';
      }

      handleCameraError(errorType, errorMessage, true, () => {
        setCurrentError(null);
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stop recording button pressed');
      
      if (!cameraRef.current || !isRecordingFromRedux) {
        console.log('Cannot stop: camera not ready or not recording', { 
          cameraReady: !!cameraRef.current, 
          isRecordingFromRedux 
        });
        return;
      }

      // Only show loading during the stop process
      setIsLoading(true);
      console.log('Stopping camera recording...');

      // Stop the camera recording
      console.log('Calling cameraRef.current.stopRecording()');
      await cameraRef.current.stopRecording();
      
      // Wait for the active recording promise to resolve with the result
      console.log('🎬 Checking activeRecording:', !!activeRecording);
      if (activeRecording) {
        console.log('Waiting for active recording promise to resolve...');
        try {
          const recordingResult = await activeRecording;
          console.log('Recording result:', recordingResult);
          
          if (recordingResult && recordingResult.uri) {
            await handleRecordingFinish(recordingResult);
          } else {
            console.log('No valid recording result received');
          }
        } catch (recordingError) {
          console.log('Recording promise rejected (likely due to manual stop):', recordingError);
          // This is expected when we manually stop recording
        }
      } else {
        console.log('No active recording to process');
      }
      
      // Update state
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

      console.log('Recording stopped successfully');
      
      // Note: The actual media processing happens in handleRecordingFinish callback
    } catch (error: any) {
      console.error('Stop recording error:', error);
      
      // If stopping fails, force reset the state
      setIsRecording(false);
      setIsPaused(false);
      cleanup();
      
      handleCameraError(
        CameraErrorType.RECORDING_FAILED,
        `Failed to stop recording: ${error.message || error}`,
        true,
        () => {
          setCurrentError(null);
        }
      );
    } finally {
      setActiveRecording(null);
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

      // Calculate actual recording duration from start time
      const actualDuration = Date.now() - startTime.current;
      console.log(`Recording duration check: timer=${recordingDuration}ms, actual=${actualDuration}ms`);
      
      // Use the larger of the two duration calculations and validate minimum duration
      const finalDuration = Math.max(recordingDuration, actualDuration);
      if (finalDuration < 500) { // Reduced to 0.5 seconds for more lenient validation
        throw new Error('Recording is too short. Please record for at least 0.5 seconds.');
      }

      const mediaCapture: MediaCapture = {
        type: 'video',
        url: uri,
        duration: finalDuration, // Use the calculated final duration
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

      // Removed "Recording Complete" pop-up notification as per UI requirements
      // const durationText = Math.round(finalDuration / 1000);
      // const sizeText = (fileSize / (1024 * 1024)).toFixed(1);
      // 
      // Alert.alert(
      //   '✅ Recording Complete',
      //   `Video recorded successfully!\n\nDuration: ${durationText}s\nSize: ${sizeText}MB`,
      //   [{ text: 'OK', style: 'default' }],
      //   { cancelable: false }
      // );

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

  // SIMPLIFIED: Assume permissions are granted if user reached this screen
  const needsPermissions = false; // Skip permission check - assume granted via device settings
  
  // Add render debug alert (only during testing if needed)
  if (needsPermissions && !permissionsChecked) {
    // Only show alert once to avoid spam
    React.useEffect(() => {
      Alert.alert('Render Debug', `Showing permission screen. Camera: ${cameraPermission?.granted}, Media: ${mediaLibraryPermission?.granted}, Mic: ${microphonePermission?.granted}`);
    }, []);
  }
  
  if (needsPermissions && !permissionsChecked) {
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
        />
        
        {/* Overlay content positioned absolutely over the camera */}
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
      </View>

      {/* Enhanced bottom controls with platform-specific styling */}
      <View style={[
        styles.bottomControls,
        Platform.OS === 'android' && styles.bottomControlsAndroid
      ]} pointerEvents="box-none">
        <Text style={styles.instructionText}>
          Statement {statementIndex + 1}: Record your video (Debug: ready={cameraReady.toString()}, loading={isLoading.toString()})
        </Text>
        
        {/* Recording tips */}
        {!isRecordingFromRedux && (
          <Text style={styles.tipsText}>
            💡 {Platform.OS === 'ios' ? 'Tap and hold for best results' : 'Keep your device steady'}
          </Text>
        )}
        
        <View style={styles.recordingControls} pointerEvents="box-none">
          {!isRecordingFromRedux ? (
            <TouchableOpacity
              style={[
                styles.recordButton,
                (!cameraReady || isLoading) && styles.recordButtonDisabled
              ]}
              onPress={() => {
                console.log('🎬 Record button pressed! cameraReady:', cameraReady, 'isLoading:', isLoading);
                startRecording();
              }}
              disabled={!cameraReady || isLoading}
              activeOpacity={0.8}
            >
              {!cameraReady ? (
                <ActivityIndicator size="large" color="white" />
              ) : (
                <View style={styles.recordButtonInner} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.activeRecordingControls} pointerEvents="box-none">
              <TouchableOpacity
                style={[
                  styles.pauseButton,
                  isLoading && styles.controlButtonDisabled
                ]}
                onPress={() => {
                  console.log('Pause button pressed - isLoading:', isLoading);
                  if (!isLoading) {
                    pauseRecording();
                  }
                }}
                disabled={isLoading}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.controlButtonText}>⏸️</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.stopButton,
                  isLoading && styles.controlButtonDisabled
                ]}
                onPress={() => {
                  console.log('Stop button pressed - isLoading:', isLoading, 'isRecording (local):', isRecording, 'isRecordingFromRedux:', isRecordingFromRedux);
                  if (!isLoading) {
                    console.log('Stop button: calling stopRecording()');
                    stopRecording();
                  } else {
                    console.log('Stop button: blocked by isLoading state');
                  }
                }}
                disabled={isLoading}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        {isLoading && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color="#4a90e2" />
            <Text style={styles.processingText}>
              Please wait...
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

        {/* Debug info overlay */}
        {isRecording && (
          <View style={{
            position: 'absolute',
            bottom: 200,
            left: 20,
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 10,
            borderRadius: 5,
            zIndex: 1000,
          }}>
            <Text style={{ color: 'white', fontSize: 12 }}>
              isLoading: {isLoading.toString()}
            </Text>
            <Text style={{ color: 'white', fontSize: 12 }}>
              isRecording: {isRecording.toString()}
            </Text>
            <Text style={{ color: 'white', fontSize: 12 }}>
              cameraReady: {cameraReady.toString()}
            </Text>
          </View>
        )}
      </View>
      
      {/* Upload Progress Indicator */}
      <UploadProgressIndicator 
        statementIndex={statementIndex}
        visible={true}
      />
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