import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Button, 
  Stack,
  Loader,
  Alert
} from '@mantine/core';
import { IconBrandGoogle, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import type { GoogleOAuthResponse } from '../../types';

interface LoginProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function Login({ onSuccess, redirectTo }: LoginProps) {
  const { login, isLoading } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  const googleLogin = isDevMode ? () => {} : useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setError(null);
        console.log('OAuth response:', tokenResponse);
        
        // useGoogleLogin returns a TokenResponse with access_token
        // We need to fetch user info using the access_token
        const userInfoResponse = await fetch(
          `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenResponse.access_token}`
        );
        
        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user information');
        }
        
        const userInfo = await userInfoResponse.json();
        console.log('User info:', userInfo);
        
        // Create a mock ID token for client-only testing
        // In production, the backend would handle this properly
        const mockIdToken = btoa(JSON.stringify({
          sub: userInfo.id,
          email: userInfo.email,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          picture: userInfo.picture,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
        }));
        
        const oauthResponse: GoogleOAuthResponse = {
          access_token: tokenResponse.access_token,
          id_token: `header.${mockIdToken}.signature`, // Mock JWT format
          expires_in: tokenResponse.expires_in,
          token_type: tokenResponse.token_type,
          scope: tokenResponse.scope,
        };

        await login(oauthResponse);
        
        if (onSuccess) {
          onSuccess();
        }
        
        // Redirect if specified
        if (redirectTo) {
          window.location.href = redirectTo;
        }
      } catch (err) {
        console.error('Login error:', err);
        setError('Failed to log in with Google. Please try again.');
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setError('Google authentication failed. Please try again.');
    },
    scope: 'openid email profile',
  });

  const handleGoogleLogin = () => {
    if (isDevMode) {
      setError('Please use the Dev Mode Login button below');
      return;
    }
    setError(null);
    googleLogin();
  };

  const handleDevLogin = async () => {
    setError(null);
    try {
      // In dev mode, we can pass dummy OAuth response
      const devOAuthResponse: GoogleOAuthResponse = {
        access_token: 'dev-access-token',
        id_token: 'dev.id.token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      };

      await login(devOAuthResponse);

      if (onSuccess) {
        onSuccess();
      }

      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err) {
      console.error('Dev login error:', err);
      setError('Dev login failed. Please check DEV_MODE is enabled.');
    }
  };

  return (
    <Container size="xs" py="xl">
      <Paper withBorder shadow="md" p="xl" radius="md">
        <Stack gap="lg">
          <div style={{ textAlign: 'center' }}>
            <Title order={2} mb="xs">
              Welcome to Protocol Tracker
            </Title>
            <Text c="dimmed" size="sm">
              Sign in to manage blockchain protocols and track updates
            </Text>
          </div>

          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              color="red" 
              variant="light"
            >
              {error}
            </Alert>
          )}

          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            size="lg"
            variant="default"
            leftSection={
              isLoading ? (
                <Loader size="sm" />
              ) : (
                <IconBrandGoogle size={20} />
              )
            }
            fullWidth
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {/* Show dev login button only in dev mode */}
          {import.meta.env.VITE_DEV_MODE === 'true' && (
            <>
              <Text c="dimmed" size="xs" ta="center">
                — OR —
              </Text>
              <Button
                fullWidth
                size="lg"
                variant="light"
                color="gray"
                onClick={handleDevLogin}
                disabled={isLoading}
              >
                Dev Mode Login (No Auth Required)
              </Button>
            </>
          )}

          <Text size="xs" c="dimmed" ta="center">
            By signing in, you agree to our terms of service and privacy policy.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}

export default Login;