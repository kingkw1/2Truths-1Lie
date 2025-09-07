/**
 * End-to-End Integration Tests
 * Tests complete workflow from challenge creation through storage, retrieval, and display
 * Covers the full user journey including media upload, challenge persistence, and cross-device access
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform } from 'react-native';

// Import services and components
import { realChallengeAPI, RealChallengeAPIService } from '../services/realChallengeAPI';
import { VideoUploadService } from '../services/uploadService';
import { EnhancedChallengeCreation } from '../components/EnhancedChallengeCreation';
import { GameScreen } from '../screens/GameScreen';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import gameSessionReducer from '../store/slices/gameSessionSlice';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  documentDirectory: 'mock://documents/',
  cacheDirectory: 'mock://cache/',
}));

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    requestMicrophonePermissionsAsync: jest.fn(),
  },
  CameraView: jest.fn(() => null),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('End-to-End Integration Tests', () => {
  let store: any;
  let uploadService: VideoUploadService;
  let challengeAPI: RealChallengeAPIService;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
        gameSession: gameSessionReducer,
      },
      preloadedState: {
        challengeCreation: {
          currentChallenge: {
            id: 'test-challenge',
            statements: [
              { id: 'stmt_1', text: 'I have traveled to Japan', isLie: false, confidence: 0 },
              { id: 'stmt_2', text: 'I can speak three languages', isLie: false, confidence: 0 },
              { id: 'stmt_3', text: 'I have never broken a bone', isLie: true, confidence: 0 },
            ],
            mediaData: [],
            isPublic: true,
            creatorId: 'test-user-123',
          },
          isRecording: false,
          recordingType: null,
          currentStatementIndex: 0,
          validationErrors: [],
          isSubmitting: false,
          submissionSuccess: false,
          uploadState: {},
          mediaRecordingState: {},
          previewMode: false,
          individualRecordings: {},
        },
        gameSession: {
          currentSession: null,
          isActive: false,
          lastActivity: null,
          sessionHistory: [],
        },
      },
    });

    uploadService = VideoUploadService.getInstance();
    uploadService.setAuthToken('test-token');
    challengeAPI = new RealChallengeAPIService();
    jest.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<Provider store={store}>{component}</Provider>);
  };

  describe('Complete Challenge Creation Workflow', () => {
    it('should complete full challenge creation from recording to backend storage', async () => {
      // Mock file system operations
      const mockVideoFile = {
        exists: true,
        size: 5 * 1024 * 1024, // 5MB
        uri: 'mock://merged-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-video-data');

      // Mock successful upload flow
      mockFetch
        // Upload initiation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'e2e-upload-session',
            upload_url: '/api/upload/e2e-upload-session',
            chunk_size: 1024 * 1024,
            total_chunks: 5,
          }),
          headers: new Map([['X-Upload-Session-ID', 'e2e-upload-session']]),
        })
        // Chunk uploads (5 chunks)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ chunk_uploaded: true, progress: 20 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ chunk_uploaded: true, progress: 40 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ chunk_uploaded: true, progress: 60 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ chunk_uploaded: true, progress: 80 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 100,
            media_url: '/api/media/stream/e2e-video-id',
            media_id: 'e2e-video-id',
          }),
        })
        // Challenge creation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            challenge_id: 'e2e-challenge-123',
            creator_id: 'test-user-123',
            statements: [
              {
                statement_id: 'stmt_1',
                statement_type: 'truth',
                media_url: '/api/media/stream/e2e-video-id',
                media_file_id: 'e2e-video-id',
                duration_seconds: 10,
                segment_start_time: 0,
                segment_end_time: 10,
                created_at: new Date().toISOString(),
              },
              {
                statement_id: 'stmt_2',
                statement_type: 'truth',
                media_url: '/api/media/stream/e2e-video-id',
                media_file_id: 'e2e-video-id',
                duration_seconds: 10,
                segment_start_time: 10,
                segment_end_time: 20,
                created_at: new Date().toISOString(),
              },
              {
                statement_id: 'stmt_3',
                statement_type: 'lie',
                media_url: '/api/media/stream/e2e-video-id',
                media_file_id: 'e2e-video-id',
                duration_seconds: 10,
                segment_start_time: 20,
                segment_end_time: 30,
                created_at: new Date().toISOString(),
              },
            ],
            lie_statement_id: 'stmt_3',
            status: 'published',
            is_merged_video: true,
            merged_video_metadata: {
              total_duration_ms: 30000,
              segment_count: 3,
              segments: [
                { statement_index: 0, start_time_ms: 0, end_time_ms: 10000, duration_ms: 10000 },
                { statement_index: 1, start_time_ms: 10000, end_time_ms: 20000, duration_ms: 10000 },
                { statement_index: 2, start_time_ms: 20000, end_time_ms: 30000, duration_ms: 10000 },
              ],
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            view_count: 0,
            guess_count: 0,
            correct_guess_count: 0,
          }),
        });

      // Step 1: Upload merged video
      const uploadResult = await uploadService.uploadVideo(
        mockVideoFile.uri,
        'merged-challenge-video.mp4',
        30000, // 30 seconds total
        {}
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mediaId).toBe('e2e-video-id');
      expect(uploadResult.streamingUrl).toBe('/api/media/stream/e2e-video-id');

      // Step 2: Create challenge with uploaded media
      const challengeRequest = {
        statements: [
          {
            text: 'I have traveled to Japan',
            media_file_id: 'e2e-video-id',
            segment_start_time: 0,
            segment_end_time: 10,
            segment_duration: 10,
          },
          {
            text: 'I can speak three languages',
            media_file_id: 'e2e-video-id',
            segment_start_time: 10,
            segment_end_time: 20,
            segment_duration: 10,
          },
          {
            text: 'I have never broken a bone',
            media_file_id: 'e2e-video-id',
            segment_start_time: 20,
            segment_end_time: 30,
            segment_duration: 10,
          },
        ],
        lie_statement_index: 2,
        is_merged_video: true,
        merged_video_metadata: {
          total_duration_ms: 30000,
          segment_count: 3,
          segments: [
            { statement_index: 0, start_time_ms: 0, end_time_ms: 10000, duration_ms: 10000 },
            { statement_index: 1, start_time_ms: 10000, end_time_ms: 20000, duration_ms: 10000 },
            { statement_index: 2, start_time_ms: 20000, end_time_ms: 30000, duration_ms: 10000 },
          ],
        },
      };

      const challengeResult = await challengeAPI.createChallenge(challengeRequest);

      expect(challengeResult.success).toBe(true);
      expect(challengeResult.data?.challenge_id).toBe('e2e-challenge-123');
      expect(challengeResult.data?.statements).toHaveLength(3);
      expect(challengeResult.data?.is_merged_video).toBe(true);
      expect(challengeResult.data?.merged_video_metadata).toBeDefined();

      // Verify all API calls were made correctly
      expect(mockFetch).toHaveBeenCalledTimes(7); // 6 upload calls + 1 challenge creation
    });

    it('should handle upload failure and retry successfully', async () => {
      const mockVideoFile = {
        exists: true,
        size: 3 * 1024 * 1024, // 3MB
        uri: 'mock://retry-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock upload initiation success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'retry-session',
          upload_url: '/api/upload/retry-session',
          chunk_size: 1024 * 1024,
          total_chunks: 3,
        }),
        headers: new Map([['X-Upload-Session-ID', 'retry-session']]),
      });

      // Mock first chunk success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chunk_uploaded: true, progress: 33 }),
      });

      // Mock second chunk failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Mock resume status check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'retry-session',
          uploaded_chunks: [0],
          remaining_chunks: [1, 2],
          progress: 33,
        }),
      });

      // Mock successful retry of remaining chunks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chunk_uploaded: true, progress: 67 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/retry-video-id',
          media_id: 'retry-video-id',
        }),
      });

      const uploadResult = await uploadService.uploadVideo(
        mockVideoFile.uri,
        'retry-video.mp4',
        25000,
        { retryAttempts: 3 }
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mediaId).toBe('retry-video-id');

      // Should have made resume calls
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/retry-session/status'),
        expect.any(Object)
      );
    });
  });

  describe('Challenge Retrieval and Display Workflow', () => {
    it('should retrieve and display challenges correctly', async () => {
      // Mock successful challenge list retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenges: [
            {
              challenge_id: 'display-challenge-1',
              creator_id: 'user-456',
              statements: [
                {
                  statement_id: 'stmt_1',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/video-1',
                  media_file_id: 'video-1',
                  duration_seconds: 8,
                  segment_start_time: 0,
                  segment_end_time: 8,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'stmt_2',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/video-1',
                  media_file_id: 'video-1',
                  duration_seconds: 9,
                  segment_start_time: 8,
                  segment_end_time: 17,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'stmt_3',
                  statement_type: 'lie',
                  media_url: '/api/media/stream/video-1',
                  media_file_id: 'video-1',
                  duration_seconds: 7,
                  segment_start_time: 17,
                  segment_end_time: 24,
                  created_at: new Date().toISOString(),
                },
              ],
              lie_statement_id: 'stmt_3',
              status: 'published',
              is_merged_video: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              view_count: 15,
              guess_count: 8,
              correct_guess_count: 3,
            },
            {
              challenge_id: 'display-challenge-2',
              creator_id: 'user-789',
              statements: [
                {
                  statement_id: 'stmt_4',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/video-2',
                  media_file_id: 'video-2',
                  duration_seconds: 12,
                  segment_start_time: 0,
                  segment_end_time: 12,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'stmt_5',
                  statement_type: 'lie',
                  media_url: '/api/media/stream/video-2',
                  media_file_id: 'video-2',
                  duration_seconds: 10,
                  segment_start_time: 12,
                  segment_end_time: 22,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'stmt_6',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/video-2',
                  media_file_id: 'video-2',
                  duration_seconds: 11,
                  segment_start_time: 22,
                  segment_end_time: 33,
                  created_at: new Date().toISOString(),
                },
              ],
              lie_statement_id: 'stmt_5',
              status: 'published',
              is_merged_video: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              view_count: 22,
              guess_count: 12,
              correct_guess_count: 7,
            },
          ],
          total_count: 2,
          has_next: false,
        }),
      });

      const challengesResult = await challengeAPI.getChallenges(0, 20);

      expect(challengesResult.success).toBe(true);
      expect(challengesResult.data).toHaveLength(2);
      expect(challengesResult.data?.[0].challenge_id).toBe('display-challenge-1');
      expect(challengesResult.data?.[0].statements).toHaveLength(3);
      expect(challengesResult.data?.[0].is_merged_video).toBe(true);
      expect(challengesResult.data?.[1].challenge_id).toBe('display-challenge-2');
    });

    it('should retrieve specific challenge details correctly', async () => {
      const challengeId = 'detail-challenge-123';

      // Mock successful challenge detail retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: challengeId,
          creator_id: 'detail-user',
          statements: [
            {
              statement_id: 'detail_stmt_1',
              statement_type: 'truth',
              media_url: '/api/media/stream/detail-video',
              media_file_id: 'detail-video',
              duration_seconds: 15,
              segment_start_time: 0,
              segment_end_time: 15,
              segment_metadata: { quality: 'high', compression: 0.8 },
              created_at: new Date().toISOString(),
            },
            {
              statement_id: 'detail_stmt_2',
              statement_type: 'lie',
              media_url: '/api/media/stream/detail-video',
              media_file_id: 'detail-video',
              duration_seconds: 12,
              segment_start_time: 15,
              segment_end_time: 27,
              segment_metadata: { quality: 'high', compression: 0.8 },
              created_at: new Date().toISOString(),
            },
            {
              statement_id: 'detail_stmt_3',
              statement_type: 'truth',
              media_url: '/api/media/stream/detail-video',
              media_file_id: 'detail-video',
              duration_seconds: 13,
              segment_start_time: 27,
              segment_end_time: 40,
              segment_metadata: { quality: 'high', compression: 0.8 },
              created_at: new Date().toISOString(),
            },
          ],
          lie_statement_id: 'detail_stmt_2',
          status: 'published',
          is_merged_video: true,
          merged_video_metadata: {
            total_duration_ms: 40000,
            segment_count: 3,
            segments: [
              { statement_index: 0, start_time_ms: 0, end_time_ms: 15000, duration_ms: 15000 },
              { statement_index: 1, start_time_ms: 15000, end_time_ms: 27000, duration_ms: 12000 },
              { statement_index: 2, start_time_ms: 27000, end_time_ms: 40000, duration_ms: 13000 },
            ],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          view_count: 45,
          guess_count: 23,
          correct_guess_count: 12,
        }),
      });

      const challengeResult = await challengeAPI.getChallenge(challengeId);

      expect(challengeResult.success).toBe(true);
      expect(challengeResult.data?.challenge_id).toBe(challengeId);
      expect(challengeResult.data?.statements).toHaveLength(3);
      expect(challengeResult.data?.lie_statement_id).toBe('detail_stmt_2');
      expect(challengeResult.data?.merged_video_metadata).toBeDefined();
      expect(challengeResult.data?.merged_video_metadata?.total_duration_ms).toBe(40000);
      expect(challengeResult.data?.merged_video_metadata?.segments).toHaveLength(3);
    });
  });

  describe('Cross-Device Accessibility Tests', () => {
    it('should handle iOS-specific media access patterns', async () => {
      // Mock iOS platform
      Platform.OS = 'ios';

      const mockVideoFile = {
        exists: true,
        size: 4 * 1024 * 1024,
        uri: 'file:///var/mobile/Containers/Data/Application/video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('ios-video-data');

      // Mock successful iOS upload
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'ios-session',
            upload_url: '/api/upload/ios-session',
            chunk_size: 1024 * 1024,
            total_chunks: 4,
          }),
          headers: new Map([['X-Upload-Session-ID', 'ios-session']]),
        });

      // Mock chunk uploads
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 4) * 100,
          }),
        });
      }

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/ios-video-id',
          media_id: 'ios-video-id',
        }),
      });

      const uploadResult = await uploadService.uploadVideo(
        mockVideoFile.uri,
        'ios-video.mp4',
        35000,
        {}
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.streamingUrl).toBe('/api/media/stream/ios-video-id');

      // Verify iOS-specific handling
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/ios-session'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle Android-specific media access patterns', async () => {
      // Mock Android platform
      Platform.OS = 'android';

      const mockVideoFile = {
        exists: true,
        size: 6 * 1024 * 1024,
        uri: 'content://media/external/video/media/12345',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('android-video-data');

      // Mock successful Android upload
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'android-session',
            upload_url: '/api/upload/android-session',
            chunk_size: 1024 * 1024,
            total_chunks: 6,
          }),
          headers: new Map([['X-Upload-Session-ID', 'android-session']]),
        });

      // Mock chunk uploads
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 6) * 100,
          }),
        });
      }

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/android-video-id',
          media_id: 'android-video-id',
        }),
      });

      const uploadResult = await uploadService.uploadVideo(
        mockVideoFile.uri,
        'android-video.mp4',
        40000,
        {}
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.streamingUrl).toBe('/api/media/stream/android-video-id');

      // Verify Android-specific handling
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/android-session'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('Guess Submission and Result Workflow', () => {
    it('should complete guess submission and result retrieval', async () => {
      const challengeId = 'guess-challenge-456';
      const guessedStatementId = 'stmt_2';

      // Mock successful guess submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: challengeId,
          guessed_statement_id: guessedStatementId,
          correct_lie_statement_id: 'stmt_3',
          is_correct: false,
          points_earned: 0,
          total_points: 100,
          guess_timestamp: new Date().toISOString(),
          explanation: 'The lie was actually statement 3',
        }),
      });

      const guessResult = await challengeAPI.submitGuess(challengeId, guessedStatementId);

      expect(guessResult.success).toBe(true);
      expect(guessResult.data?.challenge_id).toBe(challengeId);
      expect(guessResult.data?.guessed_statement_id).toBe(guessedStatementId);
      expect(guessResult.data?.is_correct).toBe(false);
      expect(guessResult.data?.points_earned).toBe(0);

      // Verify API call was made correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/challenges/${challengeId}/guess`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify({
            guessed_lie_statement_id: guessedStatementId,
          }),
        })
      );
    });

    it('should handle correct guess submission', async () => {
      const challengeId = 'correct-guess-challenge';
      const correctGuessId = 'stmt_1';

      // Mock successful correct guess
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: challengeId,
          guessed_statement_id: correctGuessId,
          correct_lie_statement_id: correctGuessId,
          is_correct: true,
          points_earned: 50,
          total_points: 150,
          guess_timestamp: new Date().toISOString(),
          explanation: 'Correct! You identified the lie.',
        }),
      });

      const guessResult = await challengeAPI.submitGuess(challengeId, correctGuessId);

      expect(guessResult.success).toBe(true);
      expect(guessResult.data?.is_correct).toBe(true);
      expect(guessResult.data?.points_earned).toBe(50);
      expect(guessResult.data?.total_points).toBe(150);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const challengesResult = await challengeAPI.getChallenges(0, 10);

      expect(challengesResult.success).toBe(false);
      expect(challengesResult.error).toContain('Network request failed');
    });

    it('should handle authentication errors', async () => {
      // Mock authentication error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: 'Invalid or expired authentication token',
          error_code: 'AUTHENTICATION_FAILED',
        }),
      });

      const challengesResult = await challengeAPI.getChallenges(0, 10);

      expect(challengesResult.success).toBe(false);
      expect(challengesResult.error).toContain('Invalid or expired authentication token');
    });

    it('should handle server errors with proper error messages', async () => {
      // Mock server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error',
          error_code: 'INTERNAL_ERROR',
        }),
      });

      const challengeRequest = {
        statements: [
          { text: 'Test statement', media_file_id: 'test-media', segment_start_time: 0, segment_end_time: 10, segment_duration: 10 },
        ],
        lie_statement_index: 0,
      };

      const challengeResult = await challengeAPI.createChallenge(challengeRequest);

      expect(challengeResult.success).toBe(false);
      expect(challengeResult.error).toContain('Challenge creation failed: 500');
    });
  });

  describe('Data Persistence and Consistency', () => {
    it('should maintain data consistency across create-retrieve cycle', async () => {
      const testChallenge = {
        statements: [
          {
            text: 'I have climbed Mount Everest',
            media_file_id: 'consistency-video',
            segment_start_time: 0,
            segment_end_time: 12,
            segment_duration: 12,
          },
          {
            text: 'I speak fluent Mandarin',
            media_file_id: 'consistency-video',
            segment_start_time: 12,
            segment_end_time: 25,
            segment_duration: 13,
          },
          {
            text: 'I have never been on an airplane',
            media_file_id: 'consistency-video',
            segment_start_time: 25,
            segment_end_time: 38,
            segment_duration: 13,
          },
        ],
        lie_statement_index: 2,
        tags: ['adventure', 'travel', 'languages'],
        is_merged_video: true,
        merged_video_metadata: {
          total_duration_ms: 38000,
          segment_count: 3,
          segments: [
            { statement_index: 0, start_time_ms: 0, end_time_ms: 12000, duration_ms: 12000 },
            { statement_index: 1, start_time_ms: 12000, end_time_ms: 25000, duration_ms: 13000 },
            { statement_index: 2, start_time_ms: 25000, end_time_ms: 38000, duration_ms: 13000 },
          ],
        },
      };

      // Mock challenge creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: 'consistency-challenge',
          creator_id: 'test-user-123',
          statements: testChallenge.statements.map((stmt, index) => ({
            statement_id: `consistency_stmt_${index + 1}`,
            statement_type: index === testChallenge.lie_statement_index ? 'lie' : 'truth',
            media_url: `/api/media/stream/${stmt.media_file_id}`,
            media_file_id: stmt.media_file_id,
            duration_seconds: stmt.segment_duration,
            segment_start_time: stmt.segment_start_time,
            segment_end_time: stmt.segment_end_time,
            created_at: new Date().toISOString(),
          })),
          lie_statement_id: 'consistency_stmt_3',
          status: 'published',
          tags: testChallenge.tags,
          is_merged_video: testChallenge.is_merged_video,
          merged_video_metadata: testChallenge.merged_video_metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          view_count: 0,
          guess_count: 0,
          correct_guess_count: 0,
        }),
      });

      // Mock challenge retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: 'consistency-challenge',
          creator_id: 'test-user-123',
          statements: testChallenge.statements.map((stmt, index) => ({
            statement_id: `consistency_stmt_${index + 1}`,
            statement_type: index === testChallenge.lie_statement_index ? 'lie' : 'truth',
            media_url: `/api/media/stream/${stmt.media_file_id}`,
            media_file_id: stmt.media_file_id,
            duration_seconds: stmt.segment_duration,
            segment_start_time: stmt.segment_start_time,
            segment_end_time: stmt.segment_end_time,
            created_at: new Date().toISOString(),
          })),
          lie_statement_id: 'consistency_stmt_3',
          status: 'published',
          tags: testChallenge.tags,
          is_merged_video: testChallenge.is_merged_video,
          merged_video_metadata: testChallenge.merged_video_metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          view_count: 1,
          guess_count: 0,
          correct_guess_count: 0,
        }),
      });

      // Create challenge
      const createResult = await challengeAPI.createChallenge(testChallenge);
      expect(createResult.success).toBe(true);

      // Retrieve challenge
      const retrieveResult = await challengeAPI.getChallenge('consistency-challenge');
      expect(retrieveResult.success).toBe(true);

      // Verify data consistency
      const created = createResult.data!;
      const retrieved = retrieveResult.data!;

      expect(retrieved.challenge_id).toBe(created.challenge_id);
      expect(retrieved.statements).toHaveLength(created.statements.length);
      expect(retrieved.lie_statement_id).toBe(created.lie_statement_id);
      expect(retrieved.is_merged_video).toBe(created.is_merged_video);
      expect(retrieved.merged_video_metadata).toEqual(created.merged_video_metadata);
      expect(retrieved.tags).toEqual(created.tags);

      // Verify segment metadata consistency
      for (let i = 0; i < retrieved.statements.length; i++) {
        const createdStmt = created.statements[i];
        const retrievedStmt = retrieved.statements[i];
        
        expect(retrievedStmt.segment_start_time).toBe(createdStmt.segment_start_time);
        expect(retrievedStmt.segment_end_time).toBe(createdStmt.segment_end_time);
        expect(retrievedStmt.duration_seconds).toBe(createdStmt.duration_seconds);
        expect(retrievedStmt.media_file_id).toBe(createdStmt.media_file_id);
      }
    });
  });
});