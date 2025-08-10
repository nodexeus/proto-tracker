/**
 * React hook for managing the GitHub update polling service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdatePollerService, type PollResult, type PollingStatus, type DetectedUpdate } from '../services/updatePoller';
import { ClientService } from '../services/clients';
import { ProtocolService } from '../services/protocols';
import { useAuth } from './useAuth';
import { getApiConfig } from '../utils';
import type { Client } from '../types/client';

interface UseUpdatePollerOptions {
  githubApiKey?: string;
  pollingIntervalMinutes?: number;
  autoStart?: boolean;
}

interface UseUpdatePollerReturn {
  // Service control
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  pollNow: () => Promise<void>;
  
  // Status and data
  status: PollingStatus | null;
  recentResults: PollResult[];
  
  // Configuration
  setGitHubApiKey: (key: string) => void;
  setPollingInterval: (minutes: number) => void;
  resetPollTimestamps: () => void;
  
  // Manual operations
  pollClient: (client: Client) => Promise<PollResult>;
  saveUpdate: (update: DetectedUpdate) => Promise<void>;
  
  // Loading states
  isPolling: boolean;
  isSaving: boolean;
}

export function useUpdatePoller(options: UseUpdatePollerOptions = {}): UseUpdatePollerReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const apiConfig = getApiConfig(user?.apiKey);
  
  const pollerRef = useRef<UpdatePollerService | null>(null);
  const clientsRef = useRef<Client[]>([]);
  const saveUpdateMutationRef = useRef<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [recentResults, setRecentResults] = useState<PollResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // Initialize the poller service
  useEffect(() => {
    if (!pollerRef.current) {
      pollerRef.current = new UpdatePollerService(
        options.githubApiKey,
        options.pollingIntervalMinutes || 30
      );
    }

    return () => {
      if (pollerRef.current) {
        pollerRef.current.stop();
      }
    };
  }, []);

  // Handle autoStart separately to avoid including `start` in dependencies
  useEffect(() => {
    if (options.autoStart && !isRunning && pollerRef.current) {
      // Inline the start logic here to avoid dependency issues
      pollerRef.current['getClientsToPolll'] = async () => {
        return clientsRef.current.filter(client => client.github_url);
      };
      
      pollerRef.current['saveUpdates'] = async (updates: DetectedUpdate[]) => {
        console.log(`Would save ${updates.length} updates via background poller`);
      };

      pollerRef.current.start();
      setIsRunning(true);
    }
  }, [options.autoStart, isRunning]);

  // Get current status
  const { data: status } = useQuery({
    queryKey: ['updatePoller', 'status'],
    queryFn: () => pollerRef.current?.getStatus() || null,
    refetchInterval: isRunning ? 5000 : false, // Poll status every 5 seconds when running
    enabled: !!pollerRef.current,
  });

  // Get all clients for polling
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const clientService = new ClientService(apiConfig);
      return clientService.getClients();
    },
    enabled: !!user?.apiKey,
  });

  // Update clients ref when data changes
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  // Mutation for saving updates
  const saveUpdateMutation = useMutation({
    mutationFn: async ({ update }: { update: DetectedUpdate }) => {
      const protocolService = new ProtocolService(apiConfig);
      // Convert DetectedUpdate to the format expected by the API
      const updateData = {
        ...update.protocolUpdate,
      };
      return protocolService.createProtocolUpdate(updateData);
    },
    onSuccess: () => {
      // Invalidate protocol updates queries
      queryClient.invalidateQueries({ queryKey: ['protocol-updates'] });
      queryClient.invalidateQueries({ queryKey: ['protocolUpdates'] });
    },
  });

  // Update saveUpdateMutation ref when it changes
  useEffect(() => {
    saveUpdateMutationRef.current = saveUpdateMutation;
  }, [saveUpdateMutation]);

  const start = useCallback(() => {
    if (pollerRef.current && !isRunning) {
      // Override the getClientsToPolll method to use our actual clients
      const originalMethod = pollerRef.current['getClientsToPolll'];
      pollerRef.current['getClientsToPolll'] = async () => {
        return clientsRef.current.filter(client => client.github_url);
      };

      // Override the saveUpdates method to use our mutation
      pollerRef.current['saveUpdates'] = async (updates: DetectedUpdate[]) => {
        // We'll handle saving in the pollNow function instead
        // since we have the client context there
        console.log(`Would save ${updates.length} updates via background poller`);
      };

      pollerRef.current.start();
      setIsRunning(true);
    }
  }, [isRunning]);

  const stop = useCallback(() => {
    if (pollerRef.current && isRunning) {
      pollerRef.current.stop();
      setIsRunning(false);
    }
  }, [isRunning]);

  const pollNow = useCallback(async () => {
    if (!pollerRef.current || isPolling) return;
    
    setIsPolling(true);
    try {
      const currentClients = clientsRef.current;
      const currentSaveUpdateMutation = saveUpdateMutationRef.current;
      
      console.log('🔍 Poll Now: Starting manual poll...');
      console.log('📊 Total clients available:', currentClients.length);
      
      const results: PollResult[] = [];
      const activeClients = currentClients.filter(client => client.github_url);
      
      console.log('✅ Active clients with GitHub URLs:', activeClients.length);
      activeClients.forEach(client => {
        console.log(`  - ${client.name}: ${client.github_url}`);
      });
      
      if (activeClients.length === 0) {
        console.warn('⚠️ No clients with GitHub URLs found. Please configure client GitHub URLs first.');
      }
      
      for (const client of activeClients) {
        try {
          console.log(`🔄 Polling client: ${client.name} (${client.github_url})`);
          const result = await pollerRef.current.pollClient(client);
          results.push(result);
          
          console.log(`📈 Found ${result.updates.length} updates for ${client.name}`);
          if (result.errors.length > 0) {
            console.warn(`⚠️ Errors for ${client.name}:`, result.errors);
          }
          
          // Save any detected updates
          for (const update of result.updates) {
            try {
              console.log(`💾 Saving update: ${update.protocolUpdate.tag} for ${client.name}`);
              await currentSaveUpdateMutation.mutateAsync({ update });
              console.log(`✅ Successfully saved update: ${update.protocolUpdate.tag}`);
            } catch (error) {
              console.error('❌ Failed to save update:', error);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to poll client ${client.id}:`, error);
        }
      }
      
      setRecentResults(results);
      
      const totalUpdates = results.reduce((sum, result) => sum + result.updates.length, 0);
      console.log(`🎉 Poll completed! Found ${totalUpdates} total updates across ${results.length} clients`);
    } finally {
      setIsPolling(false);
    }
  }, [isPolling]);

  const setGitHubApiKey = useCallback((key: string) => {
    if (pollerRef.current) {
      pollerRef.current.setGitHubApiKey(key);
    }
  }, []);

  const setPollingInterval = useCallback((minutes: number) => {
    if (pollerRef.current) {
      pollerRef.current.setPollingInterval(minutes);
    }
  }, []);

  const resetPollTimestamps = useCallback(() => {
    if (pollerRef.current) {
      pollerRef.current.resetPollTimestamps();
    }
  }, []);

  const pollClient = useCallback(async (client: Client): Promise<PollResult> => {
    if (!pollerRef.current) {
      throw new Error('Poller service not initialized');
    }
    return pollerRef.current.pollClient(client);
  }, []);

  const saveUpdate = useCallback(async (update: DetectedUpdate) => {
    await saveUpdateMutationRef.current.mutateAsync({ update });
  }, []);

  return {
    isRunning,
    start,
    stop,
    pollNow,
    status: status || null,
    recentResults,
    setGitHubApiKey,
    setPollingInterval,
    resetPollTimestamps,
    pollClient,
    saveUpdate,
    isPolling,
    isSaving: saveUpdateMutation.isPending,
  };
}