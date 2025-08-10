/**
 * Example usage of the API services
 * This file demonstrates how to use the services and can be removed in production
 */

import { API_CONFIG } from '../utils/constants';
import { AuthService, ProtocolService } from './index';
import type { ProtocolCreate, GoogleOAuthResponse } from '../types';

// Example: Initialize services
export function initializeServices() {
  const authService = new AuthService(API_CONFIG);
  const protocolService = new ProtocolService(API_CONFIG);
  
  return { authService, protocolService };
}

// Example: Authentication flow
export async function exampleAuthFlow() {
  const { authService } = initializeServices();
  
  // Check if user is already authenticated
  const storedUser = authService.initializeFromStorage();
  if (storedUser) {
    console.log('User already authenticated:', storedUser);
    return storedUser;
  }
  
  // Example Google OAuth response (this would come from the OAuth flow)
  const mockOAuthResponse: GoogleOAuthResponse = {
    access_token: 'mock_access_token',
    id_token: 'mock_id_token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'openid email profile',
  };
  
  try {
    // Login with Google OAuth
    const user = await authService.loginWithGoogle(mockOAuthResponse);
    console.log('Login successful:', user);
    return user;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// Example: Protocol operations
export async function exampleProtocolOperations() {
  const { protocolService } = initializeServices();
  
  try {
    // Get all protocols
    const protocols = await protocolService.getProtocols();
    console.log('All protocols:', protocols);
    
    // Create a new protocol
    const newProtocol: ProtocolCreate = {
      name: 'Example Protocol',
      chain_id: '1',
      network: 'mainnet',
      explorer: 'https://etherscan.io',
      public_rpc: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
      proto_family: 'ethereum',
      bpm: 12,
    };
    
    const createdProtocol = await protocolService.createProtocol(newProtocol);
    console.log('Created protocol:', createdProtocol);
    
    // Get protocol updates
    const updates = await protocolService.getProtocolUpdates(createdProtocol.id);
    console.log('Protocol updates:', updates);
    
    // Get protocol snapshots
    const snapshots = await protocolService.getProtocolSnapshots(createdProtocol.id);
    console.log('Protocol snapshots:', snapshots);
    
    return createdProtocol;
  } catch (error) {
    console.error('Protocol operations failed:', error);
    throw error;
  }
}

// Example: Error handling
export async function exampleErrorHandling() {
  const { authService, protocolService } = initializeServices();
  
  try {
    // This will fail if not authenticated
    await protocolService.getProtocols();
  } catch (error) {
    const errorMessage = authService.handleAuthError(error as { status?: number; message?: string });
    console.error('Handled error:', errorMessage);
  }
}

// Example: Service configuration
export function exampleServiceConfiguration() {
  const { authService, protocolService } = initializeServices();
  
  // Check authentication status
  console.log('Auth service authenticated:', authService.isAuthenticated());
  console.log('Protocol service authenticated:', protocolService.isAuthenticated());
  
  // Get service configuration
  console.log('Auth service config:', authService.getConfig());
  console.log('Protocol service config:', protocolService.getConfig());
  
  // Set API key manually
  const apiKey = 'your-api-key-here';
  authService.setApiKey(apiKey);
  protocolService.setApiKey(apiKey);
  
  console.log('Services now authenticated:', {
    auth: authService.isAuthenticated(),
    protocol: protocolService.isAuthenticated(),
  });
}