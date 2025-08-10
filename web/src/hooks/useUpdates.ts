/**
 * React Query hooks for protocol updates management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdatesService } from '../services/updates';
import { getApiConfig } from '../utils';
import { useAuth } from './useAuth';
import type { ProtocolUpdate, ProtocolUpdateEditData } from '../types';

// Query keys for updates-related queries
export const updatesKeys = {
  all: ['updates'] as const,
  lists: () => [...updatesKeys.all, 'list'] as const,
  list: (filters: string) => [...updatesKeys.lists(), { filters }] as const,
  details: () => [...updatesKeys.all, 'detail'] as const,
  detail: (id: number) => [...updatesKeys.details(), id] as const,
  enriched: () => [...updatesKeys.all, 'enriched'] as const,
  search: (query: string) => [...updatesKeys.all, 'search', { query }] as const,
  byProtocol: (nameOrId: string) => [...updatesKeys.all, 'protocol', nameOrId] as const,
};

/**
 * Hook to fetch all protocol updates
 */
export function useProtocolUpdates() {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useQuery({
    queryKey: updatesKeys.lists(),
    queryFn: () => updatesService.getProtocolUpdates(),
    enabled: !!user,
  });
}

/**
 * Hook to fetch enriched protocol updates with client and protocol information
 */
export function useEnrichedProtocolUpdates(skip: number = 0, limit: number = 100) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useQuery({
    queryKey: [...updatesKeys.enriched(), { skip, limit }],
    queryFn: () => updatesService.getEnrichedProtocolUpdates(skip, limit),
    enabled: !!user,
  });
}

/**
 * Hook to fetch a specific protocol update
 */
export function useProtocolUpdate(id: number) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useQuery({
    queryKey: updatesKeys.detail(id),
    queryFn: () => updatesService.getProtocolUpdate(id),
    enabled: !!user && !!id,
  });
}

/**
 * Hook to search protocol updates
 */
export function useProtocolUpdateSearch(query: string) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useQuery({
    queryKey: updatesKeys.search(query),
    queryFn: () => updatesService.searchProtocolUpdates(query),
    enabled: !!user && query.trim().length > 0,
  });
}

/**
 * Hook to fetch protocol updates by protocol name or ID
 */
export function useProtocolUpdatesByProtocol(nameOrId: string) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useQuery({
    queryKey: updatesKeys.byProtocol(nameOrId),
    queryFn: () => updatesService.getProtocolUpdatesByName(nameOrId),
    enabled: !!user && !!nameOrId,
  });
}

/**
 * Hook to update a protocol update
 */
export function useUpdateProtocolUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const updatesService = new UpdatesService(apiConfig);

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProtocolUpdateEditData }) => {
      console.log('useUpdateProtocolUpdate mutationFn called with:', { id, data });
      return updatesService.updateProtocolUpdate(id, data);
    },
    onSuccess: (updatedUpdate, { id }) => {
      console.log('useUpdateProtocolUpdate onSuccess called with:', { updatedUpdate, id });
      // Invalidate and refetch related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: updatesKeys.all });
      queryClient.invalidateQueries({ queryKey: updatesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: updatesKeys.enriched() });
      // Force refetch of the enriched updates which is used by the Updates page
      queryClient.refetchQueries({ queryKey: updatesKeys.enriched() });
    },
  });
}