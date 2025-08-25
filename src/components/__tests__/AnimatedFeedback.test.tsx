/**
 * Tests for AnimatedFeedback component
 * Verifies animation behavior for correct/incorrect guesses and streaks
 */

import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { AnimatedFeedback } from '../AnimatedFeedback';
import { GuessResult } from '../../types';

// Mock result data
const mockCorrectResult: GuessResult = {
  sessionId: 'test-session',
  playerId: 'test-player',
  challengeId: 'test-challenge',
  guessedStatement: 1,
  correctStatement: 1,
  wasCorrect: true,
  pointsEarned: 100,
  timeBonus: 20,
  accuracyBonus: 30,
  streakBonus: 50,
  totalScore: 200,
  newAchievements: ['first_correct_guess'],
  levelUp: {
    oldLevel: 1,
    newLevel: 2,
    rewardsUnlocked: ['new_cosmetic_pack']
  }
};

const mockIncorrectResult: GuessResult = {
  sessionId: 'test-session',
  playerId: 'test-player',
  challengeId: 'test-challenge',
  guessedStatement: 0,
  correctStatement: 1,
  wasCorrect: false,
  pointsEarned: 0,
  timeBonus: 10,
  accuracyBonus: 0,
  streakBonus: 0,
  totalScore: 10,
  newAchievements: []
};

describe('AnimatedFeedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders correct guess feedback with celebration icon', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
      />
    );

    // Should show celebration icon for correct guess
    expect(screen.getByText('🎉')).toBeInTheDocument();
    
    // Fast-forward through animation phases
    jest.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Correct!')).toBeInTheDocument();
    });
  });

  it('renders incorrect guess feedback with thinking icon', async () => {
    render(
      <AnimatedFeedback 
        result={mockIncorrectResult}
        currentStreak={0}
        showStreakAnimation={false}
      />
    );

    // Should show thinking icon for incorrect guess
    expect(screen.getByText('🤔')).toBeInTheDocument();
    
    // Fast-forward through animation phases
    jest.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Not quite!')).toBeInTheDocument();
    });
  });

  it('shows streak animation for multiple correct guesses', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={3}
        showStreakAnimation={true}
      />
    );

    // Should show fire icon for streak
    expect(screen.getByText('🔥')).toBeInTheDocument();
    
    // Fast-forward to streak animation phase
    jest.advanceTimersByTime(2600);
    
    await waitFor(() => {
      expect(screen.getByText('3 in a row!')).toBeInTheDocument();
      expect(screen.getByText('🔥 3 STREAK! 🔥')).toBeInTheDocument();
    });
  });

  it('displays score breakdown correctly', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
      />
    );

    // Fast-forward to score phase
    jest.advanceTimersByTime(1100);
    
    await waitFor(() => {
      expect(screen.getByText('Base')).toBeInTheDocument();
      expect(screen.getByText('+100')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('+20')).toBeInTheDocument();
      expect(screen.getByText('Accuracy')).toBeInTheDocument();
      expect(screen.getByText('+30')).toBeInTheDocument();
      expect(screen.getByText('Streak')).toBeInTheDocument();
      expect(screen.getByText('+50')).toBeInTheDocument();
    });
  });

  it('shows achievement notifications', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
      />
    );

    // Fast-forward to completion phase
    jest.advanceTimersByTime(2600);
    
    await waitFor(() => {
      expect(screen.getByText('🏆 New Achievement!')).toBeInTheDocument();
      expect(screen.getByText('✨ FIRST CORRECT GUESS')).toBeInTheDocument();
    });
  });

  it('shows level up notification', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
      />
    );

    // Fast-forward to completion phase
    jest.advanceTimersByTime(2600);
    
    await waitFor(() => {
      expect(screen.getByText('🎊 LEVEL UP! 🎊')).toBeInTheDocument();
      expect(screen.getByText('Level 1 → 2')).toBeInTheDocument();
    });
  });

  it('calls onAnimationComplete callback after animation sequence', async () => {
    const mockCallback = jest.fn();
    
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
        onAnimationComplete={mockCallback}
      />
    );

    // Fast-forward through entire animation sequence
    jest.advanceTimersByTime(2600);
    
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('extends animation duration for streak animations', async () => {
    const mockCallback = jest.fn();
    
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={3}
        showStreakAnimation={true}
        onAnimationComplete={mockCallback}
      />
    );

    // Should not complete before streak animation time
    jest.advanceTimersByTime(2600);
    expect(mockCallback).not.toHaveBeenCalled();
    
    // Should complete after streak animation
    jest.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('animates score counter from 0 to total', async () => {
    render(
      <AnimatedFeedback 
        result={mockCorrectResult}
        currentStreak={1}
        showStreakAnimation={false}
      />
    );

    // Fast-forward to score animation phase
    jest.advanceTimersByTime(1100);
    
    // Score should start animating
    await waitFor(() => {
      expect(screen.getByText(/\+\d+ points/)).toBeInTheDocument();
    });
    
    // Fast-forward through score animation
    jest.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(screen.getByText('+200 points')).toBeInTheDocument();
    });
  });
});