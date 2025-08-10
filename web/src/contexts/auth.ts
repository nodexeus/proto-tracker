/**
 * Authentication context definition
 */

import { createContext } from 'react';
import type { AuthUser, GoogleOAuthResponse } from '../types';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (oauthResponse: GoogleOAuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);