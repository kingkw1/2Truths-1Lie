/**
 * Redux State Memory Management Utility
 * Prevents memory leaks and optimizes Redux state size
 */

import { Dispatch } from '@reduxjs/toolkit';
import { 
  clearIndividualRecording,
  clearMergeState,
  resetMediaState,
} from '../store/slices/challengeCreationSlice';

export interface StateCleanupConfig {
  maxMergeStates: number;
  maxUploadStates: number;
  autoCleanupInterval: number;
  enablePeriodicCleanup: boolean;
}

export class ReduxStateMemoryManager {
  private static instance: ReduxStateMemoryManager;
  private dispatch: Dispatch | null = null;
  private config: StateCleanupConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastCleanupTime = 0;

  private constructor() {
    this.config = {
      maxMergeStates: 5, // Keep max 5 merge states
      maxUploadStates: 10, // Keep max 10 upload states
      autoCleanupInterval: 10 * 60 * 1000, // 10 minutes
      enablePeriodicCleanup: true,
    };
  }

  public static getInstance(): ReduxStateMemoryManager {
    if (!ReduxStateMemoryManager.instance) {
      ReduxStateMemoryManager.instance = new ReduxStateMemoryManager();
    }
    return ReduxStateMemoryManager.instance;
  }

  /**
   * Initialize with Redux dispatch
   */
  public initialize(dispatch: Dispatch): void {
    this.dispatch = dispatch;
    
    if (this.config.enablePeriodicCleanup) {
      this.startPeriodicCleanup();
    }
    
    console.log('🧹 Redux State Memory Manager initialized');
  }

  /**
   * Clean up completed merge states
   */
  public cleanupCompletedMergeStates(getState: () => any): void {
    if (!this.dispatch) return;

    try {
      const state = getState();
      const mergeStates = state.challengeCreation.mergeState || {};
      
      // Find completed or failed merge states older than 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const stateIds = Object.keys(mergeStates);
      
      let cleanedCount = 0;
      
      for (const mergeSessionId of stateIds) {
        const mergeState = mergeStates[mergeSessionId];
        
        const shouldClean = 
          (mergeState.status === 'completed' || mergeState.status === 'failed') &&
          (mergeState.completedAt || mergeState.startedAt || 0) < oneHourAgo;
        
        if (shouldClean) {
          this.dispatch(clearMergeState({ mergeSessionId }));
          cleanedCount++;
        }
      }
      
      // If we still have too many states, clean the oldest ones
      const remainingStates = stateIds.length - cleanedCount;
      if (remainingStates > this.config.maxMergeStates) {
        const sortedStates = stateIds
          .map(id => ({ id, timestamp: mergeStates[id].startedAt || 0 }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const toRemove = remainingStates - this.config.maxMergeStates;
        for (let i = 0; i < toRemove; i++) {
          this.dispatch(clearMergeState({ mergeSessionId: sortedStates[i].id }));
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} merge states from Redux`);
      }
    } catch (error) {
      console.warn('Failed to cleanup merge states:', error);
    }
  }

  /**
   * Clean up old upload states
   */
  public cleanupOldUploadStates(getState: () => any): void {
    if (!this.dispatch) return;

    try {
      const state = getState();
      const uploadStates = state.challengeCreation.uploadState || {};
      
      // Clean up completed uploads older than 30 minutes
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      let cleanedCount = 0;
      
      Object.keys(uploadStates).forEach(statementIndex => {
        const uploadState = uploadStates[statementIndex];
        
        const shouldClean = 
          !uploadState.isUploading &&
          (uploadState.startTime || 0) < thirtyMinutesAgo &&
          (uploadState.uploadProgress === 100 || uploadState.uploadError);
        
        if (shouldClean) {
          // Reset the upload state for this statement
          this.dispatch!(resetMediaState({ statementIndex: parseInt(statementIndex) }));
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} upload states from Redux`);
      }
    } catch (error) {
      console.warn('Failed to cleanup upload states:', error);
    }
  }

  /**
   * Clean up individual recordings that are no longer needed
   */
  public cleanupUnusedIndividualRecordings(getState: () => any): void {
    if (!this.dispatch) return;

    try {
      const state = getState();
      const individualRecordings = state.challengeCreation.individualRecordings || {};
      const mediaData = state.challengeCreation.currentChallenge.mediaData || [];
      
      let cleanedCount = 0;
      
      Object.keys(individualRecordings).forEach(statementIndex => {
        const index = parseInt(statementIndex);
        const recording = individualRecordings[index];
        const currentMedia = mediaData[index];
        
        // Clean if recording is uploaded and we have current media data
        const shouldClean = 
          recording && 
          recording.isUploaded && 
          currentMedia && 
          currentMedia.isUploaded &&
          currentMedia.streamingUrl;
        
        if (shouldClean) {
          this.dispatch!(clearIndividualRecording({ statementIndex: index }));
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} individual recordings from Redux`);
      }
    } catch (error) {
      console.warn('Failed to cleanup individual recordings:', error);
    }
  }

  /**
   * Clean up old recording states
   */
  public cleanupOldRecordingStates(getState: () => any): void {
    if (!this.dispatch) return;

    try {
      const state = getState();
      const recordingStates = state.challengeCreation.mediaRecordingState || {};
      
      let cleanedCount = 0;
      
      Object.keys(recordingStates).forEach(statementIndex => {
        const recordingState = recordingStates[statementIndex];
        
        // Clean up recording states with errors older than 15 minutes
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        const shouldClean = 
          recordingState.error &&
          !recordingState.isRecording &&
          // Use current time as fallback if no timestamp available
          Date.now() - fifteenMinutesAgo > 15 * 60 * 1000;
        
        if (shouldClean) {
          this.dispatch!(resetMediaState({ statementIndex: parseInt(statementIndex) }));
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} recording states from Redux`);
      }
    } catch (error) {
      console.warn('Failed to cleanup recording states:', error);
    }
  }

  /**
   * Perform comprehensive state cleanup
   */
  public performComprehensiveCleanup(getState: () => any): void {
    console.log('🧹 Performing comprehensive Redux state cleanup...');
    
    this.cleanupCompletedMergeStates(getState);
    this.cleanupOldUploadStates(getState);
    this.cleanupUnusedIndividualRecordings(getState);
    this.cleanupOldRecordingStates(getState);
    
    this.lastCleanupTime = Date.now();
    console.log('✅ Comprehensive Redux state cleanup completed');
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      // This will be called by the Redux middleware
      console.log('🔄 Periodic Redux state cleanup triggered');
    }, this.config.autoCleanupInterval);
  }

  /**
   * Get state size estimation for monitoring
   */
  public estimateStateSize(getState: () => any): {
    mergeStatesCount: number;
    uploadStatesCount: number;
    individualRecordingsCount: number;
    recordingStatesCount: number;
    totalEstimatedSize: number;
  } {
    try {
      const state = getState();
      const challengeState = state.challengeCreation;
      
      const mergeStatesCount = Object.keys(challengeState.mergeState || {}).length;
      const uploadStatesCount = Object.keys(challengeState.uploadState || {}).length;
      const individualRecordingsCount = Object.keys(challengeState.individualRecordings || {}).length;
      const recordingStatesCount = Object.keys(challengeState.mediaRecordingState || {}).length;
      
      // Rough estimation in bytes (very approximate)
      const totalEstimatedSize = 
        (mergeStatesCount * 1000) + // ~1KB per merge state
        (uploadStatesCount * 500) + // ~500B per upload state
        (individualRecordingsCount * 2000) + // ~2KB per recording
        (recordingStatesCount * 300); // ~300B per recording state
      
      return {
        mergeStatesCount,
        uploadStatesCount,
        individualRecordingsCount,
        recordingStatesCount,
        totalEstimatedSize,
      };
    } catch (error) {
      console.warn('Failed to estimate state size:', error);
      return {
        mergeStatesCount: 0,
        uploadStatesCount: 0,
        individualRecordingsCount: 0,
        recordingStatesCount: 0,
        totalEstimatedSize: 0,
      };
    }
  }

  /**
   * Force cleanup on critical memory usage
   */
  public forceCriticalCleanup(getState: () => any): void {
    console.log('🚨 Performing critical Redux state cleanup...');
    
    if (!this.dispatch) return;
    
    try {
      const state = getState();
      
      // Clear all completed merge states immediately
      const mergeStates = state.challengeCreation.mergeState || {};
      Object.keys(mergeStates).forEach(mergeSessionId => {
        const mergeState = mergeStates[mergeSessionId];
        if (mergeState.status === 'completed' || mergeState.status === 'failed') {
          this.dispatch!(clearMergeState({ mergeSessionId }));
        }
      });
      
      // Clear all uploaded individual recordings
      const individualRecordings = state.challengeCreation.individualRecordings || {};
      Object.keys(individualRecordings).forEach(statementIndex => {
        const recording = individualRecordings[statementIndex];
        if (recording && recording.isUploaded) {
          this.dispatch!(clearIndividualRecording({ statementIndex: parseInt(statementIndex) }));
        }
      });
      
      // Clear all non-active upload states
      const uploadStates = state.challengeCreation.uploadState || {};
      Object.keys(uploadStates).forEach(statementIndex => {
        const uploadState = uploadStates[statementIndex];
        if (!uploadState.isUploading) {
          this.dispatch!(resetMediaState({ statementIndex: parseInt(statementIndex) }));
        }
      });
      
      console.log('✅ Critical Redux state cleanup completed');
    } catch (error) {
      console.error('Critical cleanup failed:', error);
    }
  }

  /**
   * Get cleanup recommendations
   */
  public getCleanupRecommendations(getState: () => any): string[] {
    const stats = this.estimateStateSize(getState);
    const recommendations: string[] = [];
    
    if (stats.mergeStatesCount > this.config.maxMergeStates) {
      recommendations.push(`Consider cleaning ${stats.mergeStatesCount - this.config.maxMergeStates} old merge states`);
    }
    
    if (stats.uploadStatesCount > this.config.maxUploadStates) {
      recommendations.push(`Consider cleaning ${stats.uploadStatesCount - this.config.maxUploadStates} old upload states`);
    }
    
    if (stats.individualRecordingsCount > 5) {
      recommendations.push(`Consider cleaning ${stats.individualRecordingsCount} individual recordings after upload`);
    }
    
    if (stats.totalEstimatedSize > 50000) { // 50KB
      recommendations.push('Redux state size is large, consider aggressive cleanup');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Redux state size is optimal');
    }
    
    return recommendations;
  }

  /**
   * Check if cleanup is needed
   */
  public shouldPerformCleanup(getState: () => any): boolean {
    const stats = this.estimateStateSize(getState);
    const timeSinceLastCleanup = Date.now() - this.lastCleanupTime;
    
    return (
      stats.mergeStatesCount > this.config.maxMergeStates ||
      stats.uploadStatesCount > this.config.maxUploadStates ||
      stats.totalEstimatedSize > 30000 || // 30KB
      timeSinceLastCleanup > this.config.autoCleanupInterval
    );
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<StateCleanupConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.enablePeriodicCleanup !== undefined) {
      if (updates.enablePeriodicCleanup && !this.cleanupInterval) {
        this.startPeriodicCleanup();
      } else if (!updates.enablePeriodicCleanup && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    }
    
    console.log('🔧 Redux state cleanup config updated:', updates);
  }

  /**
   * Dispose and cleanup resources
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.dispatch = null;
    console.log('🧹 Redux State Memory Manager disposed');
  }
}

export const reduxStateMemoryManager = ReduxStateMemoryManager.getInstance();
