/**
 * Custom hook for user profile data management using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/profile';
import { useAuth } from './useAuth';
import { getApiConfig } from '../utils';

// Query keys for React Query
export const profileKeys = {
  all: ['profile'] as const,
  profile: () => [...profileKeys.all, 'data'] as const,
};

// Helper function to create profile service
function createProfileService(apiKey?: string): ProfileService {
  return new ProfileService(getApiConfig(apiKey));
}

/**
 * Hook for fetching user profile data
 */
export function useProfile() {
  const { user } = useAuth();
  
  const profileService = createProfileService(user?.apiKey);

  return useQuery({
    queryKey: profileKeys.profile(),
    queryFn: () => profileService.getProfile(),
    enabled: !!user?.apiKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
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