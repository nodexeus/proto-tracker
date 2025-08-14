/**
 * React Query hooks for client management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClientService } from '../services/clients';
import { getApiConfig } from '../utils';
import { useAuth } from './useAuth';
import type { 
  Client, 
  ClientCreate, 
  ClientUpdate, 
  Protocol,
  ProtocolClientAssociationCreate 
} from '../types';

// Query keys for client-related queries
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: string) => [...clientKeys.lists(), { filters }] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: number) => [...clientKeys.details(), id] as const,
  protocols: (id: number) => [...clientKeys.detail(id), 'protocols'] as const,
  search: (query: string) => [...clientKeys.all, 'search', { query }] as const,
};

// Protocol-Client association query keys
export const protocolClientKeys = {
  all: ['protocol-clients'] as const,
  protocolClients: (protocolId: number) => [...protocolClientKeys.all, 'protocol', protocolId] as const,
  clientProtocols: (clientId: number) => [...protocolClientKeys.all, 'client', clientId] as const,
};

/**
 * Hook to fetch all clients
 */
export function useClients() {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useQuery({
    queryKey: clientKeys.lists(),
    queryFn: () => clientService.getClients(),
    enabled: !!user,
  });
}

/**
 * Hook to fetch a specific client
 */
export function useClient(id: number) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientService.getClient(id),
    enabled: !!user && !!id,
  });
}

/**
 * Hook to search clients
 */
export function useClientSearch(query: string) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useQuery({
    queryKey: clientKeys.search(query),
    queryFn: () => clientService.searchClients(query),
    enabled: !!user && query.trim().length > 0,
  });
}

/**
 * Hook to fetch protocols associated with a client
 */
export function useClientProtocols(clientId: number) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useQuery({
    queryKey: protocolClientKeys.clientProtocols(clientId),
    queryFn: () => clientService.getClientProtocols(clientId),
    enabled: !!user && !!clientId,
  });
}

/**
 * Hook to fetch clients associated with a protocol
 */
export function useProtocolClients(protocolId: number) {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useQuery({
    queryKey: protocolClientKeys.protocolClients(protocolId),
    queryFn: () => clientService.getProtocolClients(protocolId),
    enabled: !!user && !!protocolId,
  });
}

/**
 * Hook to create a client
 */
export function useCreateClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: (data: ClientCreate) => clientService.createClient(data),
    onSuccess: () => {
      // Invalidate and refetch clients list and dashboard stats
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

/**
 * Hook to update a client
 */
export function useUpdateClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClientUpdate }) => 
      clientService.updateClient(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate and refetch clients list, specific client, and dashboard stats
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

/**
 * Hook to delete a client
 */
export function useDeleteClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: (id: number) => clientService.deleteClient(id),
    onSuccess: () => {
      // Invalidate and refetch clients list and dashboard stats
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

/**
 * Hook to add a client to a protocol
 */
export function useAddClientToProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: ({ protocolId, data }: { protocolId: number; data: ProtocolClientAssociationCreate }) => 
      clientService.addClientToProtocol(protocolId, data),
    onSuccess: (_, { protocolId, data }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.protocolClients(protocolId) });
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.clientProtocols(data.client_id) });
    },
  });
}

/**
 * Hook to remove a client from a protocol
 */
export function useRemoveClientFromProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: ({ protocolId, clientId }: { protocolId: number; clientId: number }) => 
      clientService.removeClientFromProtocol(protocolId, clientId),
    onSuccess: (_, { protocolId, clientId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.protocolClients(protocolId) });
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.clientProtocols(clientId) });
    },
  });
}

/**
 * Hook to set a client as primary for a protocol
 */
export function useSetPrimaryClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  const clientService = new ClientService(apiConfig);

  return useMutation({
    mutationFn: ({ protocolId, clientId }: { protocolId: number; clientId: number }) => 
      clientService.setPrimaryClient(protocolId, clientId),
    onSuccess: (_, { protocolId, clientId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.protocolClients(protocolId) });
      queryClient.invalidateQueries({ queryKey: protocolClientKeys.clientProtocols(clientId) });
    },
  });
}