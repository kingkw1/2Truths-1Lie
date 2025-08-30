import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform, AppState, BackHandler } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { MobileCameraRecorder } from '../components/MobileCameraRecorder';
import { EnhancedMobileCameraIntegration } from '../components/EnhancedMobileCameraIntegration';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

// Mock Expo modules with realistic device behaviors
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

jest.mock('expo-camera', () => {
  const mockReact = require('react');
  return {
    CameraView: mockReact.forwardRef(({ children, onCameraReady }: any, ref: any) => {
      mockReact.useImperativeHandle(ref, () => ({
        recordAsync: jest.fn().mockImplementation(async (options) => {
          // Simulate realistic recording behavior
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Simulate different recording outcomes based on test scenarios
          const testScenario = global.__TEST_SCENARIO__;
          
          if (testScenario === 'STORAGE_FULL') {
            throw new Error('Not enough storage space available');
          }
          
          if (testScenario === 'PERMISSION_DENIED') {
            throw new Error('Camera permission denied');
          }
          
          if (testScenario === 'HARDWARE_ERROR') {
            throw new Error('Camera hardware unavailable');
          }
          
          if (testScenario === 'RECORDING_TIMEOUT') {
            // Simulate long recording that should timeout
            await new Promise(resolve => setTimeout(resolve, 66000));
          }
          
          return {
            uri: `file://test-recording-${Date.now()}.mp4`,
          };
        }),
        stopRecording: jest.fn(),
      }));
      
      // Trigger onCameraReady after mount
      mockReact.useEffect(() => {
        setTimeout(() => onCameraReady?.(), 50);
      }, [onCameraReady]);
      
      return children;
    }),
    useCameraPermissions: jest.fn(() => [
      { granted: global.__CAMERA_PERMISSION_GRANTED__ !== false },
      jest.fn().mockResolvedValue({ granted: global.__CAMERA_PERMISSION_GRANTED__ !== false }),
    ]),
    CameraType: {
      front: 'front',
      back: 'back',
    },
  };
});

jest.mock('expo-media-library', () => ({
  usePermissions: () => [
    { granted: global.__MEDIA_LIBRARY_PERMISSION_GRANTED__ !== false },
    jest.fn().mockResolvedValue({ granted: global.__MEDIA_LIBRARY_PERMISSION_GRANTED__ !== false }),
  ],
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockImplementation(async (uri) => {
    const testScenario = global.__TEST_SCENARIO__;
    
    if (testScenario === 'FILE_NOT_FOUND') {
      return { exists: false };
    }
    
    if (testScenario === 'EMPTY_FILE') {
      return { exists: true, size: 0 };
    }
    
    return {
      exists: true,
      size: 5 * 1024 * 1024, // 5MB
    };
  }),
  getFreeDiskStorageAsync: jest.fn().mockImplementation(async () => {
    const testScenario = global.__TEST_SCENARIO__;
    
    if (testScenario === 'STORAGE_FULL') {
      return 50 * 1024 * 1024; // 50MB - below threshold
    }
    
    return 2 * 1024 * 1024 * 1024; // 2GB
  }),
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024), // 10GB
}));

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((options) => options.ios || options.default),
    },
    AppState: {
      addEventListener: jest.fn(),
      currentState: 'active',
    },
    BackHandler: {
      addEventListener: jest.fn(),
    },
    Vibration: {
      vibrate: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
  };
});

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

describe('Device Camera Recording Flow Tests', () => {
  const mockProps = {
    statementIndex: 0,
    onRecordingComplete: jest.fn(),
    onError: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.__TEST_SCENARIO__ = 'NORMAL';
    global.__CAMERA_PERMISSION_GRANTED__ = true;
    global.__MEDIA_LIBRARY_PERMISSION_GRANTED__ = true;
  });

  describe('Normal Recording Flow', () => {
    it('successfully records, processes, and completes video recording', async () => {
      const store = createTestStore();
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />,
        store
      );

      // Wait for camera to be ready
      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      // Start recording
      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should show recording indicator
      await waitFor(() => {
        expect(getByText('REC')).toBeTruthy();
      });

      // Stop recording after a short time
      await act(async () => {
        jest.advanceTimersByTime(3000); // 3 seconds
      });

      const stopButton = getByTestId('stop-button') || getByText('⏹️');
      await act(async () => {
        fireEvent.press(stopButton);
      });

      // Should show success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Complete',
          expect.stringContaining('Video recorded successfully'),
          expect.any(Array),
          expect.any(Object)
        );
      });

      // Should call completion callback
      expect(mockProps.onRecordingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video',
          url: expect.stringContaining('file://test-recording-'),
          duration: expect.any(Number),
          fileSize: expect.any(Number),
        })
      );
    });

    it('handles camera facing toggle during recording setup', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByTestId('flip-camera-button') || getByText('🤳')).toBeTruthy();
      });

      const flipButton = getByTestId('flip-camera-button') || getByText('🤳');
      await act(async () => {
        fireEvent.press(flipButton);
      });

      // Should toggle to back camera
      await waitFor(() => {
        expect(getByText('📷')).toBeTruthy();
      });
    });

    it('shows recording duration and progress correctly', async () => {
      jest.useFakeTimers();
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      // Start recording
      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Advance time and check duration updates
      await act(async () => {
        jest.advanceTimersByTime(5000); // 5 seconds
      });

      await waitFor(() => {
        expect(getByText('0:05')).toBeTruthy(); // Should show 5 seconds
      });

      // Check remaining time indicator
      await waitFor(() => {
        expect(getByText('55s remaining')).toBeTruthy();
      });

      jest.useRealTimers();
    });
  });

  describe('Permission Handling', () => {
    it('requests camera permission when not granted', async () => {
      global.__CAMERA_PERMISSION_GRANTED__ = false;
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Camera Access Required')).toBeTruthy();
        expect(getByText('Grant Permissions')).toBeTruthy();
      });

      const grantButton = getByText('Grant Permissions');
      await act(async () => {
        fireEvent.press(grantButton);
      });

      // Should attempt to request permissions
      expect(getByText('Grant Permissions')).toBeTruthy();
    });

    it('requests media library permission when not granted', async () => {
      global.__MEDIA_LIBRARY_PERMISSION_GRANTED__ = false;
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Camera Access Required')).toBeTruthy();
        expect(getByText('💾 Media Library: Save your recordings')).toBeTruthy();
      });
    });

    it('handles permission denial gracefully', async () => {
      global.__TEST_SCENARIO__ = 'PERMISSION_DENIED';
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(getByText('Permission Required')).toBeTruthy();
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('permission')
        );
      });
    });
  });

  describe('Storage and File Handling', () => {
    it('detects and handles insufficient storage space', async () => {
      global.__TEST_SCENARIO__ = 'STORAGE_FULL';
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Storage Full')).toBeTruthy();
        expect(getByText('Available: 0.0GB')).toBeTruthy();
      });
    });

    it('handles file system errors during recording', async () => {
      global.__TEST_SCENARIO__ = 'FILE_NOT_FOUND';
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Stop recording
      const stopButton = getByTestId('stop-button') || getByText('⏹️');
      await act(async () => {
        fireEvent.press(stopButton);
      });

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('Recording file was not saved properly')
        );
      });
    });

    it('validates file size and rejects empty recordings', async () => {
      global.__TEST_SCENARIO__ = 'EMPTY_FILE';
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      const stopButton = getByTestId('stop-button') || getByText('⏹️');
      await act(async () => {
        fireEvent.press(stopButton);
      });

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('Recording file is empty')
        );
      });
    });
  });

  describe('Hardware and System Error Handling', () => {
    it('handles camera hardware errors', async () => {
      global.__TEST_SCENARIO__ = 'HARDWARE_ERROR';
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(getByText('Hardware Error')).toBeTruthy();
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('Camera hardware error')
        );
      });
    });

    it('handles app backgrounding during recording', async () => {
      const mockAppStateListener = jest.fn();
      const mockAddEventListener = jest.spyOn(AppState, 'addEventListener')
        .mockImplementation((event, listener) => {
          mockAppStateListener.mockImplementation(listener);
          return { remove: jest.fn() };
        });

      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      // Start recording
      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Simulate app going to background
      await act(async () => {
        mockAppStateListener('background');
      });

      await waitFor(() => {
        expect(getByText('Recording Interrupted')).toBeTruthy();
      });

      mockAddEventListener.mockRestore();
    });

    it('handles hardware back button during recording', async () => {
      const mockBackHandler = jest.fn();
      const mockAddEventListener = jest.spyOn(BackHandler, 'addEventListener')
        .mockImplementation((event, listener) => {
          mockBackHandler.mockImplementation(listener);
          return { remove: jest.fn() };
        });

      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      // Start recording
      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Simulate back button press
      const shouldPreventDefault = mockBackHandler();
      expect(shouldPreventDefault).toBe(true);

      // Should show confirmation alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Stop Recording?',
        expect.stringContaining('currently recording'),
        expect.any(Array)
      );

      mockAddEventListener.mockRestore();
    });
  });

  describe('Recording Timeout and Limits', () => {
    it('automatically stops recording at maximum duration', async () => {
      jest.useFakeTimers();
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Advance time to trigger timeout
      await act(async () => {
        jest.advanceTimersByTime(65000); // 65 seconds
      });

      await waitFor(() => {
        expect(getByText('Recording stopped automatically')).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it('shows warning when approaching time limit', async () => {
      jest.useFakeTimers();
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Advance to 50+ seconds
      await act(async () => {
        jest.advanceTimersByTime(51000);
      });

      await waitFor(() => {
        expect(getByText('10s left')).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it('rejects recordings that are too short', async () => {
      jest.useFakeTimers();
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      const recordButton = getByTestId('record-button') || getByText('Record');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Stop recording immediately (less than 1 second)
      await act(async () => {
        jest.advanceTimersByTime(500); // 0.5 seconds
      });

      const stopButton = getByTestId('stop-button') || getByText('⏹️');
      await act(async () => {
        fireEvent.press(stopButton);
      });

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('Recording is too short')
        );
      });

      jest.useRealTimers();
    });
  });

  describe('Enhanced Mobile Camera Integration', () => {
    const enhancedProps = {
      statementIndex: 0,
      isVisible: true,
      onComplete: jest.fn(),
      onCancel: jest.fn(),
      onError: jest.fn(),
    };

    it('processes recording with compression for large files', async () => {
      // Mock large file size
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
        exists: true,
        size: 60 * 1024 * 1024, // 60MB - above compression threshold
      });

      const store = createTestStore();
      
      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...enhancedProps} />,
        store
      );

      await waitFor(() => {
        expect(getByText('Record Statement 1')).toBeTruthy();
      });

      // Simulate recording completion
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'file://test-large-video.mp4',
        duration: 10000,
        fileSize: 60 * 1024 * 1024,
        mimeType: 'video/mp4',
      };

      // Trigger recording completion
      await act(async () => {
        enhancedProps.onComplete(mockMedia);
      });

      // Should show compression progress
      await waitFor(() => {
        expect(getByText('Compressing video...')).toBeTruthy();
      });

      // Should complete with success
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Saved',
          expect.stringContaining('Statement 1 has been recorded successfully'),
          expect.any(Array),
          expect.any(Object)
        );
      });
    });

    it('handles cancellation during active recording', async () => {
      const store = createTestStore();
      
      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...enhancedProps} />,
        store
      );

      // Simulate recording in progress
      store.dispatch({
        type: 'challengeCreation/startMediaRecording',
        payload: { statementIndex: 0, mediaType: 'video' }
      });

      await waitFor(() => {
        expect(getByText('Cancel')).toBeTruthy();
      });

      const cancelButton = getByText('Cancel');
      await act(async () => {
        fireEvent.press(cancelButton);
      });

      // Should show confirmation dialog
      expect(Alert.alert).toHaveBeenCalledWith(
        'Stop Recording?',
        expect.stringContaining('currently recording'),
        expect.any(Array)
      );
    });

    it('validates recording meets all requirements', async () => {
      const store = createTestStore();
      
      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...enhancedProps} />,
        store
      );

      // Test with invalid recording (too short)
      const invalidMedia: MediaCapture = {
        type: 'video',
        url: 'file://test-short-video.mp4',
        duration: 500, // Too short
        fileSize: 1024,
        mimeType: 'video/mp4',
      };

      await act(async () => {
        enhancedProps.onComplete(invalidMedia);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Recording Error',
          expect.stringContaining('Recording too short'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Retry and Recovery Mechanisms', () => {
    it('provides retry options for recoverable errors', async () => {
      global.__TEST_SCENARIO__ = 'HARDWARE_ERROR';
      
      const { getByText, getByTestId } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('Hardware Error')).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
      });

      // Reset scenario for retry
      global.__TEST_SCENARIO__ = 'NORMAL';
      
      const retryButton = getByText('Try Again');
      await act(async () => {
        fireEvent.press(retryButton);
      });

      // Should return to normal recording state
      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });
    });

    it('limits retry attempts for persistent errors', async () => {
      global.__TEST_SCENARIO__ = 'HARDWARE_ERROR';
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      // First retry
      await waitFor(() => {
        expect(getByText('Try Again')).toBeTruthy();
      });

      let retryButton = getByText('Try Again');
      await act(async () => {
        fireEvent.press(retryButton);
      });

      // Second retry
      await waitFor(() => {
        expect(getByText('Retry (2 left)')).toBeTruthy();
      });

      retryButton = getByText('Retry (2 left)');
      await act(async () => {
        fireEvent.press(retryButton);
      });

      // Third retry
      await waitFor(() => {
        expect(getByText('Retry (1 left)')).toBeTruthy();
      });
    });
  });

  describe('Platform-Specific Behaviors', () => {
    it('handles iOS-specific camera behaviors', async () => {
      Platform.OS = 'ios';
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('💡 Tap and hold for best results')).toBeTruthy();
      });
    });

    it('handles Android-specific camera behaviors', async () => {
      Platform.OS = 'android';
      
      const { getByText } = renderWithStore(
        <MobileCameraRecorder {...mockProps} />
      );

      await waitFor(() => {
        expect(getByText('💡 Keep your device steady')).toBeTruthy();
      });
    });
  });
});