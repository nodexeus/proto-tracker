/**
 * Custom hook for protocol data management using React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ProtocolService } from '../services/protocols';
import { useAuth } from './useAuth';
import { getApiConfig } from '../utils';
import type { ProtocolCreate, ProtocolUpdateData } from '../types';

// Query keys for React Query
export const protocolKeys = {
  all: ['protocols'] as const,
  lists: () => [...protocolKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...protocolKeys.lists(), { filters }] as const,
  details: () => [...protocolKeys.all, 'detail'] as const,
  detail: (id: number) => [...protocolKeys.details(), id] as const,
  updates: (id: number) => [...protocolKeys.detail(id), 'updates'] as const,
  snapshots: (id: number) => [...protocolKeys.detail(id), 'snapshots'] as const,
  stats: (id: number) => [...protocolKeys.detail(id), 'stats'] as const,
};

// Helper function to create protocol service
function createProtocolService(apiKey?: string): ProtocolService {
  return new ProtocolService(getApiConfig(apiKey));
}

/**
 * Hook for fetching all protocols
 */
export function useProtocols() {
  const { user } = useAuth();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useQuery({
    queryKey: protocolKeys.lists(),
    queryFn: () => protocolService.getProtocols(),
    enabled: true,
    staleTime: 2 * 60 * 1000, // 2 minutes for protocol list
  });
}

/**
 * Hook for fetching a single protocol
 */
export function useProtocol(id: number) {
  const { user } = useAuth();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useQuery({
    queryKey: protocolKeys.detail(id),
    queryFn: () => protocolService.getProtocol(id),
    enabled: !!id,
  });
}

/**
 * Hook for protocol updates
 */
export function useProtocolUpdates(protocolId: number) {
  const { user } = useAuth();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useQuery({
    queryKey: protocolKeys.updates(protocolId),
    queryFn: () => protocolService.getProtocolUpdates(protocolId),
    enabled: !!protocolId,
  });
}

/**
 * Hook for protocol snapshots
 */
export function useProtocolSnapshots(protocolId: number) {
  const { user } = useAuth();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useQuery({
    queryKey: protocolKeys.snapshots(protocolId),
    queryFn: () => protocolService.getProtocolSnapshots(protocolId),
    enabled: !!protocolId,
  });
}

/**
 * Hook for protocol statistics
 */
export function useProtocolStats(protocolId: number) {
  const { user } = useAuth();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useQuery({
    queryKey: protocolKeys.stats(protocolId),
    queryFn: () => protocolService.getProtocolStats(protocolId),
    enabled: !!protocolId,
  });
}

/**
 * Hook for creating a protocol
 */
export function useCreateProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useMutation({
    mutationFn: (data: ProtocolCreate) => protocolService.createProtocol(data),
    onSuccess: (newProtocol) => {
      // Invalidate and refetch protocols list
      queryClient.invalidateQueries({ queryKey: protocolKeys.lists() });
      
      // Add the new protocol to the cache
      queryClient.setQueryData(protocolKeys.detail(newProtocol.id), newProtocol);
      
      notifications.show({
        title: 'Success',
        message: `Protocol "${newProtocol.name}" created successfully`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create protocol',
        color: 'red',
      });
    },
  });
}

/**
 * Hook for updating a protocol
 */
export function useUpdateProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProtocolUpdateData }) => 
      protocolService.updateProtocol(id, data),
    onSuccess: (updatedProtocol) => {
      // Update the protocol in the cache
      queryClient.setQueryData(protocolKeys.detail(updatedProtocol.id), updatedProtocol);
      
      // Invalidate the protocols list to ensure it's updated
      queryClient.invalidateQueries({ queryKey: protocolKeys.lists() });
      
      notifications.show({
        title: 'Success',
        message: `Protocol "${updatedProtocol.name}" updated successfully`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to update protocol',
        color: 'red',
      });
    },
  });
}

/**
 * Hook for deleting a protocol
 */
export function useDeleteProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useMutation({
    mutationFn: (id: number) => protocolService.deleteProtocol(id),
    onSuccess: (_, deletedId) => {
      // Remove the protocol from the cache
      queryClient.removeQueries({ queryKey: protocolKeys.detail(deletedId) });
      
      // Invalidate the protocols list
      queryClient.invalidateQueries({ queryKey: protocolKeys.lists() });
      
      notifications.show({
        title: 'Success',
        message: 'Protocol deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to delete protocol',
        color: 'red',
      });
    },
  });
}

/**
 * Hook for scanning snapshots
 */
export function useScanSnapshots() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const protocolService = createProtocolService(user?.apiKey);

  return useMutation({
    mutationFn: (protocolId: number) => protocolService.scanSnapshots(protocolId),
    onSuccess: (result, protocolId) => {
      // Invalidate snapshots for this protocol
      queryClient.invalidateQueries({ queryKey: protocolKeys.snapshots(protocolId) });
      
      notifications.show({
        title: 'Scan Complete',
        message: result.message || 'Snapshot scan completed successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Scan Failed',
        message: (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to scan snapshots',
        color: 'red',
      });
    },
  });
}