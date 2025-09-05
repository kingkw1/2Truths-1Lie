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
import { MediaCapture } from '../types';
import { realChallengeAPI } from '../services/realChallengeAPI';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { errorHandlingService } from '../services/errorHandlingService';
import { useErrorHandling } from '../hooks/useErrorHandling';

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
    mergedVideo,
  } = useAppSelector((state) => state.challengeCreation);

  const [currentStep, setCurrentStep] = useState<'instructions' | 'recording' | 'lie-selection' | 'preview'>('instructions');
  const [currentStatementIndex, setCurrentStatementIndex] = useState(0);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  const [isMergingVideos, setIsMergingVideos] = useState(false);

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
      Alert.alert(
        'Challenge Created!',
        'Your challenge has been created successfully and is ready for others to play.',
        [
          {
            text: 'Create Another',
            onPress: () => {
              dispatch(startNewChallenge());
              setCurrentStep('instructions');
              setCurrentStatementIndex(0);
              setSelectedLieIndex(null);
            },
          },
          {
            text: 'Done',
            onPress: onComplete,
            style: 'default',
          },
        ]
      );
    }
  }, [submissionSuccess, onComplete, dispatch]);

  // Define video merging function with useCallback to avoid dependency issues
  const handleVideoMerging = React.useCallback(async () => {
    console.log('🎬 Starting video merging process...');
    console.log('🎬 Individual recordings:', JSON.stringify(individualRecordings, null, 2));

    try {
      // Check if we have all three individual recordings
      const hasAllRecordings = [0, 1, 2].every(index =>
        individualRecordings[index] &&
        individualRecordings[index]?.type === 'video' &&
        individualRecordings[index]?.url
      );

      if (!hasAllRecordings) {
        console.log('❌ Not all recordings are available for merging');
        setCurrentStep('lie-selection');
        return;
      }

      console.log('✅ All recordings available, starting merge...');

      // Set loading state instead of showing blocking alert
      setIsMergingVideos(true);

      // Trigger the video merging - filter out null values
      const validRecordings = {
        0: individualRecordings[0]!,
        1: individualRecordings[1]!,
        2: individualRecordings[2]!,
      };
      // Merge videos WITHOUT upload (upload happens on submit)
      await mobileMediaIntegration.mergeStatementVideosWithoutUpload(validRecordings);

      console.log('✅ Video merging completed successfully');

      // Clear loading state and proceed to lie selection
      setIsMergingVideos(false);
      setCurrentStep('lie-selection');

    } catch (error: any) {
      console.error('❌ Video merging failed:', error);
      setIsMergingVideos(false);
      Alert.alert(
        'Merge Failed',
        error.message || 'Failed to merge videos. You can still proceed with individual recordings.',
        [{ text: 'Continue', onPress: () => setCurrentStep('lie-selection') }]
      );
    }
  }, [individualRecordings, dispatch]);

  // Monitor individual recordings and trigger merging when all are complete
  useEffect(() => {
    console.log('🎬 EFFECT: individualRecordings changed:', JSON.stringify(individualRecordings, null, 2));
    console.log('🎬 EFFECT: mergedVideo:', JSON.stringify(mergedVideo, null, 2));
    console.log('🎬 EFFECT: currentStep:', currentStep);

    // Only trigger merging if we're in recording step and have all recordings but no merged video
    if (currentStep === 'recording') {
      const hasAllIndividualRecordings = individualRecordings &&
        [0, 1, 2].every(index =>
          individualRecordings[index] &&
          individualRecordings[index]?.type === 'video' &&
          individualRecordings[index]?.url
        );

      const hasMergedVideo = mergedVideo && mergedVideo.isMergedVideo;

      if (hasAllIndividualRecordings && !hasMergedVideo) {
        console.log('🎬 EFFECT: All recordings complete, triggering video merging...');
        // Small delay to ensure all state updates are complete
        setTimeout(() => {
          handleVideoMerging();
        }, 100);
      }
    }
  }, [individualRecordings, mergedVideo, currentStep, handleVideoMerging]);

  const handleStartRecording = () => {
    setCurrentStep('recording');
    setCurrentStatementIndex(0);
    setShowCameraModal(true);
  };

  const handleRecordingComplete = (media: MediaCapture) => {
    console.log('🎬 RECORDING_COMPLETE: Recording completed for statement', currentStatementIndex + 1);
    console.log('🎬 RECORDING_COMPLETE: Media:', JSON.stringify(media, null, 2));

    setShowCameraModal(false);

    // Move to next statement or lie selection
    if (currentStatementIndex < 2) {
      console.log('🎬 RECORDING_COMPLETE: Moving to next statement', currentStatementIndex + 2);
      setCurrentStatementIndex(currentStatementIndex + 1);
      // Small delay before showing next camera to allow user to process success
      setTimeout(() => {
        setShowCameraModal(true);
      }, 500);
    } else {
      console.log('🎬 RECORDING_COMPLETE: All recordings complete, checking for video merging...');
      // All recordings complete, check if we need to trigger video merging
      // Use a small delay to ensure Redux state is updated
      setTimeout(() => {
        checkAndTriggerVideoMerging();
      }, 1000);
    }
  };

  const checkAndTriggerVideoMerging = React.useCallback(() => {
    console.log('🎬 CHECK_MERGE: Checking if video merging is needed...');
    console.log('🎬 CHECK_MERGE: Current individualRecordings:', JSON.stringify(individualRecordings, null, 2));
    console.log('🎬 CHECK_MERGE: Current mergedVideo:', JSON.stringify(mergedVideo, null, 2));

    // Check if we have all individual recordings but no merged video
    const hasAllIndividualRecordings = individualRecordings &&
      [0, 1, 2].every(index =>
        individualRecordings[index] &&
        individualRecordings[index]?.type === 'video' &&
        individualRecordings[index]?.url
      );

    const hasMergedVideo = mergedVideo && mergedVideo.isMergedVideo;

    if (hasAllIndividualRecordings && !hasMergedVideo) {
      console.log('🎬 CHECK_MERGE: All recordings complete, triggering video merging...');
      handleVideoMerging();
    }
  }, [individualRecordings, mergedVideo, handleVideoMerging]);



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
      console.log('✅ PREVIEW: Validation passed, entering preview mode');
      dispatch(enterPreviewMode());
      setCurrentStep('preview');
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

      console.log('🎯 SUBMIT: Checking video upload status...');
      console.log('🎯 SUBMIT: Has mergedVideo:', !!mergedVideo);
      console.log('🎯 SUBMIT: mergedVideo isMergedVideo:', mergedVideo?.isMergedVideo);
      console.log('🎯 SUBMIT: mergedVideo segments count:', mergedVideo?.segments?.length);
      console.log('🎯 SUBMIT: Has individualRecordings:', !!individualRecordings);

      const hasMergedVideo = mergedVideo && mergedVideo.isMergedVideo && mergedVideo.segments && mergedVideo.segments.length === 3;
      const hasIndividualRecordings = individualRecordings &&
        [0, 1, 2].every(index =>
          individualRecordings[index] &&
          individualRecordings[index]?.type === 'video' &&
          individualRecordings[index]?.url
        );

      console.log('🎯 SUBMIT: hasMergedVideo:', hasMergedVideo);
      console.log('🎯 SUBMIT: hasIndividualRecordings:', hasIndividualRecordings);

      // Debug alert to show current state
      Alert.alert(
        'Debug: Video State',
        `Merged Video: ${hasMergedVideo ? 'YES' : 'NO'}\n` +
        `Individual Recordings: ${hasIndividualRecordings ? 'YES' : 'NO'}\n` +
        `Merged Video Uploaded: ${mergedVideo?.isUploaded ? 'YES' : 'NO'}\n` +
        `Merged Video MediaID: ${mergedVideo?.mediaId || 'NONE'}\n` +
        `Individual Recordings Count: ${individualRecordings ? Object.keys(individualRecordings).length : 0}`,
        [{ text: 'Continue', onPress: () => { } }]
      );

      if (!hasMergedVideo && !hasIndividualRecordings) {
        throw new Error('All 3 statements must have video recordings');
      }

      // Use a let variable to allow reassignment after upload
      let currentMergedVideo = mergedVideo;

      // For merged video, upload it now if not already uploaded
      if (hasMergedVideo && currentMergedVideo) {
        console.log('🎯 SUBMIT: Using merged video path');
        console.log('🎯 SUBMIT: mergedVideo.mediaId:', currentMergedVideo.mediaId);
        console.log('🎯 SUBMIT: mergedVideo.isUploaded:', currentMergedVideo.isUploaded);

        // Upload merged video if not already uploaded
        if (!currentMergedVideo.isUploaded) {
          console.log('🎯 SUBMIT: Uploading merged video now...');
          
          // Show processing dialog
          Alert.alert(
            'Uploading Video',
            'Please wait while we upload your merged video...',
            [],
            { cancelable: false }
          );

          try {
            const uploadedMergedVideo = await mobileMediaIntegration.uploadMergedVideoForSubmission(currentMergedVideo);
            console.log('✅ SUBMIT: Merged video uploaded successfully:', uploadedMergedVideo.mediaId);
            
            // Use the returned uploaded video object directly
            currentMergedVideo = uploadedMergedVideo;
            console.log('🎯 SUBMIT: Updated currentMergedVideo after upload:', {
              mediaId: currentMergedVideo?.mediaId,
              isUploaded: currentMergedVideo?.isUploaded
            });
          } catch (uploadError: any) {
            console.error('❌ SUBMIT: Failed to upload merged video:', uploadError);
            throw new Error(`Failed to upload video: ${uploadError.message}`);
          }
        }

        // Re-check upload status after upload (now using updated state)
        if (!currentMergedVideo.mediaId || !currentMergedVideo.isUploaded) {
          console.error('❌ SUBMIT: Upload validation failed after upload attempt');
          console.error('❌ SUBMIT: currentMergedVideo.mediaId:', currentMergedVideo.mediaId);
          console.error('❌ SUBMIT: currentMergedVideo.isUploaded:', currentMergedVideo.isUploaded);
          throw new Error('Merged video must be uploaded before creating the challenge. Please wait for upload to complete.');
        }
      }
 else {
        console.log('🎯 SUBMIT: Using individual recordings path');
        // For individual recordings, check that all are uploaded
        const missingUploads = [0, 1, 2].filter(index => {
          const media = individualRecordings[index];
          console.log(`🎯 SUBMIT: Checking recording ${index}:`, media);
          return !media || !media.mediaId || !media.isUploaded;
        });

        console.log('🎯 SUBMIT: missingUploads:', missingUploads);

        if (missingUploads.length > 0) {
          throw new Error(`Videos for statement${missingUploads.length > 1 ? 's' : ''} ${missingUploads.map(i => i + 1).join(', ')} must be uploaded before creating the challenge.`);
        }
      }

      // Prepare the challenge request for the backend
      let challengeRequest;

      if (hasMergedVideo && currentMergedVideo) {
        console.log('🎯 SUBMIT: Preparing merged video challenge request');
        console.log('🎯 SUBMIT: Merged video segments count:', currentMergedVideo.segments?.length);

        // For merged video, all statements use the same media file ID with segment metadata
        challengeRequest = {
          statements: currentChallenge.statements.map((statement, index) => {
            const segment = currentMergedVideo.segments!.find(s => s.statementIndex === index);
            if (!segment) {
              throw new Error(`Missing segment data for statement ${index + 1}`);
            }

            return {
              text: statement.text || `Statement ${index + 1}`, // Use statement text or default
              media_file_id: currentMergedVideo.mediaId!,
              // Include segment metadata for merged videos (convert to seconds)
              segment_start_time: segment.startTime / 1000,
              segment_end_time: segment.endTime / 1000,
              segment_duration: segment.duration / 1000,
            };
          }),
          lie_statement_index: lieStatementIndex,
          tags: ['mobile-game', '2truths1lie', 'merged-video'], // Include merged-video tag
          is_merged_video: true,
          merged_video_metadata: {
            total_duration_ms: currentMergedVideo.duration || 0,
            segment_count: currentMergedVideo.segments!.length,
            segments: currentMergedVideo.segments!.map(segment => ({
              statement_index: segment.statementIndex,
              start_time_ms: segment.startTime,
              end_time_ms: segment.endTime,
              duration_ms: segment.duration,
            })),
          },
        };
      } else {
        console.log('🎯 SUBMIT: Preparing individual recordings challenge request');

        // For individual recordings, each statement has its own media file ID
        challengeRequest = {
          statements: currentChallenge.statements.map((statement, index) => ({
            text: statement.text || `Statement ${index + 1}`, // Use statement text or default
            media_file_id: individualRecordings[index]!.mediaId!,
          })),
          lie_statement_index: lieStatementIndex,
          tags: ['mobile-game', '2truths1lie'], // Default tags
          is_merged_video: false,
        };
      }

      console.log('🎯 CHALLENGE: Submitting request with', challengeRequest.statements?.length, 'statements');
      console.log('🎯 CHALLENGE: Request is_merged_video:', challengeRequest.is_merged_video);
      console.log('🎯 CHALLENGE: Request size (chars):', JSON.stringify(challengeRequest).length);
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

        Alert.alert(
          '🎉 Challenge Created!',
          `Your challenge "${response.data.id}" has been created successfully! Other players can now guess which statement is the lie.`,
          [
            {
              text: 'Create Another',
              onPress: () => {
                console.log('🔄 USER: Creating another challenge');
                dispatch(startNewChallenge());
                setCurrentStep('instructions');
              }
            },
            {
              text: 'Done',
              style: 'cancel',
              onPress: () => {
                console.log('✅ USER: Done creating challenges');
                // Navigate back or to challenges list
                // navigation.goBack();
              }
            }
          ]
        );
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
    setCurrentStatementIndex(statementIndex);
    setShowCameraModal(true);
  };

  const renderInstructions = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create Your Challenge</Text>
      <Text style={styles.stepDescription}>
        You'll record 3 video statements about yourself. Two should be true, and one should be a lie.
        Other players will try to guess which statement is the lie!
      </Text>

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
            Choose which statement is the lie
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3</Text>
          <Text style={styles.instructionText}>
            Preview and submit your challenge
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
    console.log('🎯 LIE_SELECTION: Rendering lie selection screen');
    console.log('🎯 LIE_SELECTION: individualRecordings:', JSON.stringify(individualRecordings, null, 2));
    console.log('🎯 LIE_SELECTION: mergedVideo:', JSON.stringify(mergedVideo, null, 2));
    console.log('🎯 LIE_SELECTION: currentChallenge.mediaData:', JSON.stringify(currentChallenge.mediaData, null, 2));

    // Check if we have all individual recordings OR a merged video
    const hasAllIndividualRecordings = individualRecordings &&
      [0, 1, 2].every(index =>
        individualRecordings[index] &&
        individualRecordings[index]?.type === 'video' &&
        individualRecordings[index]?.url
      );

    const hasMergedVideo = mergedVideo && mergedVideo.isMergedVideo && mergedVideo.segments && mergedVideo.segments.length === 3;

    const hasAllRecordings = hasAllIndividualRecordings || hasMergedVideo;

    console.log('🎯 LIE_SELECTION: hasAllIndividualRecordings:', hasAllIndividualRecordings);
    console.log('🎯 LIE_SELECTION: hasMergedVideo:', hasMergedVideo);
    console.log('🎯 LIE_SELECTION: hasAllRecordings:', hasAllRecordings);
    console.log('🎯 LIE_SELECTION: selectedLieIndex:', selectedLieIndex);
    console.log('🎯 LIE_SELECTION: Will show preview button:', hasAllRecordings && selectedLieIndex !== null);

    return (
      <ScrollView style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Select the Lie</Text>
        <Text style={styles.stepDescription}>
          Which of your three statements is the lie? Choose carefully!
        </Text>

        {hasAllRecordings ? (
          <View style={styles.statementsContainer}>
            {[0, 1, 2].map((index) => {
              // Get media info from individual recordings or merged video segments
              let media = individualRecordings?.[index];
              let duration = media?.duration;

              // If we have a merged video, get segment info
              if (hasMergedVideo && mergedVideo?.segments) {
                const segment = mergedVideo.segments.find(s => s.statementIndex === index);
                if (segment) {
                  duration = segment.duration;
                }
              }

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
                      {hasMergedVideo ? '📹 Video Merged' : '📹 Video Recorded'}
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
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Preview Your Challenge</Text>
      <Text style={styles.stepDescription}>
        Review your challenge before submitting. Other players will see this.
      </Text>

      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Your Challenge</Text>

        {[0, 1, 2].map((index) => {
          // Get media info from individual recordings or merged video segments
          let media = individualRecordings?.[index];
          let duration = media?.duration;

          // If we have a merged video, get segment info
          if (mergedVideo?.segments) {
            const segment = mergedVideo.segments.find(s => s.statementIndex === index);
            if (segment) {
              duration = segment.duration;
            }
          }

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
                  {mergedVideo ? '📹 Video Statement (Merged)' : '📹 Video Statement'}
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
          style={styles.secondaryButton}
          onPress={() => {
            dispatch(exitPreviewMode());
            setCurrentStep('lie-selection');
          }}
        >
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            console.log('🎯 BUTTON: Submit button pressed!');
            console.log('🎯 BUTTON: isSubmitting:', isSubmitting);
            console.log('🎯 BUTTON: currentChallenge:', JSON.stringify(currentChallenge, null, 2));
            handleSubmit();
          }}
        >
          <Text style={styles.primaryButtonText}>
            Create Challenge (Debug)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'instructions':
        return renderInstructions();
      case 'lie-selection':
        return renderLieSelection();
      case 'preview':
        return renderPreview();
      default:
        return renderInstructions();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Challenge</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderCurrentStep()}

      {/* Enhanced Camera Recording Integration */}
      <EnhancedMobileCameraIntegration
        statementIndex={currentStatementIndex}
        isVisible={showCameraModal}
        onComplete={handleRecordingComplete}
        onCancel={() => setShowCameraModal(false)}
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
    </SafeAreaView>
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