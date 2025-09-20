import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { StoreProvider } from './src/store/StoreProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation';
import 'react-native-gesture-handler';

// Note: The Play Billing Library version issue was addressed by running `npx expo prebuild --clean`.
// This command forces a clean build of the native Android project, which resolves the issue by using the version of the Play Billing Library included with the `react-native-purchases` package.

const AppContent: React.FC = () => {
  // Lock screen orientation to portrait
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        console.log('📱 Screen orientation locked to portrait');
      } catch (error) {
        console.warn('Failed to lock screen orientation:', error);
      }
    };
    
    lockOrientation();
    
    // Cleanup function to unlock orientation when component unmounts
    return () => {
      ScreenOrientation.unlockAsync().catch(console.warn);
    };
  }, []);

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    if (Platform.OS === 'ios') {
      const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
      if (iosApiKey) {
        Purchases.configure({ apiKey: iosApiKey });
        console.log('✅ RevenueCat configured for iOS');
      } else {
        console.error('❌ RevenueCat iOS API key not found in environment variables');
      }
    } else if (Platform.OS === 'android') {
      const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
      if (androidApiKey) {
        Purchases.configure({ apiKey: androidApiKey });
        console.log('✅ RevenueCat configured for Android');
      } else {
        console.error('❌ RevenueCat Android API key not found in environment variables');
      }
    }
  }, []);

  console.log('=== APP LOADING ===');
  console.log('If you see this in Expo logs, logging is working!');

  return <RootNavigator />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}


