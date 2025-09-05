/**
 * Challenge Creation Screen Video Merging Tests
 * Tests the video merging functionality in the challenge creation flow
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChallengeCreationScreen } from '../ChallengeCreationScreen';
import challengeCreationReducer, { 
  setIndividualRecording,
  completeVideoMerging,
  setLieStatement 
} from '../../store/slices/challengeCreationSlice';

// Mock the mobile media integration service
jest.mock('../../services/mobileMediaIntegration', () => ({
  mobileMediaIntegration: {
    initialize: jest.fn().mockResolvedValue(undefined),
    mergeStatementVideos: jest.fn().mockResolvedValue({
      type: 'video',
      isMergedVideo: true,
      segments: [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ],
      duration: 15000,
      url: 'file:///merged-video.mp4',
      mediaId: 'merged-123',
      isUploaded: true,
    }),
  },
}));

// Mock other services
jest.mock('../../services/realChallengeAPI', () => ({
  realChallengeAPI: {
    createChallenge: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'challenge-123' },
    }),
  },
}));

// Mock React Native components
jest.mock('../../components/EnhancedMobileCameraIntegration', () => ({
  EnhancedMobileCameraIntegration: () => null,
}));

describe('ChallengeCreationScreen Video Merging', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
      },
    });
    
    jest.clearAllMocks();
  });

  const renderScreen = (props = {}) => {
    return render(
      <Provider store={store}>
        <ChallengeCreationScreen {...props} />
      </Provider>
    );
  };

  it('should handle video merging after all recordings are complete', async () => {
    const { getByText } = renderScreen();

    // Start recording process
    fireEvent.press(getByText('Start Recording'));

    // Wait for all recordings to complete (mocked)
    await waitFor(() => {
      expect(getByText('Select the Lie')).toBeTruthy();
    });

    // Check that the screen shows merged video status
    expect(getByText('📹 Video Merged')).toBeTruthy();
  });

  it('should show individual recordings when merging is not complete', () => {
    // Set up individual recordings in store
    store.dispatch(setIndividualRecording({
      statementIndex: 0,
      recording: {
        type: 'video',
        url: 'file:///video1.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 1,
      recording: {
        type: 'video',
        url: 'file:///video2.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 2,
      recording: {
        type: 'video',
        url: 'file:///video3.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    const { getByText } = renderScreen();

    // Navigate to lie selection
    fireEvent.press(getByText('Start Recording'));
    
    // Should show individual recordings
    expect(getByText('📹 Video Recorded')).toBeTruthy();
  });

  it('should show merged video information when merging is complete', () => {
    // Set up merged video in store
    store.dispatch(completeVideoMerging({
      mergedVideo: {
        type: 'video',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
        duration: 15000,
        url: 'file:///merged-video.mp4',
        mediaId: 'merged-123',
        isUploaded: true,
      },
    }));

    const { getByText } = renderScreen();

    // Navigate to lie selection
    fireEvent.press(getByText('Start Recording'));
    
    // Should show merged video status
    expect(getByText('📹 Video Merged')).toBeTruthy();
  });

  it('should allow lie selection with merged video', async () => {
    // Set up merged video in store
    store.dispatch(completeVideoMerging({
      mergedVideo: {
        type: 'video',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
        duration: 15000,
        url: 'file:///merged-video.mp4',
        mediaId: 'merged-123',
        isUploaded: true,
      },
    }));

    const { getByText } = renderScreen();

    // Navigate to lie selection
    fireEvent.press(getByText('Start Recording'));
    
    // Select a lie
    fireEvent.press(getByText('Statement 1'));
    
    // Should show preview button
    await waitFor(() => {
      expect(getByText('Preview Challenge')).toBeTruthy();
    });
  });

  it('should handle preview with merged video', async () => {
    // Set up complete state with merged video and lie selection
    store.dispatch(completeVideoMerging({
      mergedVideo: {
        type: 'video',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
        duration: 15000,
        url: 'file:///merged-video.mp4',
        mediaId: 'merged-123',
        isUploaded: true,
      },
    }));

    store.dispatch(setLieStatement(0));

    const { getByText } = renderScreen();

    // Navigate to lie selection
    fireEvent.press(getByText('Start Recording'));
    
    // Go to preview
    fireEvent.press(getByText('Preview Challenge'));
    
    // Should show merged video in preview
    expect(getByText('📹 Video Statement (Merged)')).toBeTruthy();
    expect(getByText('(The Lie)')).toBeTruthy();
  });
});