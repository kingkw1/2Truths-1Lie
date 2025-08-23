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

jest.mock('expo-permissions', () => ({
  askAsync: jest.fn(),
  getAsync: jest.fn(),
}));

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
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
  };
});

// Global test utilities
global.fetch = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();