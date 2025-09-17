/**
 * User-related type definitions
 */

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  oauth_github?: string;
  oauth_google?: string;
}

export interface ApiKey {
  id: number;
  user_id: number;
  key: string;
  name: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
}

export interface AuthUser extends User {
  apiKey: string;
  is_admin?: boolean;
}

export interface GoogleOAuthResponse {
  access_token: string;
  id_token: string;
  authorization_code?: string;  // For auth-code flow
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OAuthProvider {
  id: number;
  provider: string;
  provider_user_id: string;
  user_id: number;
  created_at: string;
  token: Record<string, unknown>;
}