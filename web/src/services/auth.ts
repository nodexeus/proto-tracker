/**
 * Authentication service for Google OAuth integration
 */

import { ApiService } from './api';
import type {
  User,
  AuthUser,
  ApiKey,
  GoogleOAuthResponse,
  OAuthProvider,
  ApiConfig,
} from '../types';

export interface LoginResponse {
  user: User;
  api_key: string;
  expires_in?: number;
}

export interface OAuthLoginRequest {
  id_token: string;
  access_token: string;
}

export class AuthService extends ApiService {
  private static readonly STORAGE_KEYS = {
    USER: 'proto_tracker_user',
    API_KEY: 'proto_tracker_api_key',
    TOKEN_EXPIRY: 'proto_tracker_token_expiry',
  };

  constructor(config: ApiConfig) {
    super(config);
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(oauthResponse: GoogleOAuthResponse): Promise<AuthUser> {
    // For development/testing: allow client-side only auth
    if (import.meta.env.VITE_AUTH_MODE === 'client-only') {
      return this.handleClientOnlyAuth(oauthResponse);
    }

    // Default: server-side verification
    const loginData: OAuthLoginRequest = {
      id_token: oauthResponse.id_token,
      access_token: oauthResponse.access_token,
    };

    const response = await this.post<LoginResponse>('/auth/google', loginData);

    const authUser: AuthUser = {
      ...response.user,
      apiKey: response.api_key,
    };

    // Store authentication data
    this.storeAuthData(authUser, response.expires_in);

    // Set API key for future requests
    this.setApiKey(response.api_key);

    return authUser;
  }

  /**
   * Handle client-side only authentication (for testing without backend)
   */
  private async handleClientOnlyAuth(oauthResponse: GoogleOAuthResponse): Promise<AuthUser> {
    console.log('Client-only auth mode - decoding ID token...');
    
    try {
      // Decode the ID token to get user info (client-side only, for testing)
      const userInfo = this.decodeIdToken(oauthResponse.id_token);
      console.log('Decoded user info:', userInfo);
      
      const authUser: AuthUser = {
        id: 1, // Mock ID for testing
        username: userInfo.email,
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        picture: userInfo.picture,
        oauth_google: userInfo.sub,
        apiKey: import.meta.env.VITE_API_KEY || 'mock-api-key-for-testing', // Use env API key for testing
      };

      console.log('Created auth user:', authUser);

      // Store authentication data
      this.storeAuthData(authUser, oauthResponse.expires_in);
      this.setApiKey(authUser.apiKey);

      return authUser;
    } catch (error) {
      console.error('Client-only auth failed:', error);
      throw error;
    }
  }

  /**
   * Decode ID token (client-side only, for testing)
   * Note: This is NOT secure for production - tokens should be verified server-side
   */
  private decodeIdToken(idToken: string): {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    [key: string]: unknown;
  } {
    try {
      // Handle JWT format (header.payload.signature)
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      // Add padding if needed for base64 decoding
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = atob(paddedPayload);
      const parsed = JSON.parse(decoded);
      
      // Validate required fields
      if (!parsed.sub || !parsed.email) {
        throw new Error('Missing required user information in token');
      }
      
      return parsed;
    } catch (error) {
      console.error('Token decode error:', error);
      throw new Error(`Invalid ID token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logout user and clear stored data
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if authenticated
      if (this.isAuthenticated()) {
        await this.post('/auth/logout');
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local storage
      this.clearAuthData();
      this.clearApiKey();
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/auth/me');
  }

  /**
   * Refresh user session
   */
  async refreshSession(): Promise<AuthUser> {
    const response = await this.post<LoginResponse>('/auth/refresh');

    const authUser: AuthUser = {
      ...response.user,
      apiKey: response.api_key,
    };

    // Update stored authentication data
    this.storeAuthData(authUser, response.expires_in);
    this.setApiKey(response.api_key);

    return authUser;
  }

  /**
   * Get user's API keys
   */
  async getUserApiKeys(): Promise<ApiKey[]> {
    return this.get<ApiKey[]>('/auth/api-keys');
  }

  /**
   * Create a new API key
   */
  async createApiKey(name: string, expiresAt?: string): Promise<ApiKey> {
    return this.post<ApiKey>('/auth/api-keys', {
      name,
      expires_at: expiresAt,
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: number): Promise<void> {
    return this.delete<void>(`/auth/api-keys/${keyId}`);
  }

  /**
   * Get OAuth providers for user
   */
  async getOAuthProviders(): Promise<OAuthProvider[]> {
    return this.get<OAuthProvider[]>('/auth/oauth-providers');
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated(): boolean {
    const user = this.getStoredUser();
    const apiKey = this.getStoredApiKey();
    const expiry = this.getTokenExpiry();

    if (!user || !apiKey) {
      return false;
    }

    // Check if token is expired
    if (expiry && new Date() > new Date(expiry)) {
      this.clearAuthData();
      return false;
    }

    return true;
  }

  /**
   * Get stored user data
   */
  getStoredUser(): AuthUser | null {
    try {
      const userData = localStorage.getItem(AuthService.STORAGE_KEYS.USER);
      const apiKey = localStorage.getItem(AuthService.STORAGE_KEYS.API_KEY);

      if (userData && apiKey) {
        const user = JSON.parse(userData) as User;
        return { ...user, apiKey };
      }
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      this.clearAuthData();
    }

    return null;
  }

  /**
   * Get stored API key
   */
  getStoredApiKey(): string | null {
    return localStorage.getItem(AuthService.STORAGE_KEYS.API_KEY);
  }

  /**
   * Initialize authentication from stored data
   */
  initializeFromStorage(): AuthUser | null {
    const user = this.getStoredUser();
    if (user && this.isUserAuthenticated()) {
      this.setApiKey(user.apiKey);
      return user;
    }
    return null;
  }

  /**
   * Store authentication data in localStorage
   */
  private storeAuthData(user: AuthUser, expiresIn?: number): void {
    try {
      const { apiKey, ...userData } = user;

      localStorage.setItem(
        AuthService.STORAGE_KEYS.USER,
        JSON.stringify(userData)
      );
      localStorage.setItem(AuthService.STORAGE_KEYS.API_KEY, apiKey);

      if (expiresIn) {
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
        localStorage.setItem(
          AuthService.STORAGE_KEYS.TOKEN_EXPIRY,
          expiryDate.toISOString()
        );
      }
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  }

  /**
   * Clear all stored authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(AuthService.STORAGE_KEYS.USER);
    localStorage.removeItem(AuthService.STORAGE_KEYS.API_KEY);
    localStorage.removeItem(AuthService.STORAGE_KEYS.TOKEN_EXPIRY);
  }

  /**
   * Get token expiry date
   */
  private getTokenExpiry(): string | null {
    return localStorage.getItem(AuthService.STORAGE_KEYS.TOKEN_EXPIRY);
  }

  /**
   * Validate Google OAuth response
   */
  validateGoogleOAuthResponse(
    response: unknown
  ): response is GoogleOAuthResponse {
    if (!response || typeof response !== 'object' || response === null) {
      return false;
    }

    const obj = response as Record<string, unknown>;
    
    return (
      'access_token' in obj &&
      'id_token' in obj &&
      'expires_in' in obj &&
      'token_type' in obj &&
      typeof obj.access_token === 'string' &&
      typeof obj.id_token === 'string' &&
      typeof obj.expires_in === 'number' &&
      typeof obj.token_type === 'string'
    );
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error: { status?: number; message?: string }): string {
    if (error.status === 401) {
      this.clearAuthData();
      this.clearApiKey();
      return 'Authentication failed. Please log in again.';
    } else if (error.status === 403) {
      return 'Access denied. You do not have permission to perform this action.';
    } else if (error.status === 429) {
      return 'Too many login attempts. Please try again later.';
    } else {
      return error.message || 'An authentication error occurred.';
    }
  }
}
