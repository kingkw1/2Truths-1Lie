/**
 * Network State Redux Slice
 * Manages network connectivity state and offline queue in Redux store
 */

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { networkResilienceService, NetworkState, QueuedRequest } from '../../services/networkResilienceService';

export interface NetworkStateSlice {
  // Current network state
  networkState: NetworkState;
  isInitialized: boolean;
  
  // Offline queue management
  offlineQueue: {
    items: QueuedRequest[];
    isProcessing: boolean;
    lastProcessed: number | null;
    processingErrors: string[];
  };
  
  // Network metrics and health
  metrics: {
    latency: number;
    bandwidth: number;
    stability: number;
    lastChecked: number;
  };
  
  // User feedback and notifications
  notifications: {
    showOfflineIndicator: boolean;
    showPoorConnectionWarning: boolean;
    showQueueStatus: boolean;
    lastNetworkChange: number | null;
  };
  
  // Upload queue specific to network issues
  networkUploadQueue: {
    [uploadId: string]: {
      id: string;
      status: 'queued' | 'retrying' | 'failed' | 'completed';
      retryCount: number;
      maxRetries: number;
      lastAttempt: number;
      error?: string;
      priority: 'high' | 'normal' | 'low';
    };
  };
}

const initialState: NetworkStateSlice = {
  networkState: {
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown' as any,
    isConnectionExpensive: false,
    strength: 'unknown',
    bandwidth: 0,
  },
  isInitialized: false,
  
  offlineQueue: {
    items: [],
    isProcessing: false,
    lastProcessed: null,
    processingErrors: [],
  },
  
  metrics: {
    latency: 0,
    bandwidth: 0,
    stability: 1,
    lastChecked: 0,
  },
  
  notifications: {
    showOfflineIndicator: false,
    showPoorConnectionWarning: false,
    showQueueStatus: false,
    lastNetworkChange: null,
  },
  
  networkUploadQueue: {},
};

// Async thunks for network operations

export const initializeNetworkMonitoring = createAsyncThunk(
  'network/initialize',
  async () => {
    const networkState = networkResilienceService.getNetworkState();
    const metrics = networkResilienceService.getNetworkMetrics();
    const queueStatus = networkResilienceService.getOfflineQueueStatus();
    
    return {
      networkState,
      metrics,
      queueStatus,
    };
  }
);

export const processOfflineQueue = createAsyncThunk(
  'network/processQueue',
  async (_, { rejectWithValue }) => {
    try {
      await networkResilienceService.forceProcessQueue();
      const queueStatus = networkResilienceService.getOfflineQueueStatus();
      return queueStatus;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to process queue');
    }
  }
);

export const retryFailedUploads = createAsyncThunk(
  'network/retryUploads',
  async (uploadIds: string[], { getState, dispatch }) => {
    const state = getState() as any;
    const networkUploadQueue = state.network.networkUploadQueue;
    
    const retryResults: Array<{ id: string; success: boolean; error?: string }> = [];
    
    for (const uploadId of uploadIds) {
      const queueItem = networkUploadQueue[uploadId];
      if (queueItem && queueItem.retryCount < queueItem.maxRetries) {
        try {
          // This would integrate with the actual upload service
          // For now, we'll simulate the retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryResults.push({ id: uploadId, success: true });
        } catch (error) {
          retryResults.push({
            id: uploadId,
            success: false,
            error: error instanceof Error ? error.message : 'Retry failed',
          });
        }
      }
    }
    
    return retryResults;
  }
);

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    // Network state updates
    updateNetworkState: (state, action: PayloadAction<NetworkState>) => {
      const previousState = state.networkState;
      state.networkState = action.payload;
      state.notifications.lastNetworkChange = Date.now();
      
      // Update notification flags based on network changes
      const wasOffline = !previousState.isConnected || !previousState.isInternetReachable;
      const isNowOnline = action.payload.isConnected && action.payload.isInternetReachable;
      const wasOnline = previousState.isConnected && previousState.isInternetReachable;
      const isNowOffline = !action.payload.isConnected || !action.payload.isInternetReachable;
      
      // Show offline indicator when going offline
      if (wasOnline && isNowOffline) {
        state.notifications.showOfflineIndicator = true;
        state.notifications.showQueueStatus = true;
      }
      
      // Hide offline indicator when coming online
      if (wasOffline && isNowOnline) {
        state.notifications.showOfflineIndicator = false;
        // Keep queue status visible briefly to show processing
        setTimeout(() => {
          state.notifications.showQueueStatus = false;
        }, 3000);
      }
      
      // Show poor connection warning
      state.notifications.showPoorConnectionWarning = 
        action.payload.isConnected && 
        (action.payload.strength === 'poor' || action.payload.strength === 'fair');
    },
    
    updateNetworkMetrics: (state, action: PayloadAction<{
      latency: number;
      bandwidth: number;
      stability: number;
    }>) => {
      state.metrics = {
        ...action.payload,
        lastChecked: Date.now(),
      };
    },
    
    // Offline queue management
    addToOfflineQueue: (state, action: PayloadAction<QueuedRequest>) => {
      state.offlineQueue.items.push(action.payload);
      state.notifications.showQueueStatus = true;
    },
    
    removeFromOfflineQueue: (state, action: PayloadAction<string>) => {
      state.offlineQueue.items = state.offlineQueue.items.filter(
        (item: QueuedRequest) => item.id !== action.payload
      );
      
      if (state.offlineQueue.items.length === 0) {
        state.notifications.showQueueStatus = false;
      }
    },
    
    updateQueueProcessingStatus: (state, action: PayloadAction<{
      isProcessing: boolean;
      errors?: string[];
    }>) => {
      state.offlineQueue.isProcessing = action.payload.isProcessing;
      if (action.payload.errors) {
        state.offlineQueue.processingErrors = action.payload.errors;
      }
      if (!action.payload.isProcessing) {
        state.offlineQueue.lastProcessed = Date.now();
      }
    },
    
    clearQueueErrors: (state) => {
      state.offlineQueue.processingErrors = [];
    },
    
    // Upload queue management
    addUploadToNetworkQueue: (state, action: PayloadAction<{
      id: string;
      priority?: 'high' | 'normal' | 'low';
      maxRetries?: number;
    }>) => {
      const { id, priority = 'normal', maxRetries = 3 } = action.payload;
      state.networkUploadQueue[id] = {
        id,
        status: 'queued',
        retryCount: 0,
        maxRetries,
        lastAttempt: Date.now(),
        priority,
      };
    },
    
    updateUploadQueueStatus: (state, action: PayloadAction<{
      id: string;
      status: 'queued' | 'retrying' | 'failed' | 'completed';
      error?: string;
    }>) => {
      const { id, status, error } = action.payload;
      if (state.networkUploadQueue[id]) {
        state.networkUploadQueue[id].status = status;
        state.networkUploadQueue[id].lastAttempt = Date.now();
        
        if (status === 'retrying') {
          state.networkUploadQueue[id].retryCount++;
        }
        
        if (error) {
          state.networkUploadQueue[id].error = error;
        }
        
        // Remove completed uploads
        if (status === 'completed') {
          delete state.networkUploadQueue[id];
        }
      }
    },
    
    removeUploadFromNetworkQueue: (state, action: PayloadAction<string>) => {
      delete state.networkUploadQueue[action.payload];
    },
    
    clearFailedUploads: (state) => {
      Object.keys(state.networkUploadQueue).forEach(id => {
        const upload = state.networkUploadQueue[id];
        if (upload.status === 'failed' || upload.retryCount >= upload.maxRetries) {
          delete state.networkUploadQueue[id];
        }
      });
    },
    
    // Notification management
    dismissOfflineIndicator: (state) => {
      state.notifications.showOfflineIndicator = false;
    },
    
    dismissPoorConnectionWarning: (state) => {
      state.notifications.showPoorConnectionWarning = false;
    },
    
    dismissQueueStatus: (state) => {
      state.notifications.showQueueStatus = false;
    },
    
    // Reset network state
    resetNetworkState: (state) => {
      state.offlineQueue = initialState.offlineQueue;
      state.networkUploadQueue = {};
      state.notifications = {
        ...initialState.notifications,
        lastNetworkChange: Date.now(),
      };
    },
  },
  
  extraReducers: (builder) => {
    // Initialize network monitoring
    builder
      .addCase(initializeNetworkMonitoring.fulfilled, (state, action) => {
        state.networkState = action.payload.networkState;
        state.metrics = action.payload.metrics;
        state.isInitialized = true;
        
        // Update queue status
        if (action.payload.queueStatus.queueLength > 0) {
          state.notifications.showQueueStatus = true;
        }
      })
      .addCase(initializeNetworkMonitoring.rejected, (state) => {
        state.isInitialized = false;
      });
    
    // Process offline queue
    builder
      .addCase(processOfflineQueue.pending, (state) => {
        state.offlineQueue.isProcessing = true;
        state.offlineQueue.processingErrors = [];
      })
      .addCase(processOfflineQueue.fulfilled, (state, action) => {
        state.offlineQueue.isProcessing = false;
        state.offlineQueue.lastProcessed = Date.now();
        
        // Update queue length based on actual service status
        if (action.payload.queueLength === 0) {
          state.notifications.showQueueStatus = false;
        }
      })
      .addCase(processOfflineQueue.rejected, (state, action) => {
        state.offlineQueue.isProcessing = false;
        state.offlineQueue.processingErrors.push(action.payload as string);
      });
    
    // Retry failed uploads
    builder
      .addCase(retryFailedUploads.fulfilled, (state, action) => {
        action.payload.forEach(result => {
          if (state.networkUploadQueue[result.id]) {
            if (result.success) {
              state.networkUploadQueue[result.id].status = 'completed';
              delete state.networkUploadQueue[result.id];
            } else {
              state.networkUploadQueue[result.id].status = 'failed';
              state.networkUploadQueue[result.id].error = result.error;
            }
          }
        });
      });
  },
});

export const {
  updateNetworkState,
  updateNetworkMetrics,
  addToOfflineQueue,
  removeFromOfflineQueue,
  updateQueueProcessingStatus,
  clearQueueErrors,
  addUploadToNetworkQueue,
  updateUploadQueueStatus,
  removeUploadFromNetworkQueue,
  clearFailedUploads,
  dismissOfflineIndicator,
  dismissPoorConnectionWarning,
  dismissQueueStatus,
  resetNetworkState,
} = networkSlice.actions;

export default networkSlice.reducer;

// Selectors
export const selectNetworkState = (state: { network: NetworkStateSlice }) => state.network.networkState;
export const selectIsOnline = (state: { network: NetworkStateSlice }) => 
  state.network.networkState.isConnected && state.network.networkState.isInternetReachable;
export const selectConnectionStrength = (state: { network: NetworkStateSlice }) => 
  state.network.networkState.strength;
export const selectOfflineQueueLength = (state: { network: NetworkStateSlice }) => 
  state.network.offlineQueue.items.length;
export const selectNetworkUploadQueue = (state: { network: NetworkStateSlice }) => 
  state.network.networkUploadQueue;
export const selectShouldShowOfflineIndicator = (state: { network: NetworkStateSlice }) => 
  state.network.notifications.showOfflineIndicator;
export const selectShouldShowPoorConnectionWarning = (state: { network: NetworkStateSlice }) => 
  state.network.notifications.showPoorConnectionWarning;
export const selectShouldShowQueueStatus = (state: { network: NetworkStateSlice }) => 
  state.network.notifications.showQueueStatus;
