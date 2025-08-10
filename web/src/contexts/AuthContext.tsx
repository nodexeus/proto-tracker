import { useEffect, useState, type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { notifications } from '@mantine/notifications';
import { AuthService } from '../services/auth';
import { AuthContext, type AuthContextType } from './auth';
import type { AuthUser, GoogleOAuthResponse } from '../types';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authService] = useState(
    () =>
      new AuthService({
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
        timeout: 10000,
      })
  );

  const isAuthenticated = !!user;

  // Initialize authentication from stored data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = authService.initializeFromStorage();
        if (storedUser) {
          // Try to fetch fresh user data from backend to get current admin status
          try {
            const currentUser = await authService.getCurrentUser();
            const enrichedUser: AuthUser = {
              ...storedUser,
              ...currentUser,
              apiKey: storedUser.apiKey, // Keep the stored API key
            };
            setUser(enrichedUser);
          } catch (profileError) {
            console.warn('Failed to fetch current user profile, using stored data:', profileError);
            setUser(storedUser);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth from storage:', error);
        // Clear any corrupted data
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [authService]);

  const login = async (oauthResponse: GoogleOAuthResponse) => {
    try {
      setIsLoading(true);
      const authUser = await authService.loginWithGoogle(oauthResponse);
      
      // Fetch additional user info from the backend to get admin status
      try {
        const currentUser = await authService.getCurrentUser();
        const enrichedUser: AuthUser = {
          ...authUser,
          ...currentUser,
          apiKey: authUser.apiKey, // Keep the API key from auth
        };
        setUser(enrichedUser);
      } catch (profileError) {
        console.warn('Failed to fetch user profile, using basic auth data:', profileError);
        setUser(authUser);
      }

      notifications.show({
        title: 'Login Successful',
        message: `Welcome back, ${authUser.first_name || authUser.email}!`,
        color: 'green',
      });
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = authService.handleAuthError(
        error as { status?: number; message?: string }
      );

      notifications.show({
        title: 'Login Failed',
        message: errorMessage,
        color: 'red',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);

      notifications.show({
        title: 'Logged Out',
        message: 'You have been successfully logged out.',
        color: 'blue',
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear user state even if API call fails
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const authUser = await authService.refreshSession();
      setUser(authUser);
    } catch (error) {
      console.error('Session refresh failed:', error);
      // If refresh fails, logout the user
      await logout();
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshSession,
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.error('VITE_GOOGLE_CLIENT_ID environment variable is not set');
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Configuration Error</h2>
        <p>
          Google OAuth client ID is not configured. Please check your
          environment variables.
        </p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

// useAuth hook is exported from hooks/useAuth.ts to avoid fast refresh issues
