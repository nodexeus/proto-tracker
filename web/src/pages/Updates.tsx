/**
 * Updates page - Lists all protocol updates/releases with client and protocol associations
 */

import { useState, useMemo } from 'react';
import {
  Table,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Text,
  Loader,
  Center,
  Alert,
  Badge,
  Anchor,
  Card,
  ScrollArea,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconAlertCircle,
  IconExternalLink,
  IconGitBranch,
  IconCalendar,
  IconDeviceDesktop,
  IconDatabase,
  IconRefresh,
  IconEye,
} from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { UpdateDetailsModal } from '../components/modals';
import { useEnrichedProtocolUpdates, useClients } from '../hooks';
import type { ProtocolUpdate } from '../types';

export function Updates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [selectedUpdate, setSelectedUpdate] = useState<ProtocolUpdate | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const {
    data: updates,
    isLoading,
    error,
    refetch,
  } = useEnrichedProtocolUpdates();

  // Get clients for filter dropdown
  const { data: clients } = useClients();

  // Memoized filtering logic
  const filteredUpdates = useMemo(() => {
    if (!updates) return [];
    
    return updates.filter((update) => {
      const matchesSearch = !searchQuery || 
        update.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        update.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        update.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        update.tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        update.release_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClient = !clientFilter || update.client === clientFilter;

      // Status filter logic
      const matchesStatus = !statusFilter || 
        (statusFilter === 'draft' && update.is_draft) ||
        (statusFilter === 'prerelease' && update.is_prerelease) ||
        (statusFilter === 'release' && !update.is_draft && !update.is_prerelease) ||
        (statusFilter === 'hardfork' && update.hard_fork);

      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [updates, searchQuery, clientFilter, statusFilter]);

  // Get unique clients for filter dropdown from actual clients
  const clientOptions = useMemo(() => {
    if (!clients) return [];
    return clients.map(client => ({
      value: client.client || client.name || '',
      label: `${client.name} ${client.client ? `(${client.client})` : ''}`.trim()
    }));
  }, [clients]);

  const statusOptions = [
    { value: 'release', label: 'Releases' },
    { value: 'prerelease', label: 'Pre-releases' },
    { value: 'draft', label: 'Drafts' },
    { value: 'hardfork', label: 'Hard Forks' },
  ];

  const handleUpdateClick = (update: ProtocolUpdate) => {
    setSelectedUpdate(update);
    setModalOpened(true);
  };

  const handleModalClose = () => {
    setModalOpened(false);
    setSelectedUpdate(null);
  };

  const handleUpdateSaved = () => {
    console.log('Update saved, refreshing data...');
    // Force refetch the updates data
    refetch();
  };

  if (isLoading) {
    return (
      <PageContainer title="Updates" description="Track protocol releases and updates">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Updates" description="Track protocol releases and updates">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading updates"
          color="red"
        >
          {error instanceof Error ? error.message : 'Failed to load updates'}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Updates" description="Track protocol releases and updates">
      <Stack gap="lg">
        {/* Header Actions */}
        <Group justify="space-between">
          <Group gap="md">
            <TextInput
              placeholder="Search updates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: 250 }}
            />
            <Select
              placeholder="Filter by client"
              value={clientFilter}
              onChange={(value) => setClientFilter(value || '')}
              data={clientOptions}
              leftSection={<IconDeviceDesktop size={16} />}
              clearable
              searchable
              style={{ minWidth: 180 }}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || '')}
              data={statusOptions}
              leftSection={<IconGitBranch size={16} />}
              clearable
              style={{ minWidth: 150 }}
            />
          </Group>
          
          <Tooltip label="Refresh updates">
            <ActionIcon
              variant="subtle"
              onClick={() => refetch()}
              loading={isLoading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Updates Stats */}
        <Group gap="md">
          <Text size="sm" c="dimmed">
            {filteredUpdates.length} of {updates?.length || 0} updates
          </Text>
        </Group>

        {/* Updates List */}
        {filteredUpdates.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">
                {searchQuery || statusFilter || clientFilter 
                  ? 'No updates match your filters' 
                  : 'No updates found'}
              </Text>
              <Text size="sm" c="dimmed">
                Updates are automatically tracked from GitHub releases
              </Text>
            </Stack>
          </Center>
        ) : (
          <Card withBorder>
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Protocol</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredUpdates.map((update) => (
                    <Table.Tr 
                      key={update.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleUpdateClick(update)}
                    >
                      <Table.Td>
                        <Group gap="xs">
                          <IconDatabase size={14} />
                          <div>
                            <Text fw={500} size="sm">{update.name}</Text>
                            {/* Show associated protocols if client_entity exists */}
                            {update.client_entity?.protocols && update.client_entity.protocols.length > 0 && (
                              <Text size="xs" c="dimmed">
                                Associated: {update.client_entity.protocols.map(p => p.name).join(', ')}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconDeviceDesktop size={14} />
                          <div>
                            <Text size="sm" fw={500}>
                              {update.client_entity?.name || update.client}
                            </Text>
                            {update.client_entity?.client && update.client_entity.client !== update.client_entity.name && (
                              <Text size="xs" c="dimmed">
                                {update.client_entity.client}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm" color="blue">
                          {update.tag}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {update.title || update.release_name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {update.is_draft && (
                            <Badge size="xs" color="gray">Draft</Badge>
                          )}
                          {update.is_prerelease && (
                            <Badge size="xs" color="orange">Pre-release</Badge>
                          )}
                          {update.hard_fork && (
                            <Badge size="xs" color="red">Hard Fork</Badge>
                          )}
                          {!update.is_draft && !update.is_prerelease && !update.hard_fork && (
                            <Badge size="xs" color="green">Release</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconCalendar size={14} />
                          <Text size="sm">
                            {update.date ? new Date(update.date).toLocaleDateString() : 'N/A'}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Group gap="xs">
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => handleUpdateClick(update)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {update.url && (
                            <Tooltip label="View Release">
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                component="a"
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {update.github_url && (
                            <Tooltip label="View on GitHub">
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                component="a"
                                href={update.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconGitBranch size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {update.client_entity?.github_url && (
                            <Tooltip label="Client Repository">
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                component="a"
                                href={update.client_entity.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconDeviceDesktop size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        )}
      </Stack>

      {/* Update Details Modal */}
      <UpdateDetailsModal
        opened={modalOpened}
        onClose={handleModalClose}
        update={selectedUpdate}
        onUpdateSaved={handleUpdateSaved}
      />
    </PageContainer>
  );
}