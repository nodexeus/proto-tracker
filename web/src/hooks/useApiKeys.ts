/**
 * Custom hook for API key management using React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ProfileService } from '../services/profile';
import { useAuth } from './useAuth';
import { getApiConfig } from '../utils';
import type { ProfileApiKeyCreate } from '../types';

// Query keys for React Query
export const apiKeysKeys = {
  all: ['apiKeys'] as const,
  lists: () => [...apiKeysKeys.all, 'list'] as const,
  fullKey: (keyId: number) => [...apiKeysKeys.all, 'full', keyId] as const,
};

// Helper function to create profile service
function createProfileService(apiKey?: string): ProfileService {
  return new ProfileService(getApiConfig(apiKey));
}

/**
 * Hook for fetching user's API keys
 */
export function useApiKeys() {
  const { user } = useAuth();
  
  const profileService = createProfileService(user?.apiKey);

  return useQuery({
    queryKey: apiKeysKeys.lists(),
    queryFn: () => profileService.getApiKeys(),
    enabled: !!user?.apiKey,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      const apiError = error as { status?: number };
      if (apiError?.status === 401 || apiError?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook for creating a new API key
 */
export function useCreateApiKey() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const profileService = createProfileService(user?.apiKey);

  return useMutation({
    mutationFn: (data: ProfileApiKeyCreate) => profileService.createApiKey(data),
    onSuccess: (newApiKey) => {
      // Invalidate and refetch API keys list
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() });
      
      notifications.show({
        title: 'Success',
        message: `API key "${newApiKey.name}" created successfully`,
        color: '#7fcf00',
      });
    },
    onError: (error: Error) => {
      const apiError = error as Error & { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Error',
        message: apiError?.response?.data?.detail || apiError?.message || 'Failed to create API key',
        color: 'red',
      });
    },
  });
}

/**
 * Hook for deleting an API key
 */
export function useDeleteApiKey() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const profileService = createProfileService(user?.apiKey);

  return useMutation({
    mutationFn: (keyId: number) => profileService.deleteApiKey(keyId),
    onSuccess: () => {
      // Invalidate the API keys list
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() });
      
      notifications.show({
        title: 'Success',
        message: 'API key deleted successfully',
        color: '#7fcf00',
      });
    },
    onError: (error: Error) => {
      const apiError = error as Error & { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Error',
        message: apiError?.response?.data?.detail || apiError?.message || 'Failed to delete API key',
        color: 'red',
      });
    },
  });
}

/**
 * Hook for getting the full API key value (for clipboard operations)
 */
export function useGetFullApiKey() {
  const { user } = useAuth();
  
  const profileService = createProfileService(user?.apiKey);

  return useMutation({
    mutationFn: (keyId: number) => profileService.getFullApiKey(keyId),
    onError: (error: Error) => {
      const apiError = error as Error & { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Error',
        message: apiError?.response?.data?.detail || apiError?.message || 'Failed to retrieve API key',
        color: 'red',
      });
    },
  });
}