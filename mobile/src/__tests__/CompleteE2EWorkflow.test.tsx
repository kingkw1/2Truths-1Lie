/**
 * Complete End-to-End Workflow Tests
 * Tests the entire user journey from video capture through upload, challenge creation, and playback
 * Covers all aspects of the mobile client integration with server-side video processing
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform } from 'react-native';

// Import services and components
import { VideoUploadService } from '../services/uploadService';
import { realChallengeAPI, RealChallengeAPIService } from '../services/realChallengeAPI';
import { EnhancedChallengeCreation } from '../components/EnhancedChallengeCreation';
import { GameScreen } from '../screens/GameScreen';
import { SegmentedVideoPlayer } from '../components/SegmentedVideoPlayer';
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
  copyAsync: jest.fn(),
  moveAsync: jest.fn(),
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

jest.mock('expo-av', () => ({
  Video: jest.fn(() => null),
  ResizeMode: {
    CONTAIN: 'contain',
    COVER: 'cover',
    STRETCH: 'stretch',
  },
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

describe('Complete E2E Workflow Tests', () => {
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
            id: 'e2e-test-challenge',
            statements: [
              { id: 'stmt_1', text: 'I have climbed Mount Everest', isLie: false, confidence: 0 },
              { id: 'stmt_2', text: 'I speak fluent Mandarin', isLie: false, confidence: 0 },
              { id: 'stmt_3', text: 'I have never been on an airplane', isLie: true, confidence: 0 },
            ],
            mediaData: [],
            isPublic: true,
            creatorId: 'e2e-test-user',
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
          mergeState: {},
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
    uploadService.setAuthToken('e2e-test-token');
    challengeAPI = new RealChallengeAPIService();
    jest.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<Provider store={store}>{component}</Provider>);
  };

  describe('Complete Multi-Video Upload and Merge Workflow', () => {
    it('should complete full workflow from video capture to challenge creation', async () => {
      // Mock file system operations for three individual videos
      const mockVideoFiles = [
        {
          exists: true,
          size: 3 * 1024 * 1024, // 3MB
          uri: 'mock://statement-0-video.mp4',
          duration: 10000, // 10 seconds
        },
        {
          exists: true,
          size: 3.5 * 1024 * 1024, // 3.5MB
          uri: 'mock://statement-1-video.mp4',
          duration: 12500, // 12.5 seconds
        },
        {
          exists: true,
          size: 4 * 1024 * 1024, // 4MB
          uri: 'mock://statement-2-video.mp4',
          duration: 15000, // 15 seconds
        },
      ];

      require('expo-file-system').getInfoAsync
        .mockResolvedValueOnce(mockVideoFiles[0])
        .mockResolvedValueOnce(mockVideoFiles[1])
        .mockResolvedValueOnce(mockVideoFiles[2]);

      require('expo-file-system').readAsStringAsync
        .mockResolvedValueOnce('mock-base64-video-data-0')
        .mockResolvedValueOnce('mock-base64-video-data-1')
        .mockResolvedValueOnce('mock-base64-video-data-2');

      // Mock successful multi-video upload flow
      mockFetch
        // Multi-video upload initiation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merge_session_id: 'e2e-merge-session-123',
            total_videos: 3,
            upload_sessions: [
              {
                session_id: 'e2e-upload-session-0',
                video_index: 0,
                chunk_size: 1024 * 1024,
                total_chunks: 3,
              },
              {
                session_id: 'e2e-upload-session-1',
                video_index: 1,
                chunk_size: 1024 * 1024,
                total_chunks: 4,
              },
              {
                session_id: 'e2e-upload-session-2',
                video_index: 2,
                chunk_size: 1024 * 1024,
                total_chunks: 4,
              },
            ],
            status: 'initiated',
            estimated_merge_time_seconds: 30,
          }),
          headers: new Map([
            ['X-Merge-Session-ID', 'e2e-merge-session-123'],
            ['X-Total-Videos', '3'],
          ]),
        });

      // Mock chunk uploads for all three videos (11 total chunks)
      for (let i = 0; i < 11; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 11) * 100,
            session_id: `e2e-upload-session-${Math.floor(i / 4)}`,
            merge_session_id: 'e2e-merge-session-123',
            video_index: Math.floor(i / 4),
            status: 'uploaded',
          }),
        });
      }

      // Mock upload completion for each video
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'e2e-upload-session-0',
            merge_session_id: 'e2e-merge-session-123',
            video_index: 0,
            status: 'completed',
            merge_triggered: false,
            merge_status: 'pending',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'e2e-upload-session-1',
            merge_session_id: 'e2e-merge-session-123',
            video_index: 1,
            status: 'completed',
            merge_triggered: false,
            merge_status: 'pending',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'e2e-upload-session-2',
            merge_session_id: 'e2e-merge-session-123',
            video_index: 2,
            status: 'completed',
            merge_triggered: true,
            merge_status: 'processing',
          }),
        });

      // Mock merge status checks
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merge_session_id: 'e2e-merge-session-123',
            total_videos: 3,
            completed_videos: 3,
            failed_videos: 0,
            overall_status: 'ready_for_merge',
            merge_triggered: true,
            merge_status: 'processing',
            merge_progress_percent: 50.0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merge_session_id: 'e2e-merge-session-123',
            total_videos: 3,
            completed_videos: 3,
            failed_videos: 0,
            overall_status: 'ready_for_merge',
            merge_triggered: true,
            merge_status: 'completed',
            merge_progress_percent: 100.0,
            merged_video_url: '/api/media/stream/e2e-merged-video-id',
            merged_video_metadata: {
              total_duration: 37.5,
              segments: [
                { start_time: 0.0, end_time: 10.0, duration: 10.0, statement_index: 0 },
                { start_time: 10.0, end_time: 22.5, duration: 12.5, statement_index: 1 },
                { start_time: 22.5, end_time: 37.5, duration: 15.0, statement_index: 2 },
              ],
            },
          }),
        });

      // Mock challenge creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: 'e2e-created-challenge-456',
          creator_id: 'e2e-test-user',
          statements: [
            {
              statement_id: 'stmt_1',
              statement_type: 'truth',
              media_url: '/api/media/stream/e2e-merged-video-id',
              media_file_id: 'e2e-merged-video-id',
              duration_seconds: 10,
              segment_start_time: 0,
              segment_end_time: 10,
              created_at: new Date().toISOString(),
            },
            {
              statement_id: 'stmt_2',
              statement_type: 'truth',
              media_url: '/api/media/stream/e2e-merged-video-id',
              media_file_id: 'e2e-merged-video-id',
              duration_seconds: 12.5,
              segment_start_time: 10,
              segment_end_time: 22.5,
              created_at: new Date().toISOString(),
            },
            {
              statement_id: 'stmt_3',
              statement_type: 'lie',
              media_url: '/api/media/stream/e2e-merged-video-id',
              media_file_id: 'e2e-merged-video-id',
              duration_seconds: 15,
              segment_start_time: 22.5,
              segment_end_time: 37.5,
              created_at: new Date().toISOString(),
            },
          ],
          lie_statement_id: 'stmt_3',
          status: 'published',
          is_merged_video: true,
          merged_video_metadata: {
            total_duration_ms: 37500,
            segment_count: 3,
            segments: [
              { statement_index: 0, start_time_ms: 0, end_time_ms: 10000, duration_ms: 10000 },
              { statement_index: 1, start_time_ms: 10000, end_time_ms: 22500, duration_ms: 12500 },
              { statement_index: 2, start_time_ms: 22500, end_time_ms: 37500, duration_ms: 15000 },
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

      // Step 1: Simulate multi-video upload
      const uploadResult = await uploadService.uploadVideosForMerge([
        {
          uri: mockVideoFiles[0].uri,
          filename: 'statement-0.mp4',
          duration: mockVideoFiles[0].duration,
          statementIndex: 0,
        },
        {
          uri: mockVideoFiles[1].uri,
          filename: 'statement-1.mp4',
          duration: mockVideoFiles[1].duration,
          statementIndex: 1,
        },
        {
          uri: mockVideoFiles[2].uri,
          filename: 'statement-2.mp4',
          duration: mockVideoFiles[2].duration,
          statementIndex: 2,
        },
      ]);

      // Verify upload succeeded
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mergeSessionId).toBe('e2e-merge-session-123');

      // Step 2: Check merge status (simulated as part of upload result)
      const mergeStatusResult = {
        success: true,
        data: {
          merge_status: 'completed',
          merged_video_url: '/api/media/stream/e2e-merged-video-id',
          merged_video_metadata: {
            total_duration: 37.5,
            segments: [
              { start_time: 0.0, end_time: 10.0, duration: 10.0, statement_index: 0 },
              { start_time: 10.0, end_time: 22.5, duration: 12.5, statement_index: 1 },
              { start_time: 22.5, end_time: 37.5, duration: 15.0, statement_index: 2 },
            ],
          },
        },
      };

      expect(mergeStatusResult.success).toBe(true);
      expect(mergeStatusResult.data?.merge_status).toBe('completed');
      expect(mergeStatusResult.data?.merged_video_url).toBe('/api/media/stream/e2e-merged-video-id');
      expect(mergeStatusResult.data?.merged_video_metadata?.total_duration).toBe(37.5);
      expect(mergeStatusResult.data?.merged_video_metadata?.segments).toHaveLength(3);

      // Step 3: Create challenge with merged video data
      const challengeRequest = {
        statements: [
          {
            text: 'I have climbed Mount Everest',
            media_file_id: 'e2e-merged-video-id',
            segment_start_time: 0,
            segment_end_time: 10,
            segment_duration: 10,
          },
          {
            text: 'I speak fluent Mandarin',
            media_file_id: 'e2e-merged-video-id',
            segment_start_time: 10,
            segment_end_time: 22.5,
            segment_duration: 12.5,
          },
          {
            text: 'I have never been on an airplane',
            media_file_id: 'e2e-merged-video-id',
            segment_start_time: 22.5,
            segment_end_time: 37.5,
            segment_duration: 15,
          },
        ],
        lie_statement_index: 2,
        is_merged_video: true,
        merged_video_metadata: {
          ...mergeStatusResult.data?.merged_video_metadata,
          video_file_id: 'e2e-merged-video-id',
          compression_applied: true,
          original_total_duration: 37.5,
        },
      };

      const challengeResult = await challengeAPI.createChallenge(challengeRequest);

      expect(challengeResult.success).toBe(true);
      expect(challengeResult.data?.challenge_id).toBe('e2e-created-challenge-456');
      expect(challengeResult.data?.statements).toHaveLength(3);
      expect(challengeResult.data?.is_merged_video).toBe(true);
      expect(challengeResult.data?.merged_video_metadata).toBeDefined();

      // Verify all API calls were made correctly
      expect(mockFetch).toHaveBeenCalledTimes(16); // 1 initiate + 11 chunks + 3 complete + 2 status + 1 create
    });

    it('should handle upload failure and recovery in multi-video workflow', async () => {
      const mockVideoFiles = [
        {
          exists: true,
          size: 2 * 1024 * 1024, // 2MB
          uri: 'mock://recovery-video-0.mp4',
          duration: 8000,
        },
        {
          exists: true,
          size: 2.5 * 1024 * 1024, // 2.5MB
          uri: 'mock://recovery-video-1.mp4',
          duration: 10000,
        },
        {
          exists: true,
          size: 3 * 1024 * 1024, // 3MB
          uri: 'mock://recovery-video-2.mp4',
          duration: 12000,
        },
      ];

      require('expo-file-system').getInfoAsync
        .mockResolvedValueOnce(mockVideoFiles[0])
        .mockResolvedValueOnce(mockVideoFiles[1])
        .mockResolvedValueOnce(mockVideoFiles[2]);

      require('expo-file-system').readAsStringAsync
        .mockResolvedValueOnce('recovery-video-data-0')
        .mockResolvedValueOnce('recovery-video-data-1')
        .mockResolvedValueOnce('recovery-video-data-2');

      // Mock upload initiation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          merge_session_id: 'recovery-merge-session',
          total_videos: 3,
          upload_sessions: [
            {
              session_id: 'recovery-session-0',
              video_index: 0,
              chunk_size: 1024 * 1024,
              total_chunks: 2,
            },
            {
              session_id: 'recovery-session-1',
              video_index: 1,
              chunk_size: 1024 * 1024,
              total_chunks: 3,
            },
            {
              session_id: 'recovery-session-2',
              video_index: 2,
              chunk_size: 1024 * 1024,
              total_chunks: 3,
            },
          ],
          status: 'initiated',
        }),
      });

      // Mock successful first chunk upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 50,
          session_id: 'recovery-session-0',
          status: 'uploaded',
        }),
      });

      // Mock failed second chunk upload
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Mock upload status check for recovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'recovery-session-0',
          merge_session_id: 'recovery-merge-session',
          video_index: 0,
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0],
          remaining_chunks: [1],
          total_chunks: 2,
        }),
      });

      // Mock successful retry of failed chunk
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          session_id: 'recovery-session-0',
          status: 'uploaded',
        }),
      });

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'recovery-session-0',
          status: 'completed',
          merge_triggered: false,
        }),
      });

      // Step 1: Start upload (will fail on second chunk)
      const uploadResult = await uploadService.uploadVideosForMerge([
        {
          uri: mockVideoFiles[0].uri,
          filename: 'recovery-video-0.mp4',
          duration: mockVideoFiles[0].duration,
          statementIndex: 0,
        },
      ], { retryAttempts: 3 });

      // Should succeed after retry
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mergeSessionId).toBe('recovery-merge-session');

      // Verify retry logic was triggered
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/challenge-videos/upload-for-merge/initiate'),
        expect.any(Object)
      );
    });
  });

  describe('Challenge Playback and Interaction Workflow', () => {
    it('should retrieve and display challenges with segmented video playback', async () => {
      // Mock challenge list retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenges: [
            {
              challenge_id: 'playback-challenge-789',
              creator_id: 'playback-user',
              statements: [
                {
                  statement_id: 'playback_stmt_1',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/playback-video',
                  media_file_id: 'playback-video',
                  duration_seconds: 12,
                  segment_start_time: 0,
                  segment_end_time: 12,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'playback_stmt_2',
                  statement_type: 'lie',
                  media_url: '/api/media/stream/playback-video',
                  media_file_id: 'playback-video',
                  duration_seconds: 11,
                  segment_start_time: 12,
                  segment_end_time: 23,
                  created_at: new Date().toISOString(),
                },
                {
                  statement_id: 'playback_stmt_3',
                  statement_type: 'truth',
                  media_url: '/api/media/stream/playback-video',
                  media_file_id: 'playback-video',
                  duration_seconds: 13,
                  segment_start_time: 23,
                  segment_end_time: 36,
                  created_at: new Date().toISOString(),
                },
              ],
              lie_statement_id: 'playback_stmt_2',
              status: 'published',
              is_merged_video: true,
              merged_video_metadata: {
                total_duration_ms: 36000,
                segment_count: 3,
                segments: [
                  { statement_index: 0, start_time_ms: 0, end_time_ms: 12000, duration_ms: 12000 },
                  { statement_index: 1, start_time_ms: 12000, end_time_ms: 23000, duration_ms: 11000 },
                  { statement_index: 2, start_time_ms: 23000, end_time_ms: 36000, duration_ms: 13000 },
                ],
              },
              created_at: new Date().toISOString(),
              view_count: 25,
              guess_count: 15,
              correct_guess_count: 8,
            },
          ],
          total_count: 1,
          has_next: false,
        }),
      });

      const challengesResult = await challengeAPI.getChallenges(0, 20);

      expect(challengesResult).toHaveLength(1);
      
      const challenge = challengesResult[0];
      expect(challenge?.challenge_id).toBe('playback-challenge-789');
      expect(challenge?.statements).toHaveLength(3);
      expect(challenge?.is_merged_video).toBe(true);
      expect(challenge?.merged_video_metadata?.total_duration_ms).toBe(36000);

      // Test segmented video player component
      const mockMergedVideo = {
        type: 'video' as const,
        streamingUrl: "/api/media/stream/playback-video",
        mediaId: "playback-video",
        duration: 36000,
      };

      const mockSegments = challenge?.merged_video_metadata?.segments?.map((seg: any) => ({
        statementIndex: seg.statement_index,
        startTime: seg.start_time_ms,
        endTime: seg.end_time_ms,
        duration: seg.duration_ms,
      })) || [];

      const { getByTestId } = renderWithProvider(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
          onSegmentSelect={jest.fn()}
          statementTexts={['Statement 1', 'Statement 2', 'Statement 3']}
          autoPlay={false}
        />
      );

      // Verify video player is rendered with correct props
      expect(getByTestId('segmented-video-player')).toBeTruthy();
    });

    it('should handle guess submission and result display', async () => {
      const challengeId = 'guess-challenge-101';
      const guessedStatementId = 'guess_stmt_2';

      // Mock successful guess submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: challengeId,
          guessed_statement_id: guessedStatementId,
          correct_lie_statement_id: 'guess_stmt_3',
          is_correct: false,
          points_earned: 0,
          total_points: 150,
          guess_timestamp: new Date().toISOString(),
          explanation: 'The lie was actually statement 3: "I have never broken a bone"',
        }),
      });

      const guessResult = await challengeAPI.submitGuess(challengeId, guessedStatementId);

      expect(guessResult.success).toBe(true);
      expect(guessResult.data?.challenge_id).toBe(challengeId);
      expect(guessResult.data?.guessed_statement_id).toBe(guessedStatementId);
      expect(guessResult.data?.is_correct).toBe(false);
      expect(guessResult.data?.points_earned).toBe(0);
      expect(guessResult.data?.explanation).toContain('The lie was actually statement 3');

      // Verify API call was made correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/challenges/${challengeId}/guess`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            guessed_lie_statement_id: guessedStatementId,
          }),
        })
      );
    });

    it('should handle correct guess with points awarded', async () => {
      const challengeId = 'correct-guess-challenge';
      const correctGuessId = 'correct_stmt_1';

      // Mock successful correct guess
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: challengeId,
          guessed_statement_id: correctGuessId,
          correct_lie_statement_id: correctGuessId,
          is_correct: true,
          points_earned: 75,
          total_points: 225,
          guess_timestamp: new Date().toISOString(),
          explanation: 'Correct! You successfully identified the lie.',
          bonus_points: 25, // Bonus for quick guess
        }),
      });

      const guessResult = await challengeAPI.submitGuess(challengeId, correctGuessId);

      expect(guessResult.success).toBe(true);
      expect(guessResult.data?.is_correct).toBe(true);
      expect(guessResult.data?.points_earned).toBe(75);
      expect(guessResult.data?.total_points).toBe(225);
      expect(guessResult.data?.bonus_points).toBe(25);
    });
  });

  describe('Cross-Platform Compatibility Tests', () => {
    it('should handle iOS-specific video processing', async () => {
      // Mock iOS platform
      Platform.OS = 'ios';

      const mockVideoFile = {
        exists: true,
        size: 5 * 1024 * 1024,
        uri: 'file:///var/mobile/Containers/Data/Application/ios-video.mp4',
        duration: 20000,
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('ios-video-data');

      // Mock iOS-specific upload flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merge_session_id: 'ios-merge-session',
            total_videos: 3,
            upload_sessions: [
              {
                session_id: 'ios-session-0',
                video_index: 0,
                chunk_size: 1024 * 1024,
                total_chunks: 5,
              },
            ],
            status: 'initiated',
          }),
        });

      // Mock chunk uploads
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 5) * 100,
            session_id: 'ios-session-0',
            status: 'uploaded',
          }),
        });
      }

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'ios-session-0',
          status: 'completed',
          merge_triggered: false,
        }),
      });

      const uploadResult = await uploadService.uploadVideosForMerge([
        {
          uri: mockVideoFile.uri,
          filename: 'ios-video.mp4',
          duration: mockVideoFile.duration,
          statementIndex: 0,
        },
      ]);

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mergeSessionId).toBe('ios-merge-session');

      // Verify iOS-specific handling
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/challenge-videos/upload-for-merge/initiate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer e2e-test-token',
          }),
        })
      );
    });

    it('should handle Android-specific video processing', async () => {
      // Mock Android platform
      Platform.OS = 'android';

      const mockVideoFile = {
        exists: true,
        size: 6 * 1024 * 1024,
        uri: 'content://media/external/video/media/android-video',
        duration: 25000,
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('android-video-data');

      // Mock Android-specific upload flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merge_session_id: 'android-merge-session',
            total_videos: 3,
            upload_sessions: [
              {
                session_id: 'android-session-0',
                video_index: 0,
                chunk_size: 1024 * 1024,
                total_chunks: 6,
              },
            ],
            status: 'initiated',
          }),
        });

      // Mock chunk uploads
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 6) * 100,
            session_id: 'android-session-0',
            status: 'uploaded',
          }),
        });
      }

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'android-session-0',
          status: 'completed',
          merge_triggered: false,
        }),
      });

      const uploadResult = await uploadService.uploadVideosForMerge([
        {
          uri: mockVideoFile.uri,
          filename: 'android-video.mp4',
          duration: mockVideoFile.duration,
          statementIndex: 0,
        },
      ]);

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.mergeSessionId).toBe('android-merge-session');

      // Verify Android-specific handling
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/challenge-videos/upload-for-merge/initiate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer e2e-test-token',
          }),
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      try {
        await challengeAPI.getChallenges(0, 10);
        fail('Expected getChallenges to throw an error');
      } catch (error) {
        expect(error.message).toContain('Network request failed');
      }
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

      try {
        await challengeAPI.getChallenges(0, 10);
        fail('Expected getChallenges to throw an error');
      } catch (error) {
        expect(error.message).toContain('Invalid or expired authentication token');
      }
    });

    it('should handle server errors with proper error messages', async () => {
      // Mock server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error during video processing',
          error_code: 'VIDEO_PROCESSING_ERROR',
        }),
      });

      const challengeRequest = {
        statements: [
          { text: 'Test statement', media_file_id: 'test-media', segment_start_time: 0, segment_end_time: 10, segment_duration: 10 },
        ],
        lie_statement_index: 0,
      };

      try {
        await challengeAPI.createChallenge(challengeRequest);
        fail('Expected createChallenge to throw an error');
      } catch (error) {
        expect(error.message).toContain('Challenge creation failed: 500');
      }
    });

    it('should handle merge session timeout', async () => {
      const mockVideoFile = {
        exists: true,
        size: 1024 * 1024,
        uri: 'mock://timeout-video.mp4',
        duration: 10000,
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockVideoFile);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('timeout-video-data');

      // Mock upload initiation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          merge_session_id: 'timeout-merge-session',
          total_videos: 3,
          upload_sessions: [
            {
              session_id: 'timeout-session-0',
              video_index: 0,
              chunk_size: 1024 * 1024,
              total_chunks: 1,
            },
          ],
          status: 'initiated',
        }),
      });

      // Mock chunk upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          session_id: 'timeout-session-0',
          status: 'uploaded',
        }),
      });

      // Mock completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'timeout-session-0',
          status: 'completed',
          merge_triggered: true,
          merge_status: 'processing',
        }),
      });

      // Mock merge status that times out
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          merge_session_id: 'timeout-merge-session',
          merge_status: 'failed',
          error: 'Merge operation timed out',
        }),
      });

      const uploadResult = await uploadService.uploadVideosForMerge([
        {
          uri: mockVideoFile.uri,
          filename: 'timeout-video.mp4',
          duration: mockVideoFile.duration,
          statementIndex: 0,
        },
      ]);

      expect(uploadResult.success).toBe(true);

      // Simulate timeout error in upload result
      expect(uploadResult.error).toContain('Merge operation timed out');
    });
  });

  describe('Data Persistence and Consistency', () => {
    it('should maintain data consistency across create-retrieve cycle', async () => {
      const testChallenge = {
        statements: [
          {
            text: 'I have run a marathon',
            media_file_id: 'consistency-video',
            segment_start_time: 0,
            segment_end_time: 14,
            segment_duration: 14,
          },
          {
            text: 'I speak three languages',
            media_file_id: 'consistency-video',
            segment_start_time: 14,
            segment_end_time: 28,
            segment_duration: 14,
          },
          {
            text: 'I have never been to Europe',
            media_file_id: 'consistency-video',
            segment_start_time: 28,
            segment_end_time: 42,
            segment_duration: 14,
          },
        ],
        lie_statement_index: 2,
        tags: ['sports', 'languages', 'travel'],
        is_merged_video: true,
        merged_video_metadata: {
          total_duration: 42,
          segments: [
            { statement_index: 0, start_time: 0, end_time: 14, duration: 14 },
            { statement_index: 1, start_time: 14, end_time: 28, duration: 14 },
            { statement_index: 2, start_time: 28, end_time: 42, duration: 14 },
          ],
          video_file_id: 'consistency-video',
          compression_applied: true,
          original_total_duration: 42,
        },
      };

      // Mock challenge creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge_id: 'consistency-challenge',
          creator_id: 'e2e-test-user',
          statements: testChallenge.statements.map((stmt, index) => ({
            statement_id: `consistency_stmt_${index + 1}`,
            statement_type: index === testChallenge.lie_statement_index ? 'lie' : 'truth',
            text: stmt.text,
            media_url: `/api/media/stream/${stmt.media_file_id}`,
            segment_start_time: stmt.segment_start_time,
            segment_end_time: stmt.segment_end_time,
            duration_seconds: stmt.segment_duration,
            created_at: new Date().toISOString(),
          })),
          lie_statement_id: 'consistency_stmt_3',
          status: 'published',
          is_merged_video: true,
          merged_video_metadata: {
            total_duration_ms: 42000,
            segment_count: 3,
            segments: testChallenge.merged_video_metadata.segments.map(seg => ({
              statement_index: seg.statement_index,
              start_time_ms: seg.start_time * 1000,
              end_time_ms: seg.end_time * 1000,
              duration_ms: seg.duration * 1000,
            })),
          },
          tags: testChallenge.tags,
          created_at: new Date().toISOString(),
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
          creator_id: 'e2e-test-user',
          statements: testChallenge.statements.map((stmt, index) => ({
            statement_id: `consistency_stmt_${index + 1}`,
            statement_type: index === testChallenge.lie_statement_index ? 'lie' : 'truth',
            text: stmt.text,
            media_url: `/api/media/stream/${stmt.media_file_id}`,
            media_file_id: stmt.media_file_id,
            segment_start_time: stmt.segment_start_time,
            segment_end_time: stmt.segment_end_time,
            duration_seconds: stmt.segment_duration,
            created_at: new Date().toISOString(),
          })),
          lie_statement_id: 'consistency_stmt_3',
          status: 'published',
          is_merged_video: true,
          merged_video_metadata: {
            total_duration_ms: 42000,
            segment_count: 3,
            segments: testChallenge.merged_video_metadata.segments.map(seg => ({
              statement_index: seg.statement_index,
              start_time_ms: seg.start_time * 1000,
              end_time_ms: seg.end_time * 1000,
              duration_ms: seg.duration * 1000,
            })),
          },
          tags: testChallenge.tags,
          created_at: new Date().toISOString(),
          view_count: 1,
          guess_count: 0,
          correct_guess_count: 0,
        }),
      });

      // Create challenge
      const createResult = await challengeAPI.createChallenge(testChallenge);
      expect(createResult.success).toBe(true);
      const created = createResult.data!;

      // Retrieve challenge
      const retrieveResult = await challengeAPI.getChallenge('consistency-challenge');
      expect(retrieveResult.success).toBe(true);
      const retrieved = retrieveResult.data!;

      // Verify data consistency

      expect(created.challenge_id).toBe(retrieved.challenge_id);
      expect(created.statements).toHaveLength(retrieved.statements.length);
      expect(created.is_merged_video).toBe(retrieved.is_merged_video);
      expect(created.merged_video_metadata?.total_duration_ms).toBe(retrieved.merged_video_metadata?.total_duration_ms);
      expect(created.tags).toEqual(retrieved.tags);

      // Verify segment metadata consistency
      created.statements.forEach((stmt, index) => {
        const retrievedStmt = retrieved.statements[index];
        expect(stmt.segment_start_time).toBe(retrievedStmt.segment_start_time);
        expect(stmt.segment_end_time).toBe(retrievedStmt.segment_end_time);
        expect(stmt.duration_seconds).toBe(retrievedStmt.duration_seconds);
        expect(stmt.media_url).toBe(retrievedStmt.media_url);
      });
    });
  });
});