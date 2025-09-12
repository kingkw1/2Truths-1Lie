/**
 * Network Resilience Service
 * Provides comprehensive network monitoring, retry logic, and offline queue management
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType;
  isConnectionExpensive: boolean;
  strength: 'poor' | 'fair' | 'good' | 'excellent' | 'unknown';
  bandwidth: number; // estimated Mbps
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBase: number;
  jitter: boolean;
}

export interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  metadata?: any;
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export interface NetworkMetrics {
  latency: number;
  bandwidth: number;
  stability: number; // 0-1 score
  lastChecked: number;
}

export class NetworkResilienceService {
  private static instance: NetworkResilienceService;
  private currentNetworkState: NetworkState;
  private networkListeners: ((state: NetworkState) => void)[] = [];
  private offlineQueue: QueuedRequest[] = [];
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();
  private isProcessingQueue: boolean = false;
  private networkMetrics: NetworkMetrics = {
    latency: 0,
    bandwidth: 0,
    stability: 1,
    lastChecked: 0,
  };

  // Default retry configurations for different request types
  private retryConfigs: Record<string, RetryConfig> = {
    upload: {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      exponentialBase: 2,
      jitter: true,
    },
    api: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 1.5,
      jitter: true,
    },
    media: {
      maxRetries: 4,
      baseDelay: 1500,
      maxDelay: 20000,
      exponentialBase: 2,
      jitter: true,
    },
  };

  private constructor() {
    this.currentNetworkState = {
      isConnected: false,
      isInternetReachable: false,
      type: NetInfoStateType.unknown,
      isConnectionExpensive: false,
      strength: 'unknown',
      bandwidth: 0,
    };

    this.initializeNetworkMonitoring();
    this.loadOfflineQueue();
  }

  public static getInstance(): NetworkResilienceService {
    if (!NetworkResilienceService.instance) {
      NetworkResilienceService.instance = new NetworkResilienceService();
    }
    return NetworkResilienceService.instance;
  }

  /**
   * Initialize network monitoring and state management
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network state
      const initialState = await NetInfo.fetch();
      this.updateNetworkState(initialState);

      // Set up network state listener
      NetInfo.addEventListener((state) => {
        this.updateNetworkState(state);
      });

      // Start periodic network health checks
      this.startNetworkHealthMonitoring();

      console.log('🌐 Network monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize network monitoring:', error);
    }
  }

  /**
   * Update network state and notify listeners
   */
  private updateNetworkState(netInfoState: NetInfoState): void {
    const previousState = { ...this.currentNetworkState };
    
    // Get connection expensive info from details if available
    const isConnectionExpensive = (netInfoState.details as any)?.isConnectionExpensive ?? false;
    
    this.currentNetworkState = {
      isConnected: netInfoState.isConnected ?? false,
      isInternetReachable: netInfoState.isInternetReachable ?? false,
      type: netInfoState.type,
      isConnectionExpensive,
      strength: this.calculateConnectionStrength(netInfoState),
      bandwidth: this.estimateBandwidth(netInfoState),
    };

    // Check for connection state changes
    const wasOffline = !previousState.isConnected || !previousState.isInternetReachable;
    const isNowOnline = this.currentNetworkState.isConnected && this.currentNetworkState.isInternetReachable;

    if (wasOffline && isNowOnline) {
      console.log('🌐 Network connection restored');
      this.processOfflineQueue();
    }

    // Notify listeners
    this.networkListeners.forEach(listener => {
      try {
        listener(this.currentNetworkState);
      } catch (error) {
        console.error('❌ Error in network listener:', error);
      }
    });
  }

  /**
   * Calculate connection strength based on network info
   */
  private calculateConnectionStrength(state: NetInfoState): NetworkState['strength'] {
    if (!state.isConnected) return 'poor';

    if (state.type === NetInfoStateType.wifi) {
      const details = state.details as any;
      if (details?.strength !== undefined) {
        if (details.strength > 80) return 'excellent';
        if (details.strength > 60) return 'good';
        if (details.strength > 40) return 'fair';
        return 'poor';
      }
      return 'good'; // Default for WiFi
    }

    if (state.type === NetInfoStateType.cellular) {
      const details = state.details as any;
      const generation = details?.cellularGeneration;
      if (generation === '5g') return 'excellent';
      if (generation === '4g') return 'good';
      if (generation === '3g') return 'fair';
      return 'poor';
    }

    return 'unknown';
  }

  /**
   * Estimate bandwidth based on connection type
   */
  private estimateBandwidth(state: NetInfoState): number {
    if (!state.isConnected) return 0;

    switch (state.type) {
      case NetInfoStateType.wifi:
        return 50; // Assume good WiFi
      case NetInfoStateType.cellular:
        const details = state.details as any;
        const generation = details?.cellularGeneration;
        switch (generation) {
          case '5g': return 100;
          case '4g': return 20;
          case '3g': return 3;
          default: return 1;
        }
      case NetInfoStateType.ethernet:
        return 100;
      default:
        return 10;
    }
  }

  /**
   * Start periodic network health monitoring
   */
  private startNetworkHealthMonitoring(): void {
    const checkInterval = 30000; // 30 seconds

    setInterval(async () => {
      await this.measureNetworkHealth();
    }, checkInterval);
  }

  /**
   * Measure network latency and stability
   */
  private async measureNetworkHealth(): Promise<void> {
    if (!this.currentNetworkState.isConnected) return;

    try {
      const startTime = Date.now();
      
      // Use a lightweight endpoint for health checks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch('https://httpbin.org/get', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      // Update metrics
      this.networkMetrics = {
        latency,
        bandwidth: this.currentNetworkState.bandwidth,
        stability: this.calculateStability(latency),
        lastChecked: Date.now(),
      };

    } catch (error) {
      // Network health check failed
      this.networkMetrics.stability = Math.max(0.1, this.networkMetrics.stability - 0.1);
    }
  }

  /**
   * Calculate network stability score
   */
  private calculateStability(latency: number): number {
    if (latency < 100) return 1.0;
    if (latency < 300) return 0.8;
    if (latency < 600) return 0.6;
    if (latency < 1000) return 0.4;
    return 0.2;
  }

  /**
   * Enhanced fetch with retry logic and queue management
   */
  public async resilientFetch(
    url: string, 
    options: RequestInit = {}, 
    requestType: 'upload' | 'api' | 'media' = 'api',
    metadata?: any
  ): Promise<Response> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Check if we're online
    if (!this.isOnline()) {
      await this.queueRequest(requestId, url, options, metadata, 'normal');
      throw new Error('No internet connection - request queued for retry when online');
    }

    // Check connection quality and adjust timeout
    const timeout = this.getTimeoutForConnection();
    const retryConfig = this.retryConfigs[requestType];

    return this.performRequestWithRetry(url, options, retryConfig, timeout);
  }

  /**
   * Perform request with exponential backoff retry
   */
  private async performRequestWithRetry(
    url: string,
    options: RequestInit,
    retryConfig: RetryConfig,
    timeout: number
  ): Promise<Response> {
    let lastError: Error = new Error('Request failed after all retries');

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestOptions: RequestInit = {
          ...options,
          signal: controller.signal,
        };

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Check for server errors that should trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`Server error: ${response.status}`);
        }

        return response;

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx except 429)
        if (error instanceof Error && error.message.includes('4')) {
          const status = parseInt(error.message.match(/\d+/)?.[0] || '0');
          if (status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }

        // Don't retry on the last attempt
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(attempt, retryConfig);
        console.log(`🔄 Retry attempt ${attempt + 1}/${retryConfig.maxRetries} after ${delay}ms`);
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.exponentialBase, attempt);
    const clampedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    if (config.jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterRange = clampedDelay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      return Math.max(0, clampedDelay + jitter);
    }
    
    return clampedDelay;
  }

  /**
   * Queue request for later processing when online
   */
  private async queueRequest(
    id: string,
    url: string,
    options: RequestInit,
    metadata?: any,
    priority: QueuedRequest['priority'] = 'normal'
  ): Promise<void> {
    const queuedRequest: QueuedRequest = {
      id,
      url,
      options,
      metadata,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.offlineQueue.push(queuedRequest);
    
    // Sort queue by priority
    this.offlineQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    await this.saveOfflineQueue();
    console.log(`📥 Request queued for offline processing: ${id}`);
  }

  /**
   * Process offline queue when connection is restored
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) return;

    this.isProcessingQueue = true;
    console.log(`🔄 Processing ${this.offlineQueue.length} queued requests`);

    const maxConcurrentRequests = 3;
    const batches = this.chunkArray(this.offlineQueue, maxConcurrentRequests);

    for (const batch of batches) {
      const promises = batch.map(request => this.processQueuedRequest(request));
      await Promise.allSettled(promises);
    }

    this.isProcessingQueue = false;
    await this.saveOfflineQueue();
  }

  /**
   * Process a single queued request
   */
  private async processQueuedRequest(request: QueuedRequest): Promise<void> {
    try {
      const retryConfig = this.retryConfigs.api;
      const timeout = this.getTimeoutForConnection();
      
      await this.performRequestWithRetry(request.url, request.options, retryConfig, timeout);
      
      // Remove successful request from queue
      this.offlineQueue = this.offlineQueue.filter(r => r.id !== request.id);
      console.log(`✅ Queued request processed successfully: ${request.id}`);

    } catch (error) {
      request.retryCount++;
      
      if (request.retryCount >= request.maxRetries) {
        // Remove failed request after max retries
        this.offlineQueue = this.offlineQueue.filter(r => r.id !== request.id);
        console.error(`❌ Queued request failed after ${request.maxRetries} retries: ${request.id}`);
      } else {
        console.log(`🔄 Queued request retry ${request.retryCount}/${request.maxRetries}: ${request.id}`);
      }
    }
  }

  /**
   * Get appropriate timeout based on connection quality
   */
  private getTimeoutForConnection(): number {
    const baseTimeout = 10000; // 10 seconds
    
    switch (this.currentNetworkState.strength) {
      case 'excellent': return baseTimeout;
      case 'good': return baseTimeout * 1.5;
      case 'fair': return baseTimeout * 2;
      case 'poor': return baseTimeout * 3;
      default: return baseTimeout * 2;
    }
  }

  /**
   * Check if device is online
   */
  public isOnline(): boolean {
    return this.currentNetworkState.isConnected && this.currentNetworkState.isInternetReachable;
  }

  /**
   * Get current network state
   */
  public getNetworkState(): NetworkState {
    return { ...this.currentNetworkState };
  }

  /**
   * Get network metrics
   */
  public getNetworkMetrics(): NetworkMetrics {
    return { ...this.networkMetrics };
  }

  /**
   * Subscribe to network state changes
   */
  public addNetworkListener(listener: (state: NetworkState) => void): () => void {
    this.networkListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.networkListeners.indexOf(listener);
      if (index > -1) {
        this.networkListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get offline queue status
   */
  public getOfflineQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    oldestRequest?: number;
  } {
    const oldestRequest = this.offlineQueue.length > 0 
      ? Math.min(...this.offlineQueue.map(r => r.createdAt))
      : undefined;

    return {
      queueLength: this.offlineQueue.length,
      isProcessing: this.isProcessingQueue,
      oldestRequest,
    };
  }

  /**
   * Update retry configuration for request type
   */
  public updateRetryConfig(requestType: string, config: Partial<RetryConfig>): void {
    this.retryConfigs[requestType] = {
      ...this.retryConfigs[requestType],
      ...config,
    };
  }

  /**
   * Clear offline queue
   */
  public async clearOfflineQueue(): Promise<void> {
    this.offlineQueue = [];
    await this.saveOfflineQueue();
  }

  /**
   * Force process offline queue (for manual retry)
   */
  public async forceProcessQueue(): Promise<void> {
    if (this.isOnline()) {
      await this.processOfflineQueue();
    }
  }

  // Private utility methods

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('networkOfflineQueue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('❌ Failed to save offline queue:', error);
    }
  }

  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('networkOfflineQueue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        console.log(`📥 Loaded ${this.offlineQueue.length} queued requests from storage`);
      }
    } catch (error) {
      console.error('❌ Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }
}

// Export singleton instance
export const networkResilienceService = NetworkResilienceService.getInstance();
