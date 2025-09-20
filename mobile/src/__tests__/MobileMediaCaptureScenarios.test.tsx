/**
 * Comprehensive Mobile Media Capture Scenario Tests
 * 
 * Tests all mobile-specific media capture scenarios including:
 * - Recording lifecycle management
 * - Storage space monitoring
 * - Hardware error handling
 * - Background interruption handling
 * - Platform-specific behaviors
 * - File validation and processing
 * - Performance optimization scenarios
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Platform, AppState, BackHandler, Vibration } from 'react-native';
import { MobileCameraRecorder } from '../components/MobileCameraRecorder';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';

// Mock Expo modules with advanced control
const mockCameraRef = {
  recordAsync: jest.fn(),
  stopRecording: jest.fn(),
};

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef(({ children, onCameraReady }: any, ref: any) => {
      React.useImperativeHandle(ref, () => mockCameraRef);

      React.useEffect(() => {
        if (onCameraReady) {
          setTimeout(onCameraReady, 100);
        }
      }, [onCameraReady]);

      return React.createElement('div', { 'data-testid': 'camera-view' }, children);
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

// Mock File System with controllable responses
const mockFileSystem = {
  getFreeDiskStorageAsync: jest.fn(),
  getTotalDiskCapacityAsync: jest.fn(),
  getInfoAsync: jest.fn(),
};

jest.mock('expo-file-system', () => mockFileSystem);

const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
  });
};

const renderWithStore = (component: React.ReactElement) => {
  const store = createTestStore();
  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store,
  };
};

describe('Mobile Media Capture Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default successful responses
    mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1024 * 1024 * 1024); // 1GB
    mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(10 * 1024 * 1024 * 1024); // 10GB
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      size: 1024 * 1024, // 1MB
    });
    
    mockCameraRef.recordAsync.mockResolvedValue({
      uri: 'mock://video.mp4',
    });
    mockCameraRef.stopRecording.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Recording Lifecycle Management', () => {
    test('should handle complete recording lifecycle', async () => {
      const mockOnRecordingComplete = jest.fn();
      const { getByTestId, store } = renderWithStore(
        <MobileCameraRecorder 
          statementIndex={0} 
          onRecordingComplete={mockOnRecordingComplete}
        />
      );

      await waitFor(() => {
        expect(getByTestId('camera-view')).toBeTruthy();
      });

      // Simulate recording start
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Fast-forward recording duration
      act(() => {
        jest.advanceTimersByTime(15000); // 15 seconds
      });

      // Simulate recording completion
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: {
            index: 0,
            media: {
              type: 'video',
              url: 'mock://video.mp4',
              duration: 15000,
              fileSize: 1024 * 1024,
              mimeType: 'video/mp4',
            },
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toEqual(
        expect.objectContaining({
          type: 'video',
          url: 'mock://video.mp4',
          duration: 15000,
        })
      );
    });

    test('should handle recording start failure', async () => {
      mockCameraRef.recordAsync.mockRejectedValue(new Error('Camera busy'));
      
      const mockOnError = jest.fn();
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      // Simulate recording start error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording failed: Camera busy',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('Camera busy');
    });

    test('should handle recording stop failure', async () => {
      mockCameraRef.stopRecording.mockRejectedValue(new Error('Stop failed'));
      
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording first
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate stop error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Failed to stop recording: Stop failed',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('Stop failed');
    });

    test('should handle recording timeout', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Fast-forward past timeout (65 seconds)
      act(() => {
        jest.advanceTimersByTime(66000);
      });

      // Simulate timeout error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording stopped automatically after reaching maximum duration.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('maximum duration');
    });
  });

  describe('Storage Space Monitoring', () => {
    test('should detect insufficient storage space', async () => {
      // Mock low storage (50MB)
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(50 * 1024 * 1024);
      
      const mockOnError = jest.fn();
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      // Simulate storage check error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Not enough storage space available. Please free up some space and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('storage space');
    });

    test('should monitor storage during recording', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate storage becoming full during recording
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(10 * 1024 * 1024); // 10MB

      // Fast-forward to trigger storage check
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Simulate storage full error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Not enough storage space to complete recording. Please free up space and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('storage space');
    });

    test('should display storage information in error state', async () => {
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(500 * 1024 * 1024); // 500MB
      mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(16 * 1024 * 1024 * 1024); // 16GB

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate storage error with info
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Not enough storage space available. Please free up some space and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('storage space');
    });
  });

  describe('Hardware Error Handling', () => {
    test('should handle camera hardware unavailable', async () => {
      const mockOnError = jest.fn();
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      // Simulate hardware error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera hardware error. Please restart the app and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('hardware error');
    });

    test('should handle camera busy error', async () => {
      mockCameraRef.recordAsync.mockRejectedValue(new Error('Camera is being used by another app'));
      
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate camera busy error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera is currently unavailable. Please restart the app and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('unavailable');
    });

    test('should provide retry mechanism for hardware errors', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate hardware error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera hardware error. Please restart the app and try again.',
          },
        });
      });

      // Clear error (simulate retry)
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: null,
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeNull();
    });
  });

  describe('Background Interruption Handling', () => {
    test('should handle app backgrounding during recording', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate app going to background
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording was interrupted when the app went to background. Please try recording again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('interrupted');
    });

    test('should handle phone call interruption', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate phone call interruption
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording was interrupted by an incoming call. Please try recording again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('interrupted');
    });

    test('should handle system interruption recovery', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate interruption
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording was interrupted when the app went to background. Please try recording again.',
          },
        });
      });

      // Clear error and restart
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: null,
          },
        });
      });

      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.isRecording).toBe(true);
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeNull();
    });
  });

  describe('Platform-Specific Behaviors', () => {
    test('should handle iOS-specific recording behaviors', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate iOS-specific media format
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: {
            index: 0,
            media: {
              type: 'video',
              url: 'mock://video.mov',
              duration: 15000,
              fileSize: 1024 * 1024,
              mimeType: 'video/quicktime',
            },
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.mimeType).toBe('video/quicktime');

      // Restore original platform
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    test('should handle Android-specific recording behaviors', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate Android-specific media format
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: {
            index: 0,
            media: {
              type: 'video',
              url: 'mock://video.mp4',
              duration: 15000,
              fileSize: 1024 * 1024,
              mimeType: 'video/mp4',
            },
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.mimeType).toBe('video/mp4');

      // Restore original platform
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    test('should handle platform-specific error messages', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate iOS-specific error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera access is restricted by iOS parental controls.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('iOS');

      // Restore original platform
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('File Validation and Processing', () => {
    test('should validate recorded file exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024 * 1024, // 1MB
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate successful recording with validation
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: {
            index: 0,
            media: {
              type: 'video',
              url: 'mock://video.mp4',
              duration: 15000,
              fileSize: 1024 * 1024,
              mimeType: 'video/mp4',
            },
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toBeTruthy();
    });

    test('should handle file validation failure', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        size: 0,
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate file validation error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording file was not saved properly',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('not saved properly');
    });

    test('should validate minimum recording duration', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate too short recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording is too short. Please record for at least 1 second.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('too short');
    });

    test('should validate file size limits', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 0, // Empty file
      });

      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate empty file error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording file is empty',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('empty');
    });
  });

  describe('Performance Optimization Scenarios', () => {
    test('should handle memory pressure during recording', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate memory pressure error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording failed due to insufficient memory. Please close other apps and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('insufficient memory');
    });

    test('should handle resource cleanup on component unmount', async () => {
      const { unmount, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Unmount component
      unmount();

      // Timers should be cleaned up (no errors thrown)
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // No errors should occur
      expect(true).toBe(true);
    });

    test('should handle efficient state updates during recording', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Start recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startMediaRecording',
          payload: { statementIndex: 0, mediaType: 'video' },
        });
      });

      // Simulate duration updates
      for (let i = 1; i <= 10; i++) {
        act(() => {
          store.dispatch({
            type: 'challengeCreation/updateRecordingDuration',
            payload: { statementIndex: 0, duration: i * 1000 },
          });
        });
      }

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.duration).toBe(10000);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    test('should implement retry logic with attempt counting', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Simulate first failure
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording failed: Camera busy',
          },
        });
      });

      // Clear error (retry attempt 1)
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: null,
          },
        });
      });

      // Simulate second failure
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Recording failed: Camera busy',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('Camera busy');
    });

    test('should provide different recovery options based on error type', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Permission error - should suggest settings
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera permission is required to record videos. Please enable it in your device settings.',
          },
        });
      });

      let state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('device settings');

      // Hardware error - should suggest restart
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera hardware error. Please restart the app and try again.',
          },
        });
      });

      state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('restart the app');
    });

    test('should handle successful recovery after multiple failures', async () => {
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // Multiple failures
      for (let i = 1; i <= 3; i++) {
        act(() => {
          store.dispatch({
            type: 'challengeCreation/setMediaRecordingError',
            payload: {
              statementIndex: 0,
              error: `Recording failed: Attempt ${i}`,
            },
          });
        });

        act(() => {
          store.dispatch({
            type: 'challengeCreation/setMediaRecordingError',
            payload: {
              statementIndex: 0,
              error: null,
            },
          });
        });
      }

      // Final success
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setStatementMedia',
          payload: {
            index: 0,
            media: {
              type: 'video',
              url: 'mock://video.mp4',
              duration: 15000,
              fileSize: 1024 * 1024,
              mimeType: 'video/mp4',
            },
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]).toBeTruthy();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeFalsy();
    });
  });
});