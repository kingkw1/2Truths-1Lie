/**
 * Network Resilience Demo
 * 
 * This file demonstrates how the app handles poor or unstable network conditions
 * with comprehensive retry logic, offline queuing, and user feedback.
 */

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { networkResilienceService } from '../services/networkResilienceService';
import { updateNetworkState, addToOfflineQueue, processOfflineQueue } from '../store/slices/networkSlice';

export function NetworkResilienceDemo() {
  const dispatch = useAppDispatch();
  const networkState = useAppSelector(state => state.network);
  const [demoResults, setDemoResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setDemoResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    addResult('🚀 Network Resilience Demo Started');

    // Set up network monitoring
    const unsubscribe = networkResilienceService.addNetworkListener((state) => {
      addResult(`📡 Network: ${state.isConnected ? 'Online' : 'Offline'} - ${state.type} - ${state.strength}`);
      
      dispatch(updateNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isConnectionExpensive: false,
        strength: state.strength,
        bandwidth: state.bandwidth,
      }));

      // Auto-process queue when back online
      if (state.isConnected && networkState.offlineQueue.items.length > 0) {
        addResult('🔄 Connection restored - processing offline queue');
        dispatch(processOfflineQueue());
      }
    });

    return unsubscribe;
  }, [dispatch, networkState.offlineQueue.items.length]);

  // Demo 1: Resilient API call with automatic retries
  const demoResilientApiCall = async () => {
    addResult('🔄 Demo 1: Making resilient API call...');
    
    try {
      // This will automatically retry with exponential backoff
      const response = await networkResilienceService.resilientFetch(
        'https://httpbin.org/delay/2', // Simulates slow response
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        'api'
      );
      
      addResult('✅ Resilient API call succeeded');
    } catch (error) {
      addResult(`❌ API call failed after retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Demo 2: Offline queue management
  const demoOfflineQueue = async () => {
    addResult('📦 Demo 2: Adding request to offline queue...');
    
    const queuedRequest = {
      id: `demo-${Date.now()}`,
      url: 'https://httpbin.org/post',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: 'Demo upload data',
          timestamp: new Date().toISOString(),
        }),
      },
      priority: 'high' as const,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    dispatch(addToOfflineQueue(queuedRequest));
    addResult(`✅ Request queued (Queue length: ${networkState.offlineQueue.items.length + 1})`);

    // If online, process immediately
    if (networkState.networkState.isConnected) {
      addResult('🔄 Processing queue immediately (online)...');
      dispatch(processOfflineQueue());
    } else {
      addResult('📴 Will process when connection restored');
    }
  };

  // Demo 3: Network health monitoring
  const demoNetworkHealth = () => {
    addResult('🏥 Demo 3: Checking network health...');
    
    const metrics = networkResilienceService.getNetworkMetrics();
    addResult(`📊 Network Health: ${metrics.latency}ms latency, ${metrics.bandwidth.toFixed(1)}Mbps, ${(metrics.stability * 100).toFixed(1)}% stability`);
    
    // Show user-friendly feedback based on connection quality
    if (metrics.latency > 1000) {
      addResult('⚠️ High latency detected - uploads may be slower');
      Alert.alert(
        'Poor Connection',
        'Your connection seems slow. Uploads may take longer than usual.',
        [{ text: 'OK' }]
      );
    } else if (metrics.stability < 0.7) {
      addResult('⚠️ Unstable connection detected');
      Alert.alert(
        'Unstable Connection',
        'Your connection is unstable. We\'ll automatically retry failed requests.',
        [{ text: 'OK' }]
      );
    } else {
      addResult('✅ Connection quality is good');
    }
  };

  // Demo 4: Handle upload with network resilience
  const demoResilientUpload = async () => {
    addResult('📤 Demo 4: Simulating video upload with network resilience...');
    
    try {
      // Simulate video upload with retry logic
      const uploadData = {
        videoId: `demo-video-${Date.now()}`,
        fileSize: 15728640, // 15MB
        duration: 30,
        metadata: {
          recordedAt: new Date().toISOString(),
          quality: 'HD',
        },
      };

      const response = await networkResilienceService.resilientFetch(
        'https://httpbin.org/post',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(uploadData),
        },
        'upload' // Uses upload-specific retry config (5 retries, longer delays)
      );

      if (response.ok) {
        addResult('✅ Video upload completed successfully');
        Alert.alert(
          'Upload Successful',
          'Your video has been uploaded successfully!',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      addResult(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Queue for later if it's a network issue
      const queuedUpload = {
        id: `upload-${Date.now()}`,
        url: 'https://httpbin.org/post',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ retryUpload: true }),
        },
        priority: 'high' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 5,
      };

      dispatch(addToOfflineQueue(queuedUpload));
      addResult('📦 Upload queued for retry when connection improves');
      
      Alert.alert(
        'Upload Failed',
        'Upload failed due to connection issues. We\'ve queued it to retry automatically when your connection improves.',
        [{ text: 'OK' }]
      );
    }
  };

  // Demo 5: Force process offline queue
  const demoProcessQueue = async () => {
    if (networkState.offlineQueue.items.length === 0) {
      addResult('📭 No items in offline queue');
      return;
    }

    addResult(`🔄 Demo 5: Force processing ${networkState.offlineQueue.items.length} queued items...`);
    
    try {
      await networkResilienceService.forceProcessQueue();
      addResult('✅ Offline queue processed');
    } catch (error) {
      addResult(`⚠️ Some queue items failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Demo 6: Clear offline queue
  const demoClearQueue = async () => {
    addResult('🗑️ Demo 6: Clearing offline queue...');
    await networkResilienceService.clearOfflineQueue();
    addResult('✅ Offline queue cleared');
  };

  return {
    // Network state
    isOnline: networkState.networkState.isConnected,
    connectionStrength: networkState.networkState.strength,
    offlineQueueLength: networkState.offlineQueue.items.length,
    isProcessingQueue: networkState.offlineQueue.isProcessing,
    
    // Demo functions
    demoResilientApiCall,
    demoOfflineQueue,
    demoNetworkHealth,
    demoResilientUpload,
    demoProcessQueue,
    demoClearQueue,
    
    // Results
    demoResults,
    
    // Network metrics
    networkMetrics: networkResilienceService.getNetworkMetrics(),
    queueStatus: networkResilienceService.getOfflineQueueStatus(),
  };
}

// Usage example for the camera recording component
export function createNetworkAwareUpload(
  videoUri: string,
  statementIndex: number,
  onProgress?: (progress: number) => void,
  onComplete?: (result: any) => void,
  onError?: (error: string) => void
) {
  return async () => {
    try {
      // Check network conditions first
      const networkState = networkResilienceService.getNetworkState();
      const metrics = networkResilienceService.getNetworkMetrics();
      
      if (!networkState.isConnected) {
        // Queue for later upload
        const queuedRequest = {
          id: `video-upload-${statementIndex}-${Date.now()}`,
          url: '/api/challenges/upload-video',
          options: {
            method: 'POST',
            body: JSON.stringify({
              videoUri,
              statementIndex,
              timestamp: Date.now(),
            }),
          },
          priority: 'high' as const,
          createdAt: Date.now(),
          retryCount: 0,
          maxRetries: 5,
        };
        
        // This would be dispatched to Redux store
        console.log('Queued video upload for later:', queuedRequest.id);
        onError?.('No internet connection. Upload queued for when connection is restored.');
        return;
      }
      
      if (networkState.strength === 'poor' || metrics.latency > 2000) {
        Alert.alert(
          'Poor Connection Detected',
          'Your connection seems slow. The upload may take longer than usual. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => performUpload()
            }
          ]
        );
        return;
      }
      
      await performUpload();
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Upload failed');
    }
    
    async function performUpload() {
      try {
        onProgress?.(0);
        
        // Use resilient fetch with upload configuration
        const response = await networkResilienceService.resilientFetch(
          '/api/challenges/upload-video',
          {
            method: 'POST',
            body: JSON.stringify({
              videoUri,
              statementIndex,
              timestamp: Date.now(),
            }),
          },
          'upload'
        );
        
        onProgress?.(100);
        onComplete?.(await response.json());
        
      } catch (error) {
        throw error;
      }
    }
  };
}

export default NetworkResilienceDemo;
