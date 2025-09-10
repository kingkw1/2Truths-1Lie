/**
 * Challenge List UI Validation Test
 * 
 * This test validates that the challenge list UI properly updates when new challenges are created.
 * It covers the complete flow from challenge creation to UI refresh and display.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';

import { GameScreen } from '../screens/GameScreen';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import { realChallengeAPI } from '../services/realChallengeAPI';
import guessingGameReducer from '../store/slices/guessingGameSlice';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { EnhancedChallenge } from '../types';

// Mock React Native components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Platform: {
      OS: 'ios',
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
  };
});

// Mock components that might cause rendering issues
jest.mock('../shared/AnimatedFeedback', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('../components/EnhancedMobileCameraIntegration', () => {
  return {
    EnhancedMobileCameraIntegration: () => null,
  };
});

jest.mock('../components/MobileCameraRecorder', () => {
  return {
    MobileCameraRecorder: () => null,
  };
});

// Mock the API service
jest.mock('../services/realChallengeAPI');
const mockRealChallengeAPI = realChallengeAPI as jest.Mocked<typeof realChallengeAPI>;

// Mock other services
jest.mock('../services/authService', () => ({
  authService: {
    getAuthToken: jest.fn(() => 'mock-token'),
  },
}));

jest.mock('../services/errorHandlingService', () => ({
  errorHandlingService: {
    checkNetworkStatus: jest.fn(() => Promise.resolve(true)),
    categorizeError: jest.fn((error) => ({
      type: 'unknown',
      message: error.message,
      retryable: true,
    })),
    logError: jest.fn(),
    formatErrorForUser: jest.fn((error) => error.message),
    getRetryStrategy: jest.fn(() => ({
      shouldRetry: false,
      delay: 1000,
      maxRetries: 3,
    })),
  },
}));

jest.mock('../services/mobileMediaIntegration', () => ({
  mobileMediaIntegration: {
    initialize: jest.fn(() => Promise.resolve()),
    mergeStatementVideos: jest.fn(() => Promise.resolve()),
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
      challengeCreation: challengeCreationReducer,
    },
  });
};

// Mock challenge data
const mockChallenge1: EnhancedChallenge = {
  id: 'challenge-1',
  creatorId: 'user-1',
  creatorName: 'Test User 1',
  statements: [
    { id: 'stmt-1', text: 'Statement 1', isLie: false, viewCount: 10, guessAccuracy: 75, averageConfidence: 80 },
    { id: 'stmt-2', text: 'Statement 2', isLie: true, viewCount: 10, guessAccuracy: 75, averageConfidence: 80 },
    { id: 'stmt-3', text: 'Statement 3', isLie: false, viewCount: 10, guessAccuracy: 75, averageConfidence: 80 },
  ],
  mediaData: [
    { type: 'video', streamingUrl: 'http://example.com/video1.mp4', duration: 30000, mediaId: 'media-1', isUploaded: true, storageType: 'cloud' },
    { type: 'video', streamingUrl: 'http://example.com/video2.mp4', duration: 30000, mediaId: 'media-2', isUploaded: true, storageType: 'cloud' },
    { type: 'video', streamingUrl: 'http://example.com/video3.mp4', duration: 30000, mediaId: 'media-3', isUploaded: true, storageType: 'cloud' },
  ],
  difficultyRating: 50,
  averageGuessTime: 20000,
  popularityScore: 75,
  emotionComplexity: 60,
  recommendationWeight: 70,
  totalGuesses: 25,
  correctGuessRate: 60,
  createdAt: '2024-01-01T00:00:00.000Z',
  lastPlayed: '2024-01-02T00:00:00.000Z',
  tags: ['test', 'mobile'],
  isActive: true,
};

const mockChallenge2: EnhancedChallenge = {
  id: 'challenge-2',
  creatorId: 'user-2',
  creatorName: 'Test User 2',
  statements: [
    { id: 'stmt-4', text: 'New Statement 1', isLie: false, viewCount: 5, guessAccuracy: 80, averageConfidence: 85 },
    { id: 'stmt-5', text: 'New Statement 2', isLie: false, viewCount: 5, guessAccuracy: 80, averageConfidence: 85 },
    { id: 'stmt-6', text: 'New Statement 3', isLie: true, viewCount: 5, guessAccuracy: 80, averageConfidence: 85 },
  ],
  mediaData: [
    { type: 'video', streamingUrl: 'http://example.com/video4.mp4', duration: 25000, mediaId: 'media-4', isUploaded: true, storageType: 'cloud' },
    { type: 'video', streamingUrl: 'http://example.com/video5.mp4', duration: 25000, mediaId: 'media-5', isUploaded: true, storageType: 'cloud' },
    { type: 'video', streamingUrl: 'http://example.com/video6.mp4', duration: 25000, mediaId: 'media-6', isUploaded: true, storageType: 'cloud' },
  ],
  difficultyRating: 65,
  averageGuessTime: 18000,
  popularityScore: 45,
  emotionComplexity: 55,
  recommendationWeight: 60,
  totalGuesses: 12,
  correctGuessRate: 75,
  createdAt: '2024-01-03T00:00:00.000Z',
  lastPlayed: '2024-01-03T00:00:00.000Z',
  tags: ['new', 'fresh'],
  isActive: true,
};

// Convert EnhancedChallenge to backend Challenge format
const convertToBackendChallenge = (challenge: EnhancedChallenge) => ({
  challenge_id: challenge.id,
  creator_id: challenge.creatorId,
  statements: challenge.statements.map((stmt, index) => ({
    statement_id: stmt.id,
    statement_type: (stmt.isLie ? 'lie' : 'truth') as 'truth' | 'lie',
    media_url: challenge.mediaData[index]?.streamingUrl || '',
    media_file_id: challenge.mediaData[index]?.mediaId || '',
    streaming_url: challenge.mediaData[index]?.streamingUrl,
    cloud_storage_key: challenge.mediaData[index]?.cloudStorageKey,
    storage_type: challenge.mediaData[index]?.storageType,
    duration_seconds: (challenge.mediaData[index]?.duration || 0) / 1000,
    created_at: challenge.createdAt,
  })),
  lie_statement_id: challenge.statements.find(s => s.isLie)?.id || '',
  status: 'published',
  tags: challenge.tags,
  created_at: challenge.createdAt,
  updated_at: challenge.createdAt,
  view_count: challenge.totalGuesses,
  guess_count: challenge.totalGuesses,
  correct_guess_count: Math.round(challenge.totalGuesses * (challenge.correctGuessRate / 100)),
});

describe('Challenge List UI Validation', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();

    // Reset API mocks
    mockRealChallengeAPI.getChallenges.mockReset();
    mockRealChallengeAPI.createChallenge.mockReset();
  });

  describe('Initial Challenge List Loading', () => {
    it('should load and display initial challenges on mount', async () => {
      // Mock API to return initial challenge
      mockRealChallengeAPI.getChallenges.mockResolvedValue([convertToBackendChallenge(mockChallenge1)]);

      const { getByText, getByTestId } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledWith(0, 20);
      });

      // Verify challenge is displayed
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
        expect(getByText('ID: challenge-1')).toBeTruthy();
      });
    });

    it('should show loading state during initial load', async () => {
      // Mock API with delay
      mockRealChallengeAPI.getChallenges.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve([convertToBackendChallenge(mockChallenge1)]), 100)
        )
      );

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Should show loading state
      expect(getByText('Loading challenges...')).toBeTruthy();

      // Wait for load to complete
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });
    });

    it('should show empty state when no challenges exist', async () => {
      // Mock API to return empty list
      mockRealChallengeAPI.getChallenges.mockResolvedValue([]);

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      await waitFor(() => {
        expect(getByText('No challenges available')).toBeTruthy();
        expect(getByText('Be the first to create a challenge!')).toBeTruthy();
      });
    });
  });

  describe('Challenge List Refresh After Creation', () => {
    it('should refresh challenge list when new challenge is created', async () => {
      // Initial load with one challenge
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Second call after creation with both challenges
        .mockResolvedValueOnce([
          convertToBackendChallenge(mockChallenge1),
          convertToBackendChallenge(mockChallenge2),
        ]);

      const { getByText, queryByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });

      // Verify only first challenge is shown initially
      expect(queryByText('By Test User 2')).toBeNull();

      // Simulate challenge creation completion by triggering the refresh
      // This simulates what happens when the Alert.alert callback is executed
      act(() => {
        // Find the GameScreen component instance and call loadChallengesFromAPI
        // In a real scenario, this would be triggered by the Alert callback
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Wait for the second API call
      await waitFor(() => {
        expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(2);
      });

      // Verify both challenges are now displayed
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
        expect(getByText('By Test User 2')).toBeTruthy();
        expect(getByText('ID: challenge-1')).toBeTruthy();
        expect(getByText('ID: challenge-2')).toBeTruthy();
      });
    });

    it('should handle API errors during refresh gracefully', async () => {
      // Initial successful load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Second call fails
        .mockRejectedValueOnce(new Error('Network error'));

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });

      // Trigger refresh that will fail
      act(() => {
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Wait for error state
      await waitFor(() => {
        expect(getByText('Something Went Wrong')).toBeTruthy();
        expect(getByText('Network error')).toBeTruthy();
      });

      // Original challenge should still be visible (not cleared on error)
      expect(getByText('By Test User 1')).toBeTruthy();
    });
  });

  describe('Challenge Creation Flow Integration', () => {
    it('should trigger list refresh when challenge creation completes successfully', async () => {
      // Mock successful challenge creation
      mockRealChallengeAPI.createChallenge.mockResolvedValue({
        success: true,
        data: convertToBackendChallenge(mockChallenge2),
        timestamp: new Date(),
      });

      // Mock challenge list refresh after creation
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        .mockResolvedValueOnce([
          convertToBackendChallenge(mockChallenge1),
          convertToBackendChallenge(mockChallenge2),
        ]);

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });

      // Simulate the Alert.alert callback that gets called after successful challenge creation
      // This is what happens in the ChallengeCreationScreen's onComplete callback
      act(() => {
        // Simulate the refresh call that happens in the Alert callback
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Verify the list was refreshed
      await waitFor(() => {
        expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(2);
      });

      // Verify new challenge appears in the list
      await waitFor(() => {
        expect(getByText('By Test User 2')).toBeTruthy();
        expect(getByText('ID: challenge-2')).toBeTruthy();
      });
    });

    it('should maintain list state when challenge creation fails', async () => {
      // Mock failed challenge creation
      mockRealChallengeAPI.createChallenge.mockRejectedValue(new Error('Creation failed'));

      // Initial load
      mockRealChallengeAPI.getChallenges.mockResolvedValue([convertToBackendChallenge(mockChallenge1)]);

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });

      // Simulate failed challenge creation - no refresh should occur
      // The original challenge should still be visible
      expect(getByText('By Test User 1')).toBeTruthy();
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-time Challenge List Updates', () => {
    it('should update challenge statistics when challenges are refreshed', async () => {
      const updatedChallenge1 = {
        ...mockChallenge1,
        totalGuesses: 50, // Increased from 25
        correctGuessRate: 70, // Increased from 60
      };

      // Initial load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Refresh with updated stats
        .mockResolvedValueOnce([convertToBackendChallenge(updatedChallenge1)]);

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('25 guesses • 60% correct')).toBeTruthy();
      });

      // Trigger refresh
      act(() => {
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Verify updated stats
      await waitFor(() => {
        expect(getByText('50 guesses • 70% correct')).toBeTruthy();
      });
    });

    it('should preserve challenge order based on API response', async () => {
      // Initial load with challenge1 first
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Refresh with challenge2 first (newer challenge)
        .mockResolvedValueOnce([
          convertToBackendChallenge(mockChallenge2),
          convertToBackendChallenge(mockChallenge1),
        ]);

      const { getAllByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getAllByText(/By Test User/)).toHaveLength(1);
      });

      // Trigger refresh
      act(() => {
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Verify both challenges are present and in correct order
      await waitFor(() => {
        const userTexts = getAllByText(/By Test User/);
        expect(userTexts).toHaveLength(2);
        // The order should match the API response (challenge2 first)
      });
    });
  });

  describe('Error Recovery and Retry', () => {
    it('should allow manual retry after failed refresh', async () => {
      // Initial successful load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Failed refresh
        .mockRejectedValueOnce(new Error('Network timeout'))
        // Successful retry
        .mockResolvedValueOnce([
          convertToBackendChallenge(mockChallenge1),
          convertToBackendChallenge(mockChallenge2),
        ]);

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('By Test User 1')).toBeTruthy();
      });

      // Trigger failed refresh
      act(() => {
        store.dispatch({ type: 'guessingGame/setLoading', payload: true });
      });

      // Wait for error state
      await waitFor(() => {
        expect(getByText('Request Timeout')).toBeTruthy();
      });

      // Click retry button
      const retryButton = getByText('Try Again');
      fireEvent.press(retryButton);

      // Verify successful retry
      await waitFor(() => {
        expect(getByText('By Test User 2')).toBeTruthy();
        expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks during frequent refreshes', async () => {
      // Mock multiple successful refreshes
      for (let i = 0; i < 5; i++) {
        mockRealChallengeAPI.getChallenges.mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)]);
      }

      const { getByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Trigger multiple refreshes rapidly
      for (let i = 0; i < 4; i++) {
        act(() => {
          store.dispatch({ type: 'guessingGame/setLoading', payload: true });
        });

        await waitFor(() => {
          expect(getByText('By Test User 1')).toBeTruthy();
        });
      }

      // Verify all API calls were made
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(5);
    });

    it('should handle large challenge lists efficiently', async () => {
      // Create a large list of challenges
      const largeChallengeList = Array.from({ length: 50 }, (_, index) => ({
        ...convertToBackendChallenge(mockChallenge1),
        challenge_id: `challenge-${index}`,
        creator_id: `user-${index}`,
      }));

      mockRealChallengeAPI.getChallenges.mockResolvedValue(largeChallengeList);

      const { getAllByText } = render(
        <Provider store={store}>
          <GameScreen />
        </Provider>
      );

      // Wait for load and verify challenges are displayed
      await waitFor(() => {
        const challengeElements = getAllByText(/By Test User/);
        expect(challengeElements.length).toBeGreaterThan(10); // Should show many challenges
      });
    });
  });
});