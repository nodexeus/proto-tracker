/**
 * Utility functions for API configuration
 */

import type { ApiConfig } from '../types';

/**
 * Get API configuration with proper API key fallback
 */
export function getApiConfig(userApiKey?: string): ApiConfig {
  const envApiKey = import.meta.env.VITE_API_KEY;
  
  // Use user's API key if available, otherwise fallback to environment
  const apiKey = userApiKey || envApiKey;
  
  // console.log('API Config Debug:', {
  //   userApiKey,
  //   envApiKey,
  //   finalApiKey: apiKey,
  //   strategy: envApiKey ? 'using env API key' : 'using user API key',
  //   envVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  // });
  
  // if (!apiKey) {
  //   console.warn('No API key found in user authentication or environment variables');
  // }

  return {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
    timeout: 30000,
    apiKey,
  };
}