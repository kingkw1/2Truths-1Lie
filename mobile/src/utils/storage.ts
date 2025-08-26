/**
 * Platform-agnostic storage utility for React Native
 * Uses AsyncStorage for persistent data storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageInterface {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

class ReactNativeStorage implements StorageInterface {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Storage setItem error:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const storage = new ReactNativeStorage();

export default storage;

// Convenience functions for common operations
export const saveGameState = async (gameState: any): Promise<void> => {
  try {
    await storage.setItem('gameState', JSON.stringify(gameState));
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
};

export const loadGameState = async (): Promise<any | null> => {
  try {
    const savedState = await storage.getItem('gameState');
    return savedState ? JSON.parse(savedState) : null;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return null;
  }
};

export const savePlayerProfile = async (profile: any): Promise<void> => {
  try {
    await storage.setItem('playerProfile', JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to save player profile:', error);
  }
};

export const loadPlayerProfile = async (): Promise<any | null> => {
  try {
    const savedProfile = await storage.getItem('playerProfile');
    return savedProfile ? JSON.parse(savedProfile) : null;
  } catch (error) {
    console.error('Failed to load player profile:', error);
    return null;
  }
};