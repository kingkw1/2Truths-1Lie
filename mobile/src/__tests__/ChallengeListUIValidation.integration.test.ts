/**
 * Challenge List UI Validation Integration Test
 * 
 * This test validates that the challenge list state properly updates when new challenges are created.
 * It focuses on the Redux state management and API integration without complex UI rendering.
 */

import { configureStore } from '@reduxjs/toolkit';
import { realChallengeAPI } from '../services/realChallengeAPI';
import guessingGameReducer, {
  loadChallenges,
  setLoading,
  setChallengeLoadError,
  clearChallengeLoadError,
  resetRetryCount,
} from '../store/slices/guessingGameSlice';
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

describe('Challenge List UI Validation - Integration', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    
    // Reset API mocks
    mockRealChallengeAPI.getChallenges.mockReset();
    mockRealChallengeAPI.createChallenge.mockReset();
  });

  describe('Redux State Management', () => {
    it('should properly load challenges into state', () => {
      const challenges = [mockChallenge1, mockChallenge2];
      
      // Dispatch load challenges action
      store.dispatch(loadChallenges(challenges));
      
      // Verify state is updated
      const state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-1');
      expect(state.guessingGame.availableChallenges[1].id).toBe('challenge-2');
      expect(state.guessingGame.isLoading).toBe(false);
      expect(state.guessingGame.loadError).toBeNull();
    });

    it('should handle loading states correctly', () => {
      // Start loading
      store.dispatch(setLoading(true));
      
      let state = store.getState();
      expect(state.guessingGame.isLoading).toBe(true);
      expect(state.guessingGame.loadError).toBeNull();
      
      // Complete loading with challenges
      store.dispatch(loadChallenges([mockChallenge1]));
      
      state = store.getState();
      expect(state.guessingGame.isLoading).toBe(false);
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
      expect(state.guessingGame.lastSuccessfulLoad).toBeTruthy();
    });

    it('should handle error states correctly', () => {
      // Set error
      store.dispatch(setChallengeLoadError({ 
        error: 'Network error', 
        errorType: 'network' 
      }));
      
      let state = store.getState();
      expect(state.guessingGame.loadError).toBeTruthy();
      expect(state.guessingGame.loadError?.message).toBe('Network error');
      expect(state.guessingGame.loadError?.type).toBe('network');
      expect(state.guessingGame.isLoading).toBe(false);
      expect(state.guessingGame.retryCount).toBe(1);
      
      // Clear error
      store.dispatch(clearChallengeLoadError());
      
      state = store.getState();
      expect(state.guessingGame.loadError).toBeNull();
      expect(state.guessingGame.retryCount).toBe(0);
    });

    it('should update challenge list when new challenges are added', () => {
      // Initial load with one challenge
      store.dispatch(loadChallenges([mockChallenge1]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
      
      // Simulate refresh with new challenge added
      store.dispatch(loadChallenges([mockChallenge1, mockChallenge2]));
      
      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.availableChallenges.find(c => c.id === 'challenge-2')).toBeTruthy();
    });
  });

  describe('API Integration', () => {
    it('should successfully fetch challenges from API', async () => {
      // Mock successful API response
      mockRealChallengeAPI.getChallenges.mockResolvedValue([convertToBackendChallenge(mockChallenge1)]);

      // Call API
      const response = await realChallengeAPI.getChallenges(0, 20);
      
      // Verify API was called correctly
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledWith(0, 20);
      expect(response).toHaveLength(1);
      expect(response[0].challenge_id).toBe('challenge-1');
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error - getChallenges throws an error
      mockRealChallengeAPI.getChallenges.mockRejectedValue(new Error('Server error'));

      // Call API and expect it to throw
      await expect(realChallengeAPI.getChallenges(0, 20)).rejects.toThrow('Server error');
    });

    it('should create new challenge successfully', async () => {
      // Mock successful challenge creation
      mockRealChallengeAPI.createChallenge.mockResolvedValue({
        success: true,
        data: convertToBackendChallenge(mockChallenge2),
        timestamp: new Date(),
      });

      const challengeRequest = {
        statements: [
          { text: 'Statement 1', media_file_id: 'media-1' },
          { text: 'Statement 2', media_file_id: 'media-2' },
          { text: 'Statement 3', media_file_id: 'media-3' },
        ],
        lie_statement_index: 1,
        tags: ['test'],
      };

      // Call API
      const response = await realChallengeAPI.createChallenge(challengeRequest);
      
      // Verify creation
      expect(mockRealChallengeAPI.createChallenge).toHaveBeenCalledWith(challengeRequest);
      expect(response.success).toBe(true);
      expect(response.data?.challenge_id).toBe('challenge-2');
    });
  });

  describe('Challenge List Refresh Flow', () => {
    it('should simulate complete refresh flow after challenge creation', async () => {
      // Initial state - load one challenge
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Second call after creation with both challenges
        .mockResolvedValueOnce([
          convertToBackendChallenge(mockChallenge1),
          convertToBackendChallenge(mockChallenge2),
        ]);

      // Simulate initial load
      const initialResponse = await realChallengeAPI.getChallenges(0, 20);
      expect(initialResponse).toHaveLength(1);
      
      // Update Redux state with initial challenges
      store.dispatch(loadChallenges([mockChallenge1]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-1');

      // Simulate challenge creation success and refresh
      const refreshResponse = await realChallengeAPI.getChallenges(0, 20);
      expect(refreshResponse).toHaveLength(2);
      
      // Update Redux state with refreshed challenges
      store.dispatch(loadChallenges([mockChallenge1, mockChallenge2]));
      
      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.availableChallenges.find(c => c.id === 'challenge-2')).toBeTruthy();
      
      // Verify both API calls were made
      expect(mockRealChallengeAPI.getChallenges).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh failure gracefully', async () => {
      // Initial successful load
      mockRealChallengeAPI.getChallenges
        .mockResolvedValueOnce([convertToBackendChallenge(mockChallenge1)])
        // Failed refresh
        .mockRejectedValueOnce(new Error('Network timeout'));

      // Initial load
      const initialResponse = await realChallengeAPI.getChallenges(0, 20);
      store.dispatch(loadChallenges([mockChallenge1]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(1);

      // Failed refresh should throw
      await expect(realChallengeAPI.getChallenges(0, 20)).rejects.toThrow('Network timeout');
      
      // Update state with error
      store.dispatch(setChallengeLoadError({ 
        error: 'Network timeout', 
        errorType: 'timeout' 
      }));
      
      state = store.getState();
      expect(state.guessingGame.loadError?.message).toBe('Network timeout');
      expect(state.guessingGame.loadError?.type).toBe('timeout');
      // Original challenges should still be available
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
    });
  });

  describe('Challenge Statistics Updates', () => {
    it('should update challenge statistics when refreshed', () => {
      const originalChallenge = mockChallenge1;
      const updatedChallenge = {
        ...mockChallenge1,
        totalGuesses: 50, // Increased from 25
        correctGuessRate: 70, // Increased from 60
        popularityScore: 85, // Increased from 75
      };

      // Initial load
      store.dispatch(loadChallenges([originalChallenge]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges[0].totalGuesses).toBe(25);
      expect(state.guessingGame.availableChallenges[0].correctGuessRate).toBe(60);

      // Refresh with updated stats
      store.dispatch(loadChallenges([updatedChallenge]));
      
      state = store.getState();
      expect(state.guessingGame.availableChallenges[0].totalGuesses).toBe(50);
      expect(state.guessingGame.availableChallenges[0].correctGuessRate).toBe(70);
      expect(state.guessingGame.availableChallenges[0].popularityScore).toBe(85);
    });

    it('should preserve challenge order from API response', () => {
      // Load challenges in one order
      store.dispatch(loadChallenges([mockChallenge1, mockChallenge2]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-1');
      expect(state.guessingGame.availableChallenges[1].id).toBe('challenge-2');

      // Refresh with reversed order (simulating newer challenge first)
      store.dispatch(loadChallenges([mockChallenge2, mockChallenge1]));
      
      state = store.getState();
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-2');
      expect(state.guessingGame.availableChallenges[1].id).toBe('challenge-1');
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should handle retry count correctly', () => {
      // First error
      store.dispatch(setChallengeLoadError({ 
        error: 'Network error', 
        errorType: 'network' 
      }));
      
      let state = store.getState();
      expect(state.guessingGame.retryCount).toBe(1);

      // Second error (retry)
      store.dispatch(setChallengeLoadError({ 
        error: 'Network error', 
        errorType: 'network' 
      }));
      
      state = store.getState();
      expect(state.guessingGame.retryCount).toBe(2);

      // Reset retry count
      store.dispatch(resetRetryCount());
      
      state = store.getState();
      expect(state.guessingGame.retryCount).toBe(0);
    });

    it('should clear error state on successful load', () => {
      // Set error state
      store.dispatch(setChallengeLoadError({ 
        error: 'Network error', 
        errorType: 'network' 
      }));
      
      let state = store.getState();
      expect(state.guessingGame.loadError).toBeTruthy();
      expect(state.guessingGame.retryCount).toBe(1);

      // Successful load should clear error
      store.dispatch(loadChallenges([mockChallenge1]));
      
      state = store.getState();
      expect(state.guessingGame.loadError).toBeNull();
      expect(state.guessingGame.retryCount).toBe(0);
      expect(state.guessingGame.lastSuccessfulLoad).toBeTruthy();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large challenge lists efficiently', () => {
      // Create a large list of challenges
      const largeChallengeList = Array.from({ length: 100 }, (_, index) => ({
        ...mockChallenge1,
        id: `challenge-${index}`,
        creatorId: `user-${index}`,
        creatorName: `User ${index}`,
      }));

      // Load large list
      store.dispatch(loadChallenges(largeChallengeList));
      
      const state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(100);
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-0');
      expect(state.guessingGame.availableChallenges[99].id).toBe('challenge-99');
    });

    it('should replace challenge list completely on refresh', () => {
      // Initial load
      store.dispatch(loadChallenges([mockChallenge1, mockChallenge2]));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);

      // Refresh with different set of challenges
      const newChallenge = {
        ...mockChallenge1,
        id: 'challenge-3',
        creatorName: 'User 3',
      };
      
      store.dispatch(loadChallenges([newChallenge]));
      
      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-3');
      // Old challenges should be completely replaced
      expect(state.guessingGame.availableChallenges.find(c => c.id === 'challenge-1')).toBeUndefined();
      expect(state.guessingGame.availableChallenges.find(c => c.id === 'challenge-2')).toBeUndefined();
    });
  });
});