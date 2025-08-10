import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Loader, Center, Stack, Text } from '@mantine/core';
import { useAuth } from '../../hooks/useAuth';
import Login from './Login';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  fallback,
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Container size="xs" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Checking authentication...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // If authentication is not required, always render children
  if (!requireAuth) {
    return <>{children}</>;
  }

  // If user is not authenticated, show login or fallback
  if (!isAuthenticated || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Show login component with redirect back to current location
    return (
      <Login 
        redirectTo={location.pathname + location.search}
        onSuccess={() => {
          // This will be handled by the login component
        }}
      />
    );
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}

export default ProtectedRoute;