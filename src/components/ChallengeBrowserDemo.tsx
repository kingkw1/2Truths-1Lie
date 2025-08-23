/**
 * Challenge Browser Demo Component
 * Demonstrates the challenge browsing functionality with filtering and sorting
 */

import React, { useState } from 'react';
import { ChallengeBrowser } from './ChallengeBrowser';
import { GuessSubmissionInterface } from './GuessSubmissionInterface';
import { EnhancedChallenge } from '../types/challenge';

export const ChallengeBrowserDemo: React.FC = () => {
  const [selectedChallenge, setSelectedChallenge] = useState<EnhancedChallenge | null>(null);
  const [showGuessInterface, setShowGuessInterface] = useState(false);

  const handleChallengeSelect = (challenge: EnhancedChallenge) => {
    // Always reset to browsing mode when selecting a new challenge
    setShowGuessInterface(false);
    setSelectedChallenge(challenge);
  };

  const startGuessing = () => {
    if (selectedChallenge) {
      setShowGuessInterface(true);
    }
  };

  const backToBrowsing = () => {
    setShowGuessInterface(false);
    setSelectedChallenge(null);
  };

  const handleGuessComplete = (result: any) => {
    console.log('Guess completed:', result);
    // Reset to browsing state but keep the challenge selected
    // so user can see it was completed and try another
    setShowGuessInterface(false);
    // Don't reset selectedChallenge immediately to give user feedback
    setTimeout(() => {
      setSelectedChallenge(null);
    }, 1000);
  };

  if (showGuessInterface && selectedChallenge) {
    return (
      <GuessSubmissionInterface
        challenge={selectedChallenge}
        onComplete={handleGuessComplete}
        onBack={backToBrowsing}
      />
    );
  }

  return (
    <div>
      <ChallengeBrowser onChallengeSelect={handleChallengeSelect} />
      
      {selectedChallenge && (
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={startGuessing}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10B981';
            }}
          >
            🎯 Start Guessing Challenge by {selectedChallenge.creatorName}
          </button>
        </div>
      )}
    </div>
  );
};