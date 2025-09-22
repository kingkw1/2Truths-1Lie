/**
 * Merge Status Service - Handles asynchronous merge status updates
 * Polls the backend for merge progress and provides real-time updates
 */

import { Dispatch } from '@reduxjs/toolkit';
import { 
  setMergeProgress, 
  setMergeStatus, 
  setMergeError,
  completeMerge 
} from '../store/slices/challengeCreationSlice';
import { authService } from './authService';

export interface MergeProgress {
  stage: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  estimatedTimeRemaining?: number; // in seconds
  error?: string;
}

export interface MergeStatusResponse {
  merge_session_id: string;
  overall_status: string;
  overall_progress_percent: number;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  ready_for_merge: boolean;
  merge_triggered: boolean;
  merge_status: string;
  merge_progress_percent: number;
  merged_video_url?: string;
  merged_video_metadata?: {
    segments: Array<{
      statementIndex: number;
      startTime: number;
      endTime: number;
    }>;
  };
}

export class MergeStatusService {
  private static instance: MergeStatusService;
  private baseUrl: string;
  private authToken: string | null = null;
  private activePolling: Map<string, NodeJS.Timeout> = new Map();
  private dispatch: Dispatch | null = null;

  private constructor() {
    // Use Railway production backend
    this.baseUrl = 'https://2truths-1lie-production.up.railway.app';
  }

  public static getInstance(): MergeStatusService {
    if (!MergeStatusService.instance) {
      MergeStatusService.instance = new MergeStatusService();
    }
    return MergeStatusService.instance;
  }

  /**
   * Initialize service with Redux dispatch and auth token
   */
  public async initialize(dispatch: Dispatch): Promise<void> {
    this.dispatch = dispatch;
    
    try {
      await authService.initialize();
      
      const token = authService.getAuthToken();
      if (token) {
        this.setAuthToken(token);
      }
    } catch (error) {
      console.warn('Failed to initialize merge status service with auth:', error);
    }
  }

  /**
   * Set authentication token
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get auth headers for API requests
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Start polling merge status for a session
   */
  public startPolling(
    mergeSessionId: string,
    options: {
      pollInterval?: number; // milliseconds, default 2000
      maxDuration?: number; // milliseconds, default 300000 (5 minutes)
      onProgress?: (progress: MergeProgress) => void;
      onComplete?: (result: { success: boolean; mergedVideoUrl?: string; segmentMetadata?: any; error?: string }) => void;
    } = {}
  ): void {
    const {
      pollInterval = 2000,
      maxDuration = 300000, // 5 minutes
      onProgress,
      onComplete
    } = options;

    console.log(`🔄 MERGE_STATUS: Starting polling for session ${mergeSessionId}`);

    // Clear any existing polling for this session
    this.stopPolling(mergeSessionId);

    const startTime = Date.now();
    let pollCount = 0;

    const poll = async () => {
      try {
        pollCount++;
        const elapsed = Date.now() - startTime;

        // Check if we've exceeded max duration
        if (elapsed > maxDuration) {
          console.warn(`⏰ MERGE_STATUS: Polling timeout for session ${mergeSessionId}`);
          this.stopPolling(mergeSessionId);
          
          const timeoutProgress: MergeProgress = {
            stage: 'failed',
            progress: 0,
            error: 'Merge operation timed out. Please try again.'
          };
          
          this.updateReduxState(mergeSessionId, timeoutProgress);
          onProgress?.(timeoutProgress);
          onComplete?.({ success: false, error: 'Merge operation timed out' });
          return;
        }

        // Fetch merge status
        const status = await this.fetchMergeStatus(mergeSessionId);
        
        if (!status) {
          console.warn(`❌ MERGE_STATUS: No status found for session ${mergeSessionId}`);
          return;
        }

        // Convert backend status to our progress format
        const progress = this.convertStatusToProgress(status);
        
        console.log(`📊 MERGE_STATUS: Poll ${pollCount} - ${progress.stage} (${progress.progress}%)`);

        // Update Redux state
        this.updateReduxState(mergeSessionId, progress);
        
        // Call progress callback
        onProgress?.(progress);

        // Check if merge is complete
        if (progress.stage === 'completed') {
          console.log(`✅ MERGE_STATUS: Merge completed for session ${mergeSessionId}`);
          this.stopPolling(mergeSessionId);
          
          onComplete?.({
            success: true,
            mergedVideoUrl: status.merged_video_url,
            segmentMetadata: status.merged_video_metadata?.segments
          });
          return;
        }

        // Check if merge failed
        if (progress.stage === 'failed') {
          console.error(`❌ MERGE_STATUS: Merge failed for session ${mergeSessionId}: ${progress.error}`);
          this.stopPolling(mergeSessionId);
          
          onComplete?.({
            success: false,
            error: progress.error || 'Merge operation failed'
          });
          return;
        }

        // Schedule next poll
        const timeoutId = setTimeout(poll, pollInterval);
        this.activePolling.set(mergeSessionId, timeoutId);

      } catch (error: any) {
        console.error(`❌ MERGE_STATUS: Polling error for session ${mergeSessionId}:`, error);
        
        // Don't stop polling on network errors, just log and continue
        if (error.message?.includes('Network') || error.message?.includes('fetch')) {
          console.log(`🔄 MERGE_STATUS: Network error, continuing to poll...`);
          const timeoutId = setTimeout(poll, pollInterval * 2); // Double interval on network errors
          this.activePolling.set(mergeSessionId, timeoutId);
        } else {
          // Stop polling on other errors
          this.stopPolling(mergeSessionId);
          
          const errorProgress: MergeProgress = {
            stage: 'failed',
            progress: 0,
            error: error.message || 'Failed to check merge status'
          };
          
          this.updateReduxState(mergeSessionId, errorProgress);
          onProgress?.(errorProgress);
          onComplete?.({ success: false, error: error.message });
        }
      }
    };

    // Start polling immediately
    poll();
  }

  /**
   * Stop polling for a merge session
   */
  public stopPolling(mergeSessionId: string): void {
    const timeoutId = this.activePolling.get(mergeSessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activePolling.delete(mergeSessionId);
      console.log(`⏹️ MERGE_STATUS: Stopped polling for session ${mergeSessionId}`);
    }
  }

  /**
   * Stop all active polling
   */
  public stopAllPolling(): void {
    this.activePolling.forEach((timeoutId, sessionId) => {
      clearTimeout(timeoutId);
      console.log(`⏹️ MERGE_STATUS: Stopped polling for session ${sessionId}`);
    });
    this.activePolling.clear();
  }

  /**
   * Fetch merge status from backend
   */
  private async fetchMergeStatus(mergeSessionId: string): Promise<MergeStatusResponse | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/challenge-videos/merge-session/${mergeSessionId}/status`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ MERGE_STATUS: Session ${mergeSessionId} not found`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`❌ MERGE_STATUS: Failed to fetch status for ${mergeSessionId}:`, error);
      throw error;
    }
  }

  /**
   * Convert backend status response to our progress format
   */
  private convertStatusToProgress(status: MergeStatusResponse): MergeProgress {
    const {
      overall_status,
      overall_progress_percent,
      merge_triggered,
      merge_status,
      merge_progress_percent,
      completed_videos,
      total_videos
    } = status;

    // Determine stage based on backend status
    let stage: MergeProgress['stage'];
    let progress: number;
    let currentStep: string;
    let estimatedTimeRemaining: number | undefined;

    if (overall_status === 'failed' || merge_status === 'failed') {
      stage = 'failed';
      progress = 0;
      currentStep = 'Merge operation failed';
    } else if (merge_status === 'completed') {
      stage = 'completed';
      progress = 100;
      currentStep = 'Merge completed successfully';
    } else if (merge_triggered && merge_status === 'processing') {
      stage = 'processing';
      progress = Math.max(50, merge_progress_percent || 50); // Merge progress starts at 50%
      currentStep = this.getMergeStepDescription(merge_progress_percent || 0);
      estimatedTimeRemaining = this.estimateRemainingTime(merge_progress_percent || 0);
    } else if (overall_status === 'ready_for_merge' || completed_videos === total_videos) {
      stage = 'processing';
      progress = 50; // All uploads complete, starting merge
      currentStep = 'Starting video merge...';
      estimatedTimeRemaining = 30; // Estimate 30 seconds for merge
    } else {
      stage = 'pending';
      progress = Math.min(49, overall_progress_percent || 0); // Upload progress caps at 49%
      currentStep = `Uploading videos (${completed_videos}/${total_videos})`;
      
      // Estimate remaining time based on upload progress
      if (overall_progress_percent > 0) {
        const uploadTimePerPercent = 1; // Rough estimate: 1 second per percent
        const remainingUploadTime = (50 - overall_progress_percent) * uploadTimePerPercent;
        const mergeTime = 30; // Estimate 30 seconds for merge
        estimatedTimeRemaining = remainingUploadTime + mergeTime;
      }
    }

    return {
      stage,
      progress,
      currentStep,
      estimatedTimeRemaining
    };
  }

  /**
   * Get descriptive text for merge progress
   */
  private getMergeStepDescription(mergeProgress: number): string {
    if (mergeProgress < 20) {
      return 'Analyzing video files...';
    } else if (mergeProgress < 40) {
      return 'Preparing videos for merge...';
    } else if (mergeProgress < 80) {
      return 'Merging video segments...';
    } else if (mergeProgress < 95) {
      return 'Compressing merged video...';
    } else {
      return 'Finalizing video...';
    }
  }

  /**
   * Estimate remaining time based on progress
   */
  private estimateRemainingTime(progress: number): number {
    // Simple estimation based on typical merge times
    const totalEstimatedTime = 60; // 60 seconds total
    const remainingProgress = 100 - progress;
    return Math.max(5, (remainingProgress / 100) * totalEstimatedTime);
  }

  /**
   * Update Redux state with merge progress
   */
  private updateReduxState(mergeSessionId: string, progress: MergeProgress): void {
    if (!this.dispatch) return;

    try {
      this.dispatch(setMergeProgress({
        mergeSessionId,
        progress: progress.progress,
        stage: progress.stage,
        currentStep: progress.currentStep,
        estimatedTimeRemaining: progress.estimatedTimeRemaining
      }));

      if (progress.stage === 'failed' && progress.error) {
        this.dispatch(setMergeError({
          mergeSessionId,
          error: progress.error
        }));
      }

      if (progress.stage === 'completed') {
        this.dispatch(completeMerge({
          mergeSessionId
        }));
      }
    } catch (error) {
      console.error('Failed to update Redux state:', error);
    }
  }

  /**
   * Get current polling status
   */
  public isPolling(mergeSessionId: string): boolean {
    return this.activePolling.has(mergeSessionId);
  }

  /**
   * Get all active polling sessions
   */
  public getActivePolling(): string[] {
    return Array.from(this.activePolling.keys());
  }
}

// Export singleton instance
export const mergeStatusService = MergeStatusService.getInstance();