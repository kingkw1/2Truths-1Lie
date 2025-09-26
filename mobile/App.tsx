// CRITICAL: Ensure FormData is available IMMEDIATELY
// This must run before any React Native code
if (typeof global !== 'undefined' && typeof global.FormData === 'undefined') {
  console.log('🔧 [APP] Installing FormData polyfill...');
  
  function FormData() {
    this._parts = [];
  }
  
  FormData.prototype.append = function(name, value, filename) {
    this._parts.push({ name: String(name), value: value, filename: filename || 'file' });
  };
  
  FormData.prototype.get = function(name) {
    const part = this._parts.find(p => p.name === name);
    return part ? part.value : null;
  };
  
  FormData.prototype.getAll = function(name) {
    return this._parts.filter(p => p.name === name).map(p => p.value);
  };
  
  FormData.prototype.has = function(name) {
    return this._parts.some(p => p.name === name);
  };
  
  FormData.prototype.delete = function(name) {
    this._parts = this._parts.filter(p => p.name !== name);
  };
  
  FormData.prototype.keys = function() {
    return this._parts.map(p => p.name);
  };
  
  FormData.prototype.values = function() {
    return this._parts.map(p => p.value);
  };
  
  FormData.prototype.entries = function() {
    return this._parts.map(p => [p.name, p.value]);
  };
  
  // Install globally
  global.FormData = FormData;
  if (typeof globalThis !== 'undefined') globalThis.FormData = FormData;
  if (typeof window !== 'undefined') window.FormData = FormData;
  
  console.log('✅ [APP] FormData polyfill installed');
} else {
  console.log('✅ [APP] FormData already available');
}

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { StoreProvider } from './src/store/StoreProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';

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
      if (iosApiKey && iosApiKey !== 'your_revenuecat_ios_api_key_here') {
        Purchases.configure({ apiKey: iosApiKey });
        console.log('✅ RevenueCat configured for iOS');
      } else {
        console.error('❌ RevenueCat iOS API key not found in environment variables');
      }
    } else if (Platform.OS === 'android') {
      const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
      if (androidApiKey && androidApiKey !== 'your_revenuecat_android_api_key_here') {
        Purchases.configure({ apiKey: androidApiKey });
        console.log('✅ RevenueCat configured for Android');
      } else {
        console.error('❌ RevenueCat Android API key not found in environment variables');
      }
    }
    
    // For Expo Go testing: RevenueCat will automatically handle browser mode
    // but token functionality will be limited to mock/placeholder values
    console.log('📱 RevenueCat initialization attempted for platform:', Platform.OS);
  }, []);

  console.log('=== APP LOADING ===');
  console.log('If you see this in Expo logs, logging is working!');

  return <RootNavigator />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StoreProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </StoreProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}


