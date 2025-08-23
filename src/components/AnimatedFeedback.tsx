/**
 * Animated Feedback Component
 * Provides visual feedback animations for correct/incorrect guesses and streaks
 * Relates to Requirements 1, 2, 4: Core Game Loop, Progress Feedback, Social Interaction
 */

import React, { useState, useEffect, useRef } from 'react';
import { GuessResult } from '../types';

interface AnimatedFeedbackProps {
  result: GuessResult;
  onAnimationComplete?: () => void;
  showStreakAnimation?: boolean;
  currentStreak?: number;
}

export const AnimatedFeedback: React.FC<AnimatedFeedbackProps> = ({
  result,
  onAnimationComplete,
  showStreakAnimation = false,
  currentStreak = 0
}) => {
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'result' | 'score' | 'streak' | 'complete'>('initial');
  const [showParticles, setShowParticles] = useState(false);
  const [scoreCounter, setScoreCounter] = useState(0);
  const animationStartedRef = useRef(false);
  const stableResultRef = useRef(result);

  // Lock in the result when animation first starts
  useEffect(() => {
    if (!animationStartedRef.current) {
      stableResultRef.current = result;
      animationStartedRef.current = true;
    }
  }, []);

  // Use the stable result for all animations
  const stableResult = stableResultRef.current;

  useEffect(() => {
    const sequence = async () => {
      // Phase 1: Initial reveal (500ms)
      setTimeout(() => setAnimationPhase('result'), 100);
      
      // Phase 2: Show result with particles (1000ms)
      setTimeout(() => {
        setShowParticles(true);
        setAnimationPhase('score');
      }, 600);
      
      // Phase 3: Animate score counter (1500ms)
      setTimeout(() => {
        animateScore();
      }, 1100);
      
      // Phase 4: Show streak animation if applicable (1000ms)
      if (showStreakAnimation && currentStreak > 1) {
        setTimeout(() => {
          setAnimationPhase('streak');
        }, 2600);
      }
      
      // Phase 5: Complete animation
      setTimeout(() => {
        setAnimationPhase('complete');
        onAnimationComplete?.();
      }, showStreakAnimation && currentStreak > 1 ? 3600 : 2600);
    };

    sequence();
  }, [stableResult, showStreakAnimation, currentStreak, onAnimationComplete]);

  const animateScore = () => {
    const duration = 1000;
    const steps = 30;
    const increment = stableResult.totalScore / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= stableResult.totalScore) {
        setScoreCounter(stableResult.totalScore);
        clearInterval(timer);
      } else {
        setScoreCounter(Math.floor(current));
      }
    }, duration / steps);
  };

  const getResultIcon = () => {
    if (stableResult.wasCorrect) {
      return currentStreak > 1 ? '🔥' : '🎉';
    }
    return '🤔';
  };

  const getResultColor = () => {
    return stableResult.wasCorrect ? '#059669' : '#DC2626';
  };

  const getResultMessage = () => {
    if (stableResult.wasCorrect) {
      if (currentStreak > 1) {
        return `${currentStreak} in a row!`;
      }
      return 'Correct!';
    }
    return 'Not quite!';
  };

  return (
    <>
      <style>
        {`
          @keyframes bounceIn {
            0% { 
              opacity: 0; 
              transform: scale(0.3) translateY(-50px); 
            }
            50% { 
              opacity: 1; 
              transform: scale(1.1) translateY(-10px); 
            }
            100% { 
              opacity: 1; 
              transform: scale(1) translateY(0); 
            }
          }
          
          @keyframes slideUp {
            0% { 
              opacity: 0; 
              transform: translateY(30px); 
            }
            100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
          
          @keyframes pulse {
            0%, 100% { 
              transform: scale(1); 
            }
            50% { 
              transform: scale(1.05); 
            }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          
          @keyframes streakFlash {
            0%, 100% { 
              background: linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7);
              background-size: 400% 400%;
              background-position: 0% 50%;
            }
            50% { 
              background-position: 100% 50%;
            }
          }
          
          @keyframes particle {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-100px) scale(0);
            }
          }
          
          @keyframes scoreCount {
            0% { 
              transform: scale(0.8);
              opacity: 0.8;
            }
            100% { 
              transform: scale(1);
              opacity: 1;
            }
          }
          
          .feedback-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
          }
          
          .feedback-content {
            text-align: center;
            color: white;
            max-width: 500px;
            padding: 40px;
          }
          
          .result-icon {
            font-size: 80px;
            margin-bottom: 20px;
            display: block;
            animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          }
          
          .result-message {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 20px;
            animation: slideUp 0.5s ease-out 0.3s both;
            transition: opacity 0.3s ease-out;
          }
          
          .score-display {
            font-size: 48px;
            font-weight: 800;
            margin: 20px 0;
            animation: slideUp 0.5s ease-out 0.6s both;
            transition: opacity 0.3s ease-out;
            font-family: 'Courier New', 'Monaco', monospace; /* Consistent character width */
          }
          
          .score-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 15px;
            margin: 20px 0;
            animation: slideUp 0.5s ease-out 0.9s both;
            transition: opacity 0.3s ease-out;
          }
          
          .score-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
            border-radius: 8px;
            backdrop-filter: blur(10px);
          }
          
          .score-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
          }
          
          .score-value {
            font-size: 18px;
            font-weight: 600;
          }
          
          .streak-animation {
            animation: streakFlash 2s ease-in-out infinite;
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 28px;
            font-weight: 800;
            margin: 20px 0;
            padding: 10px;
            border-radius: 10px;
          }
          
          .particles {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          
          .particle {
            position: absolute;
            width: 8px;
            height: 8px;
            background: #FFD700;
            border-radius: 50%;
            animation: particle 2s ease-out forwards;
          }
          
          .incorrect-shake {
            animation: shake 0.5s ease-in-out;
          }
          
          .score-counter {
            animation: scoreCount 0.1s ease-out;
          }
        `}
      </style>
      
      <div className="feedback-container">
        <div className="feedback-content">
          {/* Result Icon */}
          <span 
            className={`result-icon ${!stableResult.wasCorrect ? 'incorrect-shake' : ''}`}
            style={{ 
              animationDelay: animationPhase === 'initial' ? '0s' : '0s'
            }}
          >
            {getResultIcon()}
          </span>
          
          {/* Result Message */}
          <div 
            className="result-message"
            style={{ 
              color: getResultColor(),
              opacity: animationPhase !== 'initial' ? 1 : 0,
              visibility: animationPhase !== 'initial' ? 'visible' : 'hidden',
              height: '50px', // Reserve fixed height to prevent layout shift
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {getResultMessage()}
          </div>
          
          {/* Score Display */}
          <div 
            className="score-display score-counter"
            style={{ 
              opacity: (animationPhase === 'score' || animationPhase === 'streak' || animationPhase === 'complete') ? 1 : 0,
              visibility: (animationPhase === 'score' || animationPhase === 'streak' || animationPhase === 'complete') ? 'visible' : 'hidden',
              height: '58px', // Reserve fixed height to prevent layout shift
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            +{scoreCounter.toLocaleString()} points
          </div>
          
          {/* Score Breakdown */}
          <div 
            className="score-breakdown"
            style={{ 
              opacity: (animationPhase === 'score' || animationPhase === 'streak' || animationPhase === 'complete') ? 1 : 0,
              visibility: (animationPhase === 'score' || animationPhase === 'streak' || animationPhase === 'complete') ? 'visible' : 'hidden',
              minHeight: '80px' // Reserve fixed height to prevent layout shift
            }}
          >
            <div className="score-item">
              <div className="score-label">Base</div>
              <div className="score-value">+{stableResult.pointsEarned}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Time</div>
              <div className="score-value">+{stableResult.timeBonus}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Accuracy</div>
              <div className="score-value">+{stableResult.accuracyBonus}</div>
            </div>
            {stableResult.streakBonus > 0 && (
              <div className="score-item">
                <div className="score-label">Streak</div>
                <div className="score-value">+{stableResult.streakBonus}</div>
              </div>
            )}
          </div>
          
          {/* Streak Animation */}
          {animationPhase === 'streak' && showStreakAnimation && currentStreak > 1 && (
            <div className="streak-animation">
              🔥 {currentStreak} STREAK! 🔥
            </div>
          )}
          
          {/* Achievement Notifications */}
          {stableResult.newAchievements.length > 0 && (animationPhase === 'complete' || animationPhase === 'streak') && (
            <div style={{
              marginTop: '20px',
              animation: 'slideUp 0.5s ease-out'
            }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '10px',
                color: '#FFD700'
              }}>
                🏆 New Achievement{stableResult.newAchievements.length > 1 ? 's' : ''}!
              </div>
              {stableResult.newAchievements.map((achievement, index) => (
                <div 
                  key={achievement}
                  style={{
                    fontSize: '14px',
                    margin: '5px 0',
                    padding: '5px 10px',
                    background: 'rgba(255, 215, 0, 0.2)',
                    borderRadius: '15px',
                    animation: `slideUp 0.5s ease-out ${0.2 * index}s both`
                  }}
                >
                  ✨ {achievement.replace(/_/g, ' ').toUpperCase()}
                </div>
              ))}
            </div>
          )}
          
          {/* Level Up Animation */}
          {stableResult.levelUp && (animationPhase === 'complete' || animationPhase === 'streak') && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '10px',
              animation: 'bounceIn 0.8s ease-out'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '5px'
              }}>
                🎊 LEVEL UP! 🎊
              </div>
              <div style={{ fontSize: '16px' }}>
                Level {stableResult.levelUp.oldLevel} → {stableResult.levelUp.newLevel}
              </div>
            </div>
          )}
        </div>
        
        {/* Particle Effects */}
        {showParticles && stableResult.wasCorrect && (
          <div className="particles">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${Math.cos((i * 30) * Math.PI / 180) * 60}px`,
                  top: `${Math.sin((i * 30) * Math.PI / 180) * 60}px`,
                  animationDelay: `${i * 0.1}s`,
                  background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF6B6B' : '#4ECDC4'
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};