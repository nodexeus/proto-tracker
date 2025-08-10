/**
 * Profile-related type definitions
 */

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
  last_login?: string;
}

export interface ProfileApiKey {
  id: number;
  name: string;
  description?: string;
  key_preview: string;  // Truncated version for display
  created_at: string;
  last_used?: string;
  expires_at?: string;
  is_active: boolean;
}

export interface ProfileApiKeyCreate {
  name: string;
  description?: string;
  expires_at?: string;
}

export interface ProfileApiKeyResponse {
  id: number;
  name: string;
  description?: string;
  key: string;  // Full key shown only once
  created_at: string;
  expires_at?: string;
}