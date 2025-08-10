/**
 * Profile service for user profile and API key management
 */

import { ApiService } from './api';
import type { 
  UserProfile, 
  ProfileApiKey, 
  ProfileApiKeyCreate, 
  ProfileApiKeyResponse,
  ApiConfig 
} from '../types';

export class ProfileService extends ApiService {
  constructor(config: ApiConfig) {
    super(config);
  }

  /**
   * Get current user profile information
   */
  async getProfile(): Promise<UserProfile> {
    return this.get<UserProfile>('/profile');
  }

  /**
   * Get user's API keys
   */
  async getApiKeys(): Promise<ProfileApiKey[]> {
    return this.get<ProfileApiKey[]>('/profile/api-keys');
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: ProfileApiKeyCreate): Promise<ProfileApiKeyResponse> {
    return this.post<ProfileApiKeyResponse>('/profile/api-keys', data);
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(keyId: number): Promise<void> {
    return this.delete(`/profile/api-keys/${keyId}`);
  }

  /**
   * Get full API key value (for copying to clipboard)
   */
  async getFullApiKey(keyId: number): Promise<{ key: string }> {
    return this.get<{ key: string }>(`/profile/api-keys/${keyId}/full`);
  }
}