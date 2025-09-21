import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// Mock for react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: jest.fn().mockImplementation(({ children }) => children),
    SafeAreaConsumer: jest.fn().mockImplementation(({ children }) => children(inset)),
    useSafeAreaInsets: jest.fn().mockReturnValue(inset),
    useSafeAreaFrame: jest.fn().mockReturnValue({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// Mock for react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useSharedValue = jest.fn;
  Reanimated.useAnimatedStyle = jest.fn;
  Reanimated.withTiming = jest.fn;
  Reanimated.withSpring = jest.fn;
  Reanimated.withRepeat = jest.fn;
  Reanimated.withSequence = jest.fn;
  Reanimated.withDelay = jest.fn;
  return Reanimated;
});

// Mock for @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => <View ref={ref} {...props} />),
    BottomSheetModal: React.forwardRef((props, ref) => <View ref={ref} {...props} />),
    BottomSheetModalProvider: ({ children }) => <View>{children}</View>,
  };
});

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
jest.mock('react-native', () => {
  const React = require('react');
  
  return {
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
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    Pressable: 'Pressable',
    FlatList: 'FlatList',
    Image: 'Image',
    Button: 'Button',
    StyleSheet: {
      create: jest.fn((styles) => styles),
    },
    ActivityIndicator: 'ActivityIndicator',
    Modal: 'Modal',
    SafeAreaView: 'SafeAreaView',
  };
});

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

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {
        isConnectionExpensive: false,
        strength: 100,
      },
    }),
    addEventListener: jest.fn(() => jest.fn()),
    useNetInfo: jest.fn(() => ({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })),
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
    other: 'other',
  },
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {
      isConnectionExpensive: false,
      strength: 100,
    },
  }),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock react-native-purchases (RevenueCat)
jest.mock('react-native-purchases', () => ({
  configure: jest.fn().mockResolvedValue(undefined),
  getOfferings: jest.fn().mockResolvedValue({
    current: {
      monthly: {
        identifier: 'premium_monthly',
        priceString: '$4.99',
        product: {
          identifier: 'premium_monthly',
          priceString: '$4.99',
          title: 'Premium Monthly',
          description: 'Monthly premium subscription',
          currencyCode: 'USD',
        },
      },
    },
  }),
  getCustomerInfo: jest.fn().mockResolvedValue({
    originalAppUserId: 'test-user',
    entitlements: {
      active: {},
      all: {
        'premium': {
          identifier: 'premium',
          isActive: false,
          willRenew: false,
          latestPurchaseDate: null,
          originalPurchaseDate: null,
          expirationDate: null,
          store: 'app_store',
          productIdentifier: 'premium_monthly',
        },
      },
    },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    nonSubscriptionTransactions: [],
    firstSeen: '2024-01-01T00:00:00Z',
    originalApplicationVersion: '1.0.0',
    managementURL: null,
  }),
  purchasePackage: jest.fn().mockResolvedValue({
    customerInfo: {
      originalAppUserId: 'test-user',
      entitlements: {
        active: {
          'premium': {
            identifier: 'premium',
            isActive: true,
            willRenew: true,
            latestPurchaseDate: '2024-01-01T00:00:00Z',
            originalPurchaseDate: '2024-01-01T00:00:00Z',
            expirationDate: '2024-02-01T00:00:00Z',
            store: 'app_store',
            productIdentifier: 'premium_monthly',
          },
        },
        all: {
          'premium': {
            identifier: 'premium',
            isActive: true,
            willRenew: true,
            latestPurchaseDate: '2024-01-01T00:00:00Z',
            originalPurchaseDate: '2024-01-01T00:00:00Z',
            expirationDate: '2024-02-01T00:00:00Z',
            store: 'app_store',
            productIdentifier: 'premium_monthly',
          },
        },
      },
      activeSubscriptions: ['premium_monthly'],
      allPurchasedProductIdentifiers: ['premium_monthly'],
      nonSubscriptionTransactions: [],
      firstSeen: '2024-01-01T00:00:00Z',
      originalApplicationVersion: '1.0.0',
      managementURL: null,
    },
    transaction: null,
  }),
  addCustomerInfoUpdateListener: jest.fn((listener) => {
    // Return a function to remove the listener
    return () => {};
  }),
  removeCustomerInfoUpdateListener: jest.fn(),
  PURCHASE_TYPE: {
    SUBS: 'subs',
    INAPP: 'inapp',
  },
  PRODUCT_CATEGORY: {
    SUBSCRIPTION: 'subscription',
    NON_SUBSCRIPTION: 'non_subscription',
  },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
  },
  PACKAGE_TYPE: {
    UNKNOWN: 'UNKNOWN',
    CUSTOM: 'CUSTOM',
    LIFETIME: 'LIFETIME',
    ANNUAL: 'ANNUAL',
    SIX_MONTH: 'SIX_MONTH',
    THREE_MONTH: 'THREE_MONTH',
    TWO_MONTH: 'TWO_MONTH',
    MONTHLY: 'MONTHLY',
    WEEKLY: 'WEEKLY',
  },
}));

// Global test utilities
global.fetch = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();