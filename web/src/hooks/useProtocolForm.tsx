/**
 * Custom hook for managing protocol form operations
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { ProtocolService } from '../services/protocols';
import { useAuth } from './useAuth';
import type { Protocol, ProtocolCreate, ProtocolUpdateData } from '../types';
import { SUCCESS_MESSAGES, getApiConfig } from '../utils';

interface UseProtocolFormOptions {
  onSuccess?: (protocol: Protocol) => void;
  onError?: (error: Error) => void;
}

export function useProtocolForm(options: UseProtocolFormOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);

  const apiConfig = getApiConfig(user?.apiKey);

  const protocolService = new ProtocolService(apiConfig);

  // Create protocol mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProtocolCreate) => {
      return protocolService.createProtocol(data);
    },
    onSuccess: (protocol) => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
      notifications.show({
        title: 'Success',
        message: SUCCESS_MESSAGES.PROTOCOL_CREATED,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      options.onSuccess?.(protocol);
    },
    onError: (error) => {
      console.error('Failed to create protocol:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create protocol. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      options.onError?.(error as Error);
    },
  });

  // Update protocol mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ProtocolUpdateData) => {
      return protocolService.updateProtocol(data.id, data);
    },
    onSuccess: (protocol) => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
      queryClient.invalidateQueries({ queryKey: ['protocol', protocol.id] });
      notifications.show({
        title: 'Success',
        message: SUCCESS_MESSAGES.PROTOCOL_UPDATED,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      options.onSuccess?.(protocol);
    },
    onError: (error) => {
      console.error('Failed to update protocol:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update protocol. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      options.onError?.(error as Error);
    },
  });

  // Delete protocol mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return protocolService.deleteProtocol(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
      notifications.show({
        title: 'Success',
        message: SUCCESS_MESSAGES.PROTOCOL_DELETED,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Failed to delete protocol:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete protocol. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    },
  });

  // Modal management
  const openCreateModal = useCallback(() => {
    setEditingProtocol(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((protocol: Protocol) => {
    setEditingProtocol(protocol);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProtocol(null);
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(async (data: ProtocolCreate | ProtocolUpdateData): Promise<Protocol> => {
    let result: Protocol;
    if ('id' in data) {
      // Update existing protocol
      result = await updateMutation.mutateAsync(data);
    } else {
      // Create new protocol
      result = await createMutation.mutateAsync(data);
    }
    closeModal();
    return result;
  }, [createMutation, updateMutation, closeModal]);

  // Delete handler
  const handleDelete = useCallback(async (id: number) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const hookReturn = {
    // Modal state
    isModalOpen,
    editingProtocol,
    mode: editingProtocol ? 'edit' as const : 'create' as const,
    
    // Modal actions
    openCreateModal,
    openEditModal,
    closeModal,
    
    // Form actions
    handleSubmit,
    handleDelete,
    
    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isLoading: createMutation.isPending || updateMutation.isPending,
    
    // Error states
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };


  return hookReturn;
}