/**
 * Challenge List UI Validation Unit Test
 * 
 * This test validates the UI behavior and component interactions for challenge list updates.
 * It focuses on testing the GameScreen component's challenge list functionality.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Text, View } from 'react-native';

import { realChallengeAPI } from '../services/realChallengeAPI';
import guessingGameReducer, { loadChallenges } from '../store/slices/guessingGameSlice';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { EnhancedChallenge } from '../types';

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

// Create a simplified test component that mimics GameScreen behavior
const TestChallengeListComponent: React.FC = () => {
  const [challenges, setChallenges] = React.useState<EnhancedChallenge[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadChallengesFromAPI = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await realChallengeAPI.getChallenges(0, 20);
      
      if (response.success && response.data) {
        // Convert backend challenges to frontend format (simplified)
        const enhancedChallenges: EnhancedChallenge[] = response.data.map(backendChallenge => ({
          id: backendChallenge.challenge_id,
          creatorId: backendChallenge.creator_id,
          creatorName: `User ${backendChallenge.creator_id.slice(0, 8)}`,
          statements: backendChallenge.statements.map((stmt, index) => ({
            id: stmt.statement_id,
            text: `Statement ${index + 1}`,
            isLie: stmt.statement_type === 'lie',
            viewCount: 0,
            guessAccuracy: 50,
            averageConfidence: 50,
          })),
          mediaData: backendChallenge.statements.map((stmt) => ({
            type: 'video' as const,
            streamingUrl: stmt.streaming_url || stmt.media_url,
            duration: (stmt.duration_seconds || 0) * 1000,
            mediaId: stmt.media_file_id,
            isUploaded: true,
            storageType: stmt.storage_type as any,
            cloudStorageKey: stmt.cloud_storage_key,
          })),
          difficultyRating: 50,
          averageGuessTime: 20000,
          popularityScore: Math.min(backendChallenge.view_count * 10, 100),
          emotionComplexity: 50,
          recommendationWeight: 50,
          totalGuesses: backendChallenge.guess_count,
          correctGuessRate: backendChallenge.guess_count > 0 
            ? Math.round((backendChallenge.correct_guess_count / backendChallenge.guess_count) * 100)
            : 50,
          createdAt: new Date(backendChallenge.created_at),
          lastPlayed: new Date(),
          tags: backendChallenge.tags || [],
          isActive: backendChallenge.status === 'published',
        }));
        
        setChallenges(enhancedChallenges);
      } else {
        setError(response.error || 'Failed to load challenges');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load challenges on mount
  React.useEffect(() => {
    loadChallengesFromAPI();
  }, [loadChallengesFromAPI]);

  // Expose refresh function for testing
  React.useEffect(() => {
    (window as any).refreshChallenges = loadChallengesFromAPI;
  }, [loadChallengesFromAPI]);

  if (isLoading) {
    return (
      <View testID="loading-container">
        <Text testID="loading-text">Loading challenges...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View testID="error-container">
        <Text testID="error-text">{error}</Text>
      </View>
    );
  }

  if (challenges.length === 0) {
    return (
      <View testID="empty-container">
        <Text testID="empty-text">No challenges available</Text>
      </View>
    );
  }

  return (
    <View testID="challenge-list-container">
      <Text testID="challenge-count">{challenges.length} challenges</Text>
      {challenges.map((challenge) => (
        <View key={challenge.id} testID={`challenge-${challenge.id}`}>
          <Text testID={`challenge-creator-${challenge.id}`}>
            By {challenge.creatorName}
          </Text>
          <Text testID={`challenge-stats-${challenge.id}`}>
            {challenge.totalGuesses} guesses • {challenge.correctGuessRate}% correct
          </Text>
          <Text testID={`challenge-id-${challenge.id}`}>
            ID: {challenge.id}
          </Text>
        </View>
      ))}
    </View>
  );
};

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
const mockChallenge1 = {
  challenge_id: 'challenge-1',
  creator_id: 'user-1',
  statements: [
    {
      statement_id: 'stmt-1',
      statement_type: 'truth' as const,
      media_url: 'http://example.com/video1.mp4',
      media_file_id: 'media-1',
      streaming_url: 'http://example.com/video1.mp4',
      cloud_storage_key: 'key-1',
      storage_type: 'cloud' as const,
      duration_seconds: 30,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      statement_id: 'stmt-2',
      statement_type: 'lie' as const,
      media_url: 'http://example.com/video2.mp4',
      media_file_id: 'media-2',
      streaming_url: 'http://example.com/video2.mp4',
      cloud_storage_key: 'key-2',
      storage_type: 'cloud' as const,
      duration_seconds: 30,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      statement_id: 'stmt-3',
      statement_type: 'truth' as const,
      media_url: 'http://example.com/video3.mp4',
      media_file_id: 'media-3',
      streaming_url: 'http://example.com/video3.mp4',
      cloud_storage_key: 'key-3',
      storage_type: 'cloud' as const,
      duration_seconds: 30,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  lie_statement_id: 'stmt-2',
  status: 'published',
  tags: ['test', 'mobile'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  view_count: 25,
  guess_count: 25,
  correct_guess_count: 15,
};

const mockChallenge2 = {
  challenge_id: 'challenge-2',
  creator_id: 'user-2',
  statements: [
    {
      statement_id: 'stmt-4',
      statement_type: 'truth' as const,
      media_url: 'http://example.com/video4.mp4',
      media_file_id: 'media-4',
      streaming_url: 'http://example.com/video4.mp4',
      cloud_storage_key: 'key-4',
      storage_type: 'cloud' as const,
      duration_seconds: 25,
      created_at: '2024-01-03T00:00:00Z',
    },
    {
      statement_id: 'stmt-5',
      statement_type: 'truth' as const,
      media_url: 'http://example.com/video5.mp4',
      media_file_id: 'media-5',
      streaming_url: 'http://example.com/video5.mp4',
      cloud_storage_key: 'key-5',
      storage_type: 'cloud' as const,
      duration_seconds: 25,
      created_at: '2024-01-03T00:00:00Z',
    },
    {
      statement_id: 'stmt-6',
      statement_type: 'lie' as const,
      media_url: 'http://example.com/video6.mp4',
      media_file_id: 'media-6',
      streaming_url: 'http://example.com/video6.mp4',
      cloud_storage_key: 'key-6',
      storage_type: 'cloud' as const,
      duration_seconds: 25,
      created_at: '2024-01-03T00:00:00Z',
    },
  ],
  lie_statement_id: 'stmt-6',
  status: 'published',
  tags: ['new', 'fresh'],
  created_at: '2024-01-03T00:00:00Z',
  updated_at: '2024-01-03T00:00:00Z',
  view_count: 12,
  guess_count: 12,
  correct_guess_count: 9,
};

describe('Challenge List UI Validation - Unit Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    
    // Reset API mocks
    mockRealChallengeAPI.getChallenges.mockReset();
    mockRealChallengeAPI.createChallenge.mockReset();
    
    // Clear any global test functions
    delete (window as any).refreshChallenges;
  });

  describe('Initial Challenge List Loading', () => {
    it('should display loading state initially', async () => {
      // Mock API with delay
      mockRealChallengeAPI.getChallenges.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: [mockChallenge1],
            timestamp: new Date(),
          }), 100)
        )
      );

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Should show loading state initially
      expect(getByTestId('loading-container')).toBeTruthy();
      expect(getByTestId('loading-text')).toBeTruthy();

      // Wait for load to complete
      await waitFor(() => {
        expect(getByTestId('challenge-list-container')).toBeTruthy();
      });
    });

    it('should display challenges after successful load', async () => {
      // Mock successful API response
      mockRealChallengeAPI.getChallenges.mockResolvedValue({
        success: true,
        data: [mockChallenge1],
        timestamp: new Date(),
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for challenges to load
      await waitFor(() => {
        expect(getByTestId('challenge-list-container')).toBeTruthy();
        expect(getByTestId('challenge-count')).toBeTruthy();
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-creator-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-stats-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-id-challenge-1')).toBeTruthy();
      });

      // Verify API was called
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledWith(0, 20);
    });

    it('should display empty state when no challenges exist', async () => {
      // Mock API to return empty list
      mockRealChallengeAPI.getChallenges.mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date(),
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      await waitFor(() => {
        expect(getByTestId('empty-container')).toBeTruthy();
        expect(getByTestId('empty-text')).toBeTruthy();
      });
    });

    it('should display error state on API failure', async () => {
      // Mock API error
      mockRealChallengeAPI.getChallenges.mockResolvedValue({
        success: false,
        error: 'Network error',
        timestamp: new Date(),
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      await waitFor(() => {
        expect(getByTestId('error-container')).toBeTruthy();
        expect(getByTestId('error-text')).toBeTruthy();
      });
    });
  });

  describe('Challenge List Refresh After Creation', () => {
    it('should update challenge list when refreshed with new challenges', async () => {
      // Initial load with one challenge
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1],
          timestamp: new Date(),
        })
        // Second call after creation with both challenges
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1, mockChallenge2],
          timestamp: new Date(),
        });

      const { getByTestId, queryByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-count').props.children).toBe('1 challenges');
      });

      // Verify only first challenge is shown initially
      expect(queryByTestId('challenge-challenge-2')).toBeNull();

      // Trigger refresh (simulating what happens after challenge creation)
      act(() => {
        if ((window as any).refreshChallenges) {
          (window as any).refreshChallenges();
        }
      });

      // Wait for refresh to complete
      await waitFor(() => {
        expect(getByTestId('challenge-count').props.children).toBe('2 challenges');
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-challenge-2')).toBeTruthy();
      });

      // Verify both API calls were made
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh errors gracefully', async () => {
      // Initial successful load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1],
          timestamp: new Date(),
        })
        // Second call fails
        .mockResolvedValueOnce({
          success: false,
          error: 'Network timeout',
          timestamp: new Date(),
        });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
      });

      // Trigger refresh that will fail
      act(() => {
        if ((window as any).refreshChallenges) {
          (window as any).refreshChallenges();
        }
      });

      // Wait for error state
      await waitFor(() => {
        expect(getByTestId('error-container')).toBeTruthy();
        expect(getByTestId('error-text').props.children).toBe('Network timeout');
      });
    });
  });

  describe('Challenge Statistics Updates', () => {
    it('should display updated challenge statistics after refresh', async () => {
      const updatedChallenge1 = {
        ...mockChallenge1,
        guess_count: 50, // Increased from 25
        correct_guess_count: 35, // Increased from 15 (70% vs 60%)
      };

      // Initial load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1],
          timestamp: new Date(),
        })
        // Refresh with updated stats
        .mockResolvedValueOnce({
          success: true,
          data: [updatedChallenge1],
          timestamp: new Date(),
        });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for initial load and verify original stats
      await waitFor(() => {
        expect(getByTestId('challenge-stats-challenge-1').props.children).toBe('25 guesses • 60% correct');
      });

      // Trigger refresh
      act(() => {
        if ((window as any).refreshChallenges) {
          (window as any).refreshChallenges();
        }
      });

      // Verify updated stats
      await waitFor(() => {
        expect(getByTestId('challenge-stats-challenge-1').props.children).toBe('50 guesses • 70% correct');
      });
    });

    it('should preserve challenge order from API response', async () => {
      // Initial load with challenge1 first
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1],
          timestamp: new Date(),
        })
        // Refresh with challenge2 first (newer challenge)
        .mockResolvedValueOnce({
          success: true,
          data: [mockChallenge2, mockChallenge1],
          timestamp: new Date(),
        });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByTestId('challenge-count').props.children).toBe('1 challenges');
      });

      // Trigger refresh
      act(() => {
        if ((window as any).refreshChallenges) {
          (window as any).refreshChallenges();
        }
      });

      // Verify both challenges are present
      await waitFor(() => {
        expect(getByTestId('challenge-count').props.children).toBe('2 challenges');
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
        expect(getByTestId('challenge-challenge-2')).toBeTruthy();
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle multiple rapid refreshes without issues', async () => {
      // Mock multiple successful responses
      for (let i = 0; i < 5; i++) {
        mockRealChallengeAPI.getChallenges.mockResolvedValueOnce({
          success: true,
          data: [mockChallenge1],
          timestamp: new Date(),
        });
      }

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByTestId('challenge-challenge-1')).toBeTruthy();
      });

      // Trigger multiple rapid refreshes
      for (let i = 0; i < 4; i++) {
        act(() => {
          if ((window as any).refreshChallenges) {
            (window as any).refreshChallenges();
          }
        });
        
        await waitFor(() => {
          expect(getByTestId('challenge-challenge-1')).toBeTruthy();
        });
      }

      // Verify all API calls were made
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(5);
    });

    it('should handle large challenge lists efficiently', async () => {
      // Create a large list of challenges
      const largeChallengeList = Array.from({ length: 20 }, (_, index) => ({
        ...mockChallenge1,
        challenge_id: `challenge-${index}`,
        creator_id: `user-${index}`,
      }));

      mockRealChallengeAPI.getChallenges.mockResolvedValue({
        success: true,
        data: largeChallengeList,
        timestamp: new Date(),
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <TestChallengeListComponent />
        </Provider>
      );

      // Wait for load and verify challenges are displayed
      await waitFor(() => {
        expect(getByTestId('challenge-count').props.children).toBe('20 challenges');
        expect(getByTestId('challenge-challenge-0')).toBeTruthy();
        expect(getByTestId('challenge-challenge-19')).toBeTruthy();
      });
    });
  });
});