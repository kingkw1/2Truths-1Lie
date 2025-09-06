import React, { useEffect, useState } from 'react';
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
import { EnhancedChallenge, GuessResult } from '../types';
import { ChallengeCreationScreen } from './ChallengeCreationScreen';
import AnimatedFeedback from '../shared/AnimatedFeedback';
import SimpleVideoPlayer from '../components/SimpleVideoPlayer';
import { realChallengeAPI, Challenge as BackendChallenge } from '../services/realChallengeAPI';
import { errorHandlingService } from '../services/errorHandlingService';

// Helper function to convert backend challenge to frontend format
const convertBackendChallenge = (backendChallenge: BackendChallenge): EnhancedChallenge => {
  return {
    id: backendChallenge.challenge_id,
    creatorId: backendChallenge.creator_id,
    creatorName: `User ${backendChallenge.creator_id.slice(0, 8)}`, // Generate display name from ID
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
                streamingUrl: stmt.streaming_url || stmt.media_url,
                duration: (stmt.duration_seconds || 0) * 1000, // Convert to milliseconds
                mediaId: stmt.media_file_id,
                isUploaded: true,
                storageType: stmt.storage_type as any,
                cloudStorageKey: stmt.cloud_storage_key,
              }));
              
              return individualMedia;
            } else {
              // Only merged video available - create merged video entry
              console.log('🎬 MERGED_STRATEGY: Using merged video (no individual URLs available)');
              const mergedVideo = {
                type: 'video' as const,
                streamingUrl: mergedVideoUrl,
                duration: (mergedMetadata.total_duration || 0) * 1000, // Convert seconds to milliseconds
                mediaId: mergedVideoFileId,
                isUploaded: true,
                storageType: 'cloud' as any,
                cloudStorageKey: `challenges/${backendChallenge.challenge_id}/merged.mp4`,
                isMergedVideo: true,
                segments: (mergedMetadata.segments || []).map((segment: any, index: number) => ({
                  statementIndex: segment.statement_index || index,
                  startTime: (segment.start_time || 0) * 1000, // Convert seconds to milliseconds
                  endTime: (segment.end_time || 0) * 1000, // Convert seconds to milliseconds
                  duration: (segment.duration || 0) * 1000, // Convert seconds to milliseconds
                  url: mergedVideoUrl,
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
        streamingUrl: stmt.streaming_url || stmt.media_url,
        duration: (stmt.duration_seconds || 0) * 1000, // Convert to milliseconds
        mediaId: stmt.media_file_id,
        isUploaded: true,
        storageType: stmt.storage_type as any,
        cloudStorageKey: stmt.cloud_storage_key,
      }));

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

export const GameScreen: React.FC = () => {
  const dispatch = useAppDispatch();
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
      
      if (response.success && response.data) {
        // console.log('✅ GAME: Successfully loaded challenges:', response.data.length);
        
        // Convert backend challenges to frontend format
        const enhancedChallenges = response.data.map(convertBackendChallenge);
        dispatch(loadChallenges(enhancedChallenges));
      } else {
        const errorMessage = response.error || 'Failed to load challenges';
        console.error('❌ GAME: Failed to load challenges:', errorMessage);
        
        const errorDetails = errorHandlingService.categorizeError(new Error(errorMessage));
        errorHandlingService.logError(errorDetails, 'GameScreen.loadChallenges');
        
        dispatch(setChallengeLoadError({ 
          error: errorMessage,
          errorType: errorDetails.type 
        }));
        
        // Only fallback to empty array if it's not a retryable error
        if (!errorDetails.retryable) {
          dispatch(loadChallenges([]));
        }
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
    dispatch(selectChallenge(challenge));
    dispatch(startGuessingSession({
      challengeId: challenge.id,
      statements: challenge.statements,
    }));
    setSelectedStatement(null);
  };

  const handleSubmitGuess = () => {
    if (selectedStatement === null || !currentSession) return;

    dispatch(submitGuess(selectedStatement));

    // Simulate guess result
    setTimeout(() => {
      const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
      const wasCorrect = selectedStatement === correctStatement;

      const mockResult: GuessResult = {
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

      dispatch(setGuessResult(mockResult));
    }, 1500);
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
      <Text style={styles.title}>Two Truths & a Lie</Text>
      
      {/* Create Challenge Button */}
      <TouchableOpacity
        style={[styles.challengeCard, styles.createChallengeCard]}
        onPress={() => setShowChallengeCreation(true)}
      >
        <Text style={styles.createChallengeTitle}>📹 Create New Challenge</Text>
        <Text style={styles.createChallengeSubtitle}>
          Record your own two truths and a lie
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Play Existing Challenges</Text>
      
      {/* Loading State */}
      {(isLoading || isRetrying) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
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
                <ActivityIndicator size="small" color="#4a90e2" />
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
        <TouchableOpacity
          key={challenge.id}
          style={styles.challengeCard}
          onPress={() => handleSelectChallenge(challenge)}
        >
          <Text style={styles.creatorName}>By {challenge.creatorName}</Text>
          <Text style={styles.difficultyText}>
            Difficulty: {challenge.difficultyRating}/100
          </Text>
          <Text style={styles.statsText}>
            {challenge.totalGuesses} guesses • {challenge.correctGuessRate}% correct
          </Text>
          <Text style={styles.challengeId}>ID: {challenge.id}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderGameplay = () => {
    const mergedVideo = selectedChallenge?.mediaData?.find(media => media.isMergedVideo);
    const hasSegmentedVideo = mergedVideo && mergedVideo.segments && mergedVideo.segments.length === 3;
    const individualVideos = selectedChallenge?.mediaData?.filter(media => !media.isMergedVideo) || [];
    const hasIndividualVideos = individualVideos.length === 3; // For 3-statement challenges
    const hasAnyVideo = hasSegmentedVideo || hasIndividualVideos;

    // Debug logging
    console.log('🎥 RENDER GAMEPLAY:', {
      selectedChallengeId: selectedChallenge?.id,
      mediaDataCount: selectedChallenge?.mediaData?.length,
      mergedVideoFound: !!mergedVideo,
      hasSegmentedVideo,
      hasIndividualVideos,
      individualVideosCount: individualVideos.length,
      mergedVideoSegments: mergedVideo?.segments?.length,
    });

    return (
      <ScrollView style={styles.gameplayContainer}>
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

        {/* Segmented Video Player (for merged videos) */}
        {showVideoPlayer && hasSegmentedVideo && (
          <View style={styles.videoPlayerContainer}>
            <Text style={styles.debugText}>
              Video URL: {mergedVideo?.streamingUrl?.substring(0, 100)}
            </Text>
            <Text style={styles.debugText}>
              Segments: {mergedVideo?.segments?.length || 0}
            </Text>
            <Text style={styles.debugText}>
              Total Duration: {mergedVideo?.duration}ms
            </Text>
            <Text style={styles.debugText}>
              Individual Videos Count: {individualVideos.length}
            </Text>
            {individualVideos.map((video, idx) => (
              <Text key={idx} style={styles.debugText}>
                Individual {idx}: {video.streamingUrl?.substring(0, 80)}...
              </Text>
            ))}
            <SimpleVideoPlayer
              key={`segmented-${mergedVideo?.streamingUrl || 'default'}`}
              mergedVideo={mergedVideo}
              individualVideos={individualVideos} // Pass individual videos for proper segment playback
              statementTexts={currentSession?.statements.map((stmt: any) => stmt.text) || []}
              onSegmentSelect={(segmentIndex: number) => {
                console.log(`🎬 GAMESCREEN: Selected segment ${segmentIndex}`);
                console.log(`🎬 GAMESCREEN: Merged video URL: ${mergedVideo?.streamingUrl}`);
                console.log(`🎬 GAMESCREEN: Individual videos:`, individualVideos.map(v => v.streamingUrl));
              }}
            />
          </View>
        )}

        {/* Individual Video Player (for separate videos) */}
        {showVideoPlayer && hasIndividualVideos && !hasSegmentedVideo && (
          <View style={styles.videoPlayerContainer}>
            <Text style={styles.debugText}>
              Individual Videos: {individualVideos.length}
            </Text>
            {individualVideos.map((video, index) => (
              <View key={`${video.mediaId}-${index}`} style={styles.individualVideoContainer}>
                <Text style={styles.videoLabel}>Statement {index + 1} Video</Text>
                <Text style={styles.debugText}>
                  URL: {video.streamingUrl?.substring(0, 100)}...
                </Text>
                <Text style={styles.debugText}>
                  Duration: {video.duration}ms
                </Text>
                <SimpleVideoPlayer
                  key={`individual-${video.mediaId}-${index}`}
                  mergedVideo={{
                    ...video,
                    segments: [{
                      statementIndex: index,
                      startTime: 0,
                      endTime: video.duration || 3000,
                      duration: video.duration || 3000,
                    }]
                  }}
                  statementTexts={[`Statement ${index + 1}`]}
                  onSegmentSelect={(segmentIndex: number) => {
                    console.log(`🎬 Playing individual video ${index}, URL: ${video.streamingUrl}`);
                  }}
                />
              </View>
            ))}
          </View>
        )}
        
        {/* Statement Selection */}
        <View style={styles.statementsSection}>
          <Text style={styles.gameplaySectionTitle}>
            {showVideoPlayer ? 'Make Your Guess:' : 'Read the statements and make your guess:'}
          </Text>
          
          {currentSession?.statements.map((statement: any, index: number) => (
            <TouchableOpacity
              key={statement.id}
              style={[
                styles.statementCard,
                selectedStatement === index && styles.selectedStatement,
              ]}
              onPress={() => !guessSubmitted && setSelectedStatement(index)}
              disabled={guessSubmitted}
            >
              <Text style={styles.statementNumber}>Statement {index + 1}</Text>
              <Text style={styles.statementText}>{statement.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!guessSubmitted && selectedStatement !== null && (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitGuess}>
            <Text style={styles.submitButtonText}>Submit Guess</Text>
          </TouchableOpacity>
        )}

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
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Two Truths & a Lie</Text>
        {currentSession && (
          <TouchableOpacity onPress={handleNewGame}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    fontSize: 16,
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  challengeList: {
    flex: 1,
    padding: 20,
  },
  challengeCard: {
    backgroundColor: 'white',
    padding: 20,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createChallengeCard: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  createChallengeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
  },
  createChallengeSubtitle: {
    fontSize: 14,
    color: '#388e3c',
    textAlign: 'center',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  creatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  difficultyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  statsText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  gameplayContainer: {
    flex: 1,
    padding: 20,
  },
  statementCard: {
    backgroundColor: 'white',
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
    borderColor: '#4a90e2',
    backgroundColor: '#e3f2fd',
  },
  statementText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: 'white',
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
    color: '#4caf50',
  },
  incorrect: {
    color: '#f44336',
  },
  scoreText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
  explanationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  newGameButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 10,
  },
  newGameButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoToggleButton: {
    backgroundColor: '#4a90e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  videoToggleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    padding: 16,
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
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  statementNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  retryCountText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  networkErrorContainer: {
    backgroundColor: '#e3f2fd',
    borderColor: '#bbdefb',
  },
  authErrorContainer: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffcc02',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
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
    color: '#4a90e2',
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  lastUpdateText: {
    fontSize: 10,
    color: '#999',
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
    color: '#333',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  challengeId: {
    fontSize: 10,
    color: '#999',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  debugText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  individualVideoContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  videoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
});
