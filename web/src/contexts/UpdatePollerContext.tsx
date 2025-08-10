/**
 * Global UpdatePoller context to persist poller state across navigation
 */

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UpdatePollerService, type PollResult, type PollingStatus, type DetectedUpdate } from '../services/updatePoller';
import { ClientService } from '../services/clients';
import { ProtocolService } from '../services/protocols';
import { AdminService } from '../services/admin';
import { useAuth } from '../hooks/useAuth';
import { getApiConfig } from '../utils';
import type { Client } from '../types/client';

interface UpdatePollerContextType {
  // Service control
  isRunning: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pollNow: () => Promise<void>;
  
  // Status and data
  status: PollingStatus | null;
  recentResults: PollResult[];
  
  // Configuration
  setGitHubApiKey: (key: string) => void;
  setPollingInterval: (minutes: number) => Promise<void>;
  resetPollTimestamps: () => void;
  
  // Current configuration
  currentGithubApiKey: string;
  currentPollingInterval: number;
  
  // Manual operations
  pollClient: (client: Client) => Promise<PollResult>;
  saveUpdate: (update: DetectedUpdate) => Promise<void>;
  
  // Loading states
  isPolling: boolean;
  isSaving: boolean;
}

export const UpdatePollerContext = createContext<UpdatePollerContextType | undefined>(undefined);

interface UpdatePollerProviderProps {
  children: React.ReactNode;
}

export function UpdatePollerProvider({ children }: UpdatePollerProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use refs to maintain service instance across renders
  const pollerServiceRef = useRef<UpdatePollerService | null>(null);
  const clientsRef = useRef<Client[]>([]);
  const saveUpdateMutationRef = useRef<any>(null);
  
  // Local state for React updates
  const [isRunning, setIsRunning] = useState(false);
  const [recentResults, setRecentResults] = useState<PollResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [githubApiKey, setGithubApiKey] = useState<string>('');
  const [pollingIntervalMinutes, setPollingIntervalMinutes] = useState(5);

  const apiConfig = getApiConfig(user?.apiKey);

  // Helper function to set up service overrides
  const setupServiceOverrides = useCallback((service: UpdatePollerService) => {
    service['getClientsToPolll'] = async () => {
      return clientsRef.current.filter(client => client.github_url);
    };

    service['saveUpdates'] = async (updates: DetectedUpdate[]) => {
      console.log(`💾 Global poller: Saving ${updates.length} updates`);
      const currentSaveUpdateMutation = saveUpdateMutationRef.current;
      
      if (currentSaveUpdateMutation) {
        for (const update of updates) {
          try {
            console.log(`💾 Saving update: ${update.protocolUpdate.tag}`);
            await currentSaveUpdateMutation.mutateAsync({ update });
            console.log(`✅ Successfully saved update: ${update.protocolUpdate.tag}`);
          } catch (error) {
            console.error('❌ Failed to save update:', error);
          }
        }
      } else {
        console.warn('⚠️ No saveUpdateMutation available for background saving');
      }
    };

    // Override the runPollingCycle to update database timing
    const originalRunPollingCycle = service['runPollingCycle'].bind(service);
    service['runPollingCycle'] = async () => {
      console.log('🔄 Starting enhanced polling cycle with database timing');
      
      // Update last poll time in database at start of cycle
      try {
        const adminService = new AdminService(apiConfig);
        await adminService.updateGitHubConfig({ last_poll_time: new Date().toISOString() });
        console.log('💾 Updated last poll time in database');
        queryClient.invalidateQueries({ queryKey: ['github-config'] });
      } catch (error) {
        console.error('Failed to update poll time in database:', error);
      }
      
      // Run the original polling cycle
      await originalRunPollingCycle();
    };
  }, [apiConfig, queryClient]);

  // Fetch GitHub configuration from database
  const { data: githubConfig } = useQuery({
    queryKey: ['github-config'],
    queryFn: async () => {
      const adminService = new AdminService(apiConfig);
      return adminService.getGitHubConfig();
    },
    enabled: !!user?.apiKey,
  });

  // Update local state when config loads
  useEffect(() => {
    if (githubConfig?.api_key) {
      console.log('🔑 Loaded GitHub API key from database for global poller');
      setGithubApiKey(githubConfig.api_key);
    }
    if (githubConfig?.polling_interval_minutes) {
      console.log(`⏱️ Loaded polling interval from database: ${githubConfig.polling_interval_minutes} minutes`);
      setPollingIntervalMinutes(githubConfig.polling_interval_minutes);
    }
    if (githubConfig?.poller_enabled !== undefined) {
      console.log(`🔄 Loaded poller state from database: ${githubConfig.poller_enabled ? 'enabled' : 'disabled'}`);
      setIsRunning(githubConfig.poller_enabled);
      
      // Auto-sync the service state - every browser session should run if database says enabled
      if (pollerServiceRef.current && githubApiKey) {
        if (githubConfig.poller_enabled && !pollerServiceRef.current['isRunning']) {
          console.log('🚀 Auto-starting poller service to match database state');
          setupServiceOverrides(pollerServiceRef.current);
          pollerServiceRef.current.start();
        } else if (!githubConfig.poller_enabled && pollerServiceRef.current['isRunning']) {
          console.log('🛑 Auto-stopping poller service to match database state');
          pollerServiceRef.current.stop();
        }
      }
    }
  }, [githubConfig, githubApiKey, setupServiceOverrides]);

  // Initialize poller service once
  useEffect(() => {
    if (!pollerServiceRef.current) {
      console.log('🏗️ Initializing global UpdatePollerService');
      pollerServiceRef.current = new UpdatePollerService(githubApiKey, pollingIntervalMinutes);
      
      // Sync initial state from service
      const serviceIsRunning = pollerServiceRef.current['isRunning'] || false;
      setIsRunning(serviceIsRunning);
      
      console.log(`📊 Global poller initialized - Running: ${serviceIsRunning}`);
    }
  }, []);

  // Periodically sync running state with service (in case they get out of sync)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pollerServiceRef.current) {
        const serviceIsRunning = pollerServiceRef.current['isRunning'] || false;
        if (serviceIsRunning !== isRunning) {
          console.log(`🔄 Syncing poller state: ${isRunning} → ${serviceIsRunning}`);
          setIsRunning(serviceIsRunning);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(syncInterval);
  }, [isRunning]);

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
      const updateData = { ...update.protocolUpdate };
      return protocolService.createProtocolUpdate(updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocol-updates'] });
      queryClient.invalidateQueries({ queryKey: ['protocolUpdates'] });
    },
  });

  // Update saveUpdateMutation ref
  useEffect(() => {
    saveUpdateMutationRef.current = saveUpdateMutation;
  }, [saveUpdateMutation]);

  // Get current status with polling - now using database timing
  const { data: status } = useQuery({
    queryKey: ['updatePoller', 'status'],
    queryFn: () => {
      if (!pollerServiceRef.current || !githubConfig) return null;
      
      const serviceStatus = pollerServiceRef.current.getStatus();
      
      // Override with database timing if available
      const lastRun = githubConfig.last_poll_time ? new Date(githubConfig.last_poll_time) : undefined;
      let nextRun: Date | undefined = undefined;
      
      if (githubConfig.poller_enabled && lastRun && githubConfig.polling_interval_minutes) {
        const nextRunTime = lastRun.getTime() + (githubConfig.polling_interval_minutes * 60 * 1000);
        nextRun = new Date(nextRunTime);
      }
      
      return {
        ...serviceStatus,
        isRunning: githubConfig.poller_enabled,
        lastRun,
        nextRun,
      };
    },
    refetchInterval: 5000, // Poll status every 5 seconds
    enabled: !!pollerServiceRef.current && !!githubConfig,
  });

  // Update GitHub API key when changed
  useEffect(() => {
    if (pollerServiceRef.current && githubApiKey) {
      console.log('🔑 Updating GitHub API key in global poller');
      pollerServiceRef.current.setGitHubApiKey(githubApiKey);
    }
  }, [githubApiKey]);

  // Update polling interval when changed
  useEffect(() => {
    if (pollerServiceRef.current && pollingIntervalMinutes !== undefined) {
      console.log(`🔧 Updating global poller interval to ${pollingIntervalMinutes} minutes`);
      pollerServiceRef.current.setPollingInterval(pollingIntervalMinutes);
    }
  }, [pollingIntervalMinutes]);

  const start = useCallback(async () => {
    if (!pollerServiceRef.current || isRunning) return;

    const currentClients = clientsRef.current;
    const activeClients = currentClients.filter(client => client.github_url);
    
    console.log(`🚀 Starting global GitHub poller with ${currentClients.length} total clients, ${activeClients.length} active clients`);
    activeClients.forEach(client => {
      console.log(`  ✅ Active client: ${client.name} (${client.github_url})`);
    });

    // Set up service overrides
    setupServiceOverrides(pollerServiceRef.current);

    pollerServiceRef.current.start();
    setIsRunning(true);
    
    // Save state to database
    try {
      const adminService = new AdminService(apiConfig);
      await adminService.updateGitHubConfig({ poller_enabled: true });
      console.log('💾 Saved poller enabled state to database');
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
    } catch (error) {
      console.error('Failed to save poller state to database:', error);
    }
  }, [isRunning, setupServiceOverrides, apiConfig, queryClient]);

  const stop = useCallback(async () => {
    if (!pollerServiceRef.current || !isRunning) return;
    
    console.log('🛑 Stopping global GitHub poller');
    pollerServiceRef.current.stop();
    setIsRunning(false);
    
    // Save state to database
    try {
      const adminService = new AdminService(apiConfig);
      await adminService.updateGitHubConfig({ poller_enabled: false });
      console.log('💾 Saved poller disabled state to database');
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
    } catch (error) {
      console.error('Failed to save poller state to database:', error);
    }
  }, [isRunning, apiConfig, queryClient]);

  const pollNow = useCallback(async () => {
    if (!pollerServiceRef.current || isPolling) return;
    
    setIsPolling(true);
    try {
      const currentClients = clientsRef.current;
      const currentSaveUpdateMutation = saveUpdateMutationRef.current;
      
      console.log('🔍 Manual poll: Starting...');
      console.log('📊 Total clients available:', currentClients.length);
      
      const results: PollResult[] = [];
      const activeClients = currentClients.filter(client => client.github_url);
      
      console.log('✅ Active clients with GitHub URLs:', activeClients.length);
      
      if (activeClients.length === 0) {
        console.warn('⚠️ No clients with GitHub URLs found. Please configure client GitHub URLs first.');
      }
      
      for (const client of activeClients) {
        try {
          console.log(`🔄 Polling client: ${client.name} (${client.github_url})`);
          const result = await pollerServiceRef.current.pollClient(client);
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
      
      // Update last poll time in database for manual polls too
      try {
        const adminService = new AdminService(apiConfig);
        await adminService.updateGitHubConfig({ last_poll_time: new Date().toISOString() });
        console.log('💾 Updated last poll time in database after manual poll');
        queryClient.invalidateQueries({ queryKey: ['github-config'] });
      } catch (error) {
        console.error('Failed to update poll time in database:', error);
      }
      
      const totalUpdates = results.reduce((sum, result) => sum + result.updates.length, 0);
      console.log(`🎉 Poll completed! Found ${totalUpdates} total updates across ${results.length} clients`);
    } finally {
      setIsPolling(false);
    }
  }, [isPolling]);

  const setGitHubApiKey = useCallback((key: string) => {
    console.log('🔑 Setting GitHub API key in global context');
    setGithubApiKey(key);
    if (pollerServiceRef.current) {
      pollerServiceRef.current.setGitHubApiKey(key);
    }
  }, []);

  const setPollingInterval = useCallback(async (minutes: number) => {
    console.log(`🔧 Setting polling interval to ${minutes} minutes in global context`);
    setPollingIntervalMinutes(minutes);
    if (pollerServiceRef.current) {
      pollerServiceRef.current.setPollingInterval(minutes);
    }
    
    // Save to database
    try {
      const adminService = new AdminService(apiConfig);
      await adminService.updateGitHubConfig({ polling_interval_minutes: minutes });
      console.log(`💾 Saved polling interval to database: ${minutes} minutes`);
      
      // Invalidate the query to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
    } catch (error) {
      console.error('Failed to save polling interval to database:', error);
    }
  }, [apiConfig, queryClient]);

  const resetPollTimestamps = useCallback(() => {
    if (pollerServiceRef.current) {
      pollerServiceRef.current.resetPollTimestamps();
    }
  }, []);

  const pollClient = useCallback(async (client: Client): Promise<PollResult> => {
    if (!pollerServiceRef.current) {
      throw new Error('Poller service not initialized');
    }
    return pollerServiceRef.current.pollClient(client);
  }, []);

  const saveUpdate = useCallback(async (update: DetectedUpdate) => {
    await saveUpdateMutationRef.current.mutateAsync({ update });
  }, []);

  return (
    <UpdatePollerContext.Provider
      value={{
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
        currentGithubApiKey: githubApiKey,
        currentPollingInterval: pollingIntervalMinutes,
      }}
    >
      {children}
    </UpdatePollerContext.Provider>
  );
}

export function useUpdatePoller() {
  const context = useContext(UpdatePollerContext);
  if (context === undefined) {
    console.error('useUpdatePoller called outside UpdatePollerProvider context');
    console.error('Stack trace:', new Error().stack);
    throw new Error('useUpdatePoller must be used within an UpdatePollerProvider');
  }
  return context;
}