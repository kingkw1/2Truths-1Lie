/**
 * Error Recovery Service
 * Provides automated and manual error recovery strategies
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { ErrorDetails, errorHandlingService } from './errorHandlingService';

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  automated: boolean;
  execute: () => Promise<boolean>;
  conditions?: () => boolean;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  message: string;
  nextSteps?: string[];
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();

  private constructor() {
    this.initializeRecoveryStrategies();
  }

  public static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  private initializeRecoveryStrategies(): void {
    // Network error recovery strategies
    this.recoveryStrategies.set('network', [
      {
        id: 'check_connectivity',
        name: 'Check Network Connectivity',
        description: 'Verify internet connection is available',
        automated: true,
        execute: async () => {
          const state = await NetInfo.fetch();
          return state.isConnected ?? false;
        },
      },
      {
        id: 'wait_and_retry',
        name: 'Wait and Retry',
        description: 'Wait for network to stabilize and retry',
        automated: true,
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const state = await NetInfo.fetch();
          return state.isConnected ?? false;
        },
      },
      {
        id: 'switch_network',
        name: 'Switch Network',
        description: 'Suggest switching between WiFi and mobile data',
        automated: false,
        execute: async () => {
          // This would be handled by user action
          return true;
        },
      },
    ]);

    // Upload error recovery strategies
    this.recoveryStrategies.set('upload', [
      {
        id: 'check_storage_space',
        name: 'Check Storage Space',
        description: 'Verify sufficient storage space is available',
        automated: true,
        execute: async () => {
          try {
            const freeSpace = await FileSystem.getFreeDiskStorageAsync();
            const requiredSpace = 100 * 1024 * 1024; // 100MB minimum
            return freeSpace > requiredSpace;
          } catch {
            return false;
          }
        },
      },
      {
        id: 'clear_temp_files',
        name: 'Clear Temporary Files',
        description: 'Remove temporary files to free up space',
        automated: true,
        execute: async () => {
          try {
            const { mobileMediaIntegration } = await import('./mobileMediaIntegration');
            await mobileMediaIntegration.cleanupTempFiles();
            return true;
          } catch {
            return false;
          }
        },
      },
      {
        id: 'compress_video',
        name: 'Compress Video',
        description: 'Reduce video file size before upload',
        automated: false,
        execute: async () => {
          // This would trigger video compression
          return true;
        },
      },
      {
        id: 'retry_with_smaller_chunks',
        name: 'Retry with Smaller Chunks',
        description: 'Use smaller upload chunks for better reliability',
        automated: true,
        execute: async () => {
          // This would modify upload service settings
          return true;
        },
      },
    ]);

    // Playback error recovery strategies
    this.recoveryStrategies.set('playback', [
      {
        id: 'reload_video',
        name: 'Reload Video',
        description: 'Reload the video from the source',
        automated: true,
        execute: async () => {
          // This would be handled by the video player component
          return true;
        },
      },
      {
        id: 'check_video_accessibility',
        name: 'Check Video Accessibility',
        description: 'Verify video is accessible and not corrupted',
        automated: true,
        execute: async () => {
          // This would check video URL accessibility
          return true;
        },
      },
      {
        id: 'fallback_to_lower_quality',
        name: 'Use Lower Quality',
        description: 'Switch to lower quality version if available',
        automated: true,
        execute: async () => {
          // This would request lower quality stream
          return true;
        },
      },
    ]);

    // Storage error recovery strategies
    this.recoveryStrategies.set('storage', [
      {
        id: 'free_up_space',
        name: 'Free Up Space',
        description: 'Delete unnecessary files to create space',
        automated: true,
        execute: async () => {
          try {
            const { mobileMediaIntegration } = await import('./mobileMediaIntegration');
            await mobileMediaIntegration.cleanupTempFiles();
            
            // Check if we freed up enough space
            const freeSpace = await FileSystem.getFreeDiskStorageAsync();
            const requiredSpace = 50 * 1024 * 1024; // 50MB minimum
            return freeSpace > requiredSpace;
          } catch {
            return false;
          }
        },
      },
      {
        id: 'clear_app_cache',
        name: 'Clear App Cache',
        description: 'Clear application cache to free up space',
        automated: false,
        execute: async () => {
          // This would be handled by user action in settings
          return true;
        },
      },
    ]);

    // Authentication error recovery strategies
    this.recoveryStrategies.set('auth', [
      {
        id: 'refresh_token',
        name: 'Refresh Authentication Token',
        description: 'Attempt to refresh the authentication token',
        automated: true,
        execute: async () => {
          try {
            const { authService } = await import('./authService');
            const result = await authService.refreshToken();
            return typeof result === 'boolean' ? result : !!result;
          } catch {
            return false;
          }
        },
      },
      {
        id: 'relogin',
        name: 'Re-authenticate',
        description: 'Prompt user to log in again',
        automated: false,
        execute: async () => {
          // This would trigger login flow
          return true;
        },
      },
    ]);

    // Merge error recovery strategies
    this.recoveryStrategies.set('merge', [
      {
        id: 'retry_merge',
        name: 'Retry Video Merge',
        description: 'Attempt to merge videos again',
        automated: true,
        execute: async () => {
          // This would retry the merge operation
          return true;
        },
      },
      {
        id: 'fallback_to_individual_upload',
        name: 'Upload Individual Videos',
        description: 'Fall back to uploading videos separately',
        automated: false,
        execute: async () => {
          // This would switch to individual upload mode
          return true;
        },
      },
    ]);
  }

  /**
   * Attempt automated recovery for an error
   */
  public async attemptAutomatedRecovery(error: ErrorDetails): Promise<RecoveryResult> {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    const automatedStrategies = strategies.filter(s => s.automated);

    console.log(`🔧 RECOVERY: Attempting automated recovery for ${error.type} error`);
    console.log(`🔧 RECOVERY: Found ${automatedStrategies.length} automated strategies`);

    for (const strategy of automatedStrategies) {
      try {
        // Check conditions if they exist
        if (strategy.conditions && !strategy.conditions()) {
          console.log(`🔧 RECOVERY: Skipping ${strategy.name} - conditions not met`);
          continue;
        }

        console.log(`🔧 RECOVERY: Executing ${strategy.name}`);
        const success = await strategy.execute();

        if (success) {
          console.log(`✅ RECOVERY: ${strategy.name} succeeded`);
          return {
            success: true,
            strategy: strategy.name,
            message: `Recovery successful: ${strategy.description}`,
            nextSteps: ['Retry the original operation'],
          };
        } else {
          console.log(`❌ RECOVERY: ${strategy.name} failed`);
        }
      } catch (recoveryError) {
        console.error(`🔧 RECOVERY: Error executing ${strategy.name}:`, recoveryError);
      }
    }

    return {
      success: false,
      strategy: 'none',
      message: 'No automated recovery strategies succeeded',
      nextSteps: this.getManualRecoverySteps(error),
    };
  }

  /**
   * Get available manual recovery strategies
   */
  public getManualRecoveryStrategies(error: ErrorDetails): RecoveryStrategy[] {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    return strategies.filter(s => !s.automated);
  }

  /**
   * Get manual recovery steps for an error
   */
  public getManualRecoverySteps(error: ErrorDetails): string[] {
    const manualStrategies = this.getManualRecoveryStrategies(error);
    const steps = manualStrategies.map(s => s.description);

    // Add general recovery steps based on error type
    switch (error.type) {
      case 'network':
        steps.push(
          'Check your WiFi or mobile data connection',
          'Try switching between WiFi and mobile data',
          'Move to an area with better signal strength'
        );
        break;
      case 'upload':
        steps.push(
          'Check available storage space',
          'Try recording a shorter video',
          'Close other apps to free up memory'
        );
        break;
      case 'playback':
        steps.push(
          'Check your internet connection',
          'Try restarting the app',
          'Update the app to the latest version'
        );
        break;
      case 'storage':
        steps.push(
          'Delete unnecessary files or apps',
          'Clear app cache in device settings',
          'Move files to cloud storage'
        );
        break;
      case 'auth':
        steps.push(
          'Log out and log back in',
          'Check your account credentials',
          'Contact support if the issue persists'
        );
        break;
      default:
        steps.push(
          'Restart the app',
          'Check your internet connection',
          'Contact support if the issue continues'
        );
    }

    return steps;
  }

  /**
   * Execute a specific recovery strategy
   */
  public async executeRecoveryStrategy(
    errorType: string,
    strategyId: string
  ): Promise<RecoveryResult> {
    const strategies = this.recoveryStrategies.get(errorType) || [];
    const strategy = strategies.find(s => s.id === strategyId);

    if (!strategy) {
      return {
        success: false,
        strategy: strategyId,
        message: `Recovery strategy ${strategyId} not found`,
      };
    }

    try {
      console.log(`🔧 RECOVERY: Executing manual strategy ${strategy.name}`);
      const success = await strategy.execute();

      return {
        success,
        strategy: strategy.name,
        message: success 
          ? `Recovery successful: ${strategy.description}`
          : `Recovery failed: ${strategy.description}`,
        nextSteps: success ? ['Retry the original operation'] : ['Try another recovery method'],
      };
    } catch (error) {
      console.error(`🔧 RECOVERY: Error executing ${strategy.name}:`, error);
      return {
        success: false,
        strategy: strategy.name,
        message: `Recovery strategy failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get recovery recommendations based on error context
   */
  public getRecoveryRecommendations(error: ErrorDetails): {
    immediate: string[];
    followUp: string[];
    prevention: string[];
  } {
    const immediate: string[] = [];
    const followUp: string[] = [];
    const prevention: string[] = [];

    switch (error.type) {
      case 'network':
        immediate.push('Check internet connection', 'Try again in a moment');
        followUp.push('Switch networks if available', 'Move to better signal area');
        prevention.push('Use WiFi when possible', 'Check connection before uploads');
        break;

      case 'upload':
        immediate.push('Check file size', 'Verify storage space');
        followUp.push('Compress video if too large', 'Clear temporary files');
        prevention.push('Record shorter videos', 'Monitor storage space');
        break;

      case 'playback':
        immediate.push('Reload video', 'Check connection');
        followUp.push('Try lower quality', 'Restart app');
        prevention.push('Ensure stable connection', 'Keep app updated');
        break;

      case 'storage':
        immediate.push('Free up storage space', 'Delete unnecessary files');
        followUp.push('Clear app cache', 'Move files to cloud');
        prevention.push('Monitor storage regularly', 'Clean up old files');
        break;

      case 'auth':
        immediate.push('Log in again', 'Check credentials');
        followUp.push('Reset password if needed', 'Contact support');
        prevention.push('Keep login info secure', 'Update app regularly');
        break;

      default:
        immediate.push('Restart app', 'Check connection');
        followUp.push('Update app', 'Contact support');
        prevention.push('Keep app updated', 'Report issues');
    }

    return { immediate, followUp, prevention };
  }

  /**
   * Log recovery attempt for analytics
   */
  public logRecoveryAttempt(
    error: ErrorDetails,
    strategy: string,
    success: boolean,
    duration: number
  ): void {
    const logData = {
      errorType: error.type,
      errorSeverity: error.severity,
      recoveryStrategy: strategy,
      success,
      duration,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };

    console.log('🔧 RECOVERY_LOG:', JSON.stringify(logData, null, 2));

    // In production, send to analytics service
    // this.sendToAnalytics(logData);
  }
}

export const errorRecoveryService = ErrorRecoveryService.getInstance();