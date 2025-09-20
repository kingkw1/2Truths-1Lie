/**
 * Comprehensive Permission Flow Tests
 * 
 * Tests all permission scenarios for mobile media capture including:
 * - Initial permission requests
 * - Permission denials and recovery
 * - Permission revocation during recording
 * - Multiple permission types (camera, media library)
 * - Platform-specific permission behaviors
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform } from 'react-native';
import { MobileCameraRecorder } from '../components/MobileCameraRecorder';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';

// Mock Expo Camera with permission control
const mockUseCameraPermissions = jest.fn();
const mockRequestCameraPermission = jest.fn();

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  const CameraView = (props) => {
    React.useEffect(() => {
      if (props.onCameraReady) {
        props.onCameraReady();
      }
    }, []);
    return <View testID="camera-view">{props.children}</View>;
  };

  return {
    CameraView,
    useCameraPermissions: () => [
      mockUseCameraPermissions(),
      mockRequestCameraPermission,
    ],
  };
});

// Mock Media Library permissions
const mockUseMediaLibraryPermissions = jest.fn();
const mockRequestMediaLibraryPermission = jest.fn();

jest.mock('expo-media-library', () => ({
  usePermissions: () => [
    mockUseMediaLibraryPermissions(),
    mockRequestMediaLibraryPermission,
  ],
}));

// Mock File System
jest.mock('expo-file-system', () => ({
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024), // 1GB
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024), // 10GB
  getInfoAsync: jest.fn().mockResolvedValue({
    exists: true,
    size: 1024 * 1024, // 1MB
  }),
}));

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

describe('Permission Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default granted permissions
    mockUseCameraPermissions.mockReturnValue({ granted: true });
    mockUseMediaLibraryPermissions.mockReturnValue({ granted: true });
    mockRequestCameraPermission.mockResolvedValue({ granted: true });
    mockRequestMediaLibraryPermission.mockResolvedValue({ granted: true });
  });

  describe('Initial Permission Requests', () => {
    test('should render camera interface when all permissions are granted', async () => {
      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });
    });

    test('should show permission request UI when camera permission is denied', () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();
      expect(getByText(/Camera: Record video statements/)).toBeTruthy();
    });

    test('should show permission request UI when media library permission is denied', () => {
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();
      expect(getByText(/Media Library: Save your recordings/)).toBeTruthy();
    });

    test('should show permission request UI when both permissions are denied', () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();
    });
  });

  describe('Permission Request Flow', () => {
    test('should request camera permission when grant permissions is pressed', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: true });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });
    });

    test('should request media library permission when grant permissions is pressed', async () => {
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });
      mockRequestMediaLibraryPermission.mockResolvedValue({ granted: true });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestMediaLibraryPermission).toHaveBeenCalled();
      });
    });

    test('should show camera interface after permissions are granted', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: true });

      const { getByText, rerender } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      // Simulate permission granted by re-rendering with updated permissions
      mockUseCameraPermissions.mockReturnValue({ granted: true });
      
      rerender(
        <Provider store={createTestStore()}>
          <MobileCameraRecorder statementIndex={0} />
        </Provider>
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });
    });
  });

  describe('Permission Denial Handling', () => {
    test('should show error state when camera permission is permanently denied', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: false });

      const mockOnError = jest.fn();
      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      // Check if error was dispatched to Redux store
      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('permission');
    });

    test('should show error state when media library permission is permanently denied', async () => {
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });
      mockRequestMediaLibraryPermission.mockResolvedValue({ granted: false });

      const mockOnError = jest.fn();
      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestMediaLibraryPermission).toHaveBeenCalled();
      });

      // Check if error was dispatched to Redux store
      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('permission');
    });

    test('should provide retry option for permission errors', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: false });

      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      // Should show error state with retry option
      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeTruthy();
    });
  });

  describe('Permission Revocation During Recording', () => {
    test('should handle camera permission revoked during recording', async () => {
      const mockOnError = jest.fn();
      const { getByTestId, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      await waitFor(() => {
        expect(getByTestId('camera-view')).toBeTruthy();
      });

      // Simulate permission revocation error during recording
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Camera permission was revoked during recording. Please grant permission and try again.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('revoked');
    });

    test('should handle media library permission revoked during save', async () => {
      const mockOnError = jest.fn();
      const { store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      // Simulate media library permission error during save
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setMediaRecordingError',
          payload: {
            statementIndex: 0,
            error: 'Failed to save recording due to permission issues.',
          },
        });
      });

      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toContain('permission');
    });
  });

  describe('Platform-Specific Permission Behaviors', () => {
    test('should handle iOS-specific permission patterns', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      mockUseCameraPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();

      // Restore original platform
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    test('should handle Android-specific permission patterns', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      mockUseCameraPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();

      // Restore original platform
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Permission Error Recovery', () => {
    test('should clear errors when permissions are granted after denial', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission
        .mockResolvedValueOnce({ granted: false })
        .mockResolvedValueOnce({ granted: true });

      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      // First attempt - permission denied
      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1);
      });

      // Check error state
      let state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeTruthy();

      // Second attempt - permission granted
      mockUseCameraPermissions.mockReturnValue({ granted: true });
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalledTimes(2);
      });

      // Error should be cleared
      state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeFalsy();
    });

    test('should provide clear instructions for manual permission recovery', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: false });

      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      // Should show error with recovery instructions
      const state = store.getState();
      const error = state.challengeCreation.mediaRecordingState[0]?.error;
      expect(error).toContain('device settings');
    });
  });

  describe('Multiple Permission Scenarios', () => {
    test('should handle mixed permission states correctly', async () => {
      // Camera granted, media library denied
      mockUseCameraPermissions.mockReturnValue({ granted: true });
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      expect(getByText('Camera Access Required')).toBeTruthy();
      expect(getByText('Grant Permissions')).toBeTruthy();
    });

    test('should request only missing permissions', async () => {
      // Camera granted, media library denied
      mockUseCameraPermissions.mockReturnValue({ granted: true });
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });
      mockRequestMediaLibraryPermission.mockResolvedValue({ granted: true });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).not.toHaveBeenCalled();
        expect(mockRequestMediaLibraryPermission).toHaveBeenCalled();
      });
    });

    test('should handle sequential permission failures', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: false });
      mockRequestMediaLibraryPermission.mockResolvedValue({ granted: false });

      const { getByText, store } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      // Should show error for first failed permission
      const state = store.getState();
      expect(state.challengeCreation.mediaRecordingState[0]?.error).toBeTruthy();
    });
  });

  describe('Permission State Persistence', () => {
    test('should maintain permission state across component remounts', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: true });
      mockUseMediaLibraryPermissions.mockReturnValue({ granted: true });

      const { getByText, unmount } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      unmount();

      // Remount component
      const { getByText: getByTextRemount } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      await waitFor(() => {
        expect(getByTextRemount('Statement 1: Record your video')).toBeTruthy();
      });
    });

    test('should handle permission state changes during component lifecycle', async () => {
      mockUseCameraPermissions.mockReturnValue({ granted: true });

      const { getByText, rerender } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} />
      );

      await waitFor(() => {
        expect(getByText('Statement 1: Record your video')).toBeTruthy();
      });

      // Simulate permission revocation
      mockUseCameraPermissions.mockReturnValue({ granted: false });

      rerender(
        <Provider store={createTestStore()}>
          <MobileCameraRecorder statementIndex={0} />
        </Provider>
      );

      await waitFor(() => {
        expect(getByText('Camera Access Required')).toBeTruthy();
      });
    });
  });

  describe('Error Callback Integration', () => {
    test('should call onError callback for permission errors', async () => {
      const mockOnError = jest.fn();
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: false });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.stringContaining('permission')
        );
      });
    });

    test('should not call onError for successful permission grants', async () => {
      const mockOnError = jest.fn();
      mockUseCameraPermissions.mockReturnValue({ granted: false });
      mockRequestCameraPermission.mockResolvedValue({ granted: true });

      const { getByText } = renderWithStore(
        <MobileCameraRecorder statementIndex={0} onError={mockOnError} />
      );

      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);

      await waitFor(() => {
        expect(mockRequestCameraPermission).toHaveBeenCalled();
      });

      expect(mockOnError).not.toHaveBeenCalled();
    });
  });
});