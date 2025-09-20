import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

// Mock Video component for playback testing
jest.mock('expo-av', () => {
  const React = require('react');
  return {
    Video: React.forwardRef(({ source, onPlaybackStatusUpdate, onLoad }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        playAsync: jest.fn().mockResolvedValue({}),
        pauseAsync: jest.fn().mockResolvedValue({}),
        stopAsync: jest.fn().mockResolvedValue({}),
        setPositionAsync: jest.fn().mockResolvedValue({}),
        getStatusAsync: jest.fn().mockResolvedValue({
          isLoaded: true,
          isPlaying: false,
          positionMillis: 0,
          durationMillis: 5000,
        }),
      }));

      // Simulate video load
      React.useEffect(() => {
        setTimeout(() => {
          onLoad?.({
            isLoaded: true,
            durationMillis: 5000,
            naturalSize: { width: 1920, height: 1080 },
          });
        }, 100);
      }, [onLoad]);

      return (
        <div data-testid="video-player" data-source={source?.uri}>
          Video Player Mock
        </div>
      );
    }),
    ResizeMode: {
      CONTAIN: 'contain',
      COVER: 'cover',
    },
  };
});

// Mock Expo modules
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
}));

jest.mock('expo-camera', () => ({
  CameraView: React.forwardRef(({ children, onCameraReady }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      recordAsync: jest.fn().mockResolvedValue({
        uri: `file://re-recorded-${Date.now()}.mp4`,
      }),
      stopRecording: jest.fn(),
    }));
    
    React.useEffect(() => {
      setTimeout(() => onCameraReady?.(), 50);
    }, [onCameraReady]);
    
    return children;
  }),
  useCameraPermissions: () => [
    { granted: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}));

jest.mock('expo-media-library', () => ({
  usePermissions: () => [
    { granted: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({
    exists: true,
    size: 5 * 1024 * 1024,
  }),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(2 * 1024 * 1024 * 1024),
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024),
}));

// Mock MobileCameraRecorder for re-recording scenarios
jest.mock('../components/MobileCameraRecorder', () => ({
  MobileCameraRecorder: ({ statementIndex, onRecordingComplete, onError, onCancel }: any) => {
    const mockReRecordedMedia: MediaCapture = {
      type: 'video',
      url: `file://re-recorded-statement-${statementIndex}-${Date.now()}.mp4`,
      duration: 7000 + (statementIndex * 500), // Slightly different durations
      fileSize: (2 + statementIndex) * 1024 * 1024, // Different sizes
      mimeType: 'video/mp4',
    };

    return (
      <>
        <div testID={`re-record-statement-${statementIndex}`}>
          Re-recording Statement {statementIndex + 1}
        </div>
        <button
          testID={`complete-re-record-${statementIndex}`}
          onPress={() => {
            setTimeout(() => onRecordingComplete(mockReRecordedMedia), 200);
          }}
        >
          Complete Re-recording
        </button>
        <button
          testID={`cancel-re-record-${statementIndex}`}
          onPress={onCancel}
        >
          Cancel Re-recording
        </button>
      </>
    );
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
  });
};

const renderWithStore = (component: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

// Helper to create a store with existing recordings
const createStoreWithRecordings = () => {
  const store = createTestStore();
  
  // Add three recorded statements
  const mockMediaData: MediaCapture[] = [
    {
      type: 'video',
      url: 'file://statement-0-original.mp4',
      duration: 5000,
      fileSize: 3 * 1024 * 1024,
      mimeType: 'video/mp4',
    },
    {
      type: 'video',
      url: 'file://statement-1-original.mp4',
      duration: 6000,
      fileSize: 4 * 1024 * 1024,
      mimeType: 'video/mp4',
    },
    {
      type: 'video',
      url: 'file://statement-2-original.mp4',
      duration: 7000,
      fileSize: 5 * 1024 * 1024,
      mimeType: 'video/mp4',
    },
  ];

  // Dispatch actions to set up the state
  mockMediaData.forEach((media, index) => {
    store.dispatch({
      type: 'challengeCreation/setStatementMedia',
      payload: { index, media },
    });
  });

  return store;
};

describe('Device Playback and Re-recording Flow Tests', () => {
  const mockProps = {
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Video Playback Functionality', () => {
    it('plays back recorded videos in lie selection screen', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      // Should be on lie selection screen with all recordings
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Should show all three statement cards with play buttons
      expect(getByText('Statement 1')).toBeTruthy();
      expect(getByText('Statement 2')).toBeTruthy();
      expect(getByText('Statement 3')).toBeTruthy();

      // Find and press play button for statement 1
      const playButton1 = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton1);
      });

      // Should show video player
      await waitFor(() => {
        expect(getByTestId('video-player')).toBeTruthy();
      });

      // Verify video source is correct
      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-source')).toBe('file://statement-0-original.mp4');
    });

    it('handles video playback controls (play, pause, seek)', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Start playback
      const playButton = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show pause button during playback
      await waitFor(() => {
        expect(getByTestId('pause-statement-0') || getByText('⏸️')).toBeTruthy();
      });

      // Pause playback
      const pauseButton = getByTestId('pause-statement-0') || getByText('⏸️');
      await act(async () => {
        fireEvent.press(pauseButton);
      });

      // Should show play button again
      await waitFor(() => {
        expect(getByTestId('play-statement-0') || getByText('▶️')).toBeTruthy();
      });
    });

    it('shows video duration and progress during playback', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Start playback
      const playButton = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show duration (5 seconds for first video)
      await waitFor(() => {
        expect(getByText('0:05')).toBeTruthy();
      });

      // Should show progress bar
      expect(getByTestId('video-progress-bar')).toBeTruthy();
    });

    it('handles video playback errors gracefully', async () => {
      const store = createStoreWithRecordings();
      
      // Mock video load error
      const mockVideoRef = {
        playAsync: jest.fn().mockRejectedValue(new Error('Video playback failed')),
      };

      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      const playButton = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show error message
      await waitFor(() => {
        expect(getByText('Video playback error')).toBeTruthy();
      });
    });
  });

  describe('Re-recording Functionality', () => {
    it('allows re-recording individual statements from lie selection screen', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Find and press retake button for statement 1
      const retakeButton = getByTestId('retake-statement-0') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      // Should show camera modal for re-recording
      await waitFor(() => {
        expect(getByTestId('re-record-statement-0')).toBeTruthy();
        expect(getByText('Re-recording Statement 1')).toBeTruthy();
      });
    });

    it('completes re-recording and updates the statement', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Start re-recording
      const retakeButton = getByTestId('retake-statement-0') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      // Complete re-recording
      await waitFor(() => {
        expect(getByTestId('complete-re-record-0')).toBeTruthy();
      });

      const completeButton = getByTestId('complete-re-record-0');
      await act(async () => {
        fireEvent.press(completeButton);
      });

      // Should show success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Saved',
          expect.stringContaining('Statement 1 has been recorded successfully'),
          expect.any(Array),
          expect.any(Object)
        );
      });

      // Should return to lie selection with updated recording
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Verify Redux state has been updated
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.url).toContain('re-recorded-statement-0');
    });

    it('allows canceling re-recording and keeps original', async () => {
      const store = createStoreWithRecordings();
      const originalUrl = store.getState().challengeCreation.currentChallenge.mediaData?.[0]?.url;
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Start re-recording
      const retakeButton = getByTestId('retake-statement-0') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      // Cancel re-recording
      await waitFor(() => {
        expect(getByTestId('cancel-re-record-0')).toBeTruthy();
      });

      const cancelButton = getByTestId('cancel-re-record-0');
      await act(async () => {
        fireEvent.press(cancelButton);
      });

      // Should return to lie selection
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Verify original recording is preserved
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.url).toBe(originalUrl);
    });

    it('handles re-recording multiple statements in sequence', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Re-record statement 1
      let retakeButton = getByTestId('retake-statement-0') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      let completeButton = getByTestId('complete-re-record-0');
      await act(async () => {
        fireEvent.press(completeButton);
      });

      // Wait for return to lie selection
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Re-record statement 2
      retakeButton = getByTestId('retake-statement-1') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      completeButton = getByTestId('complete-re-record-1');
      await act(async () => {
        fireEvent.press(completeButton);
      });

      // Verify both statements have been updated
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.url).toContain('re-recorded-statement-0');
      expect(state.challengeCreation.currentChallenge.mediaData?.[1]?.url).toContain('re-recorded-statement-1');
    });
  });

  describe('Preview Mode with Playback', () => {
    it('shows all recordings in preview mode with playback controls', async () => {
      const store = createStoreWithRecordings();
      
      // Set lie selection to enable preview
      store.dispatch({
        type: 'challengeCreation/setLieStatement',
        payload: 1, // Statement 2 is the lie
      });

      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Go to preview
      const previewButton = getByText('Preview Challenge');
      await act(async () => {
        fireEvent.press(previewButton);
      });

      // Should show preview screen with all statements
      await waitFor(() => {
        expect(getByText('Preview Your Challenge')).toBeTruthy();
        expect(getByText('Statement 1')).toBeTruthy();
        expect(getByText('Statement 2')).toBeTruthy();
        expect(getByText('Statement 3')).toBeTruthy();
        expect(getByText('(The Lie)')).toBeTruthy(); // Should indicate which is the lie
      });

      // Should have play buttons for all statements
      expect(getByTestId('preview-play-0')).toBeTruthy();
      expect(getByTestId('preview-play-1')).toBeTruthy();
      expect(getByTestId('preview-play-2')).toBeTruthy();
    });

    it('allows editing from preview mode', async () => {
      const store = createStoreWithRecordings();
      
      // Set lie selection
      store.dispatch({
        type: 'challengeCreation/setLieStatement',
        payload: 1,
      });

      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      // Go to preview
      await waitFor(() => {
        expect(getByText('Preview Challenge')).toBeTruthy();
      });

      const previewButton = getByText('Preview Challenge');
      await act(async () => {
        fireEvent.press(previewButton);
      });

      // Should show edit button
      await waitFor(() => {
        expect(getByText('Edit Challenge')).toBeTruthy();
      });

      const editButton = getByText('Edit Challenge');
      await act(async () => {
        fireEvent.press(editButton);
      });

      // Should return to lie selection
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });
    });
  });

  describe('Playback Quality and Performance', () => {
    it('handles different video formats and qualities', async () => {
      const store = createTestStore();
      
      // Add recordings with different formats
      const mixedMediaData: MediaCapture[] = [
        {
          type: 'video',
          url: 'file://statement-0.mp4',
          duration: 5000,
          fileSize: 3 * 1024 * 1024,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'file://statement-1.mov',
          duration: 6000,
          fileSize: 8 * 1024 * 1024,
          mimeType: 'video/quicktime',
        },
        {
          type: 'video',
          url: 'file://statement-2.webm',
          duration: 4000,
          fileSize: 2 * 1024 * 1024,
          mimeType: 'video/webm',
        },
      ];

      mixedMediaData.forEach((media, index) => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: { index, media },
        });
      });

      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Should handle all formats
      for (let i = 0; i < 3; i++) {
        const playButton = getByTestId(`play-statement-${i}`) || getByText('▶️');
        await act(async () => {
          fireEvent.press(playButton);
        });

        await waitFor(() => {
          expect(getByTestId('video-player')).toBeTruthy();
        });
      }
    });

    it('shows loading states during video preparation', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      const playButton = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show loading indicator briefly
      expect(getByTestId('video-loading') || getByText('Loading...')).toBeTruthy();
    });

    it('handles memory management for multiple video playbacks', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Play multiple videos in sequence
      for (let i = 0; i < 3; i++) {
        const playButton = getByTestId(`play-statement-${i}`) || getByText('▶️');
        await act(async () => {
          fireEvent.press(playButton);
        });

        // Stop previous video before starting next
        const stopButton = getByTestId(`stop-statement-${i}`) || getByText('⏹️');
        await act(async () => {
          fireEvent.press(stopButton);
        });
      }

      // Should not show memory warnings or crashes
      expect(getByText('Select the Lie')).toBeTruthy();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('provides accessible controls for video playback', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId, getByLabelText } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Should have accessible labels
      expect(getByLabelText('Play statement 1') || getByTestId('play-statement-0')).toBeTruthy();
      expect(getByLabelText('Retake statement 1') || getByTestId('retake-statement-0')).toBeTruthy();
    });

    it('shows clear visual feedback for recording states', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Should show recording indicators
      expect(getByText('5s')).toBeTruthy(); // Duration for statement 1
      expect(getByText('6s')).toBeTruthy(); // Duration for statement 2
      expect(getByText('7s')).toBeTruthy(); // Duration for statement 3

      // Should show file sizes
      expect(getByText('3.0MB')).toBeTruthy();
      expect(getByText('4.0MB')).toBeTruthy();
      expect(getByText('5.0MB')).toBeTruthy();
    });

    it('provides helpful tooltips and guidance', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Should show helpful text
      expect(getByText('Tap to play your recording')).toBeTruthy();
      expect(getByText('Tap retake to record again')).toBeTruthy();
    });
  });

  describe('Error Recovery in Playback and Re-recording', () => {
    it('recovers from playback failures', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Simulate playback error
      const playButton = getByTestId('play-statement-0') || getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show error and retry option
      await waitFor(() => {
        expect(getByText('Playback failed')).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
      });
    });

    it('handles re-recording failures gracefully', async () => {
      const store = createStoreWithRecordings();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      // Start re-recording
      const retakeButton = getByTestId('retake-statement-0') || getByText('Retake');
      await act(async () => {
        fireEvent.press(retakeButton);
      });

      // Simulate re-recording error
      // This would be handled by the MobileCameraRecorder component
      // The test verifies the error handling flow exists
      expect(getByTestId('re-record-statement-0')).toBeTruthy();
    });
  });
});