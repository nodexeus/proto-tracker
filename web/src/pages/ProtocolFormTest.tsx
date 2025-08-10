/**
 * Test page for ProtocolForm component - for development testing only
 */

import { Button, Stack, Text, Group } from '@mantine/core';
import { ProtocolForm } from '../components/forms';
import { useProtocolForm } from '../hooks';
import type { Protocol } from '../types';

export function ProtocolFormTest() {
  const {
    isModalOpen,
    editingProtocol,
    mode,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    isLoading,
  } = useProtocolForm({
    onSuccess: (protocol) => {
      console.log('Protocol saved successfully:', protocol);
    },
    onError: (error) => {
      console.error('Failed to save protocol:', error);
    },
  });

  // Mock protocol for testing edit mode
  const mockProtocol: Protocol = {
    id: 1,
    name: 'Ethereum',
    chain_id: '1',
    network: 'mainnet',
    explorer: 'https://etherscan.io',
    public_rpc: 'https://eth.llamarpc.com',
    proto_family: 'ethereum',
    bpm: 5,
    snapshot_prefix: 'eth-mainnet',
    logo: undefined,
  };

  return (
    <Stack gap="lg" p="md">
      <Text size="xl" fw={700}>
        Protocol Form Test Page
      </Text>
      
      <Text c="dimmed">
        This page is for testing the ProtocolForm component functionality.
      </Text>

      <Group>
        <Button onClick={openCreateModal}>
          Test Create Form
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => openEditModal(mockProtocol)}
        >
          Test Edit Form
        </Button>
      </Group>

      <ProtocolForm
        opened={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        protocol={editingProtocol}
        loading={isLoading}
        mode={mode}
      />
    </Stack>
  );
}