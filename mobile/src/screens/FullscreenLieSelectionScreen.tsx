/**
 * FullscreenLieSelectionScreen - Combined lie selection and preview interface
 * 
 * This component merges the "Select the Lie" and "Preview Your Challenge" screens
 * into a single full-screen immersive interface that allows users to:
 * - Preview their recorded video statements in full-screen
 * - Navigate between statements with intuitive controls
 * - Mark statements as lies with clear visual feedback
 * - Submit their challenge once a lie is selected
 * - Retake individual statements without leaving the interface
 * 
 * Features:
 * - Full-screen video playback optimized for mobile
 * - Bottom navigation controls for statement switching
 * - Clear header indicating current action ("Select the Lie")
 * - Prominent "Mark as Lie" button for current statement
 * - "Submit Challenge" button that activates after lie selection
 * - "Retake" button for re-recording current statement
 * - Smooth animations and responsive touch controls
 * - Redux integration for state management
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setLieStatement,
  validateChallenge,
  startSubmission,
  completeSubmission,
} from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FullscreenLieSelectionScreenProps {
  individualRecordings: { [key: number]: MediaCapture | null };
  onBack: () => void;
  onRetake: (statementIndex: number) => void;
  onSubmit: () => void;
}

/**
 * FullscreenLieSelectionScreen Component
 * 
 * Combines lie selection and preview functionality into a single immersive interface.
 * Users can preview their recorded statements in full-screen and mark one as the lie.
 * 
 * UI State Management:
 * - currentStatementIndex: Which statement (0, 1, 2) is currently being viewed
 * - selectedLieIndex: Which statement has been marked as the lie
 * - isPlaying: Whether video is currently playing
 * - showControls: Whether video controls are visible
 * 
 * Merge Logic:
 * - Replaces both lie selection and preview screens
 * - Maintains all existing functionality while improving UX
 * - Integrates with existing Redux challenge creation state
 * - Preserves retake and submission workflows
 */
export const FullscreenLieSelectionScreen: React.FC<FullscreenLieSelectionScreenProps> = ({
  individualRecordings,
  onBack,
  onRetake,
  onSubmit,
}) => {
  const dispatch = useAppDispatch();
  const { currentChallenge, validationErrors, isSubmitting } = useAppSelector(
    (state) => state.challengeCreation
  );

  // UI State Management
  const [currentStatementIndex, setCurrentStatementIndex] = useState(0);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef<Video>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize selected lie from Redux state
  useEffect(() => {
    const lieStatement = currentChallenge.statements?.findIndex(stmt => stmt.isLie) ?? -1;
    if (lieStatement !== -1) {
      setSelectedLieIndex(lieStatement);
    }
  }, [currentChallenge.statements]);

  // Auto-play video when statement changes
  useEffect(() => {
    const currentMedia = individualRecordings[currentStatementIndex];
    if (currentMedia && currentMedia.type === 'video' && currentMedia.url && videoRef.current) {
      console.log(`🎬 FULLSCREEN_LIE: Auto-playing statement ${currentStatementIndex + 1}`);
      // Reset to beginning and start playing
      const playVideo = async () => {
        try {
          await videoRef.current?.setPositionAsync(0);
          await videoRef.current?.playAsync();
          setIsPlaying(true);
          setShowControls(true); // Show controls briefly when auto-playing
        } catch (error) {
          console.error('🎬 FULLSCREEN_LIE: Error auto-playing video:', error);
        }
      };
      playVideo();
    }
  }, [currentStatementIndex, individualRecordings]);

  // Auto-hide controls after 3 seconds of inactivity (but only when playing)
  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying]);

  /**
   * Cleanup video when component unmounts or statement changes
   */
  useEffect(() => {
    return () => {
      // Pause video when component unmounts
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(console.error);
      }
    };
  }, []);

  /**
   * Handle statement navigation
   * Switches to a different statement for preview and starts playback from beginning
   */
  const handleStatementSelect = useCallback(async (index: number) => {
    if (index === currentStatementIndex) {
      // If selecting the same statement, just restart from beginning
      console.log(`🎬 FULLSCREEN_LIE: Restarting statement ${index + 1} from beginning`);
      if (videoRef.current) {
        try {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
          setIsPlaying(true);
        } catch (error) {
          console.error('🎬 FULLSCREEN_LIE: Error restarting video:', error);
        }
      }
    } else {
      // Switching to different statement
      console.log(`🎬 FULLSCREEN_LIE: Switching to statement ${index + 1}`);
      setCurrentStatementIndex(index);
    }
    
    setShowControls(true);
    
    // Light haptic feedback for navigation
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStatementIndex]);

  /**
   * Handle lie selection
   * Marks the current statement as the lie
   */
  const handleMarkAsLie = useCallback(() => {
    console.log(`🎬 FULLSCREEN_LIE: Marking statement ${currentStatementIndex + 1} as lie`);
    setSelectedLieIndex(currentStatementIndex);
    dispatch(setLieStatement(currentStatementIndex));
    
    // Medium haptic feedback for important action
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentStatementIndex, dispatch]);

  /**
   * Handle challenge submission
   * Validates and submits the challenge
   */
  const handleSubmitChallenge = useCallback(() => {
    console.log('🎬 FULLSCREEN_LIE: Submitting challenge...');
    
    // Validate challenge before submission
    dispatch(validateChallenge());
    
    if (validationErrors.length === 0 && selectedLieIndex !== null) {
      // Strong haptic feedback for submission
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      onSubmit();
    } else {
      Alert.alert(
        'Cannot Submit',
        selectedLieIndex === null 
          ? 'Please select which statement is the lie first.'
          : validationErrors.join('\n'),
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [dispatch, validationErrors, selectedLieIndex, onSubmit]);

  /**
   * Handle retake request
   * Requests to retake the current statement
   */
  const handleRetakeStatement = useCallback(() => {
    console.log(`🎬 FULLSCREEN_LIE: Retaking statement ${currentStatementIndex + 1}`);
    onRetake(currentStatementIndex);
  }, [currentStatementIndex, onRetake]);

  /**
   * Handle video screen tap
   * Toggles video playback between play and pause, and shows/hides controls
   */
  const handleVideoTap = useCallback(async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          console.log('🎬 FULLSCREEN_LIE: Pausing video');
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          console.log('🎬 FULLSCREEN_LIE: Playing video');
          await videoRef.current.playAsync();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('🎬 FULLSCREEN_LIE: Error toggling playback:', error);
      }
    }
    
    // Always show controls when tapping video
    setShowControls(true);
  }, [isPlaying]);

  /**
   * Handle video playback status updates
   */
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  // Get current statement media
  const currentMedia = individualRecordings[currentStatementIndex];
  const hasVideo = currentMedia && currentMedia.type === 'video' && currentMedia.url;

  // Statement navigation component
  const StatementNavigationButton: React.FC<{
    index: number;
    isActive: boolean;
    isMarkedAsLie: boolean;
  }> = ({ index, isActive, isMarkedAsLie }) => (
    <TouchableOpacity
      style={[
        styles.navigationButton,
        isActive && styles.activeNavigationButton,
        isMarkedAsLie && styles.lieNavigationButton,
      ]}
      onPress={() => handleStatementSelect(index)}
      activeOpacity={0.8}
    >
      <Text style={[
        styles.navigationButtonText,
        isActive && styles.activeNavigationButtonText,
        isMarkedAsLie && styles.lieNavigationButtonText,
      ]}>
        {index + 1}
      </Text>
      {isMarkedAsLie && (
        <View style={styles.lieIndicatorDot} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Hide status bar for true fullscreen experience */}
      <StatusBar hidden />
      
      {/* Header with title and navigation */}
      <SafeAreaView style={[styles.header, !showControls && styles.hiddenHeader]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Select the Lie</Text>
        
        <TouchableOpacity
          onPress={handleRetakeStatement}
          style={styles.retakeButton}
        >
          <Text style={styles.retakeButtonText}>Retake</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Full-screen video container */}
      <View style={styles.videoContainer}>
        {hasVideo ? (
          <TouchableOpacity
            style={styles.videoTouchArea}
            onPress={handleVideoTap}
            activeOpacity={1}
          >
            <Video
              ref={videoRef}
              source={{ uri: currentMedia.url! }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              useNativeControls={false}
            />
            
            {/* Play/Pause overlay */}
            {!isPlaying && (
              <View style={styles.playPauseOverlay}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handleVideoTap}
                  activeOpacity={0.8}
                >
                  <Text style={styles.playButtonText}>▶</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Statement indicator overlay */}
            {showControls && (
              <View style={styles.statementIndicator}>
                <Text style={styles.statementIndicatorText}>
                  Statement {currentStatementIndex + 1}
                  {selectedLieIndex === currentStatementIndex && ' (The Lie)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>No video recorded</Text>
            <Text style={styles.placeholderSubtext}>
              Tap "Retake" to record this statement
            </Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={[styles.bottomControls, !showControls && styles.hiddenBottomControls]}>
        {/* Statement navigation buttons */}
        <View style={styles.navigationContainer}>
          <Text style={styles.navigationLabel}>Statements</Text>
          <View style={styles.navigationButtons}>
            {[0, 1, 2].map((index) => (
              <StatementNavigationButton
                key={index}
                index={index}
                isActive={index === currentStatementIndex}
                isMarkedAsLie={index === selectedLieIndex}
              />
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {/* Mark as Lie button */}
          <TouchableOpacity
            style={[
              styles.markLieButton,
              selectedLieIndex === currentStatementIndex && styles.markedLieButton,
            ]}
            onPress={handleMarkAsLie}
            disabled={isSubmitting}
          >
            <Text style={[
              styles.markLieButtonText,
              selectedLieIndex === currentStatementIndex && styles.markedLieButtonText,
            ]}>
              {selectedLieIndex === currentStatementIndex ? '✓ Marked as Lie' : 'Mark as Lie'}
            </Text>
          </TouchableOpacity>

          {/* Submit Challenge button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              selectedLieIndex === null && styles.disabledSubmitButton,
              isSubmitting && styles.submittingButton,
            ]}
            onPress={handleSubmitChallenge}
            disabled={selectedLieIndex === null || isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.submittingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={[
                styles.submitButtonText,
                selectedLieIndex === null && styles.disabledSubmitButtonText,
              ]}>
                Submit Challenge
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // True black for immersive experience
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  hiddenHeader: {
    opacity: 0,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTouchArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: screenWidth,
    height: screenHeight,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  playButtonText: {
    color: '#333333',
    fontSize: 32,
    fontWeight: 'bold',
    marginLeft: 4, // Slight offset to center the play triangle visually
  },
  statementIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  statementIndicatorText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  placeholderSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 15,
  },
  hiddenBottomControls: {
    opacity: 0,
  },
  navigationContainer: {
    marginBottom: 20,
  },
  navigationLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  navigationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeNavigationButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.8)',
    borderColor: '#4A90E2',
    transform: [{ scale: 1.1 }],
  },
  lieNavigationButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderColor: '#F44336',
  },
  navigationButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  activeNavigationButtonText: {
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lieNavigationButtonText: {
    color: '#ffffff',
  },
  lieIndicatorDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  actionButtons: {
    gap: 12,
  },
  markLieButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 193, 7, 0.5)',
  },
  markedLieButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  markLieButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  markedLieButtonText: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.5)',
  },
  disabledSubmitButton: {
    backgroundColor: 'rgba(158, 158, 158, 0.6)',
    borderColor: 'rgba(158, 158, 158, 0.3)',
  },
  submittingButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.7)',
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledSubmitButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default FullscreenLieSelectionScreen;
