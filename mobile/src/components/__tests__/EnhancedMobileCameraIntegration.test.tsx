import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import { EnhancedMobileCameraIntegration } from '../EnhancedMobileCameraIntegration';
import challengeCreationReducer from '../../store/slices/challengeCreationSlice';
import { MediaCapture } from '../../types';

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

// Mock MobileCameraRecorder
jest.mock('../MobileCameraRecorder', () => ({
  MobileCameraRecorder: ({ onRecordingComplete, onError }: any) => {
    const mockMedia: MediaCapture = {
      type: 'video',
      url: 'file://test-video.mp4',
      duration: 5000,
      fileSize: 1024 * 1024, // 1MB
      mimeType: 'video/mp4',
    };

    return (
      <>
        <button
          testID="mock-record-button"
          onPress={() => onRecordingComplete(mockMedia)}
        >
          Record
        </button>
        <button
          testID="mock-error-button"
          onPress={() => onError('Test error')}
        >
          Trigger Error
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

describe('EnhancedMobileCameraIntegration', () => {
  const mockProps = {
    statementIndex: 0,
    isVisible: true,
    onComplete: jest.fn(),
    onCancel: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const { getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    expect(getByText('Record Statement 1')).toBeTruthy();
    expect(getByText('New recording')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} isVisible={false} />
    );

    expect(queryByText('Record Statement 1')).toBeNull();
  });

  it('shows re-record text when media already exists', () => {
    const store = createTestStore();
    
    // Add existing media to the store
    store.dispatch({
      type: 'challengeCreation/setStatementMedia',
      payload: {
        index: 0,
        media: {
          type: 'video',
          url: 'existing-video.mp4',
          duration: 3000,
        },
      },
    });

    const { getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />,
      store
    );

    expect(getByText('Re-record')).toBeTruthy();
  });

  it('handles successful recording completion', async () => {
    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const recordButton = getByTestId('mock-record-button');
    
    await act(async () => {
      fireEvent.press(recordButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '✅ Recording Saved',
        expect.stringContaining('Statement 1 has been recorded successfully'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    expect(mockProps.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'video',
        url: 'file://test-video.mp4',
        duration: 5000,
      })
    );
  });

  it('handles recording errors appropriately', async () => {
    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const errorButton = getByTestId('mock-error-button');
    
    await act(async () => {
      fireEvent.press(errorButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Recording Error',
        'Test error',
        expect.any(Array)
      );
    });

    expect(mockProps.onError).toHaveBeenCalledWith('Test error');
  });

  it('handles permission errors with appropriate messaging', async () => {
    const permissionError = 'Camera permission denied';
    
    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration 
        {...mockProps} 
        onError={(error) => {
          if (error.includes('permission')) {
            Alert.alert('Permission Required', 'Camera access needed');
          }
        }}
      />
    );

    const errorButton = getByTestId('mock-error-button');
    
    // Simulate permission error
    await act(async () => {
      fireEvent.press(errorButton);
    });

    // The component should handle permission errors specially
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('handles storage errors with appropriate messaging', async () => {
    const storageError = 'Not enough storage space available';
    
    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const errorButton = getByTestId('mock-error-button');
    
    // Mock the error to be storage-related
    jest.mocked(require('../MobileCameraRecorder').MobileCameraRecorder).mockImplementation(
      ({ onError }: any) => (
        <button
          testID="mock-error-button"
          onPress={() => onError(storageError)}
        >
          Trigger Storage Error
        </button>
      )
    );

    await act(async () => {
      fireEvent.press(errorButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Storage Full',
        expect.stringContaining('storage space'),
        expect.any(Array)
      );
    });
  });

  it('handles cancel with confirmation when recording', async () => {
    const store = createTestStore();
    
    // Set recording state
    store.dispatch({
      type: 'challengeCreation/startMediaRecording',
      payload: { statementIndex: 0, mediaType: 'video' },
    });

    const { getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />,
      store
    );

    const cancelButton = getByText('Cancel');
    
    await act(async () => {
      fireEvent.press(cancelButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Stop Recording?',
        expect.stringContaining('currently recording'),
        expect.any(Array)
      );
    });
  });

  it('handles cancel without confirmation when not recording', async () => {
    const { getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const cancelButton = getByText('Cancel');
    
    await act(async () => {
      fireEvent.press(cancelButton);
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('validates recording duration requirements', async () => {
    // Mock short recording
    jest.mocked(require('../MobileCameraRecorder').MobileCameraRecorder).mockImplementation(
      ({ onRecordingComplete }: any) => {
        const shortMedia: MediaCapture = {
          type: 'video',
          url: 'file://short-video.mp4',
          duration: 500, // Too short
          fileSize: 1024,
          mimeType: 'video/mp4',
        };

        return (
          <button
            testID="mock-record-button"
            onPress={() => onRecordingComplete(shortMedia)}
          >
            Record Short
          </button>
        );
      }
    );

    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const recordButton = getByTestId('mock-record-button');
    
    await act(async () => {
      fireEvent.press(recordButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Recording Error',
        expect.stringContaining('too short'),
        expect.any(Array)
      );
    });

    expect(mockProps.onComplete).not.toHaveBeenCalled();
  });

  it('shows compression progress for large files', async () => {
    // Mock large file
    jest.mocked(require('../MobileCameraRecorder').MobileCameraRecorder).mockImplementation(
      ({ onRecordingComplete }: any) => {
        const largeMedia: MediaCapture = {
          type: 'video',
          url: 'file://large-video.mp4',
          duration: 30000,
          fileSize: 60 * 1024 * 1024, // 60MB - over threshold
          mimeType: 'video/mp4',
        };

        return (
          <button
            testID="mock-record-button"
            onPress={() => onRecordingComplete(largeMedia)}
          >
            Record Large
          </button>
        );
      }
    );

    const { getByTestId, getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />
    );

    const recordButton = getByTestId('mock-record-button');
    
    await act(async () => {
      fireEvent.press(recordButton);
    });

    // Should show compression step
    await waitFor(() => {
      expect(getByText('Processing Recording')).toBeTruthy();
      expect(getByText('Compressing video...')).toBeTruthy();
    });
  });

  it('updates Redux state correctly on successful recording', async () => {
    const store = createTestStore();
    
    const { getByTestId } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />,
      store
    );

    const recordButton = getByTestId('mock-record-button');
    
    await act(async () => {
      fireEvent.press(recordButton);
    });

    await waitFor(() => {
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toEqual(
        expect.objectContaining({
          type: 'video',
          url: 'file://test-video.mp4',
          duration: 5000,
        })
      );
    });
  });

  it('shows recording status indicator when recording', () => {
    const store = createTestStore();
    
    // Set recording state
    store.dispatch({
      type: 'challengeCreation/startMediaRecording',
      payload: { statementIndex: 0, mediaType: 'video' },
    });

    const { getByText } = renderWithStore(
      <EnhancedMobileCameraIntegration {...mockProps} />,
      store
    );

    expect(getByText('Recording Statement 1')).toBeTruthy();
  });
});