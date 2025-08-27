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
} from '../store/slices/guessingGameSlice';
import { EnhancedChallenge, GuessResult } from '../types';
import { ChallengeCreationScreen } from './ChallengeCreationScreen';
import AnimatedFeedback from '../shared/AnimatedFeedback';

// Mock challenges for testing
const mockChallenges: EnhancedChallenge[] = [
  {
    id: 'challenge_1',
    creatorId: 'user_1',
    creatorName: 'Alice',
    statements: [
      {
        id: 'stmt_1',
        text: 'I have climbed Mount Everest',
        isLie: true,
        viewCount: 150,
        guessAccuracy: 75,
        averageConfidence: 60,
      },
      {
        id: 'stmt_2',
        text: 'I can speak 4 languages fluently',
        isLie: false,
        viewCount: 150,
        guessAccuracy: 45,
        averageConfidence: 50,
      },
      {
        id: 'stmt_3',
        text: 'I once met a famous movie star',
        isLie: false,
        viewCount: 150,
        guessAccuracy: 65,
        averageConfidence: 55,
      },
    ],
    mediaData: [],
    difficultyRating: 65,
    averageGuessTime: 25000,
    popularityScore: 80,
    emotionComplexity: 55,
    recommendationWeight: 75,
    totalGuesses: 150,
    correctGuessRate: 65,
    createdAt: '2024-01-15T00:00:00.000Z' as any,
    lastPlayed: '2024-08-20T00:00:00.000Z' as any,
    tags: ['travel', 'languages', 'celebrities'],
    isActive: true,
  },
  {
    id: 'challenge_2',
    creatorId: 'user_2',
    creatorName: 'Bob',
    statements: [
      {
        id: 'stmt_4',
        text: 'I own 5 cats',
        isLie: false,
        viewCount: 89,
        guessAccuracy: 55,
        averageConfidence: 70,
      },
      {
        id: 'stmt_5',
        text: 'I have never broken a bone',
        isLie: false,
        viewCount: 89,
        guessAccuracy: 40,
        averageConfidence: 45,
      },
      {
        id: 'stmt_6',
        text: 'I was born in Antarctica',
        isLie: true,
        viewCount: 89,
        guessAccuracy: 85,
        averageConfidence: 90,
      },
    ],
    mediaData: [],
    difficultyRating: 45,
    averageGuessTime: 18000,
    popularityScore: 60,
    emotionComplexity: 35,
    recommendationWeight: 50,
    totalGuesses: 89,
    correctGuessRate: 75,
    createdAt: '2024-02-10T00:00:00.000Z' as any,
    lastPlayed: '2024-08-19T00:00:00.000Z' as any,
    tags: ['pets', 'health', 'geography'],
    isActive: true,
  },
];

export const GameScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    availableChallenges,
    selectedChallenge,
    currentSession,
    guessSubmitted,
    guessResult,
    showAnimatedFeedback,
  } = useAppSelector((state) => state.guessingGame);

  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [showChallengeCreation, setShowChallengeCreation] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    // Load mock challenges when component mounts
    dispatch(loadChallenges(mockChallenges));
  }, [dispatch]);

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
      
      {availableChallenges.map((challenge) => (
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
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderGameplay = () => (
    <ScrollView style={styles.gameplayContainer}>
      <Text style={styles.title}>Which statement is the lie?</Text>
      <Text style={styles.subtitle}>By {selectedChallenge?.creatorName}</Text>
      
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
          <Text style={styles.statementText}>{statement.text}</Text>
        </TouchableOpacity>
      ))}

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
              [{ text: 'OK', style: 'default' }]
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
});
