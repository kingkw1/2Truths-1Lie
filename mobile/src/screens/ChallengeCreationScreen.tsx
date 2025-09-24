import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startNewChallenge,
  setLieStatement,
  validateChallenge,
  startSubmission,
  completeSubmission,
  enterPreviewMode,
  exitPreviewMode,
} from '../store/slices/challengeCreationSlice';
import { MobileCameraRecorder } from '../components/MobileCameraRecorder';
import { EnhancedMobileCameraIntegration } from '../components/EnhancedMobileCameraIntegration';
import { FullscreenLieSelectionScreen } from './FullscreenLieSelectionScreen';
import { MediaCapture } from '../types';
import { realChallengeAPI } from '../services/realChallengeAPI';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { errorHandlingService } from '../services/errorHandlingService';
import { useErrorHandling } from '../hooks/useErrorHandling';
import { AuthStatusBanner } from '../components/ProtectedScreen';
import { useAuth } from '../hooks/useAuth';

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

interface ChallengeCreationScreenProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const ChallengeCreationScreen: React.FC<ChallengeCreationScreenProps> = ({
  onComplete,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const {
    currentChallenge,
    validationErrors,
    isSubmitting,
    submissionSuccess,
    previewMode,
    mediaRecordingState,
    individualRecordings,
  } = useAppSelector((state) => state.challengeCreation);

  const [currentStep, setCurrentStep] = useState<'instructions' | 'recording' | 'fullscreen-lie-selection'>('instructions');
  const [currentStatementIndex, setCurrentStatementIndex] = useState(0);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  const [isMergingVideos, setIsMergingVideos] = useState(false);
  const [isRetakeMode, setIsRetakeMode] = useState(false); // Track if we're retaking vs initial recording

  // Enhanced error handling for challenge creation
  const { error: creationError, handleError: handleCreationError, clearError: clearCreationError } = useErrorHandling(
    undefined,
    {
      showAlert: true,
      onError: (errorDetails) => {
        console.error('🚨 CHALLENGE CREATION ERROR:', errorDetails);
        dispatch(completeSubmission({ success: false }));
      }
    }
  );

  // Initialize new challenge and mobile media integration on mount
  useEffect(() => {
    dispatch(startNewChallenge());

    // Initialize mobile media integration with Redux dispatch
    mobileMediaIntegration.initialize(dispatch).catch(error => {
      console.error('Failed to initialize mobile media integration:', error);
    });
  }, [dispatch]);

  // Handle submission success
  useEffect(() => {
    if (submissionSuccess) {
      // Add a small delay to let users see the loading indicator complete
      // then automatically navigate back to home screen
      const navigationTimeout = setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1500); // 1.5 second delay to show completion

      return () => clearTimeout(navigationTimeout);
    }
  }, [submissionSuccess, onComplete]);

  // REMOVED: Video merging functionality
  // The app now works with individual videos only, removing client-side merging

  // Monitor individual recordings and trigger merging when all are complete
  useEffect(() => {
    // REMOVED: Automatic video merging after recording
    // Video merging should only happen during preview/submit, not immediately after recording
    // This allows users to review their recordings and select the lie first
  }, [individualRecordings, currentStep]);

  const handleStartRecording = () => {
    setCurrentStep('recording');
    setCurrentStatementIndex(0);
    setIsRetakeMode(false); // Ensure we're not in retake mode for initial recording
    setShowCameraModal(true);
  };

  const handleRecordingComplete = (media: MediaCapture) => {
    console.log('🎬 RECORDING_COMPLETE: Recording completed for statement', currentStatementIndex + 1);
    console.log('🎬 RECORDING_COMPLETE: Media:', JSON.stringify(media, null, 2));
    console.log('🎬 RECORDING_COMPLETE: Is retake mode:', isRetakeMode);

    if (isRetakeMode) {
      // If we're retaking a statement, close modal and return to fullscreen lie selection
      console.log('🎬 RECORDING_COMPLETE: Retake complete, returning to fullscreen lie selection');
      setShowCameraModal(false);
      setIsRetakeMode(false); // Reset retake mode
      setCurrentStep('fullscreen-lie-selection');
    } else {
      // Initial recording flow - move to next statement or lie selection
      if (currentStatementIndex < 2) {
        console.log('🎬 RECORDING_COMPLETE: Moving to next statement', currentStatementIndex + 2);
        // Keep camera modal open and just change statement index for seamless transition
        setCurrentStatementIndex(currentStatementIndex + 1);
        // Note: Camera modal stays open, no delay needed
      } else {
        console.log('🎬 RECORDING_COMPLETE: All recordings complete, moving to fullscreen lie selection');
        // All recordings complete, close modal and move to fullscreen lie selection step
        setShowCameraModal(false);
        // Do NOT trigger video merging yet - wait until preview/submit
        setCurrentStep('fullscreen-lie-selection');
      }
    }
  };

  // REMOVED: checkAndTriggerVideoMerging function
  // Video merging should only happen during preview/submit, not automatically after recording



  const handleRecordingError = (error: string) => {
    // Enhanced error handling with more user-friendly messages
    let title = 'Recording Error';
    let message = error;

    // Categorize errors for better user experience
    if (error.includes('permission')) {
      title = 'Permission Required';
      message = 'Camera access is needed to record your video statements. Please check your device settings.';
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: async () => {
            console.log('Opening device settings for permissions');
            await openAppSettings();
          }
        }
      ]);
    } else if (error.includes('storage') || error.includes('space')) {
      title = 'Storage Full';
      message = 'Not enough storage space to record video. Please free up some space and try again.';
      Alert.alert(title, message, [{ text: 'OK', style: 'default' }]);
    } else if (error.includes('hardware') || error.includes('camera')) {
      title = 'Camera Unavailable';
      message = 'Camera is currently unavailable. Please restart the app and try again.';
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          onPress: () => {
            // Retry recording
            setShowCameraModal(true);
          }
        }
      ]);
    } else {
      Alert.alert(title, message, [{ text: 'OK', style: 'default' }]);
    }
  };

  const handleLieSelection = (index: number) => {
    console.log('🎯 LIE_SELECTION: Lie selected at index:', index);
    setSelectedLieIndex(index);
    dispatch(setLieStatement(index));
  };

  const handlePreview = () => {
    console.log('🎯 PREVIEW: Attempting to enter preview mode...');
    console.log('🎯 PREVIEW: Current validation errors:', validationErrors);
    console.log('🎯 PREVIEW: Current challenge state:', JSON.stringify(currentChallenge, null, 2));

    dispatch(validateChallenge());
    if (validationErrors.length === 0) {
      console.log('✅ PREVIEW: Validation passed, staying in fullscreen interface');
      // No longer navigate to separate preview - stay in fullscreen interface
    } else {
      console.log('❌ PREVIEW: Validation failed:', validationErrors);
      Alert.alert(
        'Validation Error',
        validationErrors.join('\n'),
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handleSubmit = async () => {
    console.log('🚨🚨🚨 SUBMIT BUTTON PRESSED! 🚨🚨🚨');
    console.log('🚨 This should definitely appear in logs if button is working');
    console.log('🚨 Time:', new Date().toISOString());
    console.log('🚨 Platform:', Platform.OS);

    try {
      console.log('🎯 CHALLENGE: Starting challenge submission...');
      console.log('🎯 CHALLENGE: Current step:', currentStep);
      console.log('🎯 CHALLENGE: Challenge statements count:', currentChallenge?.statements?.length);
      console.log('🎯 CHALLENGE: Challenge has lie selected:', currentChallenge?.statements?.some(s => s.isLie));

      dispatch(startSubmission());

      console.log('🎯 CHALLENGE: Using currentChallenge from component state');

      // Validate we have all required data
      if (!currentChallenge?.statements || currentChallenge.statements.length !== 3) {
        console.error('❌ SUBMIT: Invalid statements count:', currentChallenge?.statements?.length);
        throw new Error('Challenge must have exactly 3 statements');
      }

      // Find which statement is marked as the lie
      const lieStatementIndex = currentChallenge.statements.findIndex(stmt => stmt.isLie);
      console.log('🎯 SUBMIT: Looking for lie statement...');
      console.log('🎯 SUBMIT: Statement analysis:');
      currentChallenge.statements.forEach((stmt, idx) => {
        console.log(`  Statement ${idx}: isLie=${stmt.isLie}, text="${stmt.text}"`);
      });
      console.log('🎯 SUBMIT: lieStatementIndex:', lieStatementIndex);

      if (lieStatementIndex === -1) {
        console.error('❌ SUBMIT: No lie statement found');
        throw new Error('You must select which statement is the lie');
      }

      console.log('🎯 SUBMIT: Checking individual video recordings...');
      console.log('🎯 SUBMIT: Has individualRecordings:', !!individualRecordings);

      // Check if we have all individual recordings
      const hasIndividualRecordings = individualRecordings &&
        [0, 1, 2].every(index =>
          individualRecordings[index] &&
          individualRecordings[index]?.type === 'video' &&
          individualRecordings[index]?.url
        );

      console.log('🎯 SUBMIT: hasIndividualRecordings:', hasIndividualRecordings);

      if (!hasIndividualRecordings) {
        throw new Error('All 3 statements must have video recordings');
      }

      // Check that all individual videos are recorded (they will be uploaded during merge)
      const missingRecordings = [0, 1, 2].filter(index => {
        const media = individualRecordings[index];
        console.log(`🎯 SUBMIT: Checking recording ${index}:`, media);
        return !media || !media.url;
      });

      console.log('🎯 SUBMIT: missingRecordings:', missingRecordings);

      if (missingRecordings.length > 0) {
        throw new Error(`Videos for statement${missingRecordings.length > 1 ? 's' : ''} ${missingRecordings.map(i => i + 1).join(', ')} must be recorded before creating the challenge.`);
      }

      console.log('🎯 SUBMIT: Uploading videos for server-side merging...');

      // Upload all three videos for server-side merging
      // Filter out null values to match expected type
      const validRecordings: { [key: number]: MediaCapture } = {};
      Object.entries(individualRecordings).forEach(([key, value]) => {
        if (value !== null) {
          validRecordings[parseInt(key, 10)] = value;
        }
      });
      const mergeResult = await mobileMediaIntegration.uploadVideosForMerging(validRecordings);

      if (!mergeResult.success) {
        throw new Error(mergeResult.error || 'Failed to upload videos for merging');
      }

      // Ensure we have a proper server URL, not a local file path
      if (!mergeResult.mergedVideoUrl || mergeResult.mergedVideoUrl.startsWith('file://')) {
        throw new Error('Server did not return a valid merged video URL. Please try again.');
      }

      console.log('✅ SUBMIT: Videos uploaded and merged successfully');
      console.log('✅ SUBMIT: Merged video URL:', mergeResult.mergedVideoUrl);
      console.log('✅ SUBMIT: Segment metadata:', mergeResult.segmentMetadata);

      // Prepare the challenge request with merged video data
      const challengeRequest = {
        statements: currentChallenge.statements.map((statement, index) => {
          const segmentData = mergeResult.segmentMetadata?.find(s => s.statementIndex === index);
          return {
            text: statement.text || `Statement ${index + 1}`,
            media_file_id: mergeResult.mergedVideoUrl || '', // Use merged video URL as media file ID
            segment_start_time: segmentData?.startTime ? segmentData.startTime / 1000 : undefined, // Convert to seconds
            segment_end_time: segmentData?.endTime ? segmentData.endTime / 1000 : undefined, // Convert to seconds
            segment_duration: segmentData ? (segmentData.endTime - segmentData.startTime) / 1000 : undefined, // Convert to seconds
          };
        }),
        lie_statement_index: lieStatementIndex,
        tags: ['mobile-game', '2truths1lie'],
        is_merged_video: true,
        // Server-side merged video fields
        merged_video_url: mergeResult.mergedVideoUrl,
        merged_video_file_id: mergeResult.mergedVideoUrl, // Use URL as file ID for now
        merge_session_id: mergeResult.mergeSessionId,
        merged_video_metadata: mergeResult.segmentMetadata ? {
          total_duration: mergeResult.segmentMetadata.reduce((total, segment) =>
            total + (segment.endTime - segment.startTime), 0) / 1000, // Convert from milliseconds to seconds
          segments: mergeResult.segmentMetadata.map(segment => ({
            statement_index: segment.statementIndex,
            start_time: segment.startTime / 1000, // Convert from milliseconds to seconds
            end_time: segment.endTime / 1000, // Convert from milliseconds to seconds
            duration: (segment.endTime - segment.startTime) / 1000, // Convert from milliseconds to seconds
          })),
          video_file_id: mergeResult.mergedVideoUrl || '',
          compression_applied: true, // Assume compression was applied during merge
          original_total_duration: mergeResult.segmentMetadata.reduce((total, segment) =>
            total + (segment.endTime - segment.startTime), 0) / 1000, // Convert from milliseconds to seconds
        } : undefined,
      };

      console.log('🎯 CHALLENGE: Submitting request with merged video');
      console.log('🎯 CHALLENGE: Request is_merged_video:', challengeRequest.is_merged_video);
      console.log('🎯 CHALLENGE: Request size (chars):', JSON.stringify(challengeRequest).length);
      console.log('🔍 DEBUG: Full segment metadata being sent:');
      if (challengeRequest.merged_video_metadata?.segments) {
        challengeRequest.merged_video_metadata.segments.forEach((seg, i) => {
          console.log(`🔍 DEBUG: Segment ${i}: start_time=${seg.start_time}, end_time=${seg.end_time}, duration=${seg.duration}`);
        });
      }
      console.log('🎯 CHALLENGE: About to call realChallengeAPI.createChallenge...');

      // Submit to backend
      const response = await realChallengeAPI.createChallenge(challengeRequest);

      console.log('🎯 CHALLENGE: Got response from API');
      console.log('🎯 CHALLENGE: Response success:', response.success);
      console.log('🎯 CHALLENGE: Response data:', response.data);
      console.log('🎯 CHALLENGE: Response error:', response.error);

      if (response.success && response.data) {
        console.log('✅ CHALLENGE: Successfully created challenge:', response.data.id || response.data.challenge_id);
        console.log('✅ CHALLENGE: Response success confirmed');
        dispatch(completeSubmission({ success: true }));

        // Removed debugging "Challenge Created" pop-up that shows technical details like challenge ID
        // The user-friendly alert is shown in GameScreen.tsx onComplete callback
        // Alert.alert(
        //   '🎉 Challenge Created!',
        //   `Your challenge "${response.data.id}" has been created successfully! Other players can now guess which statement is the lie.`,
        //   [
        //     {
        //       text: 'Create Another',
        //       onPress: () => {
        //         console.log('🔄 USER: Creating another challenge');
        //         dispatch(startNewChallenge());
        //         setCurrentStep('instructions');
        //       }
        //     },
        //     {
        //       text: 'Done',
        //       style: 'cancel',
        //       onPress: () => {
        //         console.log('✅ USER: Done creating challenges');
        //         // Navigate back or to challenges list
        //         // navigation.goBack();
        //       }
        //     }
        //   ]
        // );
      } else {
        console.error('❌ CHALLENGE: API returned unsuccessful response');
        console.error('❌ CHALLENGE: Error details:', response.error);
        throw new Error(response.error || 'Failed to create challenge');
      }

    } catch (error: any) {
      console.error('🚨🚨🚨 SUBMIT ERROR CAUGHT! 🚨🚨🚨');
      console.error('🚨 Error type:', typeof error);
      console.error('🚨 Error name:', error?.name || 'Unknown');
      console.error('🚨 Error message:', error?.message || 'No message');
      console.error('🚨 Error occurred during challenge submission');

      handleCreationError(error, 'ChallengeCreationScreen.submitChallenge');
    }
  };

  const handleRetakeVideo = (statementIndex: number) => {
    console.log('🎬 RETAKE: Starting retake for statement', statementIndex + 1);
    setCurrentStatementIndex(statementIndex);
    setIsRetakeMode(true); // Mark that we're in retake mode
    setShowCameraModal(true);
  };

  const handleCameraCancel = () => {
    console.log('🎬 CAMERA_CANCEL: Camera cancelled, isRetakeMode:', isRetakeMode);
    setShowCameraModal(false);
    
    if (isRetakeMode) {
      // If we were retaking, reset retake mode and go back to fullscreen interface
      setIsRetakeMode(false);
      setCurrentStep('fullscreen-lie-selection');
    }
    // If not retake mode, stay in current step (recording flow continues normally)
  };

  const renderInstructions = () => (
    <ScrollView 
      style={styles.stepContainer}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <Text style={styles.stepTitle}>Create Your Challenge</Text>
      <Text style={styles.stepDescription}>
        You'll record 3 video statements about yourself. Two should be true, and one should be a lie.
        Other players will try to guess which statement is the lie!
      </Text>

      <View style={styles.rateLimitContainer}>
        <Text style={styles.rateLimitText}>
          ⏰ Rate Limit: You can create up to 5 challenges per hour
        </Text>
      </View>

      <View style={styles.instructionsList}>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1</Text>
          <Text style={styles.instructionText}>
            Record 3 video statements (each 10-60 seconds)
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2</Text>
          <Text style={styles.instructionText}>
            Select which statement is the lie and submit
          </Text>
        </View>
      </View>

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Tips for Great Challenges:</Text>
        <Text style={styles.tipText}>• Make your lie believable but not obvious</Text>
        <Text style={styles.tipText}>• Keep statements interesting and personal</Text>
        <Text style={styles.tipText}>• Speak clearly and maintain good lighting</Text>
        <Text style={styles.tipText}>• Have fun with it!</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleStartRecording}
      >
        <Text style={styles.primaryButtonText}>Start Recording</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLieSelection = () => {
    // Check if we have all individual recordings (local files are fine for lie selection)
    const hasAllIndividualRecordings = individualRecordings &&
      [0, 1, 2].every(index =>
        individualRecordings[index] &&
        individualRecordings[index]?.type === 'video' &&
        individualRecordings[index]?.url
      );

    const hasAllRecordings = hasAllIndividualRecordings;

    // Only log when there's a state change we care about
    if (selectedLieIndex !== null) {
      console.log('🎯 LIE_SELECTION: Lie selected:', selectedLieIndex);
    }

    return (
      <ScrollView 
        style={styles.stepContainer}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Text style={styles.stepTitle}>Select the Lie</Text>
        <Text style={styles.stepDescription}>
          Which of your three statements is the lie? Choose carefully!
        </Text>

        {hasAllRecordings ? (
          <View style={styles.statementsContainer}>
            {[0, 1, 2].map((index) => {
              // Get media info from individual recordings
              let media = individualRecordings?.[index];
              let duration = media?.duration;

              const isSelected = selectedLieIndex === index;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.statementCard,
                    isSelected && styles.selectedStatementCard,
                  ]}
                  onPress={() => handleLieSelection(index)}
                >
                  <View style={styles.statementHeader}>
                    <Text style={styles.statementNumber}>Statement {index + 1}</Text>
                    <TouchableOpacity
                      style={styles.retakeButton}
                      onPress={() => handleRetakeVideo(index)}
                    >
                      <Text style={styles.retakeButtonText}>Retake</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoPlaceholderText}>
                      📹 Video Recorded
                    </Text>
                    <Text style={styles.videoDuration}>
                      {duration ? `${Math.round(duration / 1000)}s` : ''}
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.lieIndicator}>
                      <Text style={styles.lieIndicatorText}>🤥 This is the lie</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.incompleteContainer}>
            <Text style={styles.incompleteText}>
              Please complete all video recordings first.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setCurrentStep('recording');
                setShowCameraModal(true);
              }}
            >
              <Text style={styles.secondaryButtonText}>Continue Recording</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasAllRecordings && selectedLieIndex !== null && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePreview}
          >
            <Text style={styles.primaryButtonText}>Preview Challenge</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const renderPreview = () => (
    <ScrollView 
      style={styles.stepContainer}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <Text style={styles.stepTitle}>Preview Your Challenge</Text>
      <Text style={styles.stepDescription}>
        Review your challenge before submitting. Other players will see this.
      </Text>

      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Your Challenge</Text>

        {[0, 1, 2].map((index) => {
          // Get media info from individual recordings
          let media = individualRecordings?.[index];
          let duration = media?.duration;

          const isLie = currentChallenge.statements?.[index]?.isLie;

          return (
            <View key={index} style={styles.previewStatementCard}>
              <View style={styles.previewStatementHeader}>
                <Text style={styles.previewStatementNumber}>
                  Statement {index + 1}
                </Text>
                {isLie && (
                  <Text style={styles.previewLieTag}>(The Lie)</Text>
                )}
              </View>

              <View style={styles.previewVideoPlaceholder}>
                <Text style={styles.previewVideoText}>
                  📹 Video Statement
                </Text>
                <Text style={styles.previewVideoDuration}>
                  {duration ? `${Math.round(duration / 1000)}s` : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.previewActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, isSubmitting && styles.disabledButton]}
          disabled={isSubmitting}
          onPress={() => {
            dispatch(exitPreviewMode());
            setCurrentStep('fullscreen-lie-selection');
          }}
        >
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
          disabled={isSubmitting}
          onPress={() => {
            console.log('🎯 BUTTON: Submit button pressed!');
            console.log('🎯 BUTTON: isSubmitting:', isSubmitting);
            console.log('🎯 BUTTON: currentChallenge:', JSON.stringify(currentChallenge, null, 2));
            handleSubmit();
          }}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Creating Challenge...' : 'Create Challenge (Debug)'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  /**
   * Render the new fullscreen lie selection interface
   * This replaces both the lie selection and preview screens
   */
  const renderFullscreenLieSelection = () => {
    // Check if we have all individual recordings
    const hasAllIndividualRecordings = individualRecordings &&
      [0, 1, 2].every(index =>
        individualRecordings[index] &&
        individualRecordings[index]?.type === 'video' &&
        individualRecordings[index]?.url
      );

    if (!hasAllIndividualRecordings) {
      // Fallback to traditional interface if recordings are missing
      return (
        <View style={styles.incompleteContainer}>
          <Text style={styles.incompleteText}>
            Please complete all video recordings first.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setCurrentStep('recording');
              setShowCameraModal(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>Continue Recording</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FullscreenLieSelectionScreen
        individualRecordings={individualRecordings}
        onBack={() => setCurrentStep('instructions')}
        onRetake={(statementIndex: number) => {
          handleRetakeVideo(statementIndex);
        }}
        onSubmit={handleSubmit}
      />
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'instructions':
        return renderInstructions();
      case 'fullscreen-lie-selection':
        return renderFullscreenLieSelection();
      default:
        return renderInstructions();
    }
  };

  return (
    <>
      {currentStep === 'fullscreen-lie-selection' ? (
        // Render fullscreen interface without container wrapping
        renderFullscreenLieSelection()
      ) : (
        // Render traditional interface with header and container
        <SafeAreaView style={styles.container}>
          <AuthStatusBanner
            showForGuests={true}
            guestMessage="Sign in to save your challenges and track your creations"
            onAuthAction={() => {
              // Navigate back to trigger auth flow
              if (onCancel) onCancel();
            }}
          />
          
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Challenge</Text>
            <View style={styles.headerSpacer} />
          </View>

          {renderCurrentStep()}
        </SafeAreaView>
      )}

      {/* Enhanced Camera Recording Integration */}
      <EnhancedMobileCameraIntegration
        statementIndex={currentStatementIndex}
        isVisible={showCameraModal}
        onComplete={handleRecordingComplete}
        onCancel={handleCameraCancel}
        onError={handleRecordingError}
      />

      {/* Video Merging Loading Overlay */}
      {isMergingVideos && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingTitle}>🎬 Processing Videos</Text>
            <Text style={styles.loadingSubtitle}>Merging your video statements...</Text>
          </View>
        </View>
      )}

      {/* Challenge Submission Loading Overlay */}
      {(isSubmitting || submissionSuccess) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            {!submissionSuccess ? (
              <>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingTitle}>🚀 Creating Challenge</Text>
                <Text style={styles.loadingSubtitle}>Finalizing your challenge...</Text>
              </>
            ) : (
              <>
                <Text style={[styles.loadingTitle, { color: '#34C759' }]}>✅ Challenge Created!</Text>
                <Text style={styles.loadingSubtitle}>Your challenge is ready to play!</Text>
              </>
            )}
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#4a90e2',
  },
  cancelButton: {
    fontSize: 16,
    color: 'white',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSpacer: {
    width: 60,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  scrollContentContainer: {
    paddingBottom: Platform.OS === 'android' ? 100 : 50, // Extra bottom padding for Android navigation bar
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  rateLimitContainer: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  rateLimitText: {
    fontSize: 14,
    color: '#e65100',
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionsList: {
    marginBottom: 30,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  instructionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4a90e2',
    color: 'white',
    textAlign: 'center',
    lineHeight: 30,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  tipsContainer: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#388e3c',
    marginBottom: 5,
  },
  statementsContainer: {
    marginBottom: 30,
  },
  statementCard: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedStatementCard: {
    borderColor: '#4a90e2',
    backgroundColor: '#e3f2fd',
  },
  statementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statementNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  retakeButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  videoPlaceholder: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  videoPlaceholderText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  videoDuration: {
    fontSize: 14,
    color: '#999',
  },
  lieIndicator: {
    backgroundColor: '#ffeb3b',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  lieIndicatorText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f57f17',
  },
  incompleteContainer: {
    alignItems: 'center',
    padding: 40,
  },
  incompleteText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  previewContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewStatementCard: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewStatementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewStatementNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  previewLieTag: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: 'bold',
  },
  previewVideoPlaceholder: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 6,
    alignItems: 'center',
  },
  previewVideoText: {
    fontSize: 14,
    color: '#666',
  },
  previewVideoDuration: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  loadingOverlay: {
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
  loadingContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 300,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },

});