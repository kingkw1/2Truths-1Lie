import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '../store';
import { GameScreen } from '../screens/GameScreen';
import {
  startMediaRecording,
  setStatementMedia,
  setLieStatement,
  validateChallenge,
} from '../store/slices/challengeCreationSlice';

// Mock Expo Camera and permissions
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  return {
    CameraView: mockReact.forwardRef(({ children, ...props }: any, ref: any) => {
      mockReact.useImperativeHandle(ref, () => ({
        recordAsync: jest.fn().mockResolvedValue({
          uri: 'mock://recorded-video.mp4',
        }),
        stopRecording: jest.fn().mockResolvedValue(undefined),
      }));
      return mockReact.createElement('div', { testID: 'mock-camera-view', ...props }, children);
    }),
    useCameraPermissions: () => [
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ],
  };
});

jest.mock('expo-media-library', () => ({
  usePermissions: () => [
    { granted: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}));

// Mock fetch for file operations
global.fetch = jest.fn().mockResolvedValue({
  blob: () => Promise.resolve({ size: 2048 }),
});

describe('Mobile Camera Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('integrates camera recording with Redux state management', async () => {
    // Test that camera recording updates Redux state correctly
    const mockMedia = {
      type: 'video' as const,
      url: 'mock://video.mp4',
      duration: 15000,
      fileSize: 2048,
      mimeType: 'video/mp4',
    };

    // Dispatch recording actions
    store.dispatch(startMediaRecording({ statementIndex: 0, mediaType: 'video' }));
    store.dispatch(setStatementMedia({ index: 0, media: mockMedia }));

    const state = store.getState();
    
    expect(state.challengeCreation.mediaRecordingState[0]).toEqual(
      expect.objectContaining({
        isRecording: true,
        mediaType: 'video',
      })
    );

    expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toEqual(mockMedia);
  });

  it('validates complete challenge with video recordings', () => {
    // Set up a complete challenge
    const mockMediaData = [
      { type: 'video' as const, url: 'mock://video1.mp4', duration: 15000 },
      { type: 'video' as const, url: 'mock://video2.mp4', duration: 12000 },
      { type: 'video' as const, url: 'mock://video3.mp4', duration: 18000 },
    ];

    // Add media data
    mockMediaData.forEach((media, index) => {
      store.dispatch(setStatementMedia({ index, media }));
    });

    // Set lie statement
    store.dispatch(setLieStatement(1));

    // Validate challenge
    store.dispatch(validateChallenge());

    const state = store.getState();
    
    // Should have no validation errors for complete challenge
    expect(state.challengeCreation.validationErrors).toHaveLength(0);
    expect(state.challengeCreation.currentChallenge.statements?.[1]?.isLie).toBe(true);
  });

  it('handles permission errors gracefully', async () => {
    // Mock permission denied
    jest.doMock('expo-camera', () => ({
      CameraView: React.forwardRef(({ children }: any, ref: any) => (
        <div testID="mock-camera-view">{children}</div>
      )),
      useCameraPermissions: () => [
        { granted: false },
        jest.fn().mockResolvedValue({ granted: false }),
      ],
    }));

    const { getByText } = render(
      <Provider store={store}>
        <GameScreen />
      </Provider>
    );

    // Should show the main game interface
    expect(getByText('Two Truths & a Lie')).toBeTruthy();
  });

  it('manages recording state transitions correctly', () => {
    const statementIndex = 0;

    // Start recording
    store.dispatch(startMediaRecording({ statementIndex, mediaType: 'video' }));
    
    let state = store.getState();
    expect(state.challengeCreation.mediaRecordingState[statementIndex]).toEqual(
      expect.objectContaining({
        isRecording: true,
        mediaType: 'video',
        hasPermission: true,
      })
    );

    // Complete recording with media
    const mockMedia = {
      type: 'video' as const,
      url: 'mock://completed-video.mp4',
      duration: 20000,
      fileSize: 3072,
      mimeType: 'video/mp4',
    };

    store.dispatch(setStatementMedia({ index: statementIndex, media: mockMedia }));

    state = store.getState();
    expect(state.challengeCreation.currentChallenge.mediaData?.[statementIndex]).toEqual(mockMedia);
  });

  it('validates video-only recording requirements', () => {
    // Test validation with missing videos
    store.dispatch(validateChallenge());
    
    let state = store.getState();
    expect(state.challengeCreation.validationErrors).toContain(
      'All statements must have video recordings'
    );

    // Add incomplete media (missing video URLs)
    const incompleteMedia = [
      { type: 'video' as const, duration: 0 }, // Missing URL
      { type: 'text' as const, duration: 0 }, // Wrong type
      { type: 'video' as const, url: 'mock://video.mp4', duration: 15000 }, // Complete
    ];

    incompleteMedia.forEach((media, index) => {
      store.dispatch(setStatementMedia({ index, media }));
    });

    store.dispatch(validateChallenge());
    
    state = store.getState();
    expect(state.challengeCreation.validationErrors).toContain(
      'Statements 1, 2 must have video recordings'
    );
  });

  it('handles recording errors and recovery', () => {
    const statementIndex = 0;
    const errorMessage = 'Camera access denied';

    // Simulate recording error
    store.dispatch({
      type: 'challengeCreation/setMediaRecordingError',
      payload: { statementIndex, error: errorMessage },
    });

    const state = store.getState();
    expect(state.challengeCreation.mediaRecordingState[statementIndex]?.error).toBe(errorMessage);

    // Clear error for recovery
    store.dispatch({
      type: 'challengeCreation/setMediaRecordingError',
      payload: { statementIndex, error: null },
    });

    const recoveredState = store.getState();
    expect(recoveredState.challengeCreation.mediaRecordingState[statementIndex]?.error).toBeNull();
  });

  it('supports recording duration tracking', () => {
    const statementIndex = 0;
    const duration = 12500; // 12.5 seconds

    store.dispatch({
      type: 'challengeCreation/updateRecordingDuration',
      payload: { statementIndex, duration },
    });

    const state = store.getState();
    expect(state.challengeCreation.mediaRecordingState[statementIndex]?.duration).toBe(duration);
  });
});