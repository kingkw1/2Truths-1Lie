import '@testing-library/jest-native/extend-expect';
import React from 'react';

// Mock Expo modules with proper React components
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  return {
    CameraView: mockReact.forwardRef(({ children, onCameraReady, ...props }: any, ref: any) => {
      mockReact.useImperativeHandle(ref, () => ({
        recordAsync: jest.fn().mockResolvedValue({ uri: 'mock://video.mp4' }),
        stopRecording: jest.fn(),
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'mock://photo.jpg' }),
      }));
      
      mockReact.useEffect(() => {
        if (onCameraReady) {
          setTimeout(onCameraReady, 100);
        }
      }, [onCameraReady]);

      return mockReact.createElement('View', {
        testID: 'camera-view',
        ...props
      }, children);
    }),
    CameraType: {
      back: 'back',
      front: 'front',
    },
    useCameraPermissions: jest.fn(() => [
      { status: 'granted', granted: true, canAskAgain: true },
      jest.fn().mockResolvedValue({ granted: true })
    ]),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('expo-av', () => {
  const mockReact = require('react');
  return {
    Audio: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
    Video: mockReact.forwardRef((props: any, ref: any) => {
      mockReact.useImperativeHandle(ref, () => ({
        playAsync: jest.fn().mockResolvedValue(undefined),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
          isLoaded: true,
          durationMillis: 15000,
          positionMillis: 0,
        }),
      }));
      
      return mockReact.createElement('View', {
        testID: 'video-player',
        ...props
      });
    }),
  };
});

jest.mock('expo-media-library', () => ({
  usePermissions: jest.fn(() => [
    { status: 'granted', granted: true, canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true })
  ]),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  saveToLibraryAsync: jest.fn().mockResolvedValue({ id: 'mock-id' }),
}));

jest.mock('expo-file-system', () => ({
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024), // 1GB
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(8 * 1024 * 1024 * 1024), // 8GB
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios || options.default),
  },
  Vibration: {
    vibrate: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  BackHandler: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  Alert: {
    alert: jest.fn(),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// Global test utilities
global.fetch = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();