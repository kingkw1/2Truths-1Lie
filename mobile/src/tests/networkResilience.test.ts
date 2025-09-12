/**
 * Network Resilience Test Suite
 * 
 * Tests for network resilience features including:
 * - Retry logic with exponential backoff
 * - Offline queue management
 * - Network state monitoring
 * - Automatic resumption when connection restored
 */

import { NetworkResilienceService } from '../services/networkResilienceService';
import { networkSlice } from '../store/slices/networkSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('NetworkResilienceService', () => {
  let service: NetworkResilienceService;

  beforeEach(() => {
    service = new NetworkResilienceService();
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      
      // Mock fetch to fail twice, then succeed
      fetchSpy
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('success'));

      const config = {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        jitterRange: 0.1,
        retryableStatuses: [500, 502, 503, 504],
        adaptiveTimeout: true,
      };

      const result = await service.resilientFetch('https://api.example.com/test', {}, config);
      
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    it('should respect maximum retry attempts', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const config = {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100,
        jitterRange: 0,
        retryableStatuses: [500, 502, 503, 504],
        adaptiveTimeout: true,
      };

      await expect(
        service.resilientFetch('https://api.example.com/test', {}, config)
      ).rejects.toThrow('Network error');

      expect(fetchSpy).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable status codes', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const mockResponse = new Response('Not Found', { status: 404 });
      fetchSpy.mockResolvedValue(mockResponse);

      const config = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        jitterRange: 0,
        retryableStatuses: [500, 502, 503, 504],
        adaptiveTimeout: true,
      };

      await expect(
        service.resilientFetch('https://api.example.com/test', {}, config)
      ).rejects.toThrow('HTTP 404');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline Queue Management', () => {
    it('should queue requests when offline', async () => {
      const request = {
        url: 'https://api.example.com/upload',
        options: { method: 'POST', body: 'test data' },
        priority: 'high' as const,
      };

      await service.queueOfflineRequest(request);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_queue',
        expect.stringContaining('"url":"https://api.example.com/upload"')
      );
    });

    it('should process queued requests when back online', async () => {
      const queuedRequests = [
        {
          id: '1',
          url: 'https://api.example.com/upload1',
          options: { method: 'POST' },
          priority: 'high' as const,
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: '2',
          url: 'https://api.example.com/upload2',
          options: { method: 'POST' },
          priority: 'medium' as const,
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedRequests));
      
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(new Response('success'));

      const processedRequests = await service.processOfflineQueue();

      expect(processedRequests).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should prioritize high priority requests', async () => {
      const queuedRequests = [
        {
          id: '1',
          url: 'https://api.example.com/low',
          options: { method: 'POST' },
          priority: 'low' as const,
          timestamp: Date.now() - 1000,
          retryCount: 0,
        },
        {
          id: '2',
          url: 'https://api.example.com/high',
          options: { method: 'POST' },
          priority: 'high' as const,
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedRequests));
      
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(new Response('success'));

      await service.processOfflineQueue();

      // High priority request should be processed first
      expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://api.example.com/high', expect.any(Object));
      expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://api.example.com/low', expect.any(Object));
    });
  });

  describe('Network Health Monitoring', () => {
    it('should measure network latency', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(new Response('pong'));

      const health = await service.measureNetworkHealth();

      expect(health.latency).toBeGreaterThan(0);
      expect(health.timestamp).toBeDefined();
    });

    it('should calculate stability score', async () => {
      const measurements = [
        { latency: 100, timestamp: Date.now() - 4000 },
        { latency: 120, timestamp: Date.now() - 3000 },
        { latency: 110, timestamp: Date.now() - 2000 },
        { latency: 105, timestamp: Date.now() - 1000 },
        { latency: 115, timestamp: Date.now() },
      ];

      const stability = service.calculateStabilityScore(measurements);

      expect(stability).toBeGreaterThan(0);
      expect(stability).toBeLessThanOrEqual(1);
    });
  });
});

describe('Network Redux Slice', () => {
  it('should update network state', () => {
    const initialState = {
      isOnline: true,
      connectionType: 'wifi' as const,
      connectionStrength: 'excellent' as const,
      latency: 0,
      bandwidth: 0,
      stabilityScore: 1,
      lastConnected: null,
      offlineQueue: [],
      isProcessingQueue: false,
      retryCount: 0,
      shouldShowOfflineIndicator: false,
      shouldShowPoorConnectionWarning: false,
      lastNetworkCheck: Date.now(),
    };

    const newNetworkState = {
      isConnected: false,
      type: 'none' as const,
      details: null,
    };

    const action = networkSlice.actions.updateNetworkState(newNetworkState);
    const nextState = networkSlice.reducer(initialState, action);

    expect(nextState.isOnline).toBe(false);
    expect(nextState.shouldShowOfflineIndicator).toBe(true);
  });

  it('should add requests to offline queue', () => {
    const initialState = {
      isOnline: true,
      connectionType: 'wifi' as const,
      connectionStrength: 'excellent' as const,
      latency: 0,
      bandwidth: 0,
      stabilityScore: 1,
      lastConnected: null,
      offlineQueue: [],
      isProcessingQueue: false,
      retryCount: 0,
      shouldShowOfflineIndicator: false,
      shouldShowPoorConnectionWarning: false,
      lastNetworkCheck: Date.now(),
    };

    const request = {
      id: '123',
      url: 'https://api.example.com/upload',
      options: { method: 'POST' },
      priority: 'high' as const,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const action = networkSlice.actions.addToOfflineQueue(request);
    const nextState = networkSlice.reducer(initialState, action);

    expect(nextState.offlineQueue).toHaveLength(1);
    expect(nextState.offlineQueue[0]).toEqual(request);
  });
});

// Integration test for complete network resilience workflow
describe('Network Resilience Integration', () => {
  it('should handle complete offline/online workflow', async () => {
    const service = new NetworkResilienceService();
    
    // 1. Simulate going offline and queuing requests
    const request1 = {
      url: 'https://api.example.com/upload1',
      options: { method: 'POST', body: 'data1' },
      priority: 'high' as const,
    };
    
    const request2 = {
      url: 'https://api.example.com/upload2',
      options: { method: 'POST', body: 'data2' },
      priority: 'medium' as const,
    };

    await service.queueOfflineRequest(request1);
    await service.queueOfflineRequest(request2);

    // 2. Simulate coming back online and processing queue
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(new Response('success'));

    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([
      {
        id: '1',
        ...request1,
        timestamp: Date.now(),
        retryCount: 0,
      },
      {
        id: '2',
        ...request2,
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]));

    const processedRequests = await service.processOfflineQueue();

    expect(processedRequests).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    
    // High priority request should be processed first
    expect(fetchSpy).toHaveBeenNthCalledWith(1, request1.url, expect.any(Object));
    expect(fetchSpy).toHaveBeenNthCalledWith(2, request2.url, expect.any(Object));
  });
});
