import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

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
  CameraView: ({ children }: any) => children,
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
    size: 1024 * 1024,
  }),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024), // 1GB
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024), // 10GB
}));

// Mock MobileCameraRecorder to simulate recording workflow
jest.mock('../components/MobileCameraRecorder', () => ({
  MobileCameraRecorder: ({ statementIndex, onRecordingComplete, onError, onCancel }: any) => {
    const mockMedia: MediaCapture = {
      type: 'video',
      url: `file://statement-${statementIndex}-video.mp4`,
      duration: 5000 + (statementIndex * 1000), // Different durations
      fileSize: (1 + statementIndex) * 1024 * 1024, // Different sizes
      mimeType: 'video/mp4',
    };

    return (
      <>
        <button
          testID={`record-statement-${statementIndex}`}
          onPress={() => {
            // Simulate recording delay
            setTimeout(() => onRecordingComplete(mockMedia), 100);
          }}
        >
          Record Statement {statementIndex + 1}
        </button>
        <button
          testID={`error-statement-${statementIndex}`}
          onPress={() => onError(`Recording error for statement ${statementIndex + 1}`)}
        >
          Trigger Error
        </button>
        <button
          testID={`cancel-statement-${statementIndex}`}
          onPress={onCancel}
        >
          Cancel Recording
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

describe('Mobile Camera Integration Workflow', () => {
  const mockProps = {
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes full challenge creation workflow with camera recording', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId, queryByText } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // 1. Start from instructions screen
    expect(getByText('Create Your Challenge')).toBeTruthy();
    expect(getByText('Start Recording')).toBeTruthy();

    // 2. Start recording process
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Should show camera modal for statement 1
    await waitFor(() => {
      expect(getByTestId('record-statement-0')).toBeTruthy();
    });

    // 3. Record first statement
    const recordButton1 = getByTestId('record-statement-0');
    await act(async () => {
      fireEvent.press(recordButton1);
    });

    // Should show success alert and move to statement 2
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '✅ Recording Complete',
        expect.stringContaining('Statement 1 recorded successfully'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    // Should automatically show camera for statement 2
    await waitFor(() => {
      expect(getByTestId('record-statement-1')).toBeTruthy();
    });

    // 4. Record second statement
    const recordButton2 = getByTestId('record-statement-1');
    await act(async () => {
      fireEvent.press(recordButton2);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '✅ Recording Complete',
        expect.stringContaining('Statement 2 recorded successfully'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    // Should automatically show camera for statement 3
    await waitFor(() => {
      expect(getByTestId('record-statement-2')).toBeTruthy();
    });

    // 5. Record third statement
    const recordButton3 = getByTestId('record-statement-2');
    await act(async () => {
      fireEvent.press(recordButton3);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '✅ Recording Complete',
        expect.stringContaining('Statement 3 recorded successfully'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    // 6. Should move to lie selection screen
    await waitFor(() => {
      expect(getByText('Select the Lie')).toBeTruthy();
      expect(getByText('Statement 1')).toBeTruthy();
      expect(getByText('Statement 2')).toBeTruthy();
      expect(getByText('Statement 3')).toBeTruthy();
    });

    // Verify all statements have recordings
    const state = store.getState();
    expect(state.challengeCreation.currentChallenge.mediaData).toHaveLength(3);
    expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toEqual(
      expect.objectContaining({
        type: 'video',
        url: 'file://statement-0-video.mp4',
        duration: 5000,
      })
    );
    expect(state.challengeCreation.currentChallenge.mediaData?.[1]).toEqual(
      expect.objectContaining({
        type: 'video',
        url: 'file://statement-1-video.mp4',
        duration: 6000,
      })
    );
    expect(state.challengeCreation.currentChallenge.mediaData?.[2]).toEqual(
      expect.objectContaining({
        type: 'video',
        url: 'file://statement-2-video.mp4',
        duration: 7000,
      })
    );
  });

  it('handles recording errors gracefully during workflow', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // Start recording process
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Trigger error on first statement
    await waitFor(() => {
      expect(getByTestId('error-statement-0')).toBeTruthy();
    });

    const errorButton = getByTestId('error-statement-0');
    await act(async () => {
      fireEvent.press(errorButton);
    });

    // Should show error alert
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Recording Error',
        expect.stringContaining('Recording error for statement 1'),
        expect.any(Array)
      );
    });

    // Should still be on the same statement (error recovery)
    expect(getByTestId('record-statement-0')).toBeTruthy();
  });

  it('allows retaking videos during workflow', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // Complete recording workflow to get to lie selection
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Record all three statements quickly
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(getByTestId(`record-statement-${i}`)).toBeTruthy();
      });
      
      const recordButton = getByTestId(`record-statement-${i}`);
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Complete',
          expect.stringContaining(`Statement ${i + 1} recorded successfully`),
          expect.any(Array),
          expect.any(Object)
        );
      });
    }

    // Should be on lie selection screen
    await waitFor(() => {
      expect(getByText('Select the Lie')).toBeTruthy();
    });

    // Find and press retake button for statement 1
    const retakeButtons = getByText('Retake');
    await act(async () => {
      fireEvent.press(retakeButtons);
    });

    // Should show camera modal for retaking
    await waitFor(() => {
      expect(getByTestId('record-statement-0')).toBeTruthy();
    });
  });

  it('validates challenge correctly after all recordings', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // Complete recording workflow
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Record all statements
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(getByTestId(`record-statement-${i}`)).toBeTruthy();
      });
      
      const recordButton = getByTestId(`record-statement-${i}`);
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Complete',
          expect.stringContaining(`Statement ${i + 1} recorded successfully`),
          expect.any(Array),
          expect.any(Object)
        );
      });
    }

    // Select lie (statement 2)
    await waitFor(() => {
      expect(getByText('Select the Lie')).toBeTruthy();
    });

    const statement2Card = getByText('Statement 2').closest('TouchableOpacity');
    await act(async () => {
      fireEvent.press(statement2Card);
    });

    // Should be able to preview
    const previewButton = getByText('Preview Challenge');
    expect(previewButton).toBeTruthy();

    await act(async () => {
      fireEvent.press(previewButton);
    });

    // Should show preview screen
    await waitFor(() => {
      expect(getByText('Preview Your Challenge')).toBeTruthy();
      expect(getByText('(The Lie)')).toBeTruthy(); // Should show lie indicator
    });

    // Verify Redux state has correct validation
    const state = store.getState();
    expect(state.challengeCreation.validationErrors).toHaveLength(0);
    expect(state.challengeCreation.currentChallenge.statements?.[1]?.isLie).toBe(true);
  });

  it('handles camera modal cancellation correctly', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // Start recording process
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Cancel recording
    await waitFor(() => {
      expect(getByTestId('cancel-statement-0')).toBeTruthy();
    });

    const cancelButton = getByTestId('cancel-statement-0');
    await act(async () => {
      fireEvent.press(cancelButton);
    });

    // Should return to instructions screen
    await waitFor(() => {
      expect(getByText('Create Your Challenge')).toBeTruthy();
      expect(getByText('Start Recording')).toBeTruthy();
    });
  });

  it('maintains proper Redux state synchronization throughout workflow', async () => {
    const store = createTestStore();
    
    const { getByText, getByTestId } = renderWithStore(
      <ChallengeCreationScreen {...mockProps} />,
      store
    );

    // Initial state check
    let state = store.getState();
    expect(state.challengeCreation.currentChallenge.mediaData).toEqual([]);
    expect(state.challengeCreation.currentStatementIndex).toBe(0);

    // Start recording
    const startRecordingButton = getByText('Start Recording');
    await act(async () => {
      fireEvent.press(startRecordingButton);
    });

    // Record first statement
    await waitFor(() => {
      expect(getByTestId('record-statement-0')).toBeTruthy();
    });

    const recordButton1 = getByTestId('record-statement-0');
    await act(async () => {
      fireEvent.press(recordButton1);
    });

    // Check state after first recording
    await waitFor(() => {
      state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData).toHaveLength(1);
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.type).toBe('video');
    });

    // Record second statement
    await waitFor(() => {
      expect(getByTestId('record-statement-1')).toBeTruthy();
    });

    const recordButton2 = getByTestId('record-statement-1');
    await act(async () => {
      fireEvent.press(recordButton2);
    });

    // Check state after second recording
    await waitFor(() => {
      state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData).toHaveLength(2);
    });

    // Record third statement
    await waitFor(() => {
      expect(getByTestId('record-statement-2')).toBeTruthy();
    });

    const recordButton3 = getByTestId('record-statement-2');
    await act(async () => {
      fireEvent.press(recordButton3);
    });

    // Final state check
    await waitFor(() => {
      state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData).toHaveLength(3);
      expect(state.challengeCreation.currentChallenge.mediaData?.every(
        media => media.type === 'video' && media.url
      )).toBe(true);
    });
  });
});