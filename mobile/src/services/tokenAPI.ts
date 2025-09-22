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
    baseUrl: 'https://your-app.railway.app', // Replace with your actual Railway URL
    timeout: 10000,
  }
};

/**
 * Get the appropriate API base URL based on environment
 */
export const getApiBaseUrl = (): string => {
  if (__DEV__) {
    return API_CONFIG.development.baseUrl;
  }
  return API_CONFIG.production.baseUrl;
};

/**
 * Get authentication token from storage
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
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
      await AsyncStorage.removeItem('auth_token');
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
    return makeAuthenticatedRequest('/api/v1/tokens/balance');
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
    return makeAuthenticatedRequest('/api/v1/tokens/spend', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
  
  /**
   * Get transaction history
   */
  getTransactionHistory: async (limit: number = 50): Promise<any[]> => {
    return makeAuthenticatedRequest(`/api/v1/tokens/history?limit=${limit}`);
  },
};

export default {
  getApiBaseUrl,
  getAuthToken,
  makeAuthenticatedRequest,
  TokenAPI,
};