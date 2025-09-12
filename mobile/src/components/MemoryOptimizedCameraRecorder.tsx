/**
 * Memory-Optimized Mobile Camera Recorder
 * Enhanced version with comprehensive memory management
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
  AppStateStatus,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  startMediaRecording, 
  stopMediaRecording, 
  setMediaRecordingError,
  updateRecordingDuration,
} from '../store/slices/challengeCreationSlice';
import { enhancedMobileMediaIntegration } from '../services/enhancedMobileMediaIntegrationService';
import { memoryOptimizationService } from '../services/memoryOptimizationService';
import { reduxStateMemoryManager } from '../utils/reduxStateMemoryManager';
import { MediaCapture } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MemoryOptimizedCameraRecorderProps {
  statementIndex: number;
  onRecordingComplete?: (media: MediaCapture) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

interface MemoryStats {
  availableMemory: number;
  tempFileSize: number;
  isLowMemory: boolean;
  canRecord: boolean;
}

export const MemoryOptimizedCameraRecorder: React.FC<MemoryOptimizedCameraRecorderProps> = ({
  statementIndex,
  onRecordingComplete,
  onError,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const recordingState = useAppSelector(
    (state) => state.challengeCreation.mediaRecordingState[statementIndex]
  );
  const getState = useAppSelector((state) => state);

  // Recording state from Redux
  const isRecordingFromRedux = recordingState?.isRecording || false;
  const isPausedFromRedux = recordingState?.isPaused || false;
  const durationFromRedux = recordingState?.duration || 0;

  // Local state
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    availableMemory: 0,
    tempFileSize: 0,
    isLowMemory: false,
    canRecord: true,
  });

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const memoryCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const activeRecordingRef = useRef<any>(null);

  // Initialize memory optimization services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await enhancedMobileMediaIntegration.initialize(dispatch);
        reduxStateMemoryManager.initialize(dispatch);
        
        // Initial memory check
        await updateMemoryStats();
      } catch (error) {
        console.error('Failed to initialize memory services:', error);
      }
    };

    initializeServices();
  }, [dispatch]);

  // Memory monitoring during recording
  useEffect(() => {
    if (isRecordingFromRedux) {
      memoryCheckInterval.current = setInterval(async () => {
        await updateMemoryStats();
        
        // Check if we need to perform cleanup
        if (reduxStateMemoryManager.shouldPerformCleanup(() => getState)) {
          reduxStateMemoryManager.performComprehensiveCleanup(() => getState);
        }
      }, 10000); // Check every 10 seconds during recording

      return () => {
        if (memoryCheckInterval.current) {
          clearInterval(memoryCheckInterval.current);
        }
      };
    }
  }, [isRecordingFromRedux, getState]);

  // Recording duration tracking with memory optimization
  useEffect(() => {
    if (isRecordingFromRedux && !isPausedFromRedux) {
      recordingTimer.current = setInterval(() => {
        const elapsed = Date.now() - startTime.current;
        dispatch(updateRecordingDuration({ statementIndex, duration: elapsed }));

        // Stop recording if it gets too long (memory protection)
        if (elapsed > 120000) { // 2 minutes max
          handleStopRecording();
        }
      }, 500); // Less frequent updates to reduce Redux overhead
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

  // App state handling with memory cleanup
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        if (isRecordingFromRedux) {
          handleStopRecording(); // Stop recording to save memory
        }
        // Perform aggressive cleanup when backgrounded
        await memoryOptimizationService.cleanupTempVideoFiles();
        reduxStateMemoryManager.forceCriticalCleanup(() => getState);
      } else if (nextAppState === 'active') {
        // Check memory when app becomes active
        await updateMemoryStats();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      subscription?.remove();
      backHandler.remove();
      cleanup();
    };
  }, [isRecordingFromRedux, getState]);

  /**
   * Update memory statistics
   */
  const updateMemoryStats = useCallback(async () => {
    try {
      const stats = await memoryOptimizationService.getMemoryStats();
      const memoryPressure = await memoryOptimizationService.checkMemoryPressure();
      
      const newMemoryStats: MemoryStats = {
        availableMemory: stats.availableMemory,
        tempFileSize: stats.tempFileSize,
        isLowMemory: memoryPressure.isCritical,
        canRecord: stats.availableMemory > 100 * 1024 * 1024, // Need at least 100MB
      };

      setMemoryStats(newMemoryStats);

      // Show warning if memory is low
      if (memoryPressure.isCritical && !isRecordingFromRedux) {
        Alert.alert(
          'Low Memory Warning',
          'Device memory is running low. Please close other apps before recording.',
          [
            { text: 'Clean Up', onPress: handleMemoryCleanup },
            { text: 'Continue', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.warn('Failed to update memory stats:', error);
    }
  }, [isRecordingFromRedux]);

  /**
   * Handle memory cleanup
   */
  const handleMemoryCleanup = useCallback(async () => {
    try {
      setIsLoading(true);
      
      await memoryOptimizationService.cleanupTempVideoFiles();
      await memoryOptimizationService.cleanupOldCache();
      reduxStateMemoryManager.forceCriticalCleanup(() => getState);
      
      await updateMemoryStats();
      
      Alert.alert('Cleanup Complete', 'Memory has been optimized for recording.');
    } catch (error) {
      console.error('Memory cleanup failed:', error);
      Alert.alert('Cleanup Failed', 'Unable to optimize memory. Please restart the app.');
    } finally {
      setIsLoading(false);
    }
  }, [getState]);

  /**
   * Start recording with memory checks
   */
  const handleStartRecording = useCallback(async () => {
    if (!cameraReady || isRecordingFromRedux || isLoading) return;

    try {
      setIsLoading(true);

      // Pre-recording memory check
      const memoryCheck = await memoryOptimizationService.checkMemoryPressure();
      if (memoryCheck.isCritical) {
        Alert.alert(
          'Insufficient Memory',
          'Not enough memory to start recording. Please close other apps and try again.',
          [
            { text: 'Clean Up', onPress: handleMemoryCleanup },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Check storage space
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace < 100 * 1024 * 1024) { // 100MB
        Alert.alert(
          'Insufficient Storage',
          'Not enough storage space to record video. Please free up space and try again.'
        );
        return;
      }

      // Start recording through enhanced service
      await enhancedMobileMediaIntegration.startRecording(statementIndex);

      // Start camera recording
      if (cameraRef.current) {
        const recording = await cameraRef.current.recordAsync({
          maxDuration: memoryStats.isLowMemory ? 60 : 120, // Shorter duration for low memory
        });
        activeRecordingRef.current = recording;
      }

      startTime.current = Date.now();

      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      dispatch(setMediaRecordingError({ 
        statementIndex, 
        error: error.message || 'Failed to start recording' 
      }));
      onError?.(error.message || 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  }, [
    cameraReady, 
    isRecordingFromRedux, 
    isLoading, 
    statementIndex, 
    memoryStats.isLowMemory,
    dispatch,
    onError
  ]);

  /**
   * Stop recording with memory optimization
   */
  const handleStopRecording = useCallback(async () => {
    if (!isRecordingFromRedux) return;

    try {
      setIsLoading(true);

      // Stop camera recording
      if (activeRecordingRef.current && cameraRef.current) {
        cameraRef.current.stopRecording();
        activeRecordingRef.current = null;
      }

      // Calculate duration
      const duration = Date.now() - startTime.current;

      // Stop recording through enhanced service
      const mockUri = `${FileSystem.documentDirectory}recording_${statementIndex}_${Date.now()}.mp4`;
      const mediaCapture = await enhancedMobileMediaIntegration.stopRecording(
        statementIndex,
        mockUri,
        duration
      );

      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Immediate cleanup after recording
      setTimeout(() => {
        memoryOptimizationService.cleanupTempVideoFiles();
      }, 1000);

      onRecordingComplete?.(mediaCapture);

    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      dispatch(setMediaRecordingError({ 
        statementIndex, 
        error: error.message || 'Failed to stop recording' 
      }));
      onError?.(error.message || 'Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  }, [isRecordingFromRedux, statementIndex, dispatch, onRecordingComplete, onError]);

  /**
   * Switch camera with memory consideration
   */
  const switchCamera = useCallback(() => {
    if (isRecordingFromRedux) return;
    setCameraType(current => current === 'back' ? 'front' : 'back');
  }, [isRecordingFromRedux]);

  /**
   * Toggle flash
   */
  const toggleFlash = useCallback(() => {
    setFlashMode(current => current === 'off' ? 'on' : 'off');
  }, []);

  /**
   * Handle back press
   */
  const handleBackPress = useCallback(() => {
    if (isRecordingFromRedux) {
      Alert.alert(
        'Stop Recording?',
        'Are you sure you want to stop recording and go back?',
        [
          { text: 'Continue Recording', style: 'cancel' },
          { text: 'Stop & Go Back', onPress: () => {
            handleStopRecording();
            onCancel?.();
          }},
        ]
      );
      return true;
    }
    return false;
  }, [isRecordingFromRedux, handleStopRecording, onCancel]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    if (memoryCheckInterval.current) {
      clearInterval(memoryCheckInterval.current);
    }
    if (activeRecordingRef.current && cameraRef.current) {
      cameraRef.current.stopRecording();
      activeRecordingRef.current = null;
    }
  }, []);

  // Show loading screen while initializing
  if (!cameraPermission || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {!cameraPermission ? 'Checking permissions...' : 'Optimizing memory...'}
        </Text>
      </View>
    );
  }

  // Show permission request
  if (!cameraPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Memory stats overlay */}
        {__DEV__ && (
          <View style={styles.memoryStatsOverlay}>
            <Text style={styles.memoryStatsText}>
              Mem: {Math.round(memoryStats.availableMemory / (1024 * 1024))}MB
            </Text>
            <Text style={styles.memoryStatsText}>
              Temp: {Math.round(memoryStats.tempFileSize / 1024)}KB
            </Text>
            {memoryStats.isLowMemory && (
              <Text style={styles.lowMemoryWarning}>LOW MEMORY</Text>
            )}
          </View>
        )}

        {/* Recording indicator */}
        {isRecordingFromRedux && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {Math.floor(durationFromRedux / 60000)}:{((durationFromRedux % 60000) / 1000).toFixed(0).padStart(2, '0')}
              </Text>
            </View>
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
                (!cameraReady || !memoryStats.canRecord) && styles.recordButtonDisabled,
              ]}
              onPress={isRecordingFromRedux ? handleStopRecording : handleStartRecording}
              disabled={!cameraReady || isLoading || !memoryStats.canRecord}
            >
              <View style={[
                styles.recordButtonInner,
                isRecordingFromRedux && styles.recordButtonInnerActive,
              ]} />
            </TouchableOpacity>
          </View>
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
    marginTop: 20,
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memoryStatsOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  memoryStatsText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lowMemoryWarning: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  recordingOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '600',
  },
  controlsOverlay: {
    flex: 1,
    justifyContent: 'space-between',
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
});

export default MemoryOptimizedCameraRecorder;
