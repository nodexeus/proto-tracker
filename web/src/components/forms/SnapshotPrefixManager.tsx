/**
 * Snapshot Prefix Management Component
 * Allows managing multiple snapshot prefixes for a protocol
 */

import React, { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  Button,
  Card,
  Badge,
  ActionIcon,
  Table,
  Switch,
  Modal,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { ApiService } from '../../services/api';
import { getApiConfig } from '../../utils';
import { useAuth } from '../../hooks/useAuth';
import type { ProtocolSnapshotPrefix, ProtocolSnapshotPrefixCreate, ProtocolSnapshotPrefixUpdate } from '../../types/protocol';

interface SnapshotPrefixManagerProps {
  protocolId: number;
}

interface FormValues {
  prefix: string;
  client_name: string;
  network: string;
  node_type: string;
  description: string;
  is_active: boolean;
}

class SnapshotPrefixService extends ApiService {
  async getProtocolSnapshotPrefixes(protocolId: number): Promise<ProtocolSnapshotPrefix[]> {
    return this.get<ProtocolSnapshotPrefix[]>(`/protocols/${protocolId}/snapshot-prefixes`);
  }

  async createSnapshotPrefix(protocolId: number, data: ProtocolSnapshotPrefixCreate): Promise<ProtocolSnapshotPrefix> {
    return this.post<ProtocolSnapshotPrefix>(`/protocols/${protocolId}/snapshot-prefixes`, data);
  }

  async updateSnapshotPrefix(prefixId: number, data: ProtocolSnapshotPrefixUpdate): Promise<ProtocolSnapshotPrefix> {
    return this.put<ProtocolSnapshotPrefix>(`/snapshot-prefixes/${prefixId}`, data);
  }

  async deleteSnapshotPrefix(prefixId: number): Promise<void> {
    return this.delete(`/snapshot-prefixes/${prefixId}`);
  }
}

export function SnapshotPrefixManager({ protocolId }: SnapshotPrefixManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingPrefix, setEditingPrefix] = useState<ProtocolSnapshotPrefix | null>(null);

  const apiConfig = getApiConfig(user?.apiKey);
  const prefixService = new SnapshotPrefixService(apiConfig);

  const form = useForm<FormValues>({
    initialValues: {
      prefix: '',
      client_name: '',
      network: '',
      node_type: '',
      description: '',
      is_active: true,
    },
    validate: {
      prefix: (value) => (!value.trim() ? 'Prefix is required' : null),
    },
  });

  // Get snapshot prefixes
  const { data: prefixes, isLoading } = useQuery({
    queryKey: ['snapshot-prefixes', protocolId],
    queryFn: () => prefixService.getProtocolSnapshotPrefixes(protocolId),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const createData: ProtocolSnapshotPrefixCreate = {
        protocol_id: protocolId,
        prefix: data.prefix.trim(),
        client_name: data.client_name.trim() || undefined,
        network: data.network.trim() || undefined,
        node_type: data.node_type.trim() || undefined,
        description: data.description.trim() || undefined,
        is_active: data.is_active,
      };
      return prefixService.createSnapshotPrefix(protocolId, createData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshot-prefixes', protocolId] });
      setModalOpened(false);
      form.reset();
      notifications.show({
        title: 'Success',
        message: 'Snapshot prefix created successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create snapshot prefix',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormValues }) => {
      const updateData: ProtocolSnapshotPrefixUpdate = {
        prefix: data.prefix.trim(),
        client_name: data.client_name.trim() || undefined,
        network: data.network.trim() || undefined,
        node_type: data.node_type.trim() || undefined,
        description: data.description.trim() || undefined,
        is_active: data.is_active,
      };
      return prefixService.updateSnapshotPrefix(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshot-prefixes', protocolId] });
      setModalOpened(false);
      setEditingPrefix(null);
      form.reset();
      notifications.show({
        title: 'Success',
        message: 'Snapshot prefix updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to update snapshot prefix',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => prefixService.deleteSnapshotPrefix(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshot-prefixes', protocolId] });
      notifications.show({
        title: 'Success',
        message: 'Snapshot prefix deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete snapshot prefix',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (editingPrefix) {
      updateMutation.mutate({ id: editingPrefix.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (prefix: ProtocolSnapshotPrefix) => {
    setEditingPrefix(prefix);
    form.setValues({
      prefix: prefix.prefix,
      client_name: prefix.client_name || '',
      network: prefix.network || '',
      node_type: prefix.node_type || '',
      description: prefix.description || '',
      is_active: prefix.is_active,
    });
    setModalOpened(true);
  };

  const handleAdd = () => {
    setEditingPrefix(null);
    form.reset();
    setModalOpened(true);
  };

  const handleDelete = (prefix: ProtocolSnapshotPrefix) => {
    if (window.confirm(`Are you sure you want to delete the prefix "${prefix.prefix}"?`)) {
      deleteMutation.mutate(prefix.id);
    }
  };

  if (isLoading) {
    return <Text>Loading snapshot prefixes...</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={500} size="lg">Snapshot Prefixes</Text>
          <Text size="sm" c="dimmed">
            Define multiple snapshot prefixes for different client/network combinations
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleAdd}
        >
          Add Prefix
        </Button>
      </Group>

      {(!prefixes || prefixes.length === 0) ? (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
          No snapshot prefixes defined. Add prefixes to enable snapshot scanning for this protocol.
        </Alert>
      ) : (
        <Card withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Prefix</Table.Th>
                <Table.Th>Client</Table.Th>
                <Table.Th>Network</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {prefixes.map((prefix) => (
                <Table.Tr key={prefix.id}>
                  <Table.Td>
                    <Text fw={500}>{prefix.prefix}</Text>
                    {prefix.description && (
                      <Text size="xs" c="dimmed">{prefix.description}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>{prefix.client_name || '-'}</Table.Td>
                  <Table.Td>{prefix.network || '-'}</Table.Td>
                  <Table.Td>{prefix.node_type || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={prefix.is_active ? 'green' : 'gray'} variant="light">
                      {prefix.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        onClick={() => handleEdit(prefix)}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(prefix)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingPrefix(null);
          form.reset();
        }}
        title={editingPrefix ? 'Edit Snapshot Prefix' : 'Add Snapshot Prefix'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Snapshot Prefix"
              placeholder="e.g. ethereum-reth-mainnet-archive-v1"
              description="The S3 prefix used to identify snapshots for this client/network combination"
              required
              {...form.getInputProps('prefix')}
            />

            <Group grow>
              <TextInput
                label="Client Name"
                placeholder="e.g. reth, erigon, geth"
                {...form.getInputProps('client_name')}
              />
              <TextInput
                label="Network"
                placeholder="e.g. mainnet, testnet"
                {...form.getInputProps('network')}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Node Type"
                placeholder="e.g. archive, full"
                {...form.getInputProps('node_type')}
              />
              <div>
                <Text size="sm" fw={500} mb="xs">Status</Text>
                <Switch
                  label="Active"
                  description="Enable scanning for this prefix"
                  {...form.getInputProps('is_active', { type: 'checkbox' })}
                />
              </div>
            </Group>

            <TextInput
              label="Description (Optional)"
              placeholder="Brief description of this prefix"
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  setModalOpened(false);
                  setEditingPrefix(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingPrefix ? 'Update' : 'Create'} Prefix
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}