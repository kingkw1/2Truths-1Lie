/**
 * Memory Optimization Service
 * Manages memory usage during video recording, processing, and upload phases
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MemoryUsageStats {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  activeVideoFiles: number;
  tempFileSize: number;
  cacheSize: number;
}

interface FileCleanupConfig {
  maxTempFileAge: number; // milliseconds
  maxCacheSize: number; // bytes
  maxTempFiles: number; // count
  aggressiveCleanupThreshold: number; // memory percentage
}

export class MemoryOptimizationService {
  private static instance: MemoryOptimizationService;
  private config: FileCleanupConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryWarningThreshold = 0.85; // 85% memory usage
  private isLowMemoryDevice = false;

  private constructor() {
    this.config = {
      maxTempFileAge: 60 * 60 * 1000, // 1 hour
      maxCacheSize: 500 * 1024 * 1024, // 500MB
      maxTempFiles: 20,
      aggressiveCleanupThreshold: 0.80, // 80% memory usage
    };

    this.detectDeviceCapabilities();
    this.startPeriodicCleanup();
  }

  public static getInstance(): MemoryOptimizationService {
    if (!MemoryOptimizationService.instance) {
      MemoryOptimizationService.instance = new MemoryOptimizationService();
    }
    return MemoryOptimizationService.instance;
  }

  /**
   * Detect device memory capabilities and adjust config
   */
  private async detectDeviceCapabilities(): Promise<void> {
    try {
      // Check available storage space as proxy for device capabilities
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      
      // Consider devices with less than 2GB free space as low-memory
      this.isLowMemoryDevice = freeSpace < 2 * 1024 * 1024 * 1024;
      
      if (this.isLowMemoryDevice) {
        // More aggressive cleanup for low-memory devices
        this.config = {
          ...this.config,
          maxTempFileAge: 30 * 60 * 1000, // 30 minutes
          maxCacheSize: 200 * 1024 * 1024, // 200MB
          maxTempFiles: 10,
          aggressiveCleanupThreshold: 0.70, // 70% memory usage
        };
        this.memoryWarningThreshold = 0.75; // 75% for low-memory devices
      }

      console.log('📱 Memory optimization configured for', {
        isLowMemoryDevice: this.isLowMemoryDevice,
        freeSpace: Math.round(freeSpace / (1024 * 1024 * 1024) * 10) / 10 + 'GB',
        totalSpace: Math.round(totalSpace / (1024 * 1024 * 1024) * 10) / 10 + 'GB',
        config: this.config,
      });
    } catch (error) {
      console.warn('Failed to detect device capabilities:', error);
    }
  }

  /**
   * Start periodic cleanup process
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every 5 minutes, more frequent for low-memory devices
    const interval = this.isLowMemoryDevice ? 3 * 60 * 1000 : 5 * 60 * 1000;
    
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performPeriodicCleanup();
      } catch (error) {
        console.warn('Periodic cleanup failed:', error);
      }
    }, interval);
  }

  /**
   * Get current memory usage statistics
   */
  public async getMemoryStats(): Promise<MemoryUsageStats> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const usedSpace = totalSpace - freeSpace;

      // Count temp files and cache
      const tempFileStats = await this.getTempFileStats();
      const cacheSize = await this.getCacheSize();

      return {
        totalMemory: totalSpace,
        usedMemory: usedSpace,
        availableMemory: freeSpace,
        activeVideoFiles: tempFileStats.count,
        tempFileSize: tempFileStats.size,
        cacheSize,
      };
    } catch (error) {
      console.warn('Failed to get memory stats:', error);
      return {
        totalMemory: 0,
        usedMemory: 0,
        availableMemory: 0,
        activeVideoFiles: 0,
        tempFileSize: 0,
        cacheSize: 0,
      };
    }
  }

  /**
   * Check if memory usage is critical and cleanup is needed
   */
  public async checkMemoryPressure(): Promise<{
    isCritical: boolean;
    usagePercentage: number;
    recommendation: string;
  }> {
    const stats = await this.getMemoryStats();
    const usagePercentage = stats.usedMemory / stats.totalMemory;

    let recommendation = 'Normal operation';
    let isCritical = false;

    if (usagePercentage > this.config.aggressiveCleanupThreshold) {
      isCritical = true;
      recommendation = 'Aggressive cleanup recommended';
      await this.performAggressiveCleanup();
    } else if (usagePercentage > this.memoryWarningThreshold) {
      recommendation = 'Standard cleanup recommended';
      await this.performStandardCleanup();
    }

    return {
      isCritical,
      usagePercentage,
      recommendation,
    };
  }

  /**
   * Clean up temporary video files
   */
  public async cleanupTempVideoFiles(): Promise<{
    filesRemoved: number;
    spaceFreed: number;
  }> {
    let filesRemoved = 0;
    let spaceFreed = 0;

    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return { filesRemoved, spaceFreed };

      const files = await FileSystem.readDirectoryAsync(documentDir);
      const tempVideoFiles = files.filter(file => 
        file.startsWith('compressed_') ||
        file.startsWith('temp_recording_') ||
        file.startsWith('recording_') ||
        file.endsWith('.mov') ||
        file.endsWith('.mp4')
      );

      const now = Date.now();

      for (const file of tempVideoFiles) {
        try {
          const filePath = `${documentDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          if (fileInfo.exists) {
            const shouldDelete = fileInfo.modificationTime ? 
              (now - fileInfo.modificationTime) > this.config.maxTempFileAge :
              true; // Delete files without modification time

            if (shouldDelete) {
              const fileSize = 'size' in fileInfo ? fileInfo.size || 0 : 0;
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              filesRemoved++;
              spaceFreed += fileSize;
              console.log(`🗑️ Cleaned temp video file: ${file} (${Math.round(fileSize / 1024)}KB)`);
            }
          }
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${file}:`, error);
        }
      }

      console.log(`🧹 Temp video cleanup: ${filesRemoved} files, ${Math.round(spaceFreed / (1024 * 1024))}MB freed`);
    } catch (error) {
      console.warn('Failed to cleanup temp video files:', error);
    }

    return { filesRemoved, spaceFreed };
  }

  /**
   * Clean up old cache entries
   */
  public async cleanupOldCache(): Promise<{
    entriesRemoved: number;
    spaceFreed: number;
  }> {
    let entriesRemoved = 0;
    let spaceFreed = 0;

    try {
      // Clean up AsyncStorage cache entries
      const keys = await AsyncStorage.getAllKeys();
      const now = Date.now();

      for (const key of keys) {
        if (key.startsWith('media_cache_') || key.startsWith('upload_cache_')) {
          try {
            const value = await AsyncStorage.getItem(key);
            if (value) {
              const cached = JSON.parse(value);
              const age = now - (cached.timestamp || 0);
              
              // Remove cache entries older than 24 hours
              if (age > 24 * 60 * 60 * 1000) {
                await AsyncStorage.removeItem(key);
                entriesRemoved++;
                spaceFreed += value.length;
              }
            }
          } catch (error) {
            // Remove corrupted cache entries
            await AsyncStorage.removeItem(key);
            entriesRemoved++;
          }
        }
      }

      console.log(`🧹 Cache cleanup: ${entriesRemoved} entries removed`);
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }

    return { entriesRemoved, spaceFreed };
  }

  /**
   * Optimize video file for storage
   */
  public async optimizeVideoFile(
    inputUri: string,
    outputUri?: string,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{
    outputUri: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    try {
      const inputInfo = await FileSystem.getInfoAsync(inputUri);
      if (!inputInfo.exists) {
        throw new Error('Input video file not found');
      }

      const originalSize = 'size' in inputInfo ? inputInfo.size || 0 : 0;
      
      // For now, we'll copy the file as-is since video compression requires native modules
      // In a full implementation, this would use FFmpeg or similar
      const finalOutputUri = outputUri || `${FileSystem.documentDirectory!}optimized_${Date.now()}.mp4`;
      
      await FileSystem.copyAsync({
        from: inputUri,
        to: finalOutputUri,
      });

      const outputInfo = await FileSystem.getInfoAsync(finalOutputUri);
      const compressedSize = 'size' in outputInfo ? outputInfo.size || originalSize : originalSize;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      console.log(`📹 Video optimization: ${Math.round(originalSize / 1024)}KB → ${Math.round(compressedSize / 1024)}KB`);

      return {
        outputUri: finalOutputUri,
        originalSize,
        compressedSize,
        compressionRatio,
      };
    } catch (error) {
      console.error('Video optimization failed:', error);
      throw error;
    }
  }

  /**
   * Perform standard cleanup
   */
  private async performStandardCleanup(): Promise<void> {
    console.log('🧹 Performing standard memory cleanup...');
    
    const [tempCleanup, cacheCleanup] = await Promise.all([
      this.cleanupTempVideoFiles(),
      this.cleanupOldCache(),
    ]);

    console.log('✅ Standard cleanup completed:', {
      tempFiles: tempCleanup,
      cache: cacheCleanup,
    });
  }

  /**
   * Perform aggressive cleanup for low memory situations
   */
  private async performAggressiveCleanup(): Promise<void> {
    console.log('🚨 Performing aggressive memory cleanup...');

    // First, standard cleanup
    await this.performStandardCleanup();

    // Additional aggressive measures
    try {
      // Clean ALL temp files regardless of age
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const files = await FileSystem.readDirectoryAsync(documentDir);
        const allTempFiles = files.filter(file => 
          file.startsWith('temp_') || 
          file.startsWith('cache_') ||
          file.includes('_temp_')
        );

        for (const file of allTempFiles) {
          try {
            const filePath = `${documentDir}${file}`;
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            console.log(`🗑️ Aggressive cleanup: removed ${file}`);
          } catch (error) {
            console.warn(`Failed to remove ${file}:`, error);
          }
        }
      }

      // Clear all non-essential cache
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith('cache_') || 
        key.startsWith('temp_') ||
        key.includes('_cache')
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`🗑️ Aggressive cleanup: removed ${cacheKeys.length} cache entries`);
      }

    } catch (error) {
      console.warn('Aggressive cleanup failed:', error);
    }

    console.log('✅ Aggressive cleanup completed');
  }

  /**
   * Perform periodic cleanup
   */
  private async performPeriodicCleanup(): Promise<void> {
    console.log('🔄 Performing periodic cleanup...');
    
    const memoryCheck = await this.checkMemoryPressure();
    
    if (!memoryCheck.isCritical) {
      // Only clean old files during periodic cleanup if memory isn't critical
      const tempStats = await this.getTempFileStats();
      
      if (tempStats.count > this.config.maxTempFiles) {
        await this.cleanupTempVideoFiles();
      }
      
      if (tempStats.size > this.config.maxCacheSize) {
        await this.cleanupOldCache();
      }
    }
  }

  /**
   * Get temporary file statistics
   */
  private async getTempFileStats(): Promise<{ count: number; size: number }> {
    let count = 0;
    let size = 0;

    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return { count, size };

      const files = await FileSystem.readDirectoryAsync(documentDir);
      const tempFiles = files.filter(file => 
        file.startsWith('temp_') || 
        file.startsWith('compressed_') ||
        file.startsWith('recording_')
      );

      for (const file of tempFiles) {
        try {
          const filePath = `${documentDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists) {
            count++;
            size += 'size' in fileInfo ? fileInfo.size || 0 : 0;
          }
        } catch (error) {
          // Ignore individual file errors
        }
      }
    } catch (error) {
      console.warn('Failed to get temp file stats:', error);
    }

    return { count, size };
  }

  /**
   * Get cache size
   */
  private async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        } catch (error) {
          // Ignore individual errors
        }
      }

      return totalSize;
    } catch (error) {
      console.warn('Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Dispose of service and cleanup resources
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get memory optimization recommendations
   */
  public async getOptimizationRecommendations(): Promise<string[]> {
    const stats = await this.getMemoryStats();
    const recommendations: string[] = [];

    const usagePercentage = stats.usedMemory / stats.totalMemory;

    if (usagePercentage > 0.9) {
      recommendations.push('Critical: Delete unused apps and files');
      recommendations.push('Close other apps to free memory');
      recommendations.push('Restart device to clear memory');
    } else if (usagePercentage > 0.8) {
      recommendations.push('Clear app cache and temporary files');
      recommendations.push('Delete old recordings and media');
    } else if (stats.activeVideoFiles > 15) {
      recommendations.push('Clean up temporary video files');
    }

    if (stats.tempFileSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Remove large temporary files');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage is optimal');
    }

    return recommendations;
  }
}

export const memoryOptimizationService = MemoryOptimizationService.getInstance();
