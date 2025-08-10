/**
 * Quick protocols overview component for dashboard
 */

import {
  Card,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Avatar,
  Table,
  Skeleton,
  Alert,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconRefresh,
  IconExternalLink,
  IconAlertTriangle,
  IconChevronRight,
  IconServer
} from '@tabler/icons-react';
import { useProtocols } from '../../hooks';
import type { Protocol } from '../../types';

interface QuickProtocolsOverviewProps {
  onViewProtocol?: (protocol: Protocol) => void;
  onEditProtocol?: (protocol: Protocol) => void;
  onViewAllProtocols?: () => void;
  maxItems?: number;
}

export function QuickProtocolsOverview({
  onViewProtocol,
  onEditProtocol,
  onViewAllProtocols,
  maxItems = 5
}: QuickProtocolsOverviewProps) {
  const {
    data: protocols = [],
    isLoading,
    error,
    refetch,
    isRefetching
  } = useProtocols();

  // Show only the most recently updated protocols
  const recentProtocols = protocols.slice(0, maxItems);

  if (isLoading) {
    return (
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <IconServer size={20} />
              <Text fw={500}>Recent Protocols</Text>
            </Group>
            <Skeleton height={24} width={60} />
          </Group>
          
          <Stack gap="xs">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder>
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Failed to load protocols"
          color="red"
          variant="light"
        >
          <Group justify="space-between" align="center" mt="sm">
            <Text size="sm">
              {error instanceof Error ? error.message : 'Unable to fetch protocol data'}
            </Text>
            <ActionIcon variant="light" onClick={() => refetch()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Alert>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconServer size={20} />
            <Text fw={500}>Recent Protocols</Text>
            <Badge variant="light" size="sm">
              {protocols.length}
            </Badge>
          </Group>
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon
                variant="light"
                size="sm"
                onClick={() => refetch()}
                loading={isRefetching}
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {protocols.length === 0 ? (
          <Stack align="center" py="xl" gap="md">
            <IconServer size={48} style={{ opacity: 0.3 }} />
            <Stack align="center" gap="xs">
              <Text fw={500} c="dimmed">No protocols found</Text>
              <Text size="sm" c="dimmed" ta="center">
                Get started by adding your first protocol to begin tracking updates and snapshots.
              </Text>
            </Stack>
          </Stack>
        ) : (
          <>
            <ScrollArea>
              <Table>
                <Table.Tbody>
                  {recentProtocols.map((protocol) => (
                    <Table.Tr key={protocol.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar
                            src={
                              protocol.logo
                                ? protocol.logo.startsWith('data:')
                                  ? protocol.logo
                                  : `data:image/png;base64,${protocol.logo}`
                                : null
                            }
                            alt={protocol.name}
                            size="sm"
                            radius="sm"
                          >
                            <IconServer size={16} />
                          </Avatar>
                          <div style={{ flex: 1 }}>
                            <Group justify="space-between" align="center">
                              <Stack gap={2}>
                                <Text fw={500} size="sm" lineClamp={1}>
                                  {protocol.name}
                                </Text>
                                <Group gap="xs">
                                  <Badge size="xs" variant="light">
                                    {protocol.network}
                                  </Badge>
                                  {protocol.chain_id && (
                                    <Text size="xs" c="dimmed">
                                      Chain {protocol.chain_id}
                                    </Text>
                                  )}
                                </Group>
                              </Stack>
                              <Group gap="xs">
                                {protocol.explorer && (
                                  <Tooltip label="Open Explorer">
                                    <ActionIcon
                                      size="sm"
                                      variant="light"
                                      component="a"
                                      href={protocol.explorer}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <IconExternalLink size={12} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                {onViewProtocol && (
                                  <Tooltip label="View Details">
                                    <ActionIcon
                                      size="sm"
                                      variant="light"
                                      onClick={() => onViewProtocol(protocol)}
                                    >
                                      <IconEye size={12} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                {onEditProtocol && (
                                  <Tooltip label="Edit Protocol">
                                    <ActionIcon
                                      size="sm"
                                      variant="light"
                                      onClick={() => onEditProtocol(protocol)}
                                    >
                                      <IconEdit size={12} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Group>
                          </div>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {protocols.length > maxItems && onViewAllProtocols && (
              <Button
                variant="light"
                size="sm"
                rightSection={<IconChevronRight size={14} />}
                onClick={onViewAllProtocols}
              >
                View All {protocols.length} Protocols
              </Button>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}