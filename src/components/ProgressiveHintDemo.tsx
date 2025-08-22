/**
 * Demo component for the Progressive Hint System
 * Shows how the enhanced hint system works with progressive revelation
 */

import React, { useState, useRef, useEffect } from 'react';
import { ProgressiveHintService, ProgressiveHint, HintLevel } from '../services/progressiveHintService';
import { AnalyzedStatement } from '../types';

export const ProgressiveHintDemo: React.FC = () => {
  const [hints, setHints] = useState<ProgressiveHint[]>([]);
  const [currentLevel, setCurrentLevel] = useState<HintLevel>('basic');
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const hintServiceRef = useRef<ProgressiveHintService | null>(null);

  const mockStatements: AnalyzedStatement[] = [
    {
      id: '1',
      text: 'I once climbed Mount Everest and reached the summit in perfect weather conditions.',
      isLie: false,
      confidence: 0.8,
      viewCount: 150,
      guessAccuracy: 0.6,
      averageConfidence: 0.7,
      popularGuess: false,
      emotionScores: {
        confidence: 0.8,
        emotions: {
          joy: 0.7,
          sadness: 0.1,
          anger: 0.05,
          fear: 0.1,
          surprise: 0.05,
          disgust: 0.05,
          neutral: 0.05,
        },
        dominantEmotion: 'joy',
        analysisTimestamp: new Date(),
      },
    },
    {
      id: '2',
      text: 'I can speak twelve languages fluently, including ancient Latin and Sanskrit.',
      isLie: true,
      confidence: 0.4,
      viewCount: 200,
      guessAccuracy: 0.3,
      averageConfidence: 0.45,
      popularGuess: true,
      emotionScores: {
        confidence: 0.4,
        emotions: {
          joy: 0.2,
          sadness: 0.1,
          anger: 0.1,
          fear: 0.4,
          surprise: 0.1,
          disgust: 0.05,
          neutral: 0.05,
        },
        dominantEmotion: 'fear',
        analysisTimestamp: new Date(),
      },
    },
    {
      id: '3',
      text: 'I work as a software engineer at a tech company in San Francisco.',
      isLie: false,
      confidence: 0.9,
      viewCount: 100,
      guessAccuracy: 0.8,
      averageConfidence: 0.85,
      popularGuess: false,
    },
  ];

  useEffect(() => {
    // Initialize the progressive hint service
    hintServiceRef.current = new ProgressiveHintService({
      maxHintsPerLevel: 3,
      timeBetweenHints: 2000, // 2 seconds for demo
      enableEmotionalAnalysis: true,
      enableLinguisticAnalysis: true,
      enableBehavioralAnalysis: true,
      enableStatisticalAnalysis: true,
      adaptiveDifficulty: true,
    });

    hintServiceRef.current.initializeHints(mockStatements);
    setProgress(hintServiceRef.current.getHintProgress());
    setCurrentLevel(hintServiceRef.current.getCurrentLevel());
  }, []);

  const handleGetNextHint = () => {
    if (!hintServiceRef.current) return;

    const nextHint = hintServiceRef.current.getNextHint();
    if (nextHint) {
      setHints(prev => [...prev, nextHint]);
      setCurrentLevel(hintServiceRef.current!.getCurrentLevel());
      setProgress(hintServiceRef.current!.getHintProgress());
      setShowHint(true);

      // Auto-hide after 10 seconds
      setTimeout(() => setShowHint(false), 10000);
    }
  };

  const handleGetCategoryHint = (category: ProgressiveHint['category']) => {
    if (!hintServiceRef.current) return;

    const hint = hintServiceRef.current.revealHintByCategory(category);
    if (hint) {
      setHints(prev => [...prev, hint]);
      setCurrentLevel(hintServiceRef.current!.getCurrentLevel());
      setProgress(hintServiceRef.current!.getHintProgress());
      setShowHint(true);

      setTimeout(() => setShowHint(false), 10000);
    }
  };

  const hasMoreHints = hintServiceRef.current?.hasMoreHints() ?? false;
  const latestHint = hints[hints.length - 1];

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
            🧠 Progressive Hint System Demo
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: '0'
          }}>
            Experience the advanced hint system with progressive revelation of analysis and clues
          </p>
        </div>

        {/* Mock Challenge Statements */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '16px'
          }}>
            🎯 Sample Challenge: Guess the Lie
          </h2>
          
          {mockStatements.map((statement, index) => (
            <div key={statement.id} style={{
              padding: '16px',
              margin: '8px 0',
              borderRadius: '8px',
              border: statement.isLie ? '2px solid #EF4444' : '1px solid #E5E7EB',
              backgroundColor: statement.isLie ? '#FEF2F2' : '#FFFFFF'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: statement.isLie ? '#EF4444' : '#10B981',
                  color: '#FFFFFF',
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
                  <div style={{
                    fontSize: '12px',
                    color: '#6B7280'
                  }}>
                    {statement.isLie ? '❌ This is the LIE' : '✅ This is TRUE'} • 
                    Accuracy: {Math.round(statement.guessAccuracy * 100)}% • 
                    Views: {statement.viewCount}
                    {statement.popularGuess && ' • 🔥 Popular choice'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progressive Hint System */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 4px 0'
              }}>
                🧠 Progressive Analysis System
              </h2>
              <div style={{
                fontSize: '14px',
                color: '#6B7280'
              }}>
                Level: {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)} • 
                Progress: {Math.round(progress)}% • 
                Hints Revealed: {hints.length}
              </div>
            </div>
            <button
              onClick={handleGetNextHint}
              disabled={!hasMoreHints}
              style={{
                padding: '12px 20px',
                backgroundColor: hasMoreHints ? '#3B82F6' : '#9CA3AF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: hasMoreHints ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {hasMoreHints ? 'Get Next Clue' : 'No More Hints'}
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#E5E7EB',
            borderRadius: '3px',
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: '3px',
              transition: 'width 0.5s ease'
            }} />
          </div>

          {/* Category Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {[
              { category: 'emotional' as const, icon: '😊', label: 'Emotional Analysis', color: '#F59E0B' },
              { category: 'linguistic' as const, icon: '📝', label: 'Language Patterns', color: '#10B981' },
              { category: 'behavioral' as const, icon: '🎭', label: 'Behavioral Cues', color: '#8B5CF6' },
              { category: 'statistical' as const, icon: '📊', label: 'Statistical Data', color: '#EF4444' }
            ].map(({ category, icon, label, color }) => (
              <button
                key={category}
                onClick={() => handleGetCategoryHint(category)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FFFFFF',
                  border: `2px solid ${color}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: color,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = color;
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.color = color;
                }}
              >
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Current Hint Display */}
          {showHint && latestHint && (
            <div style={{
              padding: '20px',
              backgroundColor: '#EBF8FF',
              border: '2px solid #3B82F6',
              borderRadius: '12px',
              marginBottom: '20px',
              animation: 'fadeIn 0.5s ease-in'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1E40AF',
                  backgroundColor: '#FFFFFF',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {latestHint.category}
                </span>
                <span style={{
                  fontSize: '14px',
                  color: '#3B82F6',
                  fontWeight: '600'
                }}>
                  Level: {latestHint.level} • Confidence: {Math.round(latestHint.confidence * 100)}%
                </span>
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1E40AF',
                margin: '0 0 8px 0'
              }}>
                {latestHint.title}
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#1E40AF',
                margin: '0',
                lineHeight: '1.5'
              }}>
                {latestHint.content}
              </p>
              {latestHint.statementIndex !== undefined && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '14px',
                  color: '#3B82F6',
                  fontStyle: 'italic'
                }}>
                  💡 This hint relates to Statement {latestHint.statementIndex + 1}
                </div>
              )}
            </div>
          )}

          {/* Hint History */}
          {hints.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                📚 Hint History ({hints.length} revealed)
              </h3>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC'
              }}>
                {hints.map((hint, index) => (
                  <div key={hint.id} style={{
                    padding: '12px 16px',
                    borderBottom: index < hints.length - 1 ? '1px solid #E5E7EB' : 'none'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6B7280',
                        backgroundColor: '#FFFFFF',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        {hint.category.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#9CA3AF'
                      }}>
                        {hint.level} • {Math.round(hint.confidence * 100)}%
                      </span>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '2px'
                    }}>
                      {hint.title}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      lineHeight: '1.4'
                    }}>
                      {hint.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {hints.length === 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: '#92400E'
              }}>
                💡 <strong>Try the progressive hint system!</strong> Click "Get Next Clue" or choose a specific analysis category to see how the system provides increasingly sophisticated hints to help you identify the lie.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};