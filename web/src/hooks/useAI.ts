/**
 * React hooks for AI functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getApiConfig } from '../utils';
import { AIService, AIAnalysis, AIConfig, AIConfigUpdate, AIFeedback } from '../services/ai';
import { notifications } from '@mantine/notifications';

export function useAIService() {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  return new AIService(apiConfig);
}

export function useAIConfig() {
  const aiService = useAIService();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiService.getAIConfig(),
    enabled: !!user?.apiKey && user?.is_admin,
  });
}

export function useUpdateAIConfig() {
  const aiService = useAIService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AIConfigUpdate) => aiService.updateAIConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      notifications.show({
        title: 'Success',
        message: 'AI configuration updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useTestAIConfig() {
  const aiService = useAIService();

  return useMutation({
    mutationFn: () => aiService.testAIConfig(),
    onSuccess: (data) => {
      if (data.status === 'success') {
        notifications.show({
          title: 'Success',
          message: 'AI configuration test passed',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Test Failed',
          message: data.message,
          color: 'red',
        });
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useAIAnalysis(updateId: number) {
  const aiService = useAIService();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ai-analysis', updateId],
    queryFn: () => aiService.getAIAnalysis(updateId),
    enabled: !!user?.apiKey && !!updateId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnalyzeProtocolUpdate() {
  const aiService = useAIService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ updateId, forceReanalyze = false }: { updateId: number; forceReanalyze?: boolean }) =>
      aiService.analyzeProtocolUpdate(updateId, forceReanalyze),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-analysis', variables.updateId] });
      queryClient.invalidateQueries({ queryKey: ['protocol-updates'] });
      notifications.show({
        title: 'Analysis Complete',
        message: 'AI analysis completed successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Analysis Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useSubmitAIFeedback() {
  const aiService = useAIService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedback: AIFeedback) => aiService.submitFeedback(feedback),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-feedback', variables.protocol_update_id] });
      notifications.show({
        title: 'Thank you!',
        message: 'Your feedback has been submitted',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useAIFeedback(updateId: number) {
  const aiService = useAIService();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ai-feedback', updateId],
    queryFn: () => aiService.getFeedback(updateId),
    enabled: !!user?.apiKey && !!updateId,
  });
}