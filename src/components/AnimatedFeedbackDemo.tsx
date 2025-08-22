/**
 * Demo component for AnimatedFeedback
 * Shows different animation scenarios for correct/incorrect guesses and streaks
 */

import React, { useState } from 'react';
import { AnimatedFeedback } from './AnimatedFeedback';
import { GuessResult } from '../types';

export const AnimatedFeedbackDemo: React.FC = () => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentResult, setCurrentResult] = useState<GuessResult | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);

  const demoScenarios = [
    {
      name: 'First Correct Guess',
      result: {
        sessionId: 'demo-session',
        playerId: 'demo-player',
        challengeId: 'demo-challenge',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 25,
        accuracyBonus: 40,
        streakBonus: 0,
        totalScore: 165,
        newAchievements: ['first_correct_guess']
      } as GuessResult,
      streak: 1
    },
    {
      name: 'Incorrect Guess',
      result: {
        sessionId: 'demo-session',
        playerId: 'demo-player',
        challengeId: 'demo-challenge',
        guessedStatement: 0,
        correctStatement: 2,
        wasCorrect: false,
        pointsEarned: 0,
        timeBonus: 15,
        accuracyBonus: 0,
        streakBonus: 0,
        totalScore: 15,
        newAchievements: []
      } as GuessResult,
      streak: 0
    },
    {
      name: '3-Streak Master',
      result: {
        sessionId: 'demo-session',
        playerId: 'demo-player',
        challengeId: 'demo-challenge',
        guessedStatement: 2,
        correctStatement: 2,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 30,
        accuracyBonus: 45,
        streakBonus: 75,
        totalScore: 250,
        newAchievements: ['streak_master']
      } as GuessResult,
      streak: 3
    },
    {
      name: '5-Streak with Level Up',
      result: {
        sessionId: 'demo-session',
        playerId: 'demo-player',
        challengeId: 'demo-challenge',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 35,
        accuracyBonus: 50,
        streakBonus: 125,
        totalScore: 310,
        newAchievements: ['deception_expert', 'perfectionist'],
        levelUp: {
          oldLevel: 2,
          newLevel: 3,
          rewardsUnlocked: ['premium_cosmetic_pack', 'special_badge']
        }
      } as GuessResult,
      streak: 5
    },
    {
      name: 'Speed Demon (High Confidence)',
      result: {
        sessionId: 'demo-session',
        playerId: 'demo-player',
        challengeId: 'demo-challenge',
        guessedStatement: 0,
        correctStatement: 0,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 50,
        accuracyBonus: 50,
        streakBonus: 50,
        totalScore: 250,
        newAchievements: ['speed_demon', 'perfectionist']
      } as GuessResult,
      streak: 2
    }
  ];

  const handleScenarioClick = (scenario: typeof demoScenarios[0]) => {
    setCurrentResult(scenario.result);
    setCurrentStreak(scenario.streak);
    setShowFeedback(true);
  };

  const handleAnimationComplete = () => {
    setShowFeedback(false);
    setCurrentResult(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
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
            🎬 Animated Feedback Demo
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: '0'
          }}>
            Experience the different animation scenarios for guess results and streaks
          </p>
        </div>

        {/* Demo Controls */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1F2937',
            margin: '0 0 16px 0'
          }}>
            🎯 Try Different Scenarios
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {demoScenarios.map((scenario, index) => (
              <button
                key={index}
                onClick={() => handleScenarioClick(scenario)}
                disabled={showFeedback}
                style={{
                  padding: '16px',
                  backgroundColor: showFeedback ? '#F3F4F6' : '#FFFFFF',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  cursor: showFeedback ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  opacity: showFeedback ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!showFeedback) {
                    e.currentTarget.style.borderColor = '#3B82F6';
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showFeedback) {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }
                }}
              >
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: '8px'
                }}>
                  {scenario.result.wasCorrect ? '✅' : '❌'} {scenario.name}
                </div>
                
                <div style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  marginBottom: '8px'
                }}>
                  {scenario.result.wasCorrect ? 'Correct guess' : 'Incorrect guess'} • 
                  {scenario.streak > 0 ? ` ${scenario.streak} streak` : ' No streak'} • 
                  {scenario.result.totalScore} points
                </div>
                
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  {scenario.result.newAchievements.map(achievement => (
                    <span
                      key={achievement}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}
                    >
                      🏆 {achievement.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                  {scenario.result.levelUp && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: '#DBEAFE',
                        color: '#1E40AF',
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}
                    >
                      🎊 LEVEL UP
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1F2937',
            margin: '0 0 16px 0'
          }}>
            🎨 Animation Features
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            fontSize: '14px',
            color: '#6B7280'
          }}>
            <div>
              <strong style={{ color: '#374151' }}>🎉 Success Animations</strong>
              <br />
              Celebration icons, particle effects, and score counting for correct guesses
            </div>
            <div>
              <strong style={{ color: '#374151' }}>🔥 Streak Effects</strong>
              <br />
              Special fire icons and rainbow animations for consecutive correct guesses
            </div>
            <div>
              <strong style={{ color: '#374151' }}>🏆 Achievement Popups</strong>
              <br />
              Sliding notifications for unlocked achievements and milestones
            </div>
            <div>
              <strong style={{ color: '#374151' }}>📊 Score Breakdown</strong>
              <br />
              Animated counters showing base points, bonuses, and total score
            </div>
            <div>
              <strong style={{ color: '#374151' }}>🎊 Level Up</strong>
              <br />
              Special celebration for player level progression
            </div>
            <div>
              <strong style={{ color: '#374151' }}>⚡ Smooth Transitions</strong>
              <br />
              Timed animation sequences with bounce, slide, and fade effects
            </div>
          </div>
        </div>
      </div>

      {/* Animated Feedback Overlay */}
      {showFeedback && currentResult && (
        <AnimatedFeedback
          result={currentResult}
          currentStreak={currentStreak}
          showStreakAnimation={currentResult.wasCorrect && currentStreak > 1}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </div>
  );
};