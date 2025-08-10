/**
 * Application constants and configuration
 */

import type { ApiConfig } from '../types';

// API Configuration
export const API_CONFIG: ApiConfig = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
  timeout: 30000, // 30 seconds
};

// Google OAuth Configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`,
  scope: 'openid email profile',
};

// Application Constants
export const APP_CONSTANTS = {
  APP_NAME: 'Proto Tracker',
  VERSION: '1.0.0',
  SUPPORTED_IMAGE_TYPES: ['image/png'],
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// Storage Keys
export const STORAGE_KEYS = {
  THEME: 'proto_tracker_theme',
  LANGUAGE: 'proto_tracker_language',
  USER_PREFERENCES: 'proto_tracker_preferences',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_ME: '/auth/me',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_API_KEYS: '/auth/api-keys',
  AUTH_OAUTH_PROVIDERS: '/auth/oauth-providers',
  
  // Protocols
  PROTOCOLS: '/protocols',
  PROTOCOL_UPDATES: '/protocol-updates',
  PROTOCOL_SNAPSHOTS: (id: number) => `/protocols/${id}/snapshots`,
  PROTOCOL_SCAN_SNAPSHOTS: (id: number) => `/protocols/${id}/scan-snapshots`,
  PROTOCOL_STATS: (id: number) => `/protocols/${id}/stats`,
  PROTOCOL_SEARCH: '/protocols/search',
  
  // Clients
  CLIENTS: '/clients',
  
  // Snapshots
  SNAPSHOTS: '/snapshots',
  
  // Admin
  B2_CONFIG: '/admin/b2-config',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  PROTOCOL_CREATED: 'Protocol created successfully!',
  PROTOCOL_UPDATED: 'Protocol updated successfully!',
  PROTOCOL_DELETED: 'Protocol deleted successfully!',
  SNAPSHOT_SCAN_STARTED: 'Snapshot scan started successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  PROTOCOL_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
  CHAIN_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
  NETWORK: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  URL: {
    MAX_LENGTH: 500,
  },
  BPM: {
    MIN: 0,
    MAX: 1000,
  },
} as const;