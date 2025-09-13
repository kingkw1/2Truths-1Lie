import React, { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StoreProvider } from './src/store/StoreProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation';
import 'react-native-gesture-handler';

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


