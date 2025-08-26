/**
 * Platform-agnostic storage abstraction
 * Automatically uses the correct storage implementation based on platform
 * - React Native: AsyncStorage
 * - Web: localStorage (for future web implementation)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Web storage implementation (for future use)
class WebStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return null;
    }
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return;
    }
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return;
    }
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return;
    }
    localStorage.clear();
  }
}

// Mobile storage implementation (current)
class MobileStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    return AsyncStorage.clear();
  }
}

// Platform-specific storage instance
const createStorage = (): StorageInterface => {
  // For React Native (current deployment)
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return new MobileStorage();
  }
  
  // For web (future implementation)
  if (Platform.OS === 'web') {
    return new WebStorage();
  }
  
  // Fallback to mobile storage
  return new MobileStorage();
};

// Export the storage instance
export const storage = createStorage();

// Export types for future use
export type { StorageInterface };
export { WebStorage, MobileStorage };
