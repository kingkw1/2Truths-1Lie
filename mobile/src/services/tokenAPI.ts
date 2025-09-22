/**
 * API Configuration for Secure Token Management
 * 
 * This file handles API configuration for the secure token backend integration.
 * Add this to your project and update your existing API configuration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_CONFIG = {
  development: {
    baseUrl: 'http://192.168.50.111:8001',
    timeout: 10000,
  },
  production: {
    baseUrl: 'https://2truths-1lie-production.up.railway.app', // Railway URL
    timeout: 10000,
  }
};

/**
 * Get the appropriate API base URL based on environment
 */
export const getApiBaseUrl = (): string => {
  // Force production mode to use Railway backend (matching other API services)
  const isDevelopment = false;
  
  if (isDevelopment) {
    return API_CONFIG.development.baseUrl;
  }
  return API_CONFIG.production.baseUrl;
};

/**
 * Get authentication token from storage
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

/**
 * Make authenticated API request
 */
export const makeAuthenticatedRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication token not found. Please log in again.');
  }
  
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  console.log(`🌐 API Response: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Response might not be JSON
    }
    
    const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    
    if (response.status === 401) {
      // Token expired or invalid - should trigger re-authentication
      await AsyncStorage.removeItem('authToken');
      throw new Error('Authentication expired. Please log in again.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
};

/**
 * Token API endpoints
 */
export const TokenAPI = {
  /**
   * Get current token balance
   */
  getBalance: async (): Promise<{ balance: number; last_updated: string }> => {
    try {
      return await makeAuthenticatedRequest('/api/v1/tokens/balance');
    } catch (error) {
      // Handle case where token endpoints aren't deployed yet
      if (error instanceof Error && error.message.includes('Not Found')) {
        console.log('🔄 Token endpoints not available, returning default balance');
        return {
          balance: 100, // Default starting balance
          last_updated: new Date().toISOString()
        };
      }
      throw error;
    }
  },
  
  /**
   * Spend tokens
   */
  spendTokens: async (request: {
    amount: number;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    transaction_id?: string;
    new_balance: number;
    message: string;
  }> => {
    try {
      return await makeAuthenticatedRequest('/api/v1/tokens/spend', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    } catch (error) {
      // Handle case where token endpoints aren't deployed yet
      if (error instanceof Error && error.message.includes('Not Found')) {
        console.log('🔄 Token endpoints not available, simulating spend');
        return {
          success: true,
          transaction_id: `sim_${Date.now()}`,
          new_balance: Math.max(0, 100 - request.amount), // Simulate spending from default balance
          message: 'Tokens spent successfully (simulated)'
        };
      }
      throw error;
    }
  },
  
  /**
   * Get transaction history
   */
  getTransactionHistory: async (limit: number = 50): Promise<any[]> => {
    try {
      return await makeAuthenticatedRequest(`/api/v1/tokens/history?limit=${limit}`);
    } catch (error) {
      // Handle case where token endpoints aren't deployed yet
      if (error instanceof Error && error.message.includes('Not Found')) {
        console.log('🔄 Token endpoints not available, returning empty history');
        return [];
      }
      throw error;
    }
  },
};

export default {
  getApiBaseUrl,
  getAuthToken,
  makeAuthenticatedRequest,
  TokenAPI,
};