/**
 * Test for challenge switching state reset bug fix
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChallengeBrowserDemo } from '../ChallengeBrowserDemo';
import guessingGameReducer from '../../store/slices/guessingGameSlice';
import { EnhancedChallenge } from '../../types/challenge';

// Mock enhanced challenges for testing (simplified for test purposes)
const mockChallenges: Partial<EnhancedChallenge>[] = [
  {
    id: 'challenge1',
    creatorName: 'Test Creator 1',
    statements: [
      { 
        id: 'stmt1-1',
        text: 'Statement 1', 
        isLie: false, 
        confidence: 0.8,
        viewCount: 50,
        guessAccuracy: 0.7,
        averageConfidence: 0.75
      },
      { 
        id: 'stmt1-2',
        text: 'Statement 2', 
        isLie: true, 
        confidence: 0.9,
        viewCount: 50,
        guessAccuracy: 0.6,
        averageConfidence: 0.8
      },
      { 
        id: 'stmt1-3',
        text: 'Statement 3', 
        isLie: false, 
        confidence: 0.7,
        viewCount: 50,
        guessAccuracy: 0.8,
        averageConfidence: 0.7
      }
    ],
  },
  {
    id: 'challenge2',
    creatorName: 'Test Creator 2',
    statements: [
      { 
        id: 'stmt2-1',
        text: 'Different Statement 1', 
        isLie: false, 
        confidence: 0.8,
        viewCount: 75,
        guessAccuracy: 0.7,
        averageConfidence: 0.75
      },
      { 
        id: 'stmt2-2',
        text: 'Different Statement 2', 
        isLie: false, 
        confidence: 0.7,
        viewCount: 75,
        guessAccuracy: 0.8,
        averageConfidence: 0.7
      },
      { 
        id: 'stmt2-3',
        text: 'Different Statement 3', 
        isLie: true, 
        confidence: 0.9,
        viewCount: 75,
        guessAccuracy: 0.6,
        averageConfidence: 0.8
      }
    ],
  }
] as EnhancedChallenge[];

// Mock the ChallengeBrowser component to simplify testing
jest.mock('../ChallengeBrowser', () => ({
  ChallengeBrowser: ({ onChallengeSelect }: { onChallengeSelect: (challenge: any) => void }) => (
    <div>
      <h2>Mock Challenge Browser</h2>
      {mockChallenges.map((challenge) => (
        <button
          key={challenge.id}
          onClick={() => onChallengeSelect(challenge)}
          data-testid={`select-${challenge.id}`}
        >
          Select {challenge.creatorName}
        </button>
      ))}
    </div>
  )
}));

// Mock the GuessSubmissionInterface component to simulate completion
jest.mock('../GuessSubmissionInterface', () => ({
  GuessSubmissionInterface: ({ 
    challenge, 
    onComplete, 
    onBack 
  }: { 
    challenge: any; 
    onComplete: (result: any) => void; 
    onBack: () => void; 
  }) => (
    <div data-testid="guess-interface">
      <h3>Guessing Challenge: {challenge.creatorName}</h3>
      <button 
        onClick={() => onComplete({ 
          wasCorrect: true, 
          totalScore: 100,
          challengeId: challenge.id 
        })}
        data-testid="complete-guess"
      >
        Complete Guess
      </button>
      <button onClick={onBack} data-testid="back-button">
        Back
      </button>
    </div>
  )
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
    },
  });
};

const renderWithRedux = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('ChallengeBrowserDemo - Challenge Switching State Reset', () => {
  test('allows selecting new challenge after completing previous one', async () => {
    renderWithRedux(<ChallengeBrowserDemo />);

    // Initially should show challenge browser
    expect(screen.getByText('Mock Challenge Browser')).toBeInTheDocument();

    // Select first challenge
    fireEvent.click(screen.getByTestId('select-challenge1'));

    // Should show start guessing button
    await waitFor(() => {
      expect(screen.getByText(/Start Guessing Challenge by Test Creator 1/)).toBeInTheDocument();
    });

    // Start guessing
    fireEvent.click(screen.getByText(/Start Guessing Challenge by Test Creator 1/));

    // Should show guess interface
    await waitFor(() => {
      expect(screen.getByTestId('guess-interface')).toBeInTheDocument();
      expect(screen.getByText('Guessing Challenge: Test Creator 1')).toBeInTheDocument();
    });

    // Complete the guess
    fireEvent.click(screen.getByTestId('complete-guess'));

    // Should return to browser after completion
    await waitFor(() => {
      expect(screen.getByText('Mock Challenge Browser')).toBeInTheDocument();
    });

    // Wait for challenge selection to be cleared
    await waitFor(() => {
      expect(screen.queryByText(/Start Guessing Challenge by Test Creator 1/)).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Now select second challenge
    fireEvent.click(screen.getByTestId('select-challenge2'));

    // Should show start guessing button for new challenge
    await waitFor(() => {
      expect(screen.getByText(/Start Guessing Challenge by Test Creator 2/)).toBeInTheDocument();
    });

    // Start guessing second challenge
    fireEvent.click(screen.getByText(/Start Guessing Challenge by Test Creator 2/));

    // Should show guess interface for new challenge
    await waitFor(() => {
      expect(screen.getByTestId('guess-interface')).toBeInTheDocument();
      expect(screen.getByText('Guessing Challenge: Test Creator 2')).toBeInTheDocument();
    });

    // This test verifies that the state is properly reset and new challenges can be selected
  });

  test('properly resets when switching challenges without completing', async () => {
    renderWithRedux(<ChallengeBrowserDemo />);

    // Select first challenge
    fireEvent.click(screen.getByTestId('select-challenge1'));
    fireEvent.click(screen.getByText(/Start Guessing Challenge by Test Creator 1/));

    // Should be in guess interface
    await waitFor(() => {
      expect(screen.getByText('Guessing Challenge: Test Creator 1')).toBeInTheDocument();
    });

    // Go back without completing
    fireEvent.click(screen.getByTestId('back-button'));

    // Should return to browser
    await waitFor(() => {
      expect(screen.getByText('Mock Challenge Browser')).toBeInTheDocument();
    });

    // Select different challenge
    fireEvent.click(screen.getByTestId('select-challenge2'));

    // Should be able to start new challenge
    await waitFor(() => {
      expect(screen.getByText(/Start Guessing Challenge by Test Creator 2/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Start Guessing Challenge by Test Creator 2/));

    // Should show new challenge in guess interface
    await waitFor(() => {
      expect(screen.getByText('Guessing Challenge: Test Creator 2')).toBeInTheDocument();
    });
  });
});
