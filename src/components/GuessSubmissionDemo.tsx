/**
 * Demo component for the Guess Submission Interface
 * Shows the complete guessing workflow with real-time feedback
 */

import React, { useState } from 'react';
import { GuessSubmissionInterface } from './GuessSubmissionInterface';
import { ChallengeBrowser } from './ChallengeBrowser';
import { EnhancedChallenge, GuessResult } from '../types';

export const GuessSubmissionDemo: React.FC = () => {
  const [currentView, setCurrentView] = useState<'browse' | 'guess' | 'results'>('browse');
  const [selectedChallenge, setSelectedChallenge] = useState<EnhancedChallenge | null>(null);
  const [lastResult, setLastResult] = useState<GuessResult | null>(null);

  const handleChallengeSelect = (challenge: EnhancedChallenge) => {
    setSelectedChallenge(challenge);
    setCurrentView('guess');
  };

  const handleGuessComplete = (result: GuessResult) => {
    setLastResult(result);
    setCurrentView('results');
  };

  const handleBackToBrowse = () => {
    setCurrentView('browse');
    setSelectedChallenge(null);
    setLastResult(null);
  };

  const handlePlayAgain = () => {
    setCurrentView('browse');
    setLastResult(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1F2937',
            margin: '0 0 8px 0'
          }}>
            🎯 Two Truths and a Lie
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: '0'
          }}>
            {currentView === 'browse' && 'Choose a challenge to start guessing'}
            {currentView === 'guess' && 'Analyze the statements and guess the lie'}
            {currentView === 'results' && 'See how you did and play again'}
          </p>
        </div>

        {/* Navigation breadcrumb */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          fontSize: '14px',
          color: '#6B7280'
        }}>
          <span 
            onClick={handleBackToBrowse}
            style={{
              cursor: 'pointer',
              color: currentView === 'browse' ? '#3B82F6' : '#6B7280',
              fontWeight: currentView === 'browse' ? '600' : '400'
            }}
          >
            🏠 Browse Challenges
          </span>
          {(currentView === 'guess' || currentView === 'results') && (
            <>
              <span>→</span>
              <span 
                style={{
                  color: currentView === 'guess' ? '#3B82F6' : '#6B7280',
                  fontWeight: currentView === 'guess' ? '600' : '400'
                }}
              >
                🎯 Guessing
              </span>
            </>
          )}
          {currentView === 'results' && (
            <>
              <span>→</span>
              <span style={{ color: '#3B82F6', fontWeight: '600' }}>
                📊 Results
              </span>
            </>
          )}
        </div>

        {/* Main Content */}
        {currentView === 'browse' && (
          <div>
            <ChallengeBrowser onChallengeSelect={handleChallengeSelect} />
            
            {/* Instructions */}
            <div style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#1F2937' }}>
                🎮 How to Play
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                fontSize: '14px',
                color: '#6B7280'
              }}>
                <div>
                  <strong style={{ color: '#374151' }}>1. Choose a Challenge</strong>
                  <br />
                  Browse available challenges and select one that interests you.
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>2. Analyze Statements</strong>
                  <br />
                  Listen to the three statements and watch for clues in the videos.
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>3. Make Your Guess</strong>
                  <br />
                  Select which statement you think is the lie and set your confidence.
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>4. Get Feedback</strong>
                  <br />
                  See if you were right and earn points based on your performance.
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'guess' && selectedChallenge && (
          <GuessSubmissionInterface
            challenge={selectedChallenge}
            onComplete={handleGuessComplete}
            onBack={handleBackToBrowse}
          />
        )}

        {currentView === 'results' && lastResult && selectedChallenge && (
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '32px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              {lastResult.wasCorrect ? '🎉' : '🤔'}
            </div>
            
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: lastResult.wasCorrect ? '#059669' : '#DC2626',
              margin: '0 0 16px 0'
            }}>
              {lastResult.wasCorrect ? 'Congratulations!' : 'Better Luck Next Time!'}
            </h2>

            <div style={{
              fontSize: '18px',
              color: '#374151',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              {lastResult.wasCorrect ? (
                <>
                  You correctly identified the lie in "{selectedChallenge.creatorName}'s" challenge!
                  <br />
                  <strong>Statement {lastResult.correctStatement + 1}</strong> was indeed the lie.
                </>
              ) : (
                <>
                  You guessed <strong>Statement {lastResult.guessedStatement + 1}</strong>, but the lie was actually
                  <br />
                  <strong>Statement {lastResult.correctStatement + 1}</strong>.
                </>
              )}
            </div>

            {/* Detailed Score Breakdown */}
            <div style={{
              padding: '20px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              marginBottom: '24px'
            }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>
                📊 Score Breakdown
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#6B7280' }}>Base Points:</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>+{lastResult.pointsEarned}</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#6B7280' }}>Time Bonus:</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>+{lastResult.timeBonus}</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#6B7280' }}>Confidence Bonus:</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>+{lastResult.accuracyBonus}</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#6B7280' }}>Streak Bonus:</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>+{lastResult.streakBonus}</span>
                </div>
              </div>
              
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: lastResult.wasCorrect ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${lastResult.wasCorrect ? '#10B981' : '#EF4444'}`,
                borderRadius: '6px'
              }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: lastResult.wasCorrect ? '#065F46' : '#991B1B'
                }}>
                  Total Score: {lastResult.totalScore} points
                </div>
              </div>
            </div>

            {/* Achievements */}
            {lastResult.newAchievements.length > 0 && (
              <div style={{
                padding: '16px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#92400E' }}>
                  🏆 New Achievements Unlocked!
                </h4>
                <div style={{ fontSize: '14px', color: '#92400E' }}>
                  {lastResult.newAchievements.map(achievement => (
                    <div key={achievement} style={{ margin: '4px 0' }}>
                      ✨ {achievement.replace('_', ' ').toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handlePlayAgain}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3B82F6';
                }}
              >
                🎮 Play Again
              </button>
              
              <button
                onClick={handleBackToBrowse}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6B7280',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4B5563';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#6B7280';
                }}
              >
                🏠 Browse More
              </button>
            </div>

            {/* Challenge Stats */}
            <div style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
                📈 Challenge Statistics
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '8px',
                fontSize: '12px',
                color: '#6B7280'
              }}>
                <div>
                  <strong style={{ color: '#374151' }}>{Math.round(selectedChallenge.correctGuessRate * 100)}%</strong>
                  <br />Success Rate
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>{selectedChallenge.totalGuesses}</strong>
                  <br />Total Guesses
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>{Math.round(selectedChallenge.averageGuessTime / 1000)}s</strong>
                  <br />Avg Time
                </div>
                <div>
                  <strong style={{ color: '#374151' }}>{selectedChallenge.difficultyRating}/100</strong>
                  <br />Difficulty
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};