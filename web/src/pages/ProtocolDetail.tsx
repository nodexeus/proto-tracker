/**
 * Protocol detail page with updates and snapshots
 */

import { useParams } from 'react-router-dom';
import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Title,
  Button,
  Card,
  Badge,
  Alert,
  Loader,
  Image,
  Divider,
  ActionIcon,
  Tooltip,
  Box,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconAlertTriangle,
  IconClock,
  IconGitFork,
  IconActivity,
  IconAlertCircle,
} from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { UpdatesList } from '../components/protocol/UpdatesList';
import { SnapshotManager } from '../components/snapshots/SnapshotManager';
import { ProtocolForm } from '../components/forms';
import { useProtocolForm } from '../hooks/useProtocolForm';
import { useAuth } from '../hooks/useAuth';
import { useBlockNumber } from '../hooks/useBlockNumber';
import { ProtocolService } from '../services/protocols';
import { getApiConfig } from '../utils';

export function ProtocolDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'updates' | 'snapshots'>('overview');

  const {
    isModalOpen,
    editingProtocol,
    mode,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    isLoading: isFormLoading,
  } = useProtocolForm();

  const apiConfig = getApiConfig(user?.apiKey);

  const protocolService = new ProtocolService(apiConfig);

  const {
    data: protocol,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['protocol', id],
    queryFn: () => protocolService.getProtocol(parseInt(id!)),
    enabled: !!id,
  });

  const {
    data: updates,
    isLoading: updatesLoading,
  } = useQuery({
    queryKey: ['protocol-updates', id],
    queryFn: () => protocolService.getProtocolUpdates(parseInt(id!)),
    enabled: !!id,
  });

  const {
    data: snapshots,
    isLoading: snapshotsLoading,
  } = useQuery({
    queryKey: ['protocol-snapshots', id],
    queryFn: () => protocolService.getProtocolSnapshots(parseInt(id!)),
    enabled: !!id,
  });

  const {
    data: snapshotPrefixes,
    isLoading: snapshotPrefixesLoading,
  } = useQuery({
    queryKey: ['protocol-snapshot-prefixes', id],
    queryFn: () => protocolService.getProtocolSnapshotPrefixes(parseInt(id!)),
    enabled: !!id,
  });

  // Fetch current block number for protocols with RPC endpoints
  const {
    data: blockData,
    isLoading: blockLoading,
    error: blockError,
    isError: hasBlockError,
  } = useBlockNumber(protocol);

  if (isLoading) {
    return (
      <PageContainer title="Loading...">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </PageContainer>
    );
  }

  if (error || !protocol) {
    return (
      <PageContainer title="Error">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Error"
          color="red"
        >
          Failed to load protocol details. The protocol may not exist or you may not have permission to view it.
        </Alert>
      </PageContainer>
    );
  }

  const handleEditClick = () => {
    openEditModal(protocol);
  };

  const handleDeleteClick = async () => {
    if (window.confirm('Are you sure you want to delete this protocol? This action cannot be undone.')) {
      await handleDelete(protocol.id);
      // Navigate back to dashboard after deletion
      window.location.href = '/dashboard';
    }
  };

  return (
    <PageContainer title="Protocol Details">
      <Stack gap="lg">
        {/* Header Section */}
        <Group justify="space-between" align="flex-start">
          <Group align="center" gap="md">
            {protocol.logo && (
              <Image
                src={protocol.logo.startsWith('data:') ? protocol.logo : `data:image/png;base64,${protocol.logo}`}
                alt={`${protocol.name} logo`}
                w={64}
                h={64}
                fit="contain"
                radius="md"
                style={{ border: '1px solid #e0e0e0' }}
              />
            )}
            <div>
              <Group align="center" gap="sm">
                <Title order={1} size="h2">
                  {protocol.name}
                </Title>
                <Badge variant="light" color="blue">
                  Chain {protocol.chain_id}
                </Badge>
                <Badge variant="light" color="#7fcf00">
                  {protocol.network}
                </Badge>
              </Group>
              {protocol.proto_family && (
                <Text c="dimmed" size="sm">
                  Protocol Family: {protocol.proto_family}
                </Text>
              )}
            </div>
          </Group>

          <Group>
            <Button
              variant="light"
              leftSection={<IconEdit size={16} />}
              onClick={handleEditClick}
            >
              Edit
            </Button>
            <Tooltip label="Delete Protocol">
              <ActionIcon
                variant="light"
                color="red"
                onClick={handleDeleteClick}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Navigation Tabs */}
        <Group>
          <Button
            variant={activeTab === 'overview' ? 'filled' : 'subtle'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            variant={activeTab === 'updates' ? 'filled' : 'subtle'}
            onClick={() => setActiveTab('updates')}
          >
            Updates ({updates?.length || 0})
          </Button>
          {snapshotPrefixes && snapshotPrefixes.length > 0 && (
          <Button
            variant={activeTab === 'snapshots' ? 'filled' : 'subtle'}
            onClick={() => setActiveTab('snapshots')}
          >
            Snapshots ({snapshots?.length || 0})
          </Button>
          )}
        </Group>

        <Divider />

        {/* Content Based on Active Tab */}
        {activeTab === 'overview' && (
          <Stack gap="md">
            <Card withBorder padding="md">
              <Stack gap="sm">
                <Text fw={500} size="lg">
                  Protocol Information
                </Text>
                
                <Group grow>
                  <div>
                    <Text size="sm" c="dimmed">Chain ID</Text>
                    <Text fw={500}>{protocol.chain_id}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">Network</Text>
                    <Text fw={500}>{protocol.network}</Text>
                  </div>
                  {protocol.bpm && (
                    <div>
                      <Text size="sm" c="dimmed">Blocks Per Minute</Text>
                      <Text fw={500}>{protocol.bpm}</Text>
                    </div>
                  )}
                </Group>

                {(protocol.explorer || protocol.public_rpc) && (
                  <>
                    <Divider />
                    <Group>
                      {protocol.explorer && (
                        <Button
                          variant="light"
                          leftSection={<IconExternalLink size={16} />}
                          component="a"
                          href={protocol.explorer}
                          target="_blank"
                          size="sm"
                        >
                          View Explorer
                        </Button>
                      )}
                      {protocol.public_rpc && (
                        <Button
                          variant="light"
                          leftSection={<IconExternalLink size={16} />}
                          component="a"
                          href={protocol.public_rpc}
                          target="_blank"
                          size="sm"
                        >
                          Public RPC
                        </Button>
                      )}
                    </Group>
                  </>
                )}
              </Stack>
            </Card>

            {/* Current Block Number */}
            {protocol.public_rpc && (
              <Card withBorder padding="md">
                <Group justify="space-between" align="center">
                  <Group align="center" gap="sm">
                    <IconActivity size={20} color={hasBlockError ? 'red' : blockData ? '#7fcf00' : 'gray'} />
                    <div>
                      <Text fw={500} size="sm">
                        Current Block Number
                      </Text>
                      <Text size="xs" c="dimmed">
                        Live from RPC endpoint
                      </Text>
                    </div>
                  </Group>
                  
                  <div style={{ textAlign: 'right' }}>
                    {blockLoading ? (
                      <Loader size="sm" />
                    ) : hasBlockError ? (
                      <Group align="center" gap="xs">
                        <IconAlertCircle size={16} color="red" />
                        <Text size="sm" c="red">
                          RPC Error
                        </Text>
                      </Group>
                    ) : blockData ? (
                      <div>
                        <Text fw={700} size="lg" c="blue">
                          {blockData.blockNumber.toLocaleString()}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                          {blockData.blockNumberHex}
                        </Text>
                      </div>
                    ) : null}
                  </div>
                </Group>

                {hasBlockError && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    mt="sm"
                    size="sm"
                  >
                    <Text size="xs" mb={4}>
                      {blockError?.message || 'Failed to fetch current block number'}
                    </Text>
                    {blockError?.message?.includes('CORS') && (
                      <Text size="xs" c="dimmed">
                        💡 This is likely because the RPC server doesn't allow cross-origin requests. You may need to configure CORS headers on the RPC server or use a proxy.
                      </Text>
                    )}
                  </Alert>
                )}
              </Card>
            )}

            {/* Quick Stats */}
            <Group grow>
              <Card withBorder padding="md" ta="center">
                <Text size="xl" fw={700} c="blue">
                  {updates?.length || 0}
                </Text>
                <Text size="sm" c="dimmed">Total Updates</Text>
              </Card>
              
              <Card withBorder padding="md" ta="center">
                <Text size="xl" fw={700} c="#7fcf00">
                  {snapshots?.length || 0}
                </Text>
                <Text size="sm" c="dimmed">Available Snapshots</Text>
              </Card>
              
              <Card withBorder padding="md" ta="center">
                <Text size="xl" fw={700} c="orange">
                  {updates?.filter(u => u.hard_fork).length || 0}
                </Text>
                <Text size="sm" c="dimmed">Hard Forks</Text>
              </Card>
            </Group>

            {/* Recent Activity */}
            <Card withBorder padding="md">
              <Text fw={500} size="lg" mb="md">
                Recent Activity
              </Text>
              {updatesLoading ? (
                <Loader size="sm" />
              ) : updates && updates.length > 0 ? (
                <Stack gap="xs">
                  {updates.slice(0, 3).map((update) => (
                    <Group key={update.id} justify="space-between">
                      <Group gap="sm">
                        <IconClock size={16} color="gray" />
                        <div>
                          <Text size="sm" fw={500}>
                            {update.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {update.client} • {new Date(update.date).toLocaleDateString()}
                          </Text>
                        </div>
                      </Group>
                      <Group gap="xs">
                        {update.hard_fork && (
                          <Badge size="xs" color="red" leftSection={<IconGitFork size={12} />}>
                            Hard Fork
                          </Badge>
                        )}
                        {!update.is_closed && update.ticket && (
                          <Badge size="xs" color="yellow">
                            Open Ticket
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="md">
                  No updates available
                </Text>
              )}
            </Card>
          </Stack>
        )}

        {activeTab === 'updates' && (
          <Box>
            {updatesLoading ? (
              <Group justify="center" py="xl">
                <Loader size="lg" />
              </Group>
            ) : (
              <UpdatesList updates={updates || []} />
            )}
          </Box>
        )}

        {activeTab === 'snapshots' && (
          <Box>
            {snapshotsLoading ? (
              <Group justify="center" py="xl">
                <Loader size="lg" />
              </Group>
            ) : (
              <SnapshotManager snapshots={snapshots || []} protocolId={protocol.id} />
            )}
          </Box>
        )}

      </Stack>

      {/* Edit Form Modal */}
      <ProtocolForm
        opened={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        protocol={editingProtocol}
        loading={isFormLoading}
        mode={mode}
      />
    </PageContainer>
  );
}