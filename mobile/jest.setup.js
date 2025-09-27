import '@testing-library/jest-native/extend-expect';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 667 }),
  },
  Alert: {
    alert: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
}));

// Mock React Native Purchases
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    setAttributes: jest.fn(),
  },
  PurchasesOffering: jest.fn(),
  PurchasesPackage: jest.fn(),
  LOG_LEVEL: {
    VERBOSE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock Expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      API_BASE_URL: 'http://localhost:8000'
    }
  },
  isDevice: false,
}));

// Mock React Native NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    })),
    addEventListener: jest.fn(() => jest.fn()),
  },
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
  },
  useNetInfo: jest.fn(() => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
  })),
}));

// Mock Expo File System (comprehensive)
const mockFileSystemMethods = {
  documentDirectory: 'file://test/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('{}'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024), // 1GB
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(8 * 1024 * 1024 * 1024), // 8GB
};

jest.mock('expo-file-system', () => mockFileSystemMethods);

// Mock Expo File System Legacy
jest.mock('expo-file-system/legacy', () => mockFileSystemMethods);

// Mock Expo Camera (from historical setup)
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef(({ children, onCameraReady, ...props }, ref) => {
      React.useImperativeHandle(ref, () => ({
        recordAsync: jest.fn().mockResolvedValue({ uri: 'mock://video.mp4' }),
        stopRecording: jest.fn(),
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'mock://photo.jpg' }),
      }));
      
      React.useEffect(() => {
        if (onCameraReady) {
          setTimeout(onCameraReady, 100);
        }
      }, [onCameraReady]);

      return React.createElement('View', {
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

// Mock Expo Haptics (from historical setup)
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock Expo AV (from historical setup)
jest.mock('expo-av', () => {
  const React = require('react');
  return {
    Audio: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
    Video: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        playAsync: jest.fn().mockResolvedValue(undefined),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
          isLoaded: true,
          durationMillis: 15000,
          positionMillis: 0,
        }),
      }));
      
      return React.createElement('View', {
        testID: 'video-player',
        ...props
      });
    }),
  };
});

// Mock Expo Media Library (from historical setup)
jest.mock('expo-media-library', () => ({
  usePermissions: jest.fn(() => [
    { status: 'granted', granted: true, canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true })
  ]),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  saveToLibraryAsync: jest.fn().mockResolvedValue({ id: 'mock-id' }),
}));

// Enhanced React Native module mocks (from historical setup)
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
  TextInput: 'TextInput',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  NativeModules: {},
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
}));

// Mock other React Native modules
jest.mock('react-native-get-random-values', () => ({}));

// Global test utilities (from historical setup)
global.fetch = jest.fn();
global.console.warn = jest.fn();

// Set up test environment
global.__DEV__ = true;
global.process = {
  ...global.process,
  env: {
    ...global.process?.env,
    EXPO_OS: 'ios',
  },
};