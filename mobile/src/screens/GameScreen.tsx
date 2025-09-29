import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loadChallenges,
  selectChallenge,
  startGuessingSession,
  submitGuess,
  setGuessResult,
  clearGuessResult,
  endGuessingSession,
  setLoading,
  setChallengeLoadError,
  clearChallengeLoadError,
  resetRetryCount,
} from '../store/slices/guessingGameSlice';
import { selectUser } from '../store/slices/authSlice';
import { EnhancedChallenge, GuessResult } from '../types';
import { ChallengeCreationScreen } from './ChallengeCreationScreen';
import FullscreenGuessScreen from './FullscreenGuessScreen';
import { useAuth } from '../hooks/useAuth';
import { useReportAuth } from '../hooks/useReportAuth';
import AnimatedFeedback from '../shared/AnimatedFeedback';
import SimpleVideoPlayer from '../components/SimpleVideoPlayer';
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';
import { realChallengeAPI, Challenge as BackendChallenge, resolveMediaUrl } from '../services/realChallengeAPI';
import { errorHandlingService } from '../services/errorHandlingService';
import { AuthStatusBanner } from '../components/ProtectedScreen';
import { ReportButton } from '../components/ReportButton';
import { ReportModal, ModerationReason } from '../components/ReportModal';
import { submitReport } from '../store/slices/reportingSlice';
import { ThemeContext } from '../context/ThemeContext';
import { store } from '../store';
import HapticsService from '../services/HapticsService';

// Helper function to convert backend challenge to frontend format
const convertBackendChallenge = (backendChallenge: BackendChallenge): EnhancedChallenge => {
  return {
    id: backendChallenge.challenge_id,
    creatorId: backendChallenge.creator_id,
    creatorName: backendChallenge.creator_name || `User ${backendChallenge.creator_id.slice(0, 8)}`, // Use backend name or fallback
    statements: backendChallenge.statements.map((stmt, index) => ({
      id: stmt.statement_id,
      text: `Statement ${index + 1}`, // Backend doesn't store statement text yet
      isLie: stmt.statement_type === 'lie',
      viewCount: 0, // Default values for analytics data
      guessAccuracy: 50,
      averageConfidence: 50,
    })),
    mediaData: (() => {
      // For merged videos from backend, we need to decide strategy based on individual video availability
      if (backendChallenge.is_merged_video && backendChallenge.merged_video_metadata) {
        const mergedMetadata = backendChallenge.merged_video_metadata;
        
        // Use the merged video file ID to get the signed URL
        const mergedVideoFileId = mergedMetadata.video_file_id;
        if (mergedVideoFileId) {
          // Find a statement with a signed URL for the same file ID
          const statementWithSignedUrl = backendChallenge.statements.find(stmt => 
            stmt.streaming_url && stmt.streaming_url.includes(mergedVideoFileId)
          );
          
          if (statementWithSignedUrl) {
            const mergedVideoUrl = statementWithSignedUrl.streaming_url;
            
            // Check if we have original individual video URLs that are different from merged
            const hasOriginalIndividualVideos = backendChallenge.statements.some(stmt => 
              stmt.streaming_url && !stmt.streaming_url.includes(mergedVideoFileId)
            );
            
            if (hasOriginalIndividualVideos) {
              // We have proper individual videos - create individual media entries
              console.log('🎬 INDIVIDUAL_STRATEGY: Using original individual videos (different URLs)');
              const individualMedia = backendChallenge.statements.map((stmt) => ({
                type: 'video' as const,
                streamingUrl: resolveMediaUrl(stmt.streaming_url || stmt.media_url),
                duration: (stmt.duration_seconds || 0) * 1000, // Convert to milliseconds
                mediaId: stmt.media_file_id,
                isUploaded: true,
                storageType: stmt.storage_type as any,
                cloudStorageKey: stmt.cloud_storage_key,
              }));
              
              return individualMedia;
            } else {
              // Only merged video available - create merged video entry
              // console.log('🎬 MERGED_STRATEGY: Using merged video (no individual URLs available)');
              const mergedVideo = {
                type: 'video' as const,
                streamingUrl: resolveMediaUrl(mergedVideoUrl || ''),
                duration: (mergedMetadata.total_duration || 0) * 1000, // Convert seconds to milliseconds
                mediaId: mergedVideoFileId,
                isUploaded: true,
                storageType: 'cloud' as any,
                cloudStorageKey: `challenges/${backendChallenge.challenge_id}/merged.mp4`,
                isMergedVideo: true,
                segments: (mergedMetadata.segments || []).map((segment: any, index: number) => ({
                  statementIndex: segment.statement_index || index,
                  startTime: segment.start_time > 1000 ? Math.round(segment.start_time) : Math.round((segment.start_time || 0) * 1000), // Convert seconds to milliseconds if needed
                  endTime: segment.end_time > 1000 ? Math.round(segment.end_time) : Math.round((segment.end_time || 0) * 1000), // Convert seconds to milliseconds if needed
                  duration: segment.duration > 1000 ? Math.round(segment.duration) : Math.round((segment.duration || 0) * 1000), // Convert seconds to milliseconds if needed
                  url: resolveMediaUrl(mergedVideoUrl || ''),
                })),
              };
              
              return [mergedVideo];
            }
          } else {
            console.warn('🎬 GAMESCREEN: No signed URL found for merged video file ID:', mergedVideoFileId);
          }
        }
      }

      // For individual videos (non-merged), create individual media entries
      const individualMedia = backendChallenge.statements.map((stmt) => ({
        type: 'video' as const,
        streamingUrl: resolveMediaUrl(stmt.streaming_url || stmt.media_url || ''),
        duration: (stmt.duration_seconds || 0) * 1000, // Convert to milliseconds
        mediaId: stmt.media_file_id,
        isUploaded: true,
        storageType: stmt.storage_type as any,
        cloudStorageKey: stmt.cloud_storage_key,
      }));

      // If all individual streaming URLs are identical and we have merged metadata, prefer merged strategy
      const allUrls = individualMedia.map(m => m.streamingUrl);
      const uniqueUrls = Array.from(new Set(allUrls.filter(Boolean)));

      if (uniqueUrls.length === 1 && backendChallenge.merged_video_metadata) {
        const mergedVideoUrl = uniqueUrls[0];
        console.log('🎬 MERGED_DETECTION: All individual URLs identical; converting to merged video with segments');
        
        // Add detailed logging and validation for merged video timing
        const totalDurationSeconds = backendChallenge.merged_video_metadata.total_duration || 0;
        const totalDurationMs = totalDurationSeconds * 1000;
        
        console.log('🎯 TIMING_DEBUG: Processing merged video metadata');
        console.log('🎯 TIMING_DEBUG: Total duration from backend (seconds):', totalDurationSeconds);
        console.log('🎯 TIMING_DEBUG: Total duration converted (ms):', totalDurationMs);
        
        // Validate total duration
        if (totalDurationSeconds > 90) {
          console.warn('⚠️ TIMING_WARNING: Total duration suspiciously long for video statements:', totalDurationSeconds, 'seconds');
        }
        if (totalDurationSeconds < 0.1) {
          console.warn('⚠️ TIMING_WARNING: Total duration suspiciously short for video statements:', totalDurationSeconds, 'seconds');
        }

        const segments = (backendChallenge.merged_video_metadata.segments || []).map((segment: any, index: number) => {
          const startTimeSeconds = segment.start_time || 0;
          const endTimeSeconds = segment.end_time || 0;
          const durationSeconds = segment.duration || (endTimeSeconds - startTimeSeconds) || 0;
          
          const startTimeMs = Math.round(startTimeSeconds * 1000);
          const endTimeMs = Math.round(endTimeSeconds * 1000);
          const durationMs = Math.round(durationSeconds * 1000);
          
          console.log(`🎯 TIMING_DEBUG: Segment ${index} (statement ${segment.statement_index || index}):`);
          console.log(`  Backend seconds: start=${startTimeSeconds}s, end=${endTimeSeconds}s, duration=${durationSeconds}s`);
          console.log(`  Converted ms: start=${startTimeMs}ms, end=${endTimeMs}ms, duration=${durationMs}ms`);
          
          // Validate segment timing
          if (durationSeconds > 30) {
            console.warn(`⚠️ TIMING_WARNING: Segment ${index} duration suspiciously long:`, durationSeconds, 'seconds');
          }
          if (durationSeconds < 0.5) {
            console.warn(`⚠️ TIMING_WARNING: Segment ${index} duration suspiciously short:`, durationSeconds, 'seconds');
          }
          if (startTimeSeconds < 0) {
            console.warn(`⚠️ TIMING_WARNING: Segment ${index} negative start time:`, startTimeSeconds, 'seconds');
          }
          if (endTimeSeconds <= startTimeSeconds) {
            console.warn(`⚠️ TIMING_WARNING: Segment ${index} end time not after start time:`, 'start=', startTimeSeconds, 'end=', endTimeSeconds);
          }
          
          return {
            statementIndex: segment.statement_index || index,
            startTime: startTimeMs, // Convert from seconds to milliseconds
            endTime: endTimeMs, // Convert from seconds to milliseconds  
            duration: durationMs, // Convert from seconds to milliseconds
            url: mergedVideoUrl, // Already resolved URL from uniqueUrls
          };
        });

        const mergedVideo = {
          type: 'video' as const,
          streamingUrl: mergedVideoUrl, // Already resolved URL from uniqueUrls
          duration: totalDurationMs,
          mediaId: backendChallenge.merged_video_metadata.video_file_id,
          isUploaded: true,
          storageType: 'cloud' as any,
          cloudStorageKey: `challenges/${backendChallenge.challenge_id}/merged.mp4`,
          isMergedVideo: true,
          segments: segments,
        };
        
        console.log('🎯 TIMING_DEBUG: Final merged video object:', {
          duration: mergedVideo.duration,
          segmentCount: segments.length,
          segments: segments.map((s: any) => ({ statementIndex: s.statementIndex, startTime: s.startTime, endTime: s.endTime, duration: s.duration }))
        });

        return [mergedVideo];
      }

      console.log('🎬 INDIVIDUAL_VIDEOS: Created individual videos (no merged video):', individualMedia.length);
      return individualMedia;
    })(),
    difficultyRating: 50, // Default difficulty
    averageGuessTime: 20000, // Default 20 seconds
    popularityScore: Math.min(backendChallenge.view_count * 10, 100), // Scale view count to 0-100
    emotionComplexity: 50,
    recommendationWeight: 50,
    totalGuesses: backendChallenge.guess_count,
    correctGuessRate: backendChallenge.guess_count > 0 
      ? Math.round((backendChallenge.correct_guess_count / backendChallenge.guess_count) * 100)
      : 50,
    createdAt: backendChallenge.created_at, // Keep as ISO string for Redux serialization
    lastPlayed: new Date().toISOString(), // Keep as ISO string for Redux serialization
    tags: backendChallenge.tags || [],
    isActive: backendChallenge.status === 'published',
  };
};

interface GameScreenProps {
  hideCreateButton?: boolean;
  onBack?: () => void;
  useFullscreenInterface?: boolean; // Flag to enable fullscreen interface
}

export const GameScreen: React.FC<GameScreenProps> = ({ 
  hideCreateButton = false, 
  onBack,
  useFullscreenInterface = true, // Default to new interface
}) => {
  const { colors } = useContext(ThemeContext);
  // Reduced logging - GameScreen render (enable for debugging if needed)
  // console.log('🏠 GAMESCREEN: Component rendered, hideCreateButton =', hideCreateButton);
  
  const dispatch = useAppDispatch();
  const { isAuthenticated, isGuest, triggerAuthFlow } = useAuth();
  const { handleAuthRequired, validateReportPermissions } = useReportAuth();
  const currentUser = useAppSelector(selectUser);
  const {
    availableChallenges,
    selectedChallenge,
    currentSession,
    guessSubmitted,
    guessResult,
    isLoading,
    loadError,
    retryCount,
    lastSuccessfulLoad,
    currentStreak,
  } = useAppSelector((state) => state.guessingGame);

  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [showChallengeCreation, setShowChallengeCreation] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingChallengeId, setReportingChallengeId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const gameplayScrollRef = useRef<ScrollView>(null);

  const styles = getStyles(colors);

  // Debug logging for challenge creation modal state
  useEffect(() => {
    console.log('🎯 MODAL_STATE: showChallengeCreation changed to:', showChallengeCreation);
  }, [showChallengeCreation]);

  useEffect(() => {
    loadChallengesFromAPI();
  }, [dispatch]);

  // Auto-retry mechanism for retryable errors
  useEffect(() => {
    if (loadError && loadError.retryable && retryCount > 0) {
      const retryStrategy = errorHandlingService.getRetryStrategy(loadError.type, retryCount);
      
      if (retryStrategy.shouldRetry) {
        console.log(`🔄 GAME: Auto-retrying in ${retryStrategy.delay}ms (attempt ${retryCount}/${retryStrategy.maxRetries})`);
        
        const timeoutId = setTimeout(() => {
          loadChallengesFromAPI(true);
        }, retryStrategy.delay);

        return () => clearTimeout(timeoutId);
      } else {
        console.log('🚫 GAME: Max retries reached, stopping auto-retry');
      }
    }
  }, [loadError, retryCount]);

  const loadChallengesFromAPI = async (isRetry: boolean = false) => {
    try {
      // Check network status first
      const isOnline = await errorHandlingService.checkNetworkStatus();
      if (!isOnline) {
        dispatch(setChallengeLoadError({ 
          error: 'No internet connection', 
          errorType: 'network' 
        }));
        return;
      }

      if (!isRetry) {
        dispatch(setLoading(true));
        dispatch(clearChallengeLoadError());
      } else {
        setIsRetrying(true);
      }
      
      console.log('🎯 GAME: Loading challenges from backend API...');
      
      const response = await realChallengeAPI.getChallenges(0, 20);
      
      console.log('🎯 GAME: Response received:', typeof response, Array.isArray(response) ? `Array[${response.length}]` : 'Not array');
      
      // Handle direct array response from API
      if (Array.isArray(response)) {
        console.log('✅ GAME: Successfully loaded challenges:', response.length);
        
        // Convert backend challenges to frontend format
        const enhancedChallenges = response.map((challenge) => {
          return convertBackendChallenge(challenge);
        });
        
        dispatch(loadChallenges(enhancedChallenges));
      } else {
        const errorMessage = 'Invalid response format from challenges API';
        console.error('❌ GAME: Failed to load challenges:', errorMessage);
        console.error('❌ GAME: Response was:', response);
        
        const errorDetails = errorHandlingService.categorizeError(new Error(errorMessage));
        errorHandlingService.logError(errorDetails, 'GameScreen.loadChallenges');
        
        dispatch(setChallengeLoadError({ 
          error: errorMessage,
          errorType: errorDetails.type 
        }));
        
        // Fallback to empty array
        dispatch(loadChallenges([]));
      }
    } catch (err: any) {
      console.error('❌ GAME: Error loading challenges:', err);
      
      const errorDetails = errorHandlingService.categorizeError(err);
      errorHandlingService.logError(errorDetails, 'GameScreen.loadChallenges');
      
      dispatch(setChallengeLoadError({ 
        error: errorDetails.message,
        errorType: errorDetails.type 
      }));
      
      // Only fallback to empty array if it's not a retryable error
      if (!errorDetails.retryable) {
        dispatch(loadChallenges([]));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSelectChallenge = (challenge: EnhancedChallenge) => {
    HapticsService.triggerImpact('light');
    console.log(`🎯 TIMING_DEBUG: Starting challenge ${challenge.id}`);
    
    // Validate timing data for the selected challenge
    if (challenge.mediaData && challenge.mediaData.length > 0) {
      const media = challenge.mediaData[0];
      console.log(`🎯 TIMING_DEBUG: Selected challenge media:`);
      console.log(`  Duration: ${media.duration}ms`);
      console.log(`  Type: ${media.type}`);
      console.log(`  Is merged: ${media.isMergedVideo}`);
      console.log(`  Has segments: ${media.segments?.length || 0}`);
      
      if (media.isMergedVideo && media.segments) {
        console.log(`🎯 TIMING_DEBUG: Selected challenge segments:`);
        media.segments.forEach((segment, segIndex) => {
          console.log(`  Segment ${segIndex}: ${segment.startTime}ms - ${segment.endTime}ms (${segment.duration}ms) for statement ${segment.statementIndex}`);
        });
      }
    }
    
    dispatch(selectChallenge(challenge));
    dispatch(startGuessingSession({
      challengeId: challenge.id,
      statements: challenge.statements,
    }));
    setSelectedStatement(null);
  };

  const handleSubmitGuess = async () => {
    if (selectedStatement === null || !currentSession) return;

    dispatch(submitGuess(selectedStatement));

    // Handle guess result with REAL API call
    try {
      // Get the statement ID that the user guessed
      const guessedStatement = currentSession.statements[selectedStatement];
      const guessedStatementId = guessedStatement?.id || `statement_${selectedStatement}`;
      
      console.log(`🎯 GAMESCREEN_API: Submitting guess to backend API`);
      console.log(`🎯 GAMESCREEN_API: Challenge ID: ${currentSession.challengeId}`);
      console.log(`🎯 GAMESCREEN_API: Guessed Statement ID: ${guessedStatementId}`);
      
      // Call real backend API
      const apiResponse = await realChallengeAPI.submitGuess(
        currentSession.challengeId,
        guessedStatementId
      );
      
      if (apiResponse.success && apiResponse.data) {
        const backendResult = apiResponse.data;
        console.log(`✅ GAMESCREEN_API_SUCCESS: Backend response:`, backendResult);
        
        // Import updateUserScore action
        const { updateUserScore } = await import('../store/slices/authSlice');
        
        // Update user score in Redux if points were earned
        if (backendResult.points_earned > 0) {
          console.log(`💰 GAMESCREEN_SCORE: User earned ${backendResult.points_earned} points`);
          
          // Get current user score and add earned points
          const currentUser = (store.getState() as any).auth.user;
          if (currentUser) {
            const newScore = (currentUser.score || 0) + backendResult.points_earned;
            dispatch(updateUserScore(newScore));
            console.log(`✅ GAMESCREEN_SCORE_UPDATED: User score updated to ${newScore}`);
          }
        }
        
        // Find the correct statement index for revealing the answer
        const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
        
        // Create result object based on backend response
        const realResult: GuessResult = {
          sessionId: currentSession.sessionId,
          playerId: currentSession.playerId,
          challengeId: currentSession.challengeId,
          guessedStatement: selectedStatement,
          correctStatement,
          wasCorrect: backendResult.correct,
          pointsEarned: backendResult.points_earned,
          timeBonus: 0, // Backend doesn't provide time bonus yet
          accuracyBonus: 0, // Backend doesn't provide accuracy bonus yet
          streakBonus: 0, // Backend doesn't provide streak bonus yet
          totalScore: backendResult.points_earned,
          newAchievements: [], // Backend doesn't provide achievements yet
        };

        dispatch(setGuessResult(realResult));
        
      } else {
        // Handle API error - fall back to mock behavior for now
        console.error(`❌ GAMESCREEN_API_ERROR: Failed to submit guess:`, apiResponse.error);
        
        // Create fallback mock result
        const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
        const wasCorrect = selectedStatement === correctStatement;

        const fallbackResult: GuessResult = {
          sessionId: currentSession.sessionId,
          playerId: currentSession.playerId,
          challengeId: currentSession.challengeId,
          guessedStatement: selectedStatement,
          correctStatement,
          wasCorrect,
          pointsEarned: wasCorrect ? 100 : 0,
          timeBonus: 20,
          accuracyBonus: wasCorrect ? 30 : 0,
          streakBonus: wasCorrect ? 10 : 0,
          totalScore: wasCorrect ? 160 : 0,
          newAchievements: wasCorrect ? ['first_correct_guess'] : [],
        };

        dispatch(setGuessResult(fallbackResult));
      }
      
    } catch (error) {
      console.error(`❌ GAMESCREEN_GUESS_ERROR:`, error);
      
      // Create fallback mock result on error
      const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
      const wasCorrect = selectedStatement === correctStatement;

      const errorFallbackResult: GuessResult = {
        sessionId: currentSession.sessionId,
        playerId: currentSession.playerId,
        challengeId: currentSession.challengeId,
        guessedStatement: selectedStatement,
        correctStatement,
        wasCorrect,
        pointsEarned: wasCorrect ? 100 : 0,
        timeBonus: 20,
        accuracyBonus: wasCorrect ? 30 : 0,
        streakBonus: wasCorrect ? 10 : 0,
        totalScore: wasCorrect ? 160 : 0,
        newAchievements: wasCorrect ? ['first_correct_guess'] : [],
      };

      dispatch(setGuessResult(errorFallbackResult));
    }
  };

  const handleNewGame = () => {
    dispatch(endGuessingSession());
    setSelectedStatement(null);
    setShowVideoPlayer(false);
  };

  const handleManualRetry = () => {
    dispatch(resetRetryCount());
    loadChallengesFromAPI(false);
  };

  const handleCreateChallenge = () => {
    HapticsService.triggerImpact('medium');
    console.log('🚨🚨🚨 CREATE_CHALLENGE: BUTTON CLICKED! 🚨🚨🚨');
    console.log('🚨🚨🚨 This should definitely appear in logs if button is working 🚨🚨🚨');
    console.log('🎯 CREATE_CHALLENGE: Auth state:', { isAuthenticated, isGuest });
    console.log('🎯 CREATE_CHALLENGE: Should block?', (!isAuthenticated || isGuest));
    
    if (!isAuthenticated || isGuest) {
      console.log('🚨 CREATE_CHALLENGE: Blocking user - showing auth popup');
      Alert.alert(
        'Sign In Required',
        'Please sign in to create a challenge',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Sign In',
            style: 'default',
            onPress: () => {
              console.log('Navigating to sign in page...');
              triggerAuthFlow();
            },
          },
        ]
      );
      return;
    }
    
    console.log('✅ CREATE_CHALLENGE: User authenticated - proceeding to creation');
    // User is authenticated, proceed with challenge creation
    setShowChallengeCreation(true);
  };

  const handleReportChallenge = (challengeId: string) => {
    console.log('🚩 REPORT: Report button pressed for challenge:', challengeId);
    
    // Use the report auth hook to handle authentication
    handleAuthRequired(() => {
      console.log('✅ REPORT: User authenticated and can report, opening report modal');
      setReportingChallengeId(challengeId);
      setShowReportModal(true);
    });
  };

  const handleSubmitReport = async (reason: ModerationReason, details?: string) => {
    if (!reportingChallengeId) {
      console.error('🚩 REPORT: No challenge ID set for reporting');
      return;
    }

    // Validate permissions before submitting
    const canReport = await validateReportPermissions();
    if (!canReport) {
      console.error('🚩 REPORT: User does not have permission to report');
      Alert.alert(
        'Authentication Error',
        'Your session has expired. Please sign in again to report content.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsSubmittingReport(true);
      console.log('🚩 REPORT: Submitting report for challenge:', reportingChallengeId);
      
      // Use Redux action to submit report
      const result = await dispatch(submitReport({
        challengeId: reportingChallengeId,
        reason,
        details
      })).unwrap();
      
      console.log('✅ REPORT: Report submitted successfully');
      
      // Show success message
      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. Your report has been submitted for review.',
        [{ text: 'OK' }]
      );
      
      // Close modal and reset state
      setShowReportModal(false);
      setReportingChallengeId(null);
      
    } catch (error) {
      console.error('❌ REPORT: Failed to submit report:', error);
      
      // Error handling is done in the ReportModal component
      throw error;
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCloseReportModal = () => {
    console.log('🚩 REPORT: Closing report modal');
    setShowReportModal(false);
    setReportingChallengeId(null);
  };

  const getErrorDisplayInfo = () => {
    if (!loadError) return null;

    const errorDetails = errorHandlingService.categorizeError(new Error(loadError.message));
    const userMessage = errorHandlingService.formatErrorForUser(errorDetails);
    const retryStrategy = errorHandlingService.getRetryStrategy(loadError.type, retryCount);

    return {
      message: loadError.message,
      userMessage,
      canRetry: loadError.retryable,
      isAutoRetrying: retryStrategy.shouldRetry && retryCount > 0,
      retryCount,
      maxRetries: retryStrategy.maxRetries,
    };
  };

  const renderChallengeList = () => (
    <ScrollView style={styles.challengeList}>
      <Text style={styles.title}>
        {hideCreateButton ? 'Choose a Challenge' : 'Two Truths & a Lie'}
      </Text>
      
      {/* Profile Card */}
      {currentUser && (
        <View style={styles.profileCard}>
          <Text style={styles.profileName}>
            {currentUser.name} {currentUser.score ? `(🏆 ${currentUser.score})` : ''}
          </Text>
          {isGuest && (
            <Text style={styles.guestLabel}>Guest Player</Text>
          )}
        </View>
      )}
      
      {/* Create Challenge Button - only show if not hidden */}
      {!hideCreateButton && (
        <TouchableOpacity
          style={[styles.challengeCard, styles.createChallengeCard]}
          onPress={handleCreateChallenge}
        >
          <Text style={styles.createChallengeTitle}>📹 Create New Challenge</Text>
          <Text style={styles.createChallengeSubtitle}>
            Record your own two truths and a lie
          </Text>
        </TouchableOpacity>
      )}

      {/* Section title - only show when not hiding create button */}
      {!hideCreateButton && (
        <Text style={styles.sectionTitle}>Play Existing Challenges</Text>
      )}
      
      {/* Loading State */}
      {(isLoading || isRetrying) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isRetrying ? 'Retrying...' : 'Loading challenges...'}
          </Text>
          {isRetrying && retryCount > 0 && (
            <Text style={styles.retryCountText}>
              Attempt {retryCount} of {errorHandlingService.getRetryStrategy(loadError?.type || 'unknown', retryCount).maxRetries}
            </Text>
          )}
        </View>
      )}
      
      {/* Error State */}
      {loadError && !isLoading && !isRetrying && (() => {
        const errorInfo = getErrorDisplayInfo();
        if (!errorInfo) return null;

        return (
          <View style={[styles.errorContainer, 
            loadError.type === 'network' && styles.networkErrorContainer,
            loadError.type === 'auth' && styles.authErrorContainer
          ]}>
            <Text style={styles.errorIcon}>
              {loadError.type === 'network' ? '📡' : 
               loadError.type === 'timeout' ? '⏱️' : 
               loadError.type === 'server' ? '🔧' : 
               loadError.type === 'auth' ? '🔐' : '❌'}
            </Text>
            <Text style={styles.errorTitle}>
              {loadError.type === 'network' ? 'Connection Problem' :
               loadError.type === 'timeout' ? 'Request Timeout' :
               loadError.type === 'server' ? 'Server Error' :
               loadError.type === 'auth' ? 'Authentication Required' :
               'Something Went Wrong'}
            </Text>
            <Text style={styles.errorText}>{errorInfo.userMessage}</Text>
            
            {errorInfo.isAutoRetrying && (
              <View style={styles.autoRetryContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.autoRetryText}>
                  Auto-retrying... ({errorInfo.retryCount}/{errorInfo.maxRetries})
                </Text>
              </View>
            )}
            
            {errorInfo.canRetry && !errorInfo.isAutoRetrying && (
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={handleManualRetry}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}

            {lastSuccessfulLoad && (
              <Text style={styles.lastUpdateText}>
                Last updated: {new Date(lastSuccessfulLoad).toLocaleTimeString()}
              </Text>
            )}
          </View>
        );
      })()}
      
      {/* Empty State */}
      {!isLoading && !isRetrying && !loadError && availableChallenges.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No challenges available</Text>
          <Text style={styles.emptySubtext}>
            Be the first to create a challenge!
          </Text>
        </View>
      )}
      
      {/* Challenge List */}
      {!isLoading && !isRetrying && availableChallenges.length > 0 && availableChallenges.map((challenge) => (
        <View key={challenge.id} style={styles.challengeCard}>
          {/* Challenge Header with Report Button */}
          <View style={styles.challengeHeader}>
            <Text style={styles.creatorName}>By {challenge.creatorName}</Text>
            <ReportButton
              challengeId={challenge.id}
              onPress={() => handleReportChallenge(challenge.id)}
              size="small"
              variant="minimal"
              style={styles.reportButton}
            />
          </View>
          
          {/* Challenge Content - Touchable area for selection */}
          <TouchableOpacity
            style={styles.challengeContent}
            onPress={() => handleSelectChallenge(challenge)}
            activeOpacity={0.7}
          >
            <Text style={styles.difficultyText}>
              Difficulty: {challenge.difficultyRating}/100
            </Text>
            <Text style={styles.statsText}>
              {challenge.totalGuesses} guesses • {challenge.correctGuessRate}% correct
            </Text>
            <Text style={styles.challengeId}>ID: {challenge.id}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const renderGameplay = () => {
    const mediaData = selectedChallenge?.mediaData || [];
    
    // Check if we have a merged video with segments
    const mergedVideo = mediaData.find(media => media.isMergedVideo && media.segments);
    const hasMergedVideo = !!mergedVideo;
    
    // Get individual videos (non-merged)
    const individualVideos = mediaData.filter(media => !media.isMergedVideo);
    const hasIndividualVideos = individualVideos.length === 3; // For 3-statement challenges
    
    const hasAnyVideo = hasMergedVideo || hasIndividualVideos;

    // Debug logging
    console.log('🎥 RENDER GAMEPLAY:', {
      selectedChallengeId: selectedChallenge?.id,
      mediaDataCount: mediaData.length,
      hasMergedVideo,
      hasIndividualVideos,
      individualVideosCount: individualVideos.length,
      mergedVideoSegments: mergedVideo?.segments?.length || 0,
    });

    const floatingButtonVisible = !!currentSession && !guessSubmitted && selectedStatement !== null;
    const dynamicBottomPadding = bottomPadding + (floatingButtonVisible ? 88 : 0);

    return (
      <ScrollView 
        ref={gameplayScrollRef}
        style={[styles.gameplayContainer, { paddingBottom: dynamicBottomPadding }]}
      > 
        <Text style={styles.title}>Which statement is the lie?</Text>
        <Text style={styles.subtitle}>By {selectedChallenge?.creatorName}</Text>
        
        {/* Video Player Toggle */}
        {hasAnyVideo && (
          <TouchableOpacity
            style={styles.videoToggleButton}
            onPress={() => setShowVideoPlayer(!showVideoPlayer)}
          >
            <Text style={styles.videoToggleText}>
              {showVideoPlayer ? '📝 Hide Video' : '🎥 Watch Statements'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Video Player - Merged Video with Segments */}
        {showVideoPlayer && hasMergedVideo && mergedVideo && (
          <View style={styles.videoPlayerContainer}>
            <SegmentedVideoPlayer
              key={`merged-video-${mergedVideo.mediaId}`}
              mergedVideo={mergedVideo}
              segments={mergedVideo.segments || []}
              statementTexts={currentSession?.statements.map((stmt: any) => stmt.text) || []}
              onSegmentSelect={(segmentIndex: number) => {
                console.log(`🎬 GAMESCREEN: Selected merged video segment ${segmentIndex}`);
              }}
              autoPlay={false}
            />
          </View>
        )}

        {/* Video Player - Individual Videos */}
        {showVideoPlayer && !hasMergedVideo && hasIndividualVideos && (
          <View style={styles.videoPlayerContainer}>
            <SimpleVideoPlayer
              key={`individual-videos-${individualVideos.map(v => v.mediaId).join('-')}`}
              individualVideos={individualVideos}
              statementTexts={currentSession?.statements.map((stmt: any) => stmt.text) || []}
              onSegmentSelect={(segmentIndex: number) => {
                console.log(`🎬 GAMESCREEN: Selected individual video segment ${segmentIndex}`);
                console.log(`🎬 GAMESCREEN: Individual videos:`, individualVideos.map(v => v.streamingUrl));
              }}
            />
          </View>
        )}
        
        {/* Statement Selection */}
        <View style={styles.statementsSection}>
          <Text style={styles.gameplaySectionTitle}>
            {showVideoPlayer 
              ? 'Make Your Guess:' 
              : hasAnyVideo 
                ? 'Select a statement to judge (video will auto-play):' 
                : 'Read the statements and make your guess:'
            }
          </Text>
          
          {currentSession?.statements.map((statement: any, index: number) => (
            <TouchableOpacity
              key={statement.id}
              style={[
                styles.statementCard,
                selectedStatement === index && styles.selectedStatement,
              ]}
              onPress={() => {
                if (!guessSubmitted) {
                  setSelectedStatement(index);
                  // Automatically open video player when a statement is selected for guessing
                  if (hasAnyVideo && !showVideoPlayer) {
                    setShowVideoPlayer(true);
                    // Scroll to the video player after a short delay to let it render
                    setTimeout(() => {
                      gameplayScrollRef.current?.scrollTo({ y: 0, animated: true });
                    }, 100);
                  }
                }
              }}
              disabled={guessSubmitted}
            >
              <Text style={styles.statementNumber}>Statement {index + 1}</Text>
              <Text style={styles.statementText}>{statement.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

  {/* submit button removed from scroll content; floating button rendered outside ScrollView */}

        {guessResult && (
          <View style={styles.resultContainer}>
            <Text style={[styles.resultText, guessResult.wasCorrect ? styles.correct : styles.incorrect]}>
              {guessResult.wasCorrect ? '🎉 Correct!' : '🤔 Not quite!'}
            </Text>
            <Text style={styles.scoreText}>Score: +{guessResult.totalScore} points</Text>
            <Text style={styles.explanationText}>
              The lie was: "{currentSession?.statements[guessResult.correctStatement].text}"
            </Text>
            <TouchableOpacity style={styles.newGameButton} onPress={handleNewGame}>
              <Text style={styles.newGameButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
  {/* Dead white space at bottom to avoid content being hidden by floating button */}
  <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  // Check if we should use fullscreen interface for current challenge
  const shouldUseFullscreenInterface = useFullscreenInterface && currentSession && selectedChallenge;

  return (
    <>
      {/* Use fullscreen interface when enabled */}
      {shouldUseFullscreenInterface ? (
        <FullscreenGuessScreen
          challenge={selectedChallenge}
          onBack={() => {
            // Return to challenge browser instead of home screen
            console.log('Returning to challenge browser');
            handleNewGame();
          }}
          onComplete={() => {
            console.log('Fullscreen challenge completed');
            // Return to challenge browser instead of home screen
            handleNewGame();
          }}
          onRefreshChallenges={() => {
            console.log('🔄 REFRESH: Refreshing challenges after completion');
            loadChallengesFromAPI();
          }}
        />
      ) : (
        /* Traditional interface with header and layout */
        <SafeAreaView style={styles.container}>
          <AuthStatusBanner
            showForGuests={true}
            guestMessage="Sign in to save your game progress"
            onAuthAction={() => {
              // Navigate back to trigger auth flow
              if (onBack) onBack();
            }}
          />
          
          <View style={styles.header}>
            <TouchableOpacity onPress={currentSession ? handleNewGame : onBack}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Guess Challenge</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {!currentSession ? renderChallengeList() : renderGameplay()}
          
          {/* Challenge Creation Modal */}
          <Modal
            visible={showChallengeCreation}
            animationType="slide"
            presentationStyle="fullScreen"
          >
            <ChallengeCreationScreen
              onComplete={() => {
                setShowChallengeCreation(false);
                Alert.alert(
                  'Challenge Created!',
                  'Your challenge is now available for others to play.',
                  [{ 
                    text: 'OK', 
                    style: 'default',
                    onPress: () => {
                      // Refresh the challenge list to show the new challenge
                      loadChallengesFromAPI();
                    }
                  }]
                );
              }}
              onCancel={() => setShowChallengeCreation(false)}
            />
          </Modal>

          {/* Report Modal */}
          {reportingChallengeId && (
            <ReportModal
              visible={showReportModal}
              onClose={handleCloseReportModal}
              onSubmit={handleSubmitReport}
              isSubmitting={isSubmittingReport}
            />
          )}

          {/* Animated Feedback */}
          {guessResult && (
            <AnimatedFeedback
              result={guessResult}
              currentStreak={currentStreak}
              showStreakAnimation={currentStreak > 1}
              onAnimationComplete={() => {
                console.log('✅ Animation completed, clearing result');
                dispatch(clearGuessResult());
              }}
            />
          )}

          {/* Floating submit button: visible during an active session when a statement is selected and no guess submitted */}
          <FloatingSubmitButton
            visible={!!currentSession && !guessSubmitted && selectedStatement !== null}
            onPress={handleSubmitGuess}
            text="Submit Guess"
            styles={styles}
          />
        </SafeAreaView>
      )}
    </>
  );
};

// Floating submit button appears above system UI and is device-agnostic
const FloatingSubmitButton: React.FC<{ 
  visible: boolean; 
  onPress: () => void; 
  text: string; 
  styles: any 
}> = ({ visible, onPress, text, styles }) => {
  if (!visible) return null;
  return (
    <TouchableOpacity
      style={styles.floatingSubmitButton}
      onPress={onPress}
      accessibilityLabel="Submit Guess"
      testID="submit-guess-button"
    >
      <Text style={styles.floatingSubmitButtonText}>{text}</Text>
    </TouchableOpacity>
  );
};

// Platform-aware bottom padding so buttons aren't hidden behind system UI (Android nav bar)
const bottomPadding = Platform.OS === 'android' ? 96 : 20;

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.headerText,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    fontSize: 16,
    color: colors.headerText,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: colors.text,
    opacity: 0.8,
  },
  challengeList: {
    flex: 1,
    padding: 20,
  },
  challengeCard: {
    backgroundColor: colors.card,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  challengeContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  reportButton: {
    marginLeft: 8,
  },
  createChallengeCard: {
    backgroundColor: colors.createChallengeCardBackground,
    borderColor: colors.createChallengeCardBorder,
    borderWidth: 2,
  },
  createChallengeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.createChallengeCardText,
    textAlign: 'center',
  },
  createChallengeSubtitle: {
    fontSize: 14,
    color: colors.createChallengeCardText,
    textAlign: 'center',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  creatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  difficultyText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    marginTop: 5,
  },
  statsText: {
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 5,
  },
  gameplayContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: bottomPadding,
  },
  statementCard: {
    backgroundColor: colors.card,
    padding: 20,
    marginVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedStatement: {
    borderColor: colors.primary,
    backgroundColor: colors.selectedCard,
  },
  statementText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  submitButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: colors.card,
    padding: 20,
    marginTop: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  correct: {
    color: colors.success,
  },
  incorrect: {
    color: colors.incorrect,
  },
  scoreText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 10,
  },
  explanationText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 20,
  },
  newGameButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
  },
  newGameButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoToggleButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  videoToggleText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    backgroundColor: colors.videoPlayerBackground,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statementsSection: {
    marginBottom: 20,
  },
  gameplaySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  statementNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text,
    opacity: 0.8,
    marginTop: 10,
  },
  retryCountText: {
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 5,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.errorBackground,
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  networkErrorContainer: {
    backgroundColor: colors.networkErrorBackground,
    borderColor: colors.networkErrorBorder,
  },
  authErrorContainer: {
    backgroundColor: colors.authErrorBackground,
    borderColor: colors.authErrorBorder,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  autoRetryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  autoRetryText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
  lastUpdateText: {
    fontSize: 10,
    color: colors.placeholder,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
  },
  challengeId: {
    fontSize: 10,
    color: colors.placeholder,
    marginTop: 5,
    fontFamily: 'monospace',
  },
  debugText: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  individualVideoContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  floatingSubmitButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'android' ? 24 : 34,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  floatingSubmitButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 120,
    backgroundColor: colors.card,
    width: '100%',
  },
  headerSpacer: {
    width: 60, // Match the approximate width of the back button for centering
  },
  // Profile Card styles
  profileCard: {
    backgroundColor: colors.card,
    marginVertical: 10,
    marginHorizontal: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  guestLabel: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
  },
});
