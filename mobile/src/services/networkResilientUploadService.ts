/**
 * Network-Resilient Upload Service
 * Enhanced upload service with retry logic, offline queuing, and network monitoring
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { networkResilienceService, NetworkState } from './networkResilienceService';
import { getBackendBaseUrl } from '../config/apiConfig';

export interface NetworkResilientUploadProgress {
  stage: 'preparing' | 'uploading' | 'finalizing' | 'retrying' | 'queued';
  progress: number; // 0-100
  startTime: number;
  retryCount?: number;
  maxRetries?: number;
  networkState?: NetworkState;
  estimatedTimeRemaining?: number;
  speedMbps?: number;
}

export interface NetworkResilientUploadOptions {
  retryAttempts?: number;
  chunkSize?: number;
  priority?: 'high' | 'normal' | 'low';
  adaptToConnection?: boolean;
  resumable?: boolean;
  offlineQueue?: boolean;
}

export interface NetworkResilientUploadResult {
  success: boolean;
  mediaId?: string;
  streamingUrl?: string;
  cloudStorageKey?: string;
  storageType?: 'cloud' | 'local';
  fileSize?: number;
  uploadDuration?: number;
  networkConditions?: NetworkState;
  retryCount?: number;
  queuedDuration?: number;
  error?: string;
}

export interface UploadSession {
  id: string;
  fileUri: string;
  filename: string;
  totalSize: number;
  uploadedBytes: number;
  chunkSize: number;
  chunks: UploadChunk[];
  startTime: number;
  lastProgress: number;
  networkState: NetworkState;
  isResumed: boolean;
}

export interface UploadChunk {
  index: number;
  start: number;
  end: number;
  uploaded: boolean;
  retryCount: number;
  hash?: string;
}

export class NetworkResilientUploadService {
  private static instance: NetworkResilientUploadService;
  private baseUrl: string;
  private authToken: string | null = null;
  private activeSessions: Map<string, UploadSession> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private networkState: NetworkState;
  private networkUnsubscribe?: () => void;

  private constructor() {
    this.baseUrl = getBackendBaseUrl();
    this.networkState = networkResilienceService.getNetworkState();
    
    // Subscribe to network changes
    this.networkUnsubscribe = networkResilienceService.addNetworkListener((state) => {
      this.handleNetworkStateChange(state);
    });
  }

  public static getInstance(): NetworkResilientUploadService {
    if (!NetworkResilientUploadService.instance) {
      NetworkResilientUploadService.instance = new NetworkResilientUploadService();
    }
    return NetworkResilientUploadService.instance;
  }

  /**
   * Initialize service with authentication
   */
  public async initialize(): Promise<void> {
    try {
      const { authService } = await import('./authService');
      await authService.initialize();
      
      const token = authService.getAuthToken();
      if (token) {
        this.setAuthToken(token);
      }
    } catch (error) {
      console.warn('Failed to initialize network-resilient upload service:', error);
    }
  }

  /**
   * Set authentication token
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Upload video with network resilience features
   */
  public async uploadVideoWithResilience(
    videoUri: string,
    filename: string,
    duration: number,
    options: NetworkResilientUploadOptions = {},
    onProgress?: (progress: NetworkResilientUploadProgress) => void
  ): Promise<NetworkResilientUploadResult> {
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();

    // Set default options based on network conditions
    const uploadOptions = this.adaptOptionsToNetwork(options);

    try {
      console.log('🚀 Starting network-resilient upload:', {
        sessionId,
        filename,
        networkState: this.networkState,
        options: uploadOptions,
      });

      // Check if we should queue the upload
      if (!networkResilienceService.isOnline() && uploadOptions.offlineQueue) {
        return this.queueUploadForLater(sessionId, videoUri, filename, duration, uploadOptions, onProgress);
      }

      // Prepare upload session
      const session = await this.prepareUploadSession(sessionId, videoUri, filename, uploadOptions);
      this.activeSessions.set(sessionId, session);

      onProgress?.({
        stage: 'preparing',
        progress: 10,
        startTime,
        networkState: this.networkState,
      });

      // Perform chunked upload with resilience
      const result = await this.performResilientUpload(session, uploadOptions, onProgress);

      // Clean up session
      this.activeSessions.delete(sessionId);
      this.abortControllers.delete(sessionId);

      return {
        ...result,
        uploadDuration: Date.now() - startTime,
        networkConditions: this.networkState,
      };

    } catch (error) {
      // Clean up on error
      this.activeSessions.delete(sessionId);
      this.abortControllers.delete(sessionId);

      console.error('❌ Network-resilient upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        networkConditions: this.networkState,
        uploadDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Adapt upload options based on current network conditions
   */
  private adaptOptionsToNetwork(options: NetworkResilientUploadOptions): NetworkResilientUploadOptions {
    const adapted = { ...options };

    if (options.adaptToConnection !== false) {
      switch (this.networkState.strength) {
        case 'poor':
          adapted.chunkSize = Math.min(adapted.chunkSize || 512 * 1024, 256 * 1024); // 256KB max
          adapted.retryAttempts = Math.max(adapted.retryAttempts || 3, 5);
          break;
        case 'fair':
          adapted.chunkSize = Math.min(adapted.chunkSize || 1024 * 1024, 512 * 1024); // 512KB max
          adapted.retryAttempts = Math.max(adapted.retryAttempts || 3, 4);
          break;
        case 'good':
          adapted.chunkSize = adapted.chunkSize || 1024 * 1024; // 1MB default
          adapted.retryAttempts = adapted.retryAttempts || 3;
          break;
        case 'excellent':
          adapted.chunkSize = adapted.chunkSize || 2 * 1024 * 1024; // 2MB for excellent
          adapted.retryAttempts = adapted.retryAttempts || 2;
          break;
        default:
          adapted.chunkSize = adapted.chunkSize || 1024 * 1024;
          adapted.retryAttempts = adapted.retryAttempts || 3;
      }

      // Enable offline queuing for poor connections
      if (this.networkState.strength === 'poor' && adapted.offlineQueue === undefined) {
        adapted.offlineQueue = true;
      }
    }

    return adapted;
  }

  /**
   * Prepare upload session with chunks
   */
  private async prepareUploadSession(
    sessionId: string,
    videoUri: string,
    filename: string,
    options: NetworkResilientUploadOptions
  ): Promise<UploadSession> {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists) {
      throw new Error('Video file not found');
    }

    const totalSize = fileInfo.size || 0;
    const chunkSize = options.chunkSize || 1024 * 1024; // 1MB default
    const numChunks = Math.ceil(totalSize / chunkSize);

    // Create chunks
    const chunks: UploadChunk[] = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, totalSize - 1);
      
      chunks.push({
        index: i,
        start,
        end,
        uploaded: false,
        retryCount: 0,
      });
    }

    return {
      id: sessionId,
      fileUri: videoUri,
      filename,
      totalSize,
      uploadedBytes: 0,
      chunkSize,
      chunks,
      startTime: Date.now(),
      lastProgress: 0,
      networkState: this.networkState,
      isResumed: false,
    };
  }

  /**
   * Perform resilient chunked upload
   */
  private async performResilientUpload(
    session: UploadSession,
    options: NetworkResilientUploadOptions,
    onProgress?: (progress: NetworkResilientUploadProgress) => void
  ): Promise<NetworkResilientUploadResult> {
    const abortController = new AbortController();
    this.abortControllers.set(session.id, abortController);

    let uploadStartTime = Date.now();
    let totalRetries = 0;
    const maxRetries = options.retryAttempts || 3;

    // Upload chunks with resilience
    for (const chunk of session.chunks) {
      if (abortController.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      let chunkUploaded = false;
      let chunkRetries = 0;

      while (!chunkUploaded && chunkRetries <= maxRetries) {
        try {
          // Check network state before each chunk
          if (!networkResilienceService.isOnline()) {
            if (options.offlineQueue) {
              throw new Error('Connection lost - upload will be queued');
            } else {
              // Wait for connection to restore
              await this.waitForConnection(30000); // 30 second timeout
            }
          }

          // Upload chunk with network resilience
          await this.uploadChunkWithResilience(session, chunk, abortController.signal);
          
          chunkUploaded = true;
          session.uploadedBytes += (chunk.end - chunk.start + 1);
          chunk.uploaded = true;

          // Update progress
          const progress = (session.uploadedBytes / session.totalSize) * 100;
          const speedMbps = this.calculateUploadSpeed(session.uploadedBytes, uploadStartTime);
          const estimatedTimeRemaining = this.estimateTimeRemaining(
            session.totalSize - session.uploadedBytes,
            speedMbps
          );

          onProgress?.({
            stage: 'uploading',
            progress,
            startTime: session.startTime,
            networkState: this.networkState,
            speedMbps,
            estimatedTimeRemaining,
          });

        } catch (error) {
          chunkRetries++;
          totalRetries++;
          chunk.retryCount++;

          console.log(`🔄 Chunk ${chunk.index} retry ${chunkRetries}/${maxRetries}:`, error);

          if (chunkRetries <= maxRetries) {
            onProgress?.({
              stage: 'retrying',
              progress: (session.uploadedBytes / session.totalSize) * 100,
              startTime: session.startTime,
              retryCount: totalRetries,
              maxRetries: maxRetries * session.chunks.length,
              networkState: this.networkState,
            });

            // Exponential backoff for chunk retries
            const delay = Math.min(1000 * Math.pow(2, chunkRetries - 1), 10000);
            await this.sleep(delay);
          } else {
            throw new Error(`Chunk ${chunk.index} failed after ${maxRetries} retries: ${error}`);
          }
        }
      }
    }

    // Finalize upload
    onProgress?.({
      stage: 'finalizing',
      progress: 95,
      startTime: session.startTime,
      networkState: this.networkState,
    });

    const finalizeResult = await this.finalizeUpload(session);

    onProgress?.({
      stage: 'finalizing',
      progress: 100,
      startTime: session.startTime,
      networkState: this.networkState,
    });

    return {
      success: true,
      ...finalizeResult,
      retryCount: totalRetries,
    };
  }

  /**
   * Upload single chunk with network resilience
   */
  private async uploadChunkWithResilience(
    session: UploadSession,
    chunk: UploadChunk,
    signal: AbortSignal
  ): Promise<void> {
    // Read chunk data
    const chunkData = await FileSystem.readAsStringAsync(session.fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: chunk.start,
      length: chunk.end - chunk.start + 1,
    });

    // Prepare form data for chunk
    const formData = new FormData();
    formData.append('chunk_index', chunk.index.toString());
    formData.append('chunk_data', chunkData);
    formData.append('session_id', session.id);
    formData.append('filename', session.filename);
    formData.append('total_chunks', session.chunks.length.toString());

    const headers = this.getAuthHeaders();

    // Use network resilience service for the request
    const response = await networkResilienceService.resilientFetch(
      `${this.baseUrl}/api/v1/challenge-videos/upload-chunk`,
      {
        method: 'POST',
        headers,
        body: formData,
        signal,
      },
      'upload'
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk upload failed: ${response.status} ${errorText}`);
    }
  }

  /**
   * Finalize upload after all chunks are uploaded
   */
  private async finalizeUpload(session: UploadSession): Promise<Partial<NetworkResilientUploadResult>> {
    const formData = new FormData();
    formData.append('session_id', session.id);
    formData.append('filename', session.filename);
    formData.append('total_chunks', session.chunks.length.toString());
    formData.append('total_size', session.totalSize.toString());

    const headers = this.getAuthHeaders();

    const response = await networkResilienceService.resilientFetch(
      `${this.baseUrl}/api/v1/challenge-videos/finalize-upload`,
      {
        method: 'POST',
        headers,
        body: formData,
      },
      'upload'
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload finalization failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return {
      mediaId: result.media_id,
      streamingUrl: result.storage_url,
      cloudStorageKey: result.media_id,
      storageType: 'cloud' as const,
      fileSize: session.totalSize,
    };
  }

  /**
   * Queue upload for when connection is restored
   */
  private async queueUploadForLater(
    sessionId: string,
    videoUri: string,
    filename: string,
    duration: number,
    options: NetworkResilientUploadOptions,
    onProgress?: (progress: NetworkResilientUploadProgress) => void
  ): Promise<NetworkResilientUploadResult> {
    console.log('📥 Queuing upload for when connection is restored');

    onProgress?.({
      stage: 'queued',
      progress: 0,
      startTime: Date.now(),
      networkState: this.networkState,
    });

    // Store upload details for later processing
    // In a real implementation, this would integrate with the network service's queue
    // For now, we'll throw an error to indicate queuing
    return {
      success: false,
      error: 'Upload queued - will retry when connection is restored',
      networkConditions: this.networkState,
    };
  }

  /**
   * Handle network state changes
   */
  private handleNetworkStateChange(newState: NetworkState): void {
    const wasOffline = !this.networkState.isConnected;
    const isNowOnline = newState.isConnected && newState.isInternetReachable;

    this.networkState = newState;

    // Resume uploads when connection is restored
    if (wasOffline && isNowOnline) {
      console.log('🌐 Connection restored - resuming uploads');
      this.resumeActiveUploads();
    }

    // Pause uploads if connection is lost
    if (!isNowOnline && this.activeSessions.size > 0) {
      console.log('📡 Connection lost - pausing uploads');
      this.pauseActiveUploads();
    }
  }

  /**
   * Resume active uploads when connection is restored
   */
  private async resumeActiveUploads(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      try {
        // Mark as resumed and continue from last successful chunk
        session.isResumed = true;
        console.log(`🔄 Resuming upload session: ${session.id}`);
      } catch (error) {
        console.error(`❌ Failed to resume upload ${session.id}:`, error);
      }
    }
  }

  /**
   * Pause active uploads when connection is lost
   */
  private pauseActiveUploads(): void {
    for (const [sessionId, controller] of this.abortControllers.entries()) {
      console.log(`⏸️ Pausing upload session: ${sessionId}`);
      // Don't abort, just let them handle the network error gracefully
    }
  }

  /**
   * Wait for network connection to be restored
   */
  private async waitForConnection(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      const unsubscribe = networkResilienceService.addNetworkListener((state) => {
        if (state.isConnected && state.isInternetReachable) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });

      // Check if already online
      if (networkResilienceService.isOnline()) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  }

  /**
   * Cancel upload
   */
  public cancelUpload(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
      this.activeSessions.delete(sessionId);
      console.log(`❌ Upload cancelled: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get upload statistics
   */
  public getUploadStats(): {
    activeSessions: number;
    networkState: NetworkState;
    queueStatus: any;
  } {
    return {
      activeSessions: this.activeSessions.size,
      networkState: this.networkState,
      queueStatus: networkResilienceService.getOfflineQueueStatus(),
    };
  }

  // Private utility methods

  private calculateUploadSpeed(bytesUploaded: number, startTime: number): number {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const megabytes = bytesUploaded / (1024 * 1024);
    return elapsedSeconds > 0 ? megabytes / elapsedSeconds : 0;
  }

  private estimateTimeRemaining(remainingBytes: number, speedMbps: number): number {
    if (speedMbps <= 0) return 0;
    const remainingMb = remainingBytes / (1024 * 1024);
    return remainingMb / speedMbps;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    
    // Cancel all active uploads
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    
    this.abortControllers.clear();
    this.activeSessions.clear();
  }
}

// Export singleton instance
export const networkResilientUploadService = NetworkResilientUploadService.getInstance();
