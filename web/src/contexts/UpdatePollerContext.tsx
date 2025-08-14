/**
 * Global UpdatePoller context to persist poller state across navigation
 */

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PollResult, type DetectedUpdate } from '../services/updatePoller';
import { ProtocolService } from '../services/protocols';
import { AdminService } from '../services/admin';
import { useAuth } from '../hooks/useAuth';
import { getApiConfig } from '../utils';
import type { Client } from '../types/client';

// Define a custom status type for server-side poller
interface ServerPollerStatus {
  isRunning: boolean;
  databaseEnabled: boolean;
  taskAlive: boolean;
  lastRun: Date | undefined;
  nextRun: Date | undefined;
  pollingInterval: number;
}

interface UpdatePollerContextType {
  // Service control
  isRunning: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pollNow: () => Promise<void>;
  
  // Status and data
  status: ServerPollerStatus | null;
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
  
  // Use refs for mutation access
  const saveUpdateMutationRef = useRef<any>(null);
  
  // Local state for React updates
  const [isRunning, setIsRunning] = useState(false);
  const [recentResults] = useState<PollResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [githubApiKey, setGithubApiKey] = useState<string>('');
  const [pollingIntervalMinutes, setPollingIntervalMinutes] = useState(5);

  const apiConfig = getApiConfig(user?.apiKey);

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
    }
  }, [githubConfig]);

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

  // Get current status from server-side poller
  const { data: status } = useQuery({
    queryKey: ['updatePoller', 'status'],
    queryFn: async () => {
      if (!githubConfig) return null;
      
      try {
        const adminService = new AdminService(apiConfig);
        const serverStatus = await adminService.getBackgroundPollerStatus();
        
        // Calculate next run time
        const lastRun = serverStatus.last_poll_time ? new Date(serverStatus.last_poll_time) : undefined;
        let nextRun: Date | undefined = undefined;
        
        if (serverStatus.is_running && lastRun && serverStatus.polling_interval_minutes) {
          const nextRunTime = lastRun.getTime() + (serverStatus.polling_interval_minutes * 60 * 1000);
          nextRun = new Date(nextRunTime);
        }
        
        return {
          isRunning: serverStatus.is_running,
          databaseEnabled: serverStatus.database_enabled,
          taskAlive: serverStatus.task_alive,
          lastRun,
          nextRun,
          pollingInterval: serverStatus.polling_interval_minutes,
        };
      } catch (error) {
        console.error('Failed to get server-side poller status:', error);
        return null;
      }
    },
    // No polling - status only fetched on mount and after user actions
    enabled: !!githubConfig && !!user?.apiKey,
  });

  // Note: GitHub API key and polling interval are now managed server-side

  const start = useCallback(async () => {
    if (isRunning) return;

    console.log('🚀 Starting server-side background poller');
    setIsRunning(true);
    
    try {
      const adminService = new AdminService(apiConfig);
      const result = await adminService.startBackgroundPoller();
      console.log('✅ Server-side poller started:', result.message);
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
      queryClient.invalidateQueries({ queryKey: ['updatePoller', 'status'] });
    } catch (error) {
      console.error('Failed to start server-side poller:', error);
      setIsRunning(false);
      throw error;
    }
  }, [isRunning, apiConfig, queryClient]);

  const stop = useCallback(async () => {
    if (!isRunning) return;
    
    console.log('🛑 Stopping server-side background poller');
    setIsRunning(false);
    
    try {
      const adminService = new AdminService(apiConfig);
      const result = await adminService.stopBackgroundPoller();
      console.log('✅ Server-side poller stopped:', result.message);
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
      queryClient.invalidateQueries({ queryKey: ['updatePoller', 'status'] });
    } catch (error) {
      console.error('Failed to stop server-side poller:', error);
      setIsRunning(true);
      throw error;
    }
  }, [isRunning, apiConfig, queryClient]);

  const pollNow = useCallback(async () => {
    if (isPolling) return;
    
    setIsPolling(true);
    try {
      console.log('🔍 Manual poll: Starting server-side poll...');
      
      const adminService = new AdminService(apiConfig);
      const result = await adminService.pollNowBackground();
      
      console.log('✅ Server-side poll completed:', {
        status: result.status,
        clientsPolled: result.clients_polled,
        updatesCreated: result.updates_created,
        errors: result.errors?.length || 0
      });
      
      if (result.errors && result.errors.length > 0) {
        console.warn('⚠️ Poll errors:', result.errors);
      }
      
      // Refresh the queries to show updated data
      queryClient.invalidateQueries({ queryKey: ['github-config'] });
      queryClient.invalidateQueries({ queryKey: ['protocol-updates'] });
      queryClient.invalidateQueries({ queryKey: ['protocolUpdates'] });
      
      console.log(`🎉 Server-side poll completed! Created ${result.updates_created || 0} updates across ${result.clients_polled || 0} clients`);
    } catch (error) {
      console.error('Failed to run server-side poll:', error);
      throw error;
    } finally {
      setIsPolling(false);
    }
  }, [isPolling, apiConfig, queryClient]);

  const setGitHubApiKey = useCallback((key: string) => {
    console.log('🔑 Setting GitHub API key (now managed server-side)');
    setGithubApiKey(key);
  }, []);

  const setPollingInterval = useCallback(async (minutes: number) => {
    console.log(`🔧 Setting polling interval to ${minutes} minutes (server-side)`);
    setPollingIntervalMinutes(minutes);
    
    // Save to database - server-side poller will pick up the change automatically
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
    console.log('🔄 Reset poll timestamps (server-side polling manages timestamps automatically)');
  }, []);

  const pollClient = useCallback(async (client: Client): Promise<PollResult> => {
    // This method is kept for backward compatibility but now triggers a full server-side poll
    await pollNow();
    return { client, updates: [], errors: [], lastPolled: new Date() };
  }, [pollNow]);

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