/**
 * Network Hooks
 * React hooks for network state management and resilient operations
 */

import { useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  networkResilienceService, 
  NetworkState, 
  NetworkMetrics 
} from '../services/networkResilienceService';
import {
  updateNetworkState,
  updateNetworkMetrics,
  updateQueueProcessingStatus,
  initializeNetworkMonitoring,
  processOfflineQueue,
  selectNetworkState,
  selectIsOnline,
  selectConnectionStrength,
  selectOfflineQueueLength,
  selectShouldShowOfflineIndicator,
  selectShouldShowPoorConnectionWarning,
  selectShouldShowQueueStatus,
  dismissOfflineIndicator,
  dismissPoorConnectionWarning,
  dismissQueueStatus,
} from '../store/slices/networkSlice';

export interface UseNetworkOptions {
  showAlerts?: boolean;
  autoRetryQueue?: boolean;
  trackMetrics?: boolean;
}

export interface NetworkHookReturn {
  // Network state
  networkState: NetworkState;
  isOnline: boolean;
  connectionStrength: string;
  
  // Queue information
  offlineQueueLength: number;
  isProcessingQueue: boolean;
  
  // User feedback
  shouldShowOfflineIndicator: boolean;
  shouldShowPoorConnectionWarning: boolean;
  shouldShowQueueStatus: boolean;
  
  // Actions
  retryOfflineQueue: () => Promise<void>;
  dismissNetworkAlerts: () => void;
  getNetworkMetrics: () => NetworkMetrics;
  
  // Upload helpers
  canUpload: boolean;
  uploadRecommendation: 'proceed' | 'wait' | 'warn' | 'offline';
}

/**
 * Main network hook for components
 */
export const useNetwork = (options: UseNetworkOptions = {}): NetworkHookReturn => {
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const networkState = useAppSelector(selectNetworkState);
  const isOnline = useAppSelector(selectIsOnline);
  const connectionStrength = useAppSelector(selectConnectionStrength);
  const offlineQueueLength = useAppSelector(selectOfflineQueueLength);
  const shouldShowOfflineIndicator = useAppSelector(selectShouldShowOfflineIndicator);
  const shouldShowPoorConnectionWarning = useAppSelector(selectShouldShowPoorConnectionWarning);
  const shouldShowQueueStatus = useAppSelector(selectShouldShowQueueStatus);
  
  const {
    showAlerts = true,
    autoRetryQueue = true,
    trackMetrics = true,
  } = options;

  // Initialize network monitoring
  useEffect(() => {
    dispatch(initializeNetworkMonitoring());
    
    // Set up network state listener
    const unsubscribe = networkResilienceService.addNetworkListener((state: NetworkState) => {
      dispatch(updateNetworkState(state));
    });

    return unsubscribe;
  }, [dispatch]);

  // Track network metrics if enabled
  useEffect(() => {
    if (!trackMetrics) return;

    const metricsInterval = setInterval(() => {
      const metrics = networkResilienceService.getNetworkMetrics();
      dispatch(updateNetworkMetrics(metrics));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(metricsInterval);
  }, [dispatch, trackMetrics]);

  // Auto-retry queue when coming online
  useEffect(() => {
    if (autoRetryQueue && isOnline && offlineQueueLength > 0) {
      const retryDelay = setTimeout(() => {
        dispatch(processOfflineQueue());
      }, 2000); // Wait 2 seconds after coming online

      return () => clearTimeout(retryDelay);
    }
  }, [dispatch, autoRetryQueue, isOnline, offlineQueueLength]);

  // Show network alerts
  useEffect(() => {
    if (!showAlerts) return;

    if (shouldShowOfflineIndicator) {
      Alert.alert(
        'No Internet Connection',
        'You\'re currently offline. Your actions will be queued and synced when connection is restored.',
        [
          { text: 'OK', onPress: () => dispatch(dismissOfflineIndicator()) }
        ]
      );
    }
  }, [dispatch, showAlerts, shouldShowOfflineIndicator]);

  // Show poor connection warnings
  useEffect(() => {
    if (!showAlerts) return;

    if (shouldShowPoorConnectionWarning) {
      Alert.alert(
        'Poor Connection',
        'Your internet connection appears to be slow. Uploads may take longer than usual.',
        [
          { text: 'OK', onPress: () => dispatch(dismissPoorConnectionWarning()) },
          { text: 'Continue Anyway', style: 'default' }
        ]
      );
    }
  }, [dispatch, showAlerts, shouldShowPoorConnectionWarning]);

  // Retry offline queue manually
  const retryOfflineQueue = useCallback(async () => {
    try {
      dispatch(updateQueueProcessingStatus({ isProcessing: true }));
      await dispatch(processOfflineQueue()).unwrap();
    } catch (error) {
      console.error('Failed to process offline queue:', error);
      Alert.alert(
        'Queue Processing Failed',
        'Unable to process offline queue. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      dispatch(updateQueueProcessingStatus({ isProcessing: false }));
    }
  }, [dispatch]);

  // Dismiss all network alerts
  const dismissNetworkAlerts = useCallback(() => {
    dispatch(dismissOfflineIndicator());
    dispatch(dismissPoorConnectionWarning());
    dispatch(dismissQueueStatus());
  }, [dispatch]);

  // Get current network metrics
  const getNetworkMetrics = useCallback(() => {
    return networkResilienceService.getNetworkMetrics();
  }, []);

  // Calculate upload recommendation
  const uploadRecommendation = useMemo((): 'proceed' | 'wait' | 'warn' | 'offline' => {
    if (!isOnline) return 'offline';
    
    switch (connectionStrength) {
      case 'excellent':
      case 'good':
        return 'proceed';
      case 'fair':
        return 'warn';
      case 'poor':
        return 'wait';
      default:
        return 'warn';
    }
  }, [isOnline, connectionStrength]);

  const canUpload = useMemo(() => {
    return isOnline && (uploadRecommendation === 'proceed' || uploadRecommendation === 'warn');
  }, [isOnline, uploadRecommendation]);

  const isProcessingQueue = useMemo(() => {
    const queueStatus = networkResilienceService.getOfflineQueueStatus();
    return queueStatus.isProcessing;
  }, [offlineQueueLength]); // Re-compute when queue length changes

  return {
    // Network state
    networkState,
    isOnline,
    connectionStrength,
    
    // Queue information
    offlineQueueLength,
    isProcessingQueue,
    
    // User feedback
    shouldShowOfflineIndicator,
    shouldShowPoorConnectionWarning,
    shouldShowQueueStatus,
    
    // Actions
    retryOfflineQueue,
    dismissNetworkAlerts,
    getNetworkMetrics,
    
    // Upload helpers
    canUpload,
    uploadRecommendation,
  };
};

/**
 * Hook for resilient fetch operations
 */
export const useResilientFetch = () => {
  const { isOnline, uploadRecommendation } = useNetwork();

  const resilientFetch = useCallback(async (
    url: string,
    options: RequestInit = {},
    requestType: 'upload' | 'api' | 'media' = 'api',
    showUserFeedback: boolean = true
  ) => {
    // Check if we should proceed with the request
    if (!isOnline) {
      if (showUserFeedback) {
        Alert.alert(
          'No Internet Connection',
          'This action requires an internet connection. It will be queued and retried when you\'re back online.',
          [{ text: 'OK' }]
        );
      }
      throw new Error('No internet connection - request queued');
    }

    // Warn user about poor connection for uploads
    if (requestType === 'upload' && uploadRecommendation === 'wait' && showUserFeedback) {
      return new Promise<Response>((resolve, reject) => {
        Alert.alert(
          'Poor Connection Detected',
          'Your connection is slow. Uploading now may fail or take a very long time. Do you want to continue?',
          [
            { text: 'Wait', style: 'cancel', onPress: () => reject(new Error('User chose to wait for better connection')) },
            { text: 'Upload Anyway', onPress: () => {
              networkResilienceService.resilientFetch(url, options, requestType)
                .then(resolve)
                .catch(reject);
            }}
          ]
        );
      });
    }

    return networkResilienceService.resilientFetch(url, options, requestType);
  }, [isOnline, uploadRecommendation]);

  return { resilientFetch };
};

/**
 * Hook for network-aware components
 */
export const useNetworkAware = (componentName: string = 'Component') => {
  const { 
    isOnline, 
    connectionStrength, 
    shouldShowOfflineIndicator,
    dismissNetworkAlerts 
  } = useNetwork({ showAlerts: false }); // Don't show global alerts, handle locally

  // Component-specific network status
  const networkStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    
    switch (connectionStrength) {
      case 'excellent': return 'excellent';
      case 'good': return 'good';
      case 'fair': return 'fair';
      case 'poor': return 'poor';
      default: return 'unknown';
    }
  }, [isOnline, connectionStrength]);

  // Get appropriate message for current network state
  const getNetworkMessage = useCallback(() => {
    switch (networkStatus) {
      case 'offline':
        return 'You\'re offline. Actions will be queued for when you reconnect.';
      case 'poor':
        return 'Your connection is slow. Some features may be limited.';
      case 'fair':
        return 'Your connection is moderate. Large uploads may take time.';
      case 'good':
      case 'excellent':
        return 'Connected and ready to go!';
      default:
        return 'Checking connection...';
    }
  }, [networkStatus]);

  // Get appropriate icon for network state
  const getNetworkIcon = useCallback(() => {
    switch (networkStatus) {
      case 'offline': return '📶❌';
      case 'poor': return '📶🔸';
      case 'fair': return '📶🔶';
      case 'good': return '📶🟢';
      case 'excellent': return '📶💚';
      default: return '📶❓';
    }
  }, [networkStatus]);

  // Get appropriate color for UI elements
  const getNetworkColor = useCallback(() => {
    switch (networkStatus) {
      case 'offline': return '#ff4444';
      case 'poor': return '#ff8800';
      case 'fair': return '#ffcc00';
      case 'good': return '#88cc00';
      case 'excellent': return '#00cc44';
      default: return '#888888';
    }
  }, [networkStatus]);

  return {
    isOnline,
    networkStatus,
    shouldShowOfflineIndicator,
    dismissNetworkAlerts,
    getNetworkMessage,
    getNetworkIcon,
    getNetworkColor,
  };
};

/**
 * Hook for upload progress with network awareness
 */
export const useNetworkAwareUpload = () => {
  const { isOnline, connectionStrength, canUpload } = useNetwork();

  const getUploadSettings = useCallback(() => {
    const baseSettings = {
      chunkSize: 1024 * 1024, // 1MB default
      timeout: 30000, // 30 seconds
      maxRetries: 3,
    };

    // Adapt settings based on connection
    switch (connectionStrength) {
      case 'poor':
        return {
          ...baseSettings,
          chunkSize: 256 * 1024, // 256KB for poor connection
          timeout: 60000, // 60 seconds
          maxRetries: 5,
        };
      case 'fair':
        return {
          ...baseSettings,
          chunkSize: 512 * 1024, // 512KB for fair connection
          timeout: 45000, // 45 seconds
          maxRetries: 4,
        };
      case 'excellent':
        return {
          ...baseSettings,
          chunkSize: 2 * 1024 * 1024, // 2MB for excellent connection
          timeout: 20000, // 20 seconds
          maxRetries: 2,
        };
      default:
        return baseSettings;
    }
  }, [connectionStrength]);

  const shouldWarnBeforeUpload = useMemo(() => {
    return isOnline && (connectionStrength === 'poor' || connectionStrength === 'fair');
  }, [isOnline, connectionStrength]);

  return {
    canUpload,
    shouldWarnBeforeUpload,
    getUploadSettings,
    connectionStrength,
  };
};
