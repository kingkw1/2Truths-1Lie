/**
 * Guess Submission Interface Component
 * Handles the core guessing gameplay with real-time feedback
 * Relates to Requirements 1, 4: Core Game Loop and Social Guessing
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  startGuessingSession,
  submitGuess,
  setGuessResult,
  updateConfidenceScore,
  updateTimeSpent,
  updateTimeRemaining,
  useHint,
  hideHint,
  endGuessingSession,
  hideAnimatedFeedback
} from '../store/slices/guessingGameSlice';
import { useGuessResults } from '../hooks/useWebSocket';
import { EnhancedChallenge, GuessResult } from '../types';
import { ProgressiveHintService, ProgressiveHint, HintLevel } from '../services/progressiveHintService';
import { AnimatedFeedback } from './AnimatedFeedback';

interface GuessSubmissionInterfaceProps {
  challenge: EnhancedChallenge;
  onComplete?: (result: GuessResult) => void;
  onBack?: () => void;
}

export const GuessSubmissionInterface: React.FC<GuessSubmissionInterfaceProps> = ({
  challenge,
  onComplete,
  onBack
}) => {
  const dispatch = useAppDispatch();
  const { 
    currentSession, 
    guessSubmitted, 
    guessResult, 
    showHint, 
    timeRemaining,
    currentStreak,
    showAnimatedFeedback
  } = useAppSelector(state => state.guessingGame);

  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [progressiveHints, setProgressiveHints] = useState<ProgressiveHint[]>([]);
  const [currentHintLevel, setCurrentHintLevel] = useState<HintLevel>('basic');
  const [showProgressiveHint, setShowProgressiveHint] = useState(false);
  const [hintProgress, setHintProgress] = useState(0);

  const { subscribeToGuessResults } = useGuessResults();
  const hintServiceRef = useRef<ProgressiveHintService | null>(null);

  // Initialize guessing session and progressive hints
  useEffect(() => {
    if (!currentSession && challenge) {
      dispatch(startGuessingSession({
        challengeId: challenge.id,
        statements: challenge.statements
      }));

      // Initialize progressive hint service
      hintServiceRef.current = new ProgressiveHintService({
        maxHintsPerLevel: 2,
        timeBetweenHints: 10000, // 10 seconds between hints
        enableEmotionalAnalysis: true,
        enableLinguisticAnalysis: true,
        enableBehavioralAnalysis: true,
        enableStatisticalAnalysis: true,
        adaptiveDifficulty: true,
      });

      hintServiceRef.current.initializeHints(challenge.statements);
      setHintProgress(hintServiceRef.current.getHintProgress());
    }
  }, [challenge, currentSession, dispatch]);

  // Timer countdown
  useEffect(() => {
    if (!guessSubmitted && timeRemaining !== null && timeRemaining > 0) {
      const timer = setInterval(() => {
        const newTime = timeRemaining - 1;
        dispatch(updateTimeRemaining(newTime));
        
        if (newTime <= 0) {
          // Auto-submit if time runs out
          handleTimeUp();
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, guessSubmitted, dispatch]);

  // Update time spent
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSpent = Date.now() - sessionStartTime;
      dispatch(updateTimeSpent(timeSpent));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime, dispatch]);

  // Subscribe to real-time guess results
  useEffect(() => {
    const unsubscribe = subscribeToGuessResults((result: GuessResult) => {
      if (result.sessionId === currentSession?.sessionId) {
        dispatch(setGuessResult(result));
        setIsSubmitting(false);
        setShowFeedback(true);
        
        // Auto-complete after showing feedback
        setTimeout(() => {
          onComplete?.(result);
        }, 3000);
      }
    });

    return unsubscribe;
  }, [subscribeToGuessResults, currentSession?.sessionId, dispatch, onComplete]);

  const handleTimeUp = useCallback(() => {
    if (!guessSubmitted && selectedStatement !== null) {
      handleSubmitGuess();
    } else if (!guessSubmitted) {
      // Random guess if no selection
      const randomGuess = Math.floor(Math.random() * challenge.statements.length);
      setSelectedStatement(randomGuess);
      setTimeout(() => handleSubmitGuess(), 100);
    }
  }, [guessSubmitted, selectedStatement, challenge.statements.length]);

  const handleStatementSelect = (index: number) => {
    if (!guessSubmitted) {
      setSelectedStatement(index);
    }
  };

  const handleConfidenceChange = (confidence: number) => {
    setConfidenceLevel(confidence);
    if (selectedStatement !== null) {
      dispatch(updateConfidenceScore({ 
        statementIndex: selectedStatement, 
        confidence: confidence / 100 
      }));
    }
  };

  const handleUseHint = () => {
    if (!hintServiceRef.current) return;

    const nextHint = hintServiceRef.current.getNextHint();
    if (nextHint) {
      setProgressiveHints(prev => [...prev, nextHint]);
      setCurrentHintLevel(hintServiceRef.current!.getCurrentLevel());
      setHintProgress(hintServiceRef.current!.getHintProgress());
      setShowProgressiveHint(true);
      
      dispatch(useHint());
      
      // Auto-hide hint after 15 seconds
      setTimeout(() => {
        setShowProgressiveHint(false);
      }, 15000);
    }
  };

  const handleRequestSpecificHint = (category: ProgressiveHint['category']) => {
    if (!hintServiceRef.current) return;

    const hint = hintServiceRef.current.revealHintByCategory(category);
    if (hint) {
      setProgressiveHints(prev => [...prev, hint]);
      setCurrentHintLevel(hintServiceRef.current!.getCurrentLevel());
      setHintProgress(hintServiceRef.current!.getHintProgress());
      setShowProgressiveHint(true);
      
      dispatch(useHint());
      
      setTimeout(() => {
        setShowProgressiveHint(false);
      }, 15000);
    }
  };

  const handleSubmitGuess = async () => {
    if (selectedStatement === null || guessSubmitted) return;

    setIsSubmitting(true);
    dispatch(submitGuess(selectedStatement));

    // Simulate API call for guess result (in real app this would be handled by WebSocket)
    setTimeout(() => {
      const correctStatement = challenge.statements.findIndex(stmt => stmt.isLie);
      const wasCorrect = selectedStatement === correctStatement;
      
      // Calculate points based on various factors
      const basePoints = wasCorrect ? 100 : 0;
      const timeBonus = timeRemaining ? Math.floor((timeRemaining / 60) * 20) : 0;
      const confidenceBonus = wasCorrect ? Math.floor((confidenceLevel / 100) * 30) : 0;
      const difficultyBonus = Math.floor((challenge.difficultyRating / 100) * 50);
      
      // Calculate streak bonus
      const streakBonus = wasCorrect && currentStreak >= 1 ? (currentStreak + 1) * 25 : 0;
      
      // Generate achievements based on performance
      const achievements: string[] = [];
      if (wasCorrect) {
        if (currentStreak === 0) achievements.push('first_correct_guess');
        if (currentStreak + 1 === 3) achievements.push('streak_master');
        if (currentStreak + 1 === 5) achievements.push('deception_expert');
        if (confidenceLevel >= 90 && wasCorrect) achievements.push('perfectionist');
        if (timeRemaining && timeRemaining >= 45) achievements.push('speed_demon');
      }

      const mockResult: GuessResult = {
        sessionId: currentSession!.sessionId,
        playerId: currentSession!.playerId,
        challengeId: challenge.id,
        guessedStatement: selectedStatement,
        correctStatement,
        wasCorrect,
        pointsEarned: basePoints,
        timeBonus,
        accuracyBonus: confidenceBonus,
        streakBonus,
        totalScore: basePoints + timeBonus + confidenceBonus + difficultyBonus + streakBonus,
        newAchievements: achievements,
        levelUp: wasCorrect && (currentStreak + 1) % 5 === 0 ? {
          oldLevel: Math.floor((currentStreak + 1) / 5),
          newLevel: Math.floor((currentStreak + 1) / 5) + 1,
          rewardsUnlocked: ['new_cosmetic_pack']
        } : undefined
      };

      dispatch(setGuessResult(mockResult));
      setIsSubmitting(false);
      // Don't set showFeedback here - let AnimatedFeedback handle the timing
    }, 1500);
  };

  const handleBackToChallenge = () => {
    dispatch(endGuessingSession());
    onBack?.();
  };

  const handleAnimationComplete = () => {
    dispatch(hideAnimatedFeedback());
    setShowFeedback(true);
    
    // Auto-complete after showing feedback
    setTimeout(() => {
      onComplete?.(guessResult!);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatementStyle = (index: number) => ({
    padding: '16px',
    margin: '8px 0',
    borderRadius: '8px',
    border: selectedStatement === index ? '2px solid #3B82F6' : '1px solid #E5E7EB',
    backgroundColor: selectedStatement === index ? '#EFF6FF' : '#FFFFFF',
    cursor: guessSubmitted ? 'default' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: guessSubmitted && selectedStatement !== index ? 0.6 : 1,
    position: 'relative' as const
  });

  if (!currentSession) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading challenge...</div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          .hint-button:hover {
            animation: pulse 0.5s ease-in-out;
          }
        `}
      </style>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#F8FAFC',
        borderRadius: '8px',
        border: '1px solid #E2E8F0'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#1F2937', fontSize: '24px' }}>
            🎯 Guess the Lie
          </h2>
          <p style={{ margin: '0', color: '#6B7280', fontSize: '14px' }}>
            Challenge by {challenge.creatorName} • Difficulty: {challenge.difficultyRating}/100
          </p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          {timeRemaining !== null && (
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: timeRemaining <= 10 ? '#EF4444' : '#059669',
              marginBottom: '4px'
            }}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          )}
          <button
            onClick={handleBackToChallenge}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6B7280',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Instructions */}
      {!guessSubmitted && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: '0', fontSize: '14px', color: '#92400E' }}>
            💡 <strong>Instructions:</strong> Listen to each statement carefully and select the one you think is the lie. 
            Use the confidence slider to indicate how sure you are of your choice.
          </p>
        </div>
      )}

      {/* Statements */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: '#374151' }}>Select the statement you think is the lie:</h3>
        
        {challenge.statements.map((statement, index) => (
          <div
            key={statement.id}
            onClick={() => handleStatementSelect(index)}
            style={getStatementStyle(index)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: selectedStatement === index ? '#3B82F6' : '#E5E7EB',
                color: selectedStatement === index ? '#FFFFFF' : '#6B7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                flexShrink: 0
              }}>
                {index + 1}
              </div>
              
              <div style={{ flex: 1 }}>
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '16px', 
                  color: '#1F2937',
                  lineHeight: '1.5'
                }}>
                  {statement.text}
                </p>
                
                {/* Media preview placeholder */}
                {challenge.mediaData[index] && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#6B7280',
                    marginBottom: '8px'
                  }}>
                    🎥 Video recording ({Math.round((challenge.mediaData[index].duration || 0) / 1000)}s)
                  </div>
                )}

                {/* Statement analytics (shown after submission) */}
                {guessSubmitted && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#6B7280',
                    marginTop: '8px'
                  }}>
                    <span>📊 {Math.round(statement.guessAccuracy * 100)}% accuracy</span>
                    <span>👥 {statement.viewCount} views</span>
                    {statement.popularGuess && <span style={{ color: '#EF4444' }}>🔥 Popular choice</span>}
                  </div>
                )}
              </div>

              {/* Result indicator */}
              {showFeedback && guessResult && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  backgroundColor: statement.isLie ? '#10B981' : 
                                   index === selectedStatement ? '#EF4444' : '#F3F4F6',
                  color: statement.isLie ? '#FFFFFF' : 
                         index === selectedStatement ? '#FFFFFF' : '#6B7280'
                }}>
                  {statement.isLie ? '✓ LIE' : 
                   index === selectedStatement ? '✗ TRUTH' : 'TRUTH'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confidence Slider */}
      {selectedStatement !== null && !guessSubmitted && (
        <div style={{
          padding: '16px',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          marginBottom: '20px'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontSize: '14px', 
            fontWeight: '600',
            color: '#374151'
          }}>
            How confident are you? {confidenceLevel}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={confidenceLevel}
            onChange={(e) => handleConfidenceChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #EF4444 0%, #F59E0B 50%, #10B981 100%)`,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#6B7280',
            marginTop: '4px'
          }}>
            <span>Not sure</span>
            <span>Very confident</span>
          </div>
        </div>
      )}

      {/* Progressive Hint System */}
      {!guessSubmitted && hintServiceRef.current && hintServiceRef.current.hasMoreHints() && (
        <div style={{
          padding: '16px',
          backgroundColor: '#EBF8FF',
          border: '1px solid #3B82F6',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {/* Hint Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div>
              <span style={{ fontSize: '14px', color: '#1E40AF', fontWeight: '600' }}>
                🧠 Progressive Analysis System
              </span>
              <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '2px' }}>
                Level: {currentHintLevel.charAt(0).toUpperCase() + currentHintLevel.slice(1)} • 
                Progress: {Math.round(hintProgress)}%
              </div>
            </div>
            <button
              onClick={handleUseHint}
              disabled={!hintServiceRef.current?.hasMoreHints()}
              style={{
                padding: '8px 16px',
                backgroundColor: hintServiceRef.current?.hasMoreHints() ? '#3B82F6' : '#9CA3AF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: hintServiceRef.current?.hasMoreHints() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              Get Next Clue
            </button>
          </div>

          {/* Hint Progress Bar */}
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#DBEAFE',
            borderRadius: '2px',
            marginBottom: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${hintProgress}%`,
              height: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Specific Hint Categories */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {[
              { category: 'emotional' as const, icon: '😊', label: 'Emotions' },
              { category: 'linguistic' as const, icon: '📝', label: 'Language' },
              { category: 'behavioral' as const, icon: '🎭', label: 'Behavior' },
              { category: 'statistical' as const, icon: '📊', label: 'Stats' }
            ].map(({ category, icon, label }) => (
              <button
                key={category}
                onClick={() => handleRequestSpecificHint(category)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #3B82F6',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#1E40AF',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DBEAFE';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          
          {/* Current Progressive Hint */}
          {showProgressiveHint && progressiveHints.length > 0 && (
            <div style={{
              padding: '12px',
              backgroundColor: '#DBEAFE',
              borderRadius: '6px',
              border: '1px solid #93C5FD',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              {(() => {
                const latestHint = progressiveHints[progressiveHints.length - 1];
                return (
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#1E40AF',
                        backgroundColor: '#FFFFFF',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        {latestHint.category.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#3B82F6'
                      }}>
                        Confidence: {Math.round(latestHint.confidence * 100)}%
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#1E40AF',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      {latestHint.title}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#1E40AF',
                      lineHeight: '1.4'
                    }}>
                      {latestHint.content}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Revealed Hints Summary */}
          {progressiveHints.length > 0 && (
            <div style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#6B7280'
            }}>
              <details>
                <summary style={{ cursor: 'pointer', color: '#3B82F6' }}>
                  View Previous Clues ({progressiveHints.length})
                </summary>
                <div style={{
                  marginTop: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '4px'
                }}>
                  {progressiveHints.map((hint, index) => (
                    <div key={hint.id} style={{
                      padding: '4px 0',
                      borderBottom: index < progressiveHints.length - 1 ? '1px solid #E5E7EB' : 'none'
                    }}>
                      <div style={{ fontWeight: '600', color: '#374151' }}>
                        {hint.title}
                      </div>
                      <div style={{ color: '#6B7280', fontSize: '11px' }}>
                        {hint.content}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {!guessSubmitted ? (
          <button
            onClick={handleSubmitGuess}
            disabled={selectedStatement === null || isSubmitting}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedStatement !== null ? '#10B981' : '#9CA3AF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: selectedStatement !== null ? 'pointer' : 'not-allowed',
              minWidth: '160px',
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? '⏳ Submitting...' : '🎯 Submit Guess'}
          </button>
        ) : showFeedback && guessResult ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: guessResult.wasCorrect ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${guessResult.wasCorrect ? '#10B981' : '#EF4444'}`,
            borderRadius: '8px',
            width: '100%'
          }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '8px'
            }}>
              {guessResult.wasCorrect ? '🎉 Correct!' : '❌ Incorrect'}
            </div>
            <div style={{
              fontSize: '16px',
              color: guessResult.wasCorrect ? '#065F46' : '#991B1B',
              marginBottom: '12px'
            }}>
              {guessResult.wasCorrect 
                ? `Great job! You earned ${guessResult.totalScore} points.`
                : `The lie was statement ${guessResult.correctStatement + 1}. You earned ${guessResult.totalScore} points for trying.`
              }
            </div>
            
            {/* Score breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '8px',
              fontSize: '12px',
              color: '#6B7280'
            }}>
              <div>Base: +{guessResult.pointsEarned}</div>
              <div>Time: +{guessResult.timeBonus}</div>
              <div>Confidence: +{guessResult.accuracyBonus}</div>
              <div style={{ fontWeight: '600' }}>Total: {guessResult.totalScore}</div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#6B7280'
          }}>
            ⏳ Processing your guess...
          </div>
        )}
      </div>
      </div>

      {/* Animated Feedback Overlay */}
      {showAnimatedFeedback && guessResult && (
        <AnimatedFeedback
          result={guessResult}
          currentStreak={currentStreak}
          showStreakAnimation={guessResult.wasCorrect && currentStreak > 1}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </>
  );
};