/**
 * Protocols page - Lists all protocols with management actions
 */

import { useState } from 'react';
import {
  SimpleGrid,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Text,
  Loader,
  Center,
  Alert,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconAlertCircle,
} from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { ProtocolCard } from '../components/ui';
import { useProtocols } from '../hooks';
import type { Protocol } from '../types';

interface ProtocolsProps {
  onCreateProtocol?: () => void;
  onEditProtocol?: (protocol: Protocol) => void;
  onDeleteProtocol?: (protocol: Protocol) => void;
}

export function Protocols({
  onCreateProtocol,
  onEditProtocol,
  onDeleteProtocol,
}: ProtocolsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('');

  const {
    data: protocols,
    isLoading,
    error,
  } = useProtocols();

  // Filter protocols based on search query and network filter
  const filteredProtocols = protocols?.filter((protocol) => {
    const matchesSearch = !searchQuery || 
      protocol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      protocol.chain_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      protocol.network?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      protocol.proto_family?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesNetwork = !networkFilter || protocol.network === networkFilter;

    return matchesSearch && matchesNetwork;
  }) || [];

  // Get unique networks for filter dropdown
  const networks = Array.from(
    new Set(protocols?.map(p => p.network).filter(Boolean))
  ).sort();

  if (isLoading) {
    return (
      <PageContainer title="Protocols" description="Manage blockchain protocol tracking">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Protocols" description="Manage blockchain protocol tracking">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading protocols"
          color="red"
        >
          {error instanceof Error ? error.message : 'Failed to load protocols'}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Protocols" description="Manage blockchain protocol tracking">
      <Stack gap="lg">
        {/* Header Actions */}
        <Group justify="space-between">
          <Group gap="md">
            <TextInput
              placeholder="Search protocols..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: 200 }}
            />
            <Select
              placeholder="Filter by network"
              value={networkFilter}
              onChange={(value) => setNetworkFilter(value || '')}
              data={networks.map(network => ({ value: network, label: network }))}
              leftSection={<IconFilter size={16} />}
              clearable
              style={{ minWidth: 150 }}
            />
          </Group>

          {onCreateProtocol && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={onCreateProtocol}
            >
              Add Protocol
            </Button>
          )}
        </Group>

        {/* Protocol Stats */}
        <Group gap="md">
          <Text size="sm" c="dimmed">
            {filteredProtocols.length} of {protocols?.length || 0} protocols
          </Text>
        </Group>

        {/* Protocols Grid */}
        {filteredProtocols.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">
                {searchQuery || networkFilter ? 'No protocols match your filters' : 'No protocols found'}
              </Text>
              {!searchQuery && !networkFilter && onCreateProtocol && (
                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={onCreateProtocol}
                >
                  Add your first protocol
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}
            spacing="lg"
          >
            {filteredProtocols.map((protocol) => (
              <ProtocolCard
                key={protocol.id}
                protocol={protocol}
                onEdit={onEditProtocol}
                onDelete={onDeleteProtocol}
                showActions={true}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </PageContainer>
  );
}