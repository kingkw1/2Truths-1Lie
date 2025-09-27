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

// Mock Expo File System
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://test/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  copyAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

// Mock Expo File System Legacy
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://test/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  copyAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

// Mock other React Native modules
jest.mock('react-native-get-random-values', () => ({}));

// Set up test environment
global.__DEV__ = true;
global.process = {
  ...global.process,
  env: {
    ...global.process?.env,
    EXPO_OS: 'ios',
  },
};