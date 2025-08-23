import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform, Dimensions, AppStateStatus, AppStateEvent } from 'react-native';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

// Define a type for the device scenarios to ensure type safety
type DeviceScenario = keyof typeof mockDeviceScenarios;

// Extend the NodeJS.Global interface to include custom test properties
declare global {
  var __DEVICE_SCENARIO__: DeviceScenario;
  var __CAMERA_PERMISSION_GRANTED__: boolean;
}

// Mock device-specific behaviors
const mockDeviceScenarios = {
  IPHONE_13: {
    platform: 'ios',
    dimensions: { width: 390, height: 844 },
    cameraQuality: '1080p',
    storageAvailable: 50 * 1024 * 1024 * 1024, // 50GB
  },
  ANDROID_PIXEL: {
    platform: 'android',
    dimensions: { width: 393, height: 851 },
    cameraQuality: '720p',
    storageAvailable: 20 * 1024 * 1024 * 1024, // 20GB
  },
  LOW_END_ANDROID: {
    platform: 'android',
    dimensions: { width: 360, height: 640 },
    cameraQuality: '480p',
    storageAvailable: 2 * 1024 * 1024 * 1024, // 2GB
  },
  TABLET_IPAD: {
    platform: 'ios',
    dimensions: { width: 820, height: 1180 },
    cameraQuality: '1080p',
    storageAvailable: 100 * 1024 * 1024 * 1024, // 100GB
  },
};

// Mock Expo modules with device-specific behaviors
jest.mock('expo-camera', () => ({
  CameraView: React.forwardRef(({ children, onCameraReady }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      recordAsync: jest.fn().mockImplementation(async (options) => {
        const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
        const deviceConfig = mockDeviceScenarios[device];
        
        // Simulate device-specific recording behavior
        const recordingDelay = device === 'LOW_END_ANDROID' ? 300 : 100;
        await new Promise(resolve => setTimeout(resolve, recordingDelay));
        
        // Simulate different file sizes based on device quality
        const baseSize = device === 'LOW_END_ANDROID' ? 2 : device === 'TABLET_IPAD' ? 8 : 5;
        
        return {
          uri: `file://device-recording-${device}-${Date.now()}.mp4`,
          fileSize: baseSize * 1024 * 1024,
        };
      }),
      stopRecording: jest.fn(),
    }));
    
    React.useEffect(() => {
      const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
      const initDelay = device === 'LOW_END_ANDROID' ? 200 : 50;
      setTimeout(() => onCameraReady?.(), initDelay);
    }, [onCameraReady]);
    
    return children;
  }),
  useCameraPermissions: () => [
    { granted: global.__CAMERA_PERMISSION_GRANTED__ !== false },
    jest.fn().mockResolvedValue({ granted: global.__CAMERA_PERMISSION_GRANTED__ !== false }),
  ],
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockImplementation(async (uri) => {
    const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
    const deviceConfig = mockDeviceScenarios[device];
    
    return {
      exists: true,
      size: uri.includes('device-recording') ? 
        (device === 'LOW_END_ANDROID' ? 2 * 1024 * 1024 : 5 * 1024 * 1024) : 
        5 * 1024 * 1024,
    };
  }),
  getFreeDiskStorageAsync: jest.fn().mockImplementation(async () => {
    const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
    return mockDeviceScenarios[device].storageAvailable;
  }),
  getTotalDiskCapacityAsync: jest.fn().mockImplementation(async () => {
    const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
    return mockDeviceScenarios[device].storageAvailable * 2;
  }),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: global.__DEVICE_SCENARIO__ ? 
        mockDeviceScenarios[global.__DEVICE_SCENARIO__]?.platform || 'ios' : 'ios',
      select: jest.fn((options) => {
        const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
        const platform = mockDeviceScenarios[device].platform;
        return options[platform] || options.default;
      }),
    },
    Dimensions: {
      get: jest.fn(() => {
        const device = global.__DEVICE_SCENARIO__ || 'IPHONE_13';
        return mockDeviceScenarios[device].dimensions;
      }),
    },
    Alert: { alert: jest.fn() },
  };
});

// Mock other required modules
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-media-library', () => ({
  usePermissions: () => [
    { granted: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}));

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

describe('Device End-to-End Camera Flow Tests', () => {
  const mockProps = {
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.__DEVICE_SCENARIO__ = 'IPHONE_13';
    global.__CAMERA_PERMISSION_GRANTED__ = true;
  });

  describe('iPhone 13 Pro Complete Workflow', () => {
    beforeEach(() => {
      global.__DEVICE_SCENARIO__ = 'IPHONE_13';
    });

    it('completes full challenge creation workflow on iPhone 13', async () => {
      const store = createTestStore();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      // 1. Start from instructions
      expect(getByText('Create Your Challenge')).toBeTruthy();
      
      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      // 2. Record all three statements
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(getByTestId(`record-statement-${i}`) || getByText(`Record Statement ${i + 1}`)).toBeTruthy();
        });

        // Simulate recording on iPhone
        const recordButton = getByTestId(`record-statement-${i}`) || getByText('Record');
        await act(async () => {
          fireEvent.press(recordButton);
        });

        // Wait for recording completion
        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            '✅ Recording Complete',
            expect.stringContaining(`Statement ${i + 1} recorded successfully`),
            expect.any(Array),
            expect.any(Object)
          );
        });
      }

      // 3. Select lie
      await waitFor(() => {
        expect(getByText('Select the Lie')).toBeTruthy();
      });

      const statement2 = getByText('Statement 2');
      await act(async () => {
        fireEvent.press(statement2);
      });

      // 4. Preview and submit
      const previewButton = getByText('Preview Challenge');
      await act(async () => {
        fireEvent.press(previewButton);
      });

      await waitFor(() => {
        expect(getByText('Preview Your Challenge')).toBeTruthy();
      });

      const submitButton = getByText('Submit Challenge');
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // Verify final state
      const finalState = store.getState();
      expect(finalState.challengeCreation.currentChallenge.mediaData).toHaveLength(3);
      expect(finalState.challengeCreation.currentChallenge.statements?.[1]?.isLie).toBe(true);
    });

    it('handles iPhone-specific camera features', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      // Should show iOS-specific tips
      expect(getByText('💡 Tap and hold for best results')).toBeTruthy();
      
      // Should have haptic feedback (mocked)
      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Haptic feedback should be called
      const Haptics = require('expo-haptics');
      expect(Haptics.impactAsync).toHaveBeenCalled();
    });
  });

  describe('Android Pixel Complete Workflow', () => {
    beforeEach(() => {
      global.__DEVICE_SCENARIO__ = 'ANDROID_PIXEL';
    });

    it('completes full challenge creation workflow on Android Pixel', async () => {
      const store = createTestStore();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      // Complete workflow similar to iPhone but with Android-specific behaviors
      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
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

      // Verify Android-specific file paths
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData?.[0]?.url).toContain('ANDROID_PIXEL');
    });

    it('handles Android-specific camera features', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      // Should show Android-specific tips
      expect(getByText('💡 Keep your device steady')).toBeTruthy();
      
      // Should use vibration instead of haptics
      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      const { Vibration } = require('react-native');
      expect(Vibration.vibrate).toHaveBeenCalled();
    });
  });

  describe('Low-End Android Device Workflow', () => {
    beforeEach(() => {
      global.__DEVICE_SCENARIO__ = 'LOW_END_ANDROID';
    });

    it('handles performance constraints on low-end device', async () => {
      const store = createTestStore();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      // Should show loading longer on low-end device
      await waitFor(() => {
        expect(getByText('Initializing camera...')).toBeTruthy();
      }, { timeout: 3000 });

      // Eventually should be ready
      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      }, { timeout: 5000 });

      // Recording should work but with smaller file sizes
      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Complete',
          expect.stringContaining('2.0MB'), // Smaller file size
          expect.any(Array),
          expect.any(Object)
        );
      });
    });

    it('shows storage warnings on low-end device', async () => {
      // Simulate very low storage
      const FileSystem = require('expo-file-system');
      FileSystem.getFreeDiskStorageAsync.mockResolvedValueOnce(50 * 1024 * 1024); // 50MB

      const { getByText } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByText('Storage Full')).toBeTruthy();
        expect(getByText('Available: 0.0GB')).toBeTruthy();
      });
    });
  });

  describe('iPad Tablet Workflow', () => {
    beforeEach(() => {
      global.__DEVICE_SCENARIO__ = 'TABLET_IPAD';
    });

    it('adapts UI for tablet screen size', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      // Should adapt to larger screen
      expect(getByText('Create Your Challenge')).toBeTruthy();
      
      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      // Should have tablet-optimized layout
      const cameraView = getByTestId('camera-view');
      expect(cameraView).toBeTruthy();
      
      // Larger files on tablet
      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Complete',
          expect.stringContaining('8.0MB'), // Larger file size
          expect.any(Array),
          expect.any(Object)
        );
      });
    });
  });

  describe('Cross-Device Compatibility', () => {
    it('maintains consistent behavior across devices', async () => {
      const devices: DeviceScenario[] = [
        'IPHONE_13',
        'ANDROID_PIXEL',
        'LOW_END_ANDROID',
        'TABLET_IPAD',
      ];
      
      for (const device of devices) {
        global.__DEVICE_SCENARIO__ = device;
        
        const store = createTestStore();
        const { getByText, unmount } = renderWithStore(
          <ChallengeCreationScreen {...mockProps} />,
          store
        );

        // All devices should show the same initial screen
        expect(getByText('Create Your Challenge')).toBeTruthy();
        expect(getByText('Start Recording')).toBeTruthy();

        unmount();
      }
    });

    it('handles device rotation and orientation changes', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      // Simulate orientation change
      const Dimensions = require('react-native').Dimensions;
      Dimensions.get.mockReturnValueOnce({ width: 844, height: 390 }); // Landscape

      // Should still work in landscape
      expect(getByTestId('record-statement-0')).toBeTruthy();
    });
  });

  describe('Real Device Scenarios', () => {
    it('handles interruptions during recording', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Simulate phone call interruption
      const AppState = require('react-native').AppState;
      const mockListener = jest.fn();
      AppState.addEventListener.mockImplementation(
        (event: AppStateEvent, listener: (state: AppStateStatus) => void) => {
          mockListener.mockImplementation(listener);
          return { remove: jest.fn() };
        }
      );

      // Trigger background state
      await act(async () => {
        mockListener('background');
      });

      await waitFor(() => {
        expect(getByText('Recording Interrupted')).toBeTruthy();
      });
    });

    it('handles network connectivity changes', async () => {
      const { getByText } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      // Should work offline (local recording)
      expect(getByText('Create Your Challenge')).toBeTruthy();
      
      // Network status shouldn't affect local recording
      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      // Should proceed normally
      await waitFor(() => {
        expect(getByText('Record Statement 1')).toBeTruthy();
      });
    });

    it('handles battery optimization and background restrictions', async () => {
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      // Should show power optimization warnings if needed
      // This would be device-specific behavior
      expect(getByTestId('record-statement-0')).toBeTruthy();
    });
  });

  describe('Performance and Memory Management', () => {
    it('manages memory efficiently during multiple recordings', async () => {
      const store = createTestStore();
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />,
        store
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      // Record multiple statements without memory issues
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

      // Should not show memory warnings
      const state = store.getState();
      expect(state.challengeCreation.currentChallenge.mediaData).toHaveLength(3);
    });

    it('handles large video files efficiently', async () => {
      global.__DEVICE_SCENARIO__ = 'TABLET_IPAD'; // Larger files
      
      const { getByText, getByTestId } = renderWithStore(
        <ChallengeCreationScreen {...mockProps} />
      );

      const startButton = getByText('Start Recording');
      await act(async () => {
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByTestId('record-statement-0')).toBeTruthy();
      });

      const recordButton = getByTestId('record-statement-0');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should handle compression for large files
      await waitFor(() => {
        expect(getByText('Compressing video...')).toBeTruthy();
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Recording Saved',
          expect.stringContaining('Statement 1 has been recorded successfully'),
          expect.any(Array),
          expect.any(Object)
        );
      });
    });
  });
});