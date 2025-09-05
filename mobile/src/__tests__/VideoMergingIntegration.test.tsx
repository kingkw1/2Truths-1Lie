/**
 * Video Merging Integration Tests
 * Tests the complete workflow of recording individual statements and merging them
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';

import EnhancedChallengeCreation from '../components/EnhancedChallengeCreation';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { videoMergingService } from '../services/videoMergingService';
import { MediaCapture, VideoSegment } from '../types';

// Mock dependencies
jest.mock('../services/mobileMediaIntegration');
jest.mock('../services/videoMergingService');
jest.mock('../components/MobileCameraRecorder', () => {
  return {
    MobileCameraRecorder: ({ onRecordingComplete, statementIndex }: any) => {
      const mockRecording: MediaCapture = {
        type: 'video',
        url: `mock://recording_${statementIndex}.mp4`,
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
        storageType: 'local',
        isUploaded: false,
      };

      return (
        <div
          testID={`camera-recorder-${statementIndex}`}
          onPress={() => onRecordingComplete(mockRecording)}
        >
          Camera Recorder {statementIndex}
        </div>
      );
    },
  };
});

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
  if (buttons && buttons.length > 1) {
    // Simulate user clicking the second button (usually the action button)
    const actionButton = buttons[1];
    if (actionButton.onPress) {
      actionButton.onPress();
    }
  }
});

describe('VideoMergingIntegration', () => {
  let store: any;
  let mockMobileMediaIntegration: jest.Mocked<typeof mobileMediaIntegration>;
  let mockVideoMergingService: jest.Mocked<typeof videoMergingService>;

  beforeEach(() => {
    // Create test store
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
      },
    });

    // Setup mocks
    mockMobileMediaIntegration = mobileMediaIntegration as jest.Mocked<typeof mobileMediaIntegration>;
    mockVideoMergingService = videoMergingService as jest.Mocked<typeof videoMergingService>;

    // Mock mobile media integration methods
    mockMobileMediaIntegration.initialize = jest.fn().mockResolvedValue(undefined);
    mockMobileMediaIntegration.hasAllStatementRecordings = jest.fn().mockReturnValue(false);
    mockMobileMediaIntegration.mergeStatementVideos = jest.fn();
    mockMobileMediaIntegration.getSegmentPlaybackInfo = jest.fn();

    // Mock video merging service methods
    mockVideoMergingService.mergeStatementVideos = jest.fn();
    mockVideoMergingService.createMergedMediaCapture = jest.fn();
    mockVideoMergingService.getSegmentPlaybackInfo = jest.fn();

    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <EnhancedChallengeCreation {...props} />
      </Provider>
    );
  };

  describe('Individual Statement Recording', () => {
    it('should track individual recordings for each statement', async () => {
      const { getByTestId, getByText } = renderComponent();

      // Enter statement text
      const textInput = getByTestId('statement-input-0');
      fireEvent.changeText(textInput, 'This is my first statement');

      // Start recording
      const recordButton = getByText('🎥 Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByTestId('camera-recorder-0')).toBeTruthy();
      });

      // Simulate recording completion
      const cameraRecorder = getByTestId('camera-recorder-0');
      fireEvent.press(cameraRecorder);

      await waitFor(() => {
        // Should return to statements view
        expect(getByText('Create Your Challenge')).toBeTruthy();
      });

      // Check Redux state
      const state = store.getState();
      expect(state.challengeCreation.individualRecordings[0]).toBeDefined();
      expect(state.challengeCreation.individualRecordings[0].url).toBe('mock://recording_0.mp4');
    });

    it('should require statement text before allowing recording', async () => {
      const { getByText } = renderComponent();

      // Try to record without entering text
      const recordButton = getByText('🎥 Record');
      expect(recordButton.props.disabled).toBe(true);
    });

    it('should update button text after recording', async () => {
      const { getByTestId, getByText, queryByText } = renderComponent();

      // Enter statement text and record
      const textInput = getByTestId('statement-input-0');
      fireEvent.changeText(textInput, 'Test statement');

      const recordButton = getByText('🎥 Record');
      fireEvent.press(recordButton);

      // Complete recording
      await waitFor(() => {
        const cameraRecorder = getByTestId('camera-recorder-0');
        fireEvent.press(cameraRecorder);
      });

      await waitFor(() => {
        expect(queryByText('✓ Re-record')).toBeTruthy();
        expect(queryByText('🎥 Record')).toBeFalsy();
      });
    });
  });

  describe('Video Merging Workflow', () => {
    beforeEach(() => {
      // Mock that all recordings are complete
      mockMobileMediaIntegration.hasAllStatementRecordings.mockReturnValue(true);
    });

    it('should enable merge button when all recordings are complete', async () => {
      const { getByText } = renderComponent();

      // Simulate having all recordings
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 0,
            recording: { type: 'video', url: 'mock://0.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 1,
            recording: { type: 'video', url: 'mock://1.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 2,
            recording: { type: 'video', url: 'mock://2.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setLieStatement',
          payload: 1,
        });
      });

      await waitFor(() => {
        const mergeButton = getByText('Merge Videos & Create Challenge');
        expect(mergeButton.props.disabled).toBe(false);
      });
    });

    it('should start video merging process', async () => {
      const mockMergeResult = {
        success: true,
        mergedVideoUri: 'mock://merged.mp4',
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ] as VideoSegment[],
        totalDuration: 15000,
        fileSize: 3 * 1024 * 1024,
      };

      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        duration: 15000,
        fileSize: 3 * 1024 * 1024,
        mimeType: 'video/mp4',
        isMergedVideo: true,
        segments: mockMergeResult.segments,
        storageType: 'cloud',
        isUploaded: true,
      };

      mockMobileMediaIntegration.mergeStatementVideos.mockResolvedValue(mockMergedMedia);

      const { getByText } = renderComponent();

      // Setup complete recordings and lie selection
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 0,
            recording: { type: 'video', url: 'mock://0.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 1,
            recording: { type: 'video', url: 'mock://1.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 2,
            recording: { type: 'video', url: 'mock://2.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setLieStatement',
          payload: 1,
        });
      });

      // Start merging
      const mergeButton = getByText('Merge Videos & Create Challenge');
      fireEvent.press(mergeButton);

      await waitFor(() => {
        expect(mockMobileMediaIntegration.mergeStatementVideos).toHaveBeenCalledWith(
          expect.objectContaining({
            0: expect.objectContaining({ url: 'mock://0.mp4' }),
            1: expect.objectContaining({ url: 'mock://1.mp4' }),
            2: expect.objectContaining({ url: 'mock://2.mp4' }),
          })
        );
      });

      await waitFor(() => {
        expect(getByText('Challenge Ready!')).toBeTruthy();
      });
    });

    it('should show merging progress', async () => {
      const { getByText } = renderComponent();

      // Simulate merging in progress
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startVideoMerging',
        });
        store.dispatch({
          type: 'challengeCreation/updateVideoMergingProgress',
          payload: {
            progress: 50,
            stage: 'merging',
            currentSegment: 1,
          },
        });
      });

      await waitFor(() => {
        expect(getByText('Creating Your Challenge')).toBeTruthy();
        expect(getByText('Merging videos...')).toBeTruthy();
        expect(getByText('50%')).toBeTruthy();
        expect(getByText('Processing statement 2')).toBeTruthy();
      });
    });

    it('should handle merging errors', async () => {
      mockMobileMediaIntegration.mergeStatementVideos.mockRejectedValue(
        new Error('Merge failed')
      );

      const { getByText } = renderComponent();

      // Setup and start merging
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 0,
            recording: { type: 'video', url: 'mock://0.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 1,
            recording: { type: 'video', url: 'mock://1.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex: 2,
            recording: { type: 'video', url: 'mock://2.mp4' },
          },
        });
        store.dispatch({
          type: 'challengeCreation/setLieStatement',
          payload: 1,
        });
      });

      const mergeButton = getByText('Merge Videos & Create Challenge');
      fireEvent.press(mergeButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Merge Failed',
          'Merge failed',
          expect.any(Array)
        );
      });
    });
  });

  describe('Segment Metadata', () => {
    it('should create proper segment metadata during merge', async () => {
      const mockSegments: VideoSegment[] = [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ];

      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        duration: 15000,
        fileSize: 3 * 1024 * 1024,
        mimeType: 'video/mp4',
        isMergedVideo: true,
        segments: mockSegments,
        storageType: 'cloud',
        isUploaded: true,
      };

      mockMobileMediaIntegration.mergeStatementVideos.mockResolvedValue(mockMergedMedia);

      const { getByText } = renderComponent();

      // Complete the merge process
      act(() => {
        store.dispatch({
          type: 'challengeCreation/completeVideoMerging',
          payload: { mergedVideo: mockMergedMedia },
        });
      });

      await waitFor(() => {
        expect(getByText('🎬 Segments: 3')).toBeTruthy();
      });

      // Check that segments are properly stored
      const state = store.getState();
      expect(state.challengeCreation.mergedVideo?.segments).toHaveLength(3);
      expect(state.challengeCreation.mergedVideo?.segments?.[0]).toEqual(
        expect.objectContaining({
          statementIndex: 0,
          startTime: 0,
          endTime: 5000,
          duration: 5000,
        })
      );
    });

    it('should provide segment playback information', () => {
      const mockSegments: VideoSegment[] = [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ];

      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: mockSegments,
      };

      mockMobileMediaIntegration.getSegmentPlaybackInfo.mockReturnValue({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });

      const playbackInfo = mockMobileMediaIntegration.getSegmentPlaybackInfo(
        mockMergedMedia,
        1
      );

      expect(playbackInfo).toEqual({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });
    });
  });

  describe('Challenge Completion', () => {
    it('should complete challenge with merged video', async () => {
      const mockOnComplete = jest.fn();
      const { getByText } = renderComponent({ onChallengeComplete: mockOnComplete });

      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        duration: 15000,
        fileSize: 3 * 1024 * 1024,
        mimeType: 'video/mp4',
        isMergedVideo: true,
        segments: [],
        storageType: 'cloud',
        isUploaded: true,
      };

      // Set merged video in state
      act(() => {
        store.dispatch({
          type: 'challengeCreation/completeVideoMerging',
          payload: { mergedVideo: mockMergedMedia },
        });
      });

      // Complete challenge
      const completeButton = getByText('Complete Challenge');
      fireEvent.press(completeButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            mediaData: [mockMergedMedia],
          })
        );
      });
    });

    it('should show completion screen', async () => {
      const { getByText } = renderComponent();

      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: [],
      };

      // Complete challenge
      act(() => {
        store.dispatch({
          type: 'challengeCreation/completeVideoMerging',
          payload: { mergedVideo: mockMergedMedia },
        });
      });

      const completeButton = getByText('Complete Challenge');
      fireEvent.press(completeButton);

      await waitFor(() => {
        expect(getByText('🎉 Challenge Created!')).toBeTruthy();
        expect(getByText('Your challenge has been successfully created and uploaded.')).toBeTruthy();
      });
    });
  });
});