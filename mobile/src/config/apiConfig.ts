/**
 * API Configuration for 2Truths-1Lie Mobile App
 * Centralizes backend API URL configuration for all environments
 */

import { Platform } from 'react-native';

export interface APIConfig {
  baseUrl: string;
  version: string;
  timeout: number;
}

/**
 * Environment-based API configuration
 * Production URL points to the deployed Railway backend
 */
const getAPIConfig = (): APIConfig => {
  // Production configuration - Railway deployment
  const productionConfig: APIConfig = {
    baseUrl: 'https://2truths-1lie-production.up.railway.app',
    version: 'v1',
    timeout: 30000, // 30 seconds for video uploads
  };

  // Development configuration - Local backend
  const developmentConfig: APIConfig = {
    baseUrl: 'http://192.168.50.111:8001',
    version: 'v1', 
    timeout: 30000,
  };

  // Environment-based configuration
  // Use development backend for testing signed URL functionality
  // const isDevelopment = __DEV__; // React Native's built-in development flag
  const isDevelopment = false; // Force production mode to use Railway backend
  
  const config = isDevelopment ? developmentConfig : productionConfig;
  
  console.log(`🌐 API Config: Environment=${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  console.log(`🌐 API Config: Using ${config.baseUrl} for backend API`);
  console.log(`🌐 API Config: __DEV__ flag = ${__DEV__}`);
  
  return config;
};

export const apiConfig = getAPIConfig();

/**
 * Get the full API base URL with version
 */
export const getApiBaseUrl = (): string => {
  return `${apiConfig.baseUrl}/api/${apiConfig.version}`;
};

/**
 * Get the base URL without API path (for direct backend access)
 */
export const getBackendBaseUrl = (): string => {
  return apiConfig.baseUrl;
};

/**
 * Get the Swagger documentation URL
 * Access at: https://2truths-1lie-production.up.railway.app/docs
 */
export const getSwaggerDocsUrl = (): string => {
  return `${apiConfig.baseUrl}/docs`;
};
