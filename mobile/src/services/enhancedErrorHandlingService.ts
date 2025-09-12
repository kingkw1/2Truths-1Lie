/**
 * Enhanced Error Handling Service
 * Comprehensive error handling improvements for video recording, uploading, and playback
 */

import { Platform, Alert, Vibration } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorDetails {
  type: 'network' | 'server' | 'auth' | 'timeout' | 'validation' | 'upload' | 'playback' | 'recording' | 'storage' | 'hardware' | 'permission' | 'unknown';
  message: string;
  userMessage: string;
  retryable: boolean;
  retryDelay?: number;
  originalError?: any;
  context?: string;
  timestamp?: Date;
  errorCode?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryActions?: string[];
  component?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  deviceInfo?: any;
  networkInfo?: any;
  storageInfo?: any;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => Promise<void> | void;
  primary?: boolean;
  destructive?: boolean;
  type: 'retry' | 'restart' | 'cancel' | 'settings' | 'custom';
}

export interface ErrorContext {
  operation: 'upload' | 'playback' | 'recording' | 'merge' | 'auth' | 'network' | 'general';
  component?: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorMetrics {
  errorCount: number;
  recoverySuccessRate: number;
  mostCommonErrors: Array<{ type: string; count: number }>;
  lastUpdated: Date;
}

export class EnhancedErrorHandlingService {
  private static instance: EnhancedErrorHandlingService;
  private isOnline: boolean = true;
  private errorHistory: ErrorDetails[] = [];
  private metrics: ErrorMetrics = {
    errorCount: 0,
    recoverySuccessRate: 0,
    mostCommonErrors: [],
    lastUpdated: new Date(),
  };

  private constructor() {
    this.initializeNetworkListener();
    this.loadErrorHistory();
  }

  public static getInstance(): EnhancedErrorHandlingService {
    if (!EnhancedErrorHandlingService.instance) {
      EnhancedErrorHandlingService.instance = new EnhancedErrorHandlingService();
    }
    return EnhancedErrorHandlingService.instance;
  }

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  private async loadErrorHistory(): Promise<void> {
    try {
      const history = await AsyncStorage.getItem('errorHistory');
      if (history) {
        this.errorHistory = JSON.parse(history);
      }
    } catch (error) {
      console.warn('Failed to load error history:', error);
    }
  }

  private async saveErrorHistory(): Promise<void> {
    try {
      // Keep only last 100 errors to prevent storage bloat
      const recentHistory = this.errorHistory.slice(-100);
      await AsyncStorage.setItem('errorHistory', JSON.stringify(recentHistory));
    } catch (error) {
      console.warn('Failed to save error history:', error);
    }
  }

  public async checkNetworkStatus(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;
      return this.isOnline;
    } catch (error) {
      console.warn('Failed to check network status:', error);
      return false;
    }
  }

  public async checkStorageStatus(): Promise<{
    freeSpace: number;
    totalSpace: number;
    isLowStorage: boolean;
    canRecord: boolean;
  }> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const isLowStorage = freeSpace < 500 * 1024 * 1024; // Less than 500MB
      const canRecord = freeSpace > 100 * 1024 * 1024; // At least 100MB for recording

      return {
        freeSpace,
        totalSpace,
        isLowStorage,
        canRecord,
      };
    } catch (error) {
      console.warn('Failed to check storage status:', error);
      return {
        freeSpace: 0,
        totalSpace: 0,
        isLowStorage: true,
        canRecord: false,
      };
    }
  }

  public async categorizeError(error: any, context?: ErrorContext): Promise<ErrorDetails> {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const lowerMessage = errorMessage.toLowerCase();
    const timestamp = new Date();

    // Gather additional context
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
    };

    const networkInfo = await this.getNetworkInfo();
    const storageInfo = await this.checkStorageStatus();

    // Enhanced error categorization
    let errorDetails: ErrorDetails = {
      type: 'unknown',
      message: errorMessage,
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: false,
      originalError: error,
      context: context?.operation,
      timestamp,
      severity: 'medium',
      component: context?.component,
      operation: context?.operation,
      userId: context?.userId,
      sessionId: context?.sessionId,
      deviceInfo,
      networkInfo,
      storageInfo,
    };

    // Network errors
    if (!this.isOnline || 
        lowerMessage.includes('network request failed') || 
        lowerMessage.includes('no internet') || 
        lowerMessage.includes('connection failed') ||
        lowerMessage.includes('fetch failed') || 
        lowerMessage.includes('network error') ||
        lowerMessage.includes('timeout')) {
      errorDetails = {
        ...errorDetails,
        type: 'network',
        userMessage: this.getNetworkErrorMessage(networkInfo),
        retryable: true,
        retryDelay: 2000,
        severity: 'medium',
        recoveryActions: ['Check internet connection', 'Switch network', 'Try again later'],
      };
    }

    // Recording-specific errors
    else if (context?.operation === 'recording' || lowerMessage.includes('camera') || lowerMessage.includes('recording')) {
      errorDetails = {
        ...errorDetails,
        ...this.categorizeRecordingError(errorMessage, storageInfo),
      };
    }

    // Upload-specific errors
    else if (context?.operation === 'upload' || lowerMessage.includes('upload')) {
      errorDetails = {
        ...errorDetails,
        ...this.categorizeUploadError(errorMessage, storageInfo),
      };
    }

    // Playback-specific errors
    else if (context?.operation === 'playback' || lowerMessage.includes('video') || lowerMessage.includes('playback')) {
      errorDetails = {
        ...errorDetails,
        ...this.categorizePlaybackError(errorMessage, networkInfo),
      };
    }

    // Permission errors
    else if (lowerMessage.includes('permission') || lowerMessage.includes('denied') || lowerMessage.includes('unauthorized')) {
      errorDetails = {
        ...errorDetails,
        type: 'permission',
        userMessage: 'Permission denied. Please check your app permissions and try again.',
        retryable: true,
        severity: 'high',
        recoveryActions: ['Open app settings', 'Grant permissions', 'Restart app'],
      };
    }

    // Storage errors
    else if (lowerMessage.includes('storage') || lowerMessage.includes('space') || storageInfo.isLowStorage) {
      errorDetails = {
        ...errorDetails,
        type: 'storage',
        userMessage: `Insufficient storage space. You have ${Math.round(storageInfo.freeSpace / (1024 * 1024 * 1024) * 10) / 10}GB available.`,
        retryable: false,
        severity: 'high',
        recoveryActions: ['Free up storage space', 'Delete old files', 'Clear app cache'],
      };
    }

    // Log and track the error
    this.logError(errorDetails);
    await this.trackErrorMetrics(errorDetails);

    return errorDetails;
  }

  private categorizeRecordingError(message: string, storageInfo: any) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('permission') || lowerMessage.includes('denied')) {
      return {
        type: 'permission' as const,
        userMessage: 'Camera permission is required to record videos. Please grant permission in your device settings.',
        retryable: true,
        severity: 'high' as const,
        recoveryActions: ['Open settings', 'Grant camera permission', 'Restart app'],
      };
    }

    if (lowerMessage.includes('camera unavailable') || lowerMessage.includes('hardware')) {
      return {
        type: 'hardware' as const,
        userMessage: 'Camera is currently unavailable. Please close other camera apps and try again.',
        retryable: true,
        severity: 'medium' as const,
        recoveryActions: ['Close other camera apps', 'Restart device', 'Try again'],
      };
    }

    if (lowerMessage.includes('storage') || lowerMessage.includes('space') || !storageInfo.canRecord) {
      return {
        type: 'storage' as const,
        userMessage: `Not enough storage space to record. You need at least 100MB free space.`,
        retryable: false,
        severity: 'high' as const,
        recoveryActions: ['Free up storage space', 'Delete old videos', 'Record shorter clips'],
      };
    }

    if (lowerMessage.includes('interrupted') || lowerMessage.includes('background')) {
      return {
        type: 'recording' as const,
        userMessage: 'Recording was interrupted. Please stay in the app while recording.',
        retryable: true,
        severity: 'medium' as const,
        recoveryActions: ['Record again', 'Keep app in foreground', 'Check battery saver settings'],
      };
    }

    return {
      type: 'recording' as const,
      userMessage: 'Recording failed. Please try again.',
      retryable: true,
      severity: 'medium' as const,
      recoveryActions: ['Try recording again', 'Restart the app', 'Check camera settings'],
    };
  }

  private categorizeUploadError(message: string, storageInfo: any) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('file too large') || lowerMessage.includes('size limit')) {
      return {
        type: 'validation' as const,
        userMessage: 'Video file is too large. Please record a shorter video or compress the current one.',
        retryable: false,
        severity: 'medium' as const,
        recoveryActions: ['Record shorter video', 'Compress video', 'Try different quality'],
      };
    }

    if (lowerMessage.includes('unsupported format') || lowerMessage.includes('codec')) {
      return {
        type: 'validation' as const,
        userMessage: 'Video format is not supported. Please try recording again.',
        retryable: false,
        severity: 'medium' as const,
        recoveryActions: ['Record new video', 'Check video format', 'Try different settings'],
      };
    }

    if (lowerMessage.includes('server error') || lowerMessage.includes('500') || lowerMessage.includes('503')) {
      return {
        type: 'server' as const,
        userMessage: 'Server is temporarily unavailable. Please try again in a few moments.',
        retryable: true,
        retryDelay: 5000,
        severity: 'medium' as const,
        recoveryActions: ['Wait and try again', 'Check server status', 'Try again later'],
      };
    }

    return {
      type: 'upload' as const,
      userMessage: 'Upload failed. Please check your connection and try again.',
      retryable: true,
      severity: 'medium' as const,
      recoveryActions: ['Check internet connection', 'Try again', 'Save for later'],
    };
  }

  private categorizePlaybackError(message: string, networkInfo: any) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return {
        type: 'playback' as const,
        userMessage: 'Video not found. It may have been deleted or moved.',
        retryable: false,
        severity: 'medium' as const,
        recoveryActions: ['Refresh video list', 'Check original source', 'Contact support'],
      };
    }

    if (lowerMessage.includes('codec') || lowerMessage.includes('format not supported')) {
      return {
        type: 'playback' as const,
        userMessage: 'Video format is not supported on this device.',
        retryable: false,
        severity: 'medium' as const,
        recoveryActions: ['Try different video', 'Update app', 'Check device compatibility'],
      };
    }

    if (lowerMessage.includes('buffering') || lowerMessage.includes('loading') || !networkInfo.isConnected) {
      return {
        type: 'network' as const,
        userMessage: 'Video is having trouble loading. Check your internet connection.',
        retryable: true,
        retryDelay: 3000,
        severity: 'medium' as const,
        recoveryActions: ['Check internet connection', 'Wait for better signal', 'Try lower quality'],
      };
    }

    return {
      type: 'playback' as const,
      userMessage: 'Video playback failed. Please try again.',
      retryable: true,
      severity: 'medium' as const,
      recoveryActions: ['Reload video', 'Restart app', 'Check video source'],
    };
  }

  private getNetworkErrorMessage(networkInfo: any): string {
    if (!networkInfo.isConnected) {
      return 'No internet connection. Please check your network settings and try again.';
    }
    
    if (networkInfo.type === 'cellular' && networkInfo.isInternetReachable === false) {
      return 'Poor cellular connection. Try connecting to Wi-Fi or move to an area with better signal.';
    }
    
    if (networkInfo.type === 'wifi' && networkInfo.isInternetReachable === false) {
      return 'Wi-Fi is connected but no internet access. Please check your Wi-Fi connection.';
    }
    
    return 'Network connection is unstable. Please check your internet connection and try again.';
  }

  private async getNetworkInfo(): Promise<any> {
    try {
      const state = await NetInfo.fetch();
      return {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
        details: state.details,
      };
    } catch (error) {
      return {
        isConnected: false,
        type: 'unknown',
        isInternetReachable: false,
      };
    }
  }

  public logError(errorDetails: ErrorDetails, context?: string): void {
    console.error('🚨 ENHANCED_ERROR:', {
      type: errorDetails.type,
      message: errorDetails.message,
      context: context || errorDetails.context,
      component: errorDetails.component,
      operation: errorDetails.operation,
      severity: errorDetails.severity,
      retryable: errorDetails.retryable,
      timestamp: errorDetails.timestamp,
      deviceInfo: errorDetails.deviceInfo,
      networkInfo: errorDetails.networkInfo,
      storageInfo: errorDetails.storageInfo,
    });

    // Add to error history
    this.errorHistory.push(errorDetails);
    this.saveErrorHistory();
  }

  private async trackErrorMetrics(errorDetails: ErrorDetails): Promise<void> {
    this.metrics.errorCount++;
    
    // Update most common errors
    const existingError = this.metrics.mostCommonErrors.find(e => e.type === errorDetails.type);
    if (existingError) {
      existingError.count++;
    } else {
      this.metrics.mostCommonErrors.push({ type: errorDetails.type, count: 1 });
    }
    
    // Sort and keep only top 10
    this.metrics.mostCommonErrors.sort((a, b) => b.count - a.count);
    this.metrics.mostCommonErrors = this.metrics.mostCommonErrors.slice(0, 10);
    
    this.metrics.lastUpdated = new Date();

    // Save metrics
    try {
      await AsyncStorage.setItem('errorMetrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to save error metrics:', error);
    }
  }

  public async trackRecoverySuccess(errorType: string): Promise<void> {
    // Track successful recoveries for metrics
    const totalErrors = this.errorHistory.filter(e => e.type === errorType).length;
    const recoveryKey = `recovery_${errorType}`;
    
    try {
      const currentRecoveries = await AsyncStorage.getItem(recoveryKey);
      const recoveries = currentRecoveries ? parseInt(currentRecoveries) : 0;
      await AsyncStorage.setItem(recoveryKey, (recoveries + 1).toString());
      
      // Update global success rate
      if (totalErrors > 0) {
        this.metrics.recoverySuccessRate = ((recoveries + 1) / totalErrors) * 100;
      }
    } catch (error) {
      console.warn('Failed to track recovery success:', error);
    }
  }

  public shouldNotifyUser(errorDetails: ErrorDetails): boolean {
    // Don't notify for low severity errors unless they're critical operations
    if (errorDetails.severity === 'low' && errorDetails.type !== 'recording') {
      return false;
    }

    // Always notify for critical errors
    if (errorDetails.severity === 'critical') {
      return true;
    }

    // For medium/high severity, check if it's a recurring error
    const recentSimilarErrors = this.errorHistory
      .filter(e => e.type === errorDetails.type && 
               e.timestamp && 
               (Date.now() - e.timestamp.getTime()) < 300000) // Last 5 minutes
      .length;

    // Don't spam user with repeated notifications
    return recentSimilarErrors < 3;
  }

  public formatErrorForUser(errorDetails: ErrorDetails): string {
    let message = errorDetails.userMessage;

    // Add contextual information for better user experience
    if (errorDetails.storageInfo && errorDetails.type === 'storage') {
      const freeSpaceGB = Math.round(errorDetails.storageInfo.freeSpace / (1024 * 1024 * 1024) * 10) / 10;
      message += `\n\nAvailable space: ${freeSpaceGB}GB`;
    }

    if (errorDetails.networkInfo && errorDetails.type === 'network') {
      message += `\n\nConnection: ${errorDetails.networkInfo.type || 'Unknown'}`;
    }

    return message;
  }

  public getErrorTitle(errorDetails: ErrorDetails): string {
    switch (errorDetails.type) {
      case 'recording':
        return 'Recording Error';
      case 'upload':
        return 'Upload Failed';
      case 'playback':
        return 'Playback Error';
      case 'network':
        return 'Connection Problem';
      case 'storage':
        return 'Storage Full';
      case 'permission':
        return 'Permission Required';
      case 'hardware':
        return 'Camera Unavailable';
      default:
        return 'Error';
    }
  }

  public getRecoveryActions(errorDetails: ErrorDetails): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    // Add common recovery actions based on error type
    if (errorDetails.retryable) {
      actions.push({
        label: 'Try Again',
        action: async () => {
          // This will be overridden by the calling component
        },
        primary: true,
        type: 'retry',
      });
    }

    // Add specific actions based on error type
    switch (errorDetails.type) {
      case 'permission':
        actions.push({
          label: 'Open Settings',
          action: async () => {
            // This should be implemented in the component
          },
          type: 'settings',
        });
        break;

      case 'storage':
        actions.push({
          label: 'Free Up Space',
          action: async () => {
            // This should be implemented in the component
          },
          type: 'custom',
        });
        break;

      case 'network':
        actions.push({
          label: 'Check Connection',
          action: async () => {
            await this.checkNetworkStatus();
          },
          type: 'custom',
        });
        break;

      case 'hardware':
        actions.push({
          label: 'Restart App',
          action: async () => {
            // This should be implemented in the component
          },
          type: 'restart',
        });
        break;
    }

    return actions;
  }

  public async provideFeedback(errorDetails: ErrorDetails, type: 'haptic' | 'visual' | 'both' = 'both'): Promise<void> {
    if (type === 'haptic' || type === 'both') {
      try {
        if (Platform.OS === 'ios') {
          switch (errorDetails.severity) {
            case 'critical':
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              break;
            case 'high':
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              break;
            default:
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } else {
          // Android vibration patterns
          switch (errorDetails.severity) {
            case 'critical':
              Vibration.vibrate([0, 200, 100, 200, 100, 200]);
              break;
            case 'high':
              Vibration.vibrate([0, 150, 50, 150]);
              break;
            default:
              Vibration.vibrate(100);
          }
        }
      } catch (error) {
        console.warn('Failed to provide haptic feedback:', error);
      }
    }
  }

  public getErrorMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  public getErrorHistory(limit: number = 50): ErrorDetails[] {
    return this.errorHistory.slice(-limit);
  }

  public clearErrorHistory(): void {
    this.errorHistory = [];
    this.saveErrorHistory();
  }
}

export const enhancedErrorHandlingService = EnhancedErrorHandlingService.getInstance();
