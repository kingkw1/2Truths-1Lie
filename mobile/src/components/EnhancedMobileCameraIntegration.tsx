import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setStatementMedia,
  setMediaRecordingError,
  validateChallenge,
} from '../store/slices/challengeCreationSlice';
import { MobileCameraRecorder } from './MobileCameraRecorder';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';

/**
 * Opens device settings for the app
 */
const openAppSettings = async (): Promise<void> => {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      // Android - open app-specific settings
      await Linking.openSettings();
    }
  } catch (error) {
    console.warn('Failed to open app settings:', error);
    // Fallback to showing instructions
    Alert.alert(
      'Open Settings', 
      'Please go to:\nSettings > Apps > Expo Go > Permissions\n\nThen enable Camera, Microphone, and Storage permissions.',
      [{ text: 'OK' }]
    );
  }
};

interface EnhancedMobileCameraIntegrationProps {
  statementIndex: number;
  isVisible: boolean;
  onComplete: (media: MediaCapture) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const EnhancedMobileCameraIntegration: React.FC<EnhancedMobileCameraIntegrationProps> = ({
  statementIndex,
  isVisible,
  onComplete,
  onCancel,
  onError,
}) => {
  const dispatch = useAppDispatch();
  const { currentChallenge, mediaRecordingState } = useAppSelector(
    (state) => state.challengeCreation
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  const recordingState = mediaRecordingState[statementIndex];
  const existingMedia = currentChallenge.mediaData?.[statementIndex];

  // Initialize mobile media integration service
  useEffect(() => {
    mobileMediaIntegration.initialize(dispatch);
  }, [dispatch]);

  // Enhanced recording completion handler with integrated service
  const handleRecordingComplete = useCallback(async (media: MediaCapture) => {
    try {
      setIsProcessing(true);
      setProcessingStep('Processing recording...');

      // Check if media is already uploaded (has cloud storage URL)
      let processedMedia: MediaCapture;
      
      if (media.isUploaded && media.storageType === 'cloud') {
        // Media is already processed and uploaded, just use it directly
        processedMedia = media;
        
        // Still update Redux with the processed media
        dispatch(setStatementMedia({
          index: statementIndex,
          media: processedMedia,
        }));
        
        // Validate the entire challenge
        dispatch(validateChallenge());
      } else {
        // Use the mobile media integration service for processing local files
        processedMedia = await mobileMediaIntegration.stopRecording(
          statementIndex,
          media.url || '',
          media.duration || 0
        );
      }

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Removed "Recording Saved" pop-up notification as per UI requirements
      // Alert.alert(
      //   '✅ Recording Saved',
      //   `Statement ${statementIndex + 1} has been recorded successfully!\n\nDuration: ${processedMedia.duration ? Math.round(processedMedia.duration / 1000) : 'Unknown'}s\nSize: ${processedMedia.fileSize ? (processedMedia.fileSize / (1024 * 1024)).toFixed(1) + 'MB' : 'Unknown'}`,
      //   [{ text: 'Continue', style: 'default' }],
      //   { cancelable: false }
      // );

      // Call completion callback with processed media
      onComplete(processedMedia);

    } catch (error: any) {
      console.error('Recording processing error:', error);
      
      const errorMessage = error.message || 'Failed to process recording';
      
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      Alert.alert(
        'Recording Error',
        errorMessage,
        [
          { text: 'Try Again', onPress: () => {
            dispatch(setMediaRecordingError({ statementIndex, error: null }));
          }},
          { text: 'Cancel', onPress: onCancel, style: 'cancel' }
        ]
      );

      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }, [dispatch, statementIndex, onComplete, onCancel, onError]);

  // Enhanced error handler with recovery options
  const handleRecordingError = useCallback((error: string) => {
    dispatch(setMediaRecordingError({ statementIndex, error }));
    
    // Categorize errors for better user experience
    let title = 'Recording Error';
    let message = error;
    let actions: any[] = [{ text: 'OK', style: 'default' }];

    if (error.includes('permission')) {
      title = 'Permission Required';
      message = 'Camera and microphone access is needed to record your video statements. Please check your device settings.';
      actions = [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { 
          text: 'Open Settings', 
          onPress: async () => {
            console.log('Opening device settings for permissions');
            await openAppSettings();
          }
        }
      ];
    } else if (error.includes('storage') || error.includes('space')) {
      title = 'Storage Full';
      message = 'Not enough storage space to record video. Please free up some space and try again.';
      actions = [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Retry', onPress: () => {
          dispatch(setMediaRecordingError({ statementIndex, error: null }));
        }}
      ];
    } else if (error.includes('hardware') || error.includes('camera')) {
      title = 'Camera Unavailable';
      message = 'Camera is currently unavailable. Please restart the app and try again.';
      actions = [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Retry', onPress: () => {
          dispatch(setMediaRecordingError({ statementIndex, error: null }));
        }}
      ];
    }

    Alert.alert(title, message, actions);
    onError?.(error);
  }, [dispatch, statementIndex, onCancel, onError]);

  // Handle cancel with confirmation if recording in progress
  const handleCancel = useCallback(() => {
    if (recordingState?.isRecording) {
      Alert.alert(
        'Stop Recording?',
        'You are currently recording. Do you want to stop and discard the recording?',
        [
          { text: 'Continue Recording', style: 'cancel' },
          { 
            text: 'Stop & Discard', 
            style: 'destructive',
            onPress: () => {
              dispatch(setMediaRecordingError({ statementIndex, error: null }));
              onCancel();
            }
          },
        ]
      );
    } else {
      onCancel();
    }
  }, [recordingState?.isRecording, dispatch, statementIndex, onCancel]);

  // Show processing overlay when compressing or validating
  const renderProcessingOverlay = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.processingOverlay}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.processingTitle}>Processing Recording</Text>
          <Text style={styles.processingStep}>{processingStep}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
        {/* Header with enhanced info */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Record Statement {statementIndex + 1}</Text>
            <Text style={styles.headerSubtitle}>
              {existingMedia?.url ? 'Re-record' : 'New recording'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Camera Recorder */}
        <MobileCameraRecorder
          statementIndex={statementIndex}
          onRecordingComplete={handleRecordingComplete}
          onError={handleRecordingError}
          onCancel={handleCancel}
        />

        {/* Processing Overlay */}
        {renderProcessingOverlay()}

        {/* Recording Status Indicator */}
        {recordingState?.isRecording && (
          <View style={styles.recordingStatusBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingStatusText}>
              Recording Statement {statementIndex + 1}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerSpacer: {
    width: 80,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 250,
    maxWidth: screenWidth - 40,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  processingStep: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  recordingStatusBar: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  recordingStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});