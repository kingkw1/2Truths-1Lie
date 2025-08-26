import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

jest.mock('expo-media-library', () => ({
  usePermissions: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  getFreeDiskStorageAsync: jest.fn(),
  getTotalDiskCapacityAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

// Mock expo-camera permissions (replaces deprecated expo-permissions)
jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: jest.fn(() => [
    { status: 'granted', granted: true, canAskAgain: true },
    jest.fn()
  ]),
  Camera: {
    Constants: {
      Type: {
        back: 'back',
        front: 'front',
      },
      FlashMode: {
        on: 'on',
        off: 'off',
        auto: 'auto',
      },
    },
  },
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

// Global test utilities
global.fetch = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();