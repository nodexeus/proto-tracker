/**
 * Dashboard statistics component with charts and metrics
 */

import { useQuery } from '@tanstack/react-query';
import {
  SimpleGrid,
  Card,
  Text,
  Progress,
  Group,
  Badge,
  Stack,
  Title,
  Loader,
  Alert,
  RingProgress,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Table,
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconServer,
  IconGitFork,
  IconRefresh,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { ProtocolService } from '../../services/protocols';
import { useAuth } from '../../hooks/useAuth';
import { getApiConfig } from '../../utils';
import { StackedBarChart } from './StackedBarChart';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  color?: string;
  icon?: React.ReactNode;
}

function StatCard({ title, value, change, color = 'blue', icon }: StatCardProps) {
  const hasChange = typeof change === 'number';
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;

  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Text size="sm" c="dimmed" fw={500}>
            {title}
          </Text>
          <Text size="xl" fw={700} c={color}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          {hasChange && (
            <Group gap="xs" align="center">
              {isPositive ? (
                <IconTrendingUp size={16} color="#7fcf00" />
              ) : isNegative ? (
                <IconTrendingDown size={16} color="red" />
              ) : null}
              <Text
                size="sm"
                c={isPositive ? '#7fcf00' : isNegative ? '#f0000' : 'dimmed'}
                fw={500}
              >
                {change > 0 ? '+' : ''}{change}%
              </Text>
            </Group>
          )}
        </Stack>
        {icon && (
          <div style={{ opacity: 0.7 }}>
            {icon}
          </div>
        )}
      </Group>
    </Card>
  );
}

export function DashboardStats() {
  const { user } = useAuth();
  const apiConfig = getApiConfig(user?.apiKey);
  const protocolService = new ProtocolService(apiConfig);

  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => protocolService.getDashboardStats(),
    enabled: !!user?.apiKey,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
  });

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Dashboard Overview</Title>
        </Group>
        
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} withBorder>
              <Stack gap="xs">
                <Loader size="sm" />
                <Text size="sm">Loading...</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card withBorder>
            <Loader size="lg" />
          </Card>
          <Card withBorder>
            <Loader size="lg" />
          </Card>
        </SimpleGrid>
      </Stack>
    );
  }

  if (error || !stats) {
    return (
      <Alert
        icon={<IconAlertTriangle size={16} />}
        title="Failed to load dashboard statistics"
        color="red"
        variant="light"
      >
        <Group justify="space-between" align="center" mt="md">
          <Text size="sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </Text>
          <ActionIcon variant="light" onClick={() => refetch()}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Alert>
    );
  }

  // Prepare data for charts
  const networkData = Object.entries(stats.protocols_by_network).map(([network, count]) => ({
    name: network,
    value: count,
    color: getNetworkColor(network)
  }));

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Dashboard Overview</Title>
        <Tooltip label="Refresh statistics">
          <ActionIcon
            variant="light"
            onClick={() => refetch()}
            loading={isRefetching}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Key Metrics */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <StatCard
          title="Total Protocols"
          value={stats.total_protocols}
          color="blue"
          icon={<IconServer size={24} />}
        />
        <StatCard
          title="Total Clients"
          value={stats.total_clients}
          color="#7fcf00"
          icon={<IconGitFork size={24} />}
        />
        <StatCard
          title="Recent Updates"
          value={stats.recent_updates}
          color="orange"
          icon={<IconTrendingUp size={24} />}
        />
        <StatCard
          title="Recent Hard Forks"
          value={stats.recent_hard_forks}
          color="#ff0000"
          icon={<IconAlertTriangle size={24} />}
        />
      </SimpleGrid>

      {/* Charts Section */}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        {/* Protocols by Network */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Protocols by Network</Text>
              <Badge variant="light">{stats.total_protocols} total</Badge>
            </Group>
            
            {networkData.length > 0 ? (
              <Stack gap="sm">
                {networkData.slice(0, 5).map((item) => (
                  <Group key={item.name} justify="space-between">
                    <Group gap="sm">
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: item.color
                        }}
                      />
                      <Text size="sm">{item.name}</Text>
                    </Group>
                    <Group gap="xs">
                      <Progress
                        value={(item.value / stats.total_protocols) * 100}
                        size="sm"
                        w={60}
                        color={item.color}
                      />
                      <Text size="sm" c="dimmed" w={30}>
                        {item.value}
                      </Text>
                    </Group>
                  </Group>
                ))}
                {networkData.length > 5 && (
                  <Text size="xs" c="dimmed" ta="center">
                    And {networkData.length - 5} more...
                  </Text>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No network data available
              </Text>
            )}
          </Stack>
        </Card>

        {/* Update Activity */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Update Activity (Last 12 Months)</Text>
              <Badge variant="light">{stats.total_updates} total</Badge>
            </Group>
            
            {stats.updates_by_month.length > 0 ? (
              <StackedBarChart 
                data={stats.updates_by_month} 
                maxItems={6}
              />
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No update data available
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Recent Activity Summary */}
      <Card withBorder>
        <Stack gap="md">
          <Text fw={500}>Recent Activity Summary</Text>
          <Group grow>
            <Stack align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[
                  {
                    value: stats.total_updates > 0 ? (stats.recent_updates / stats.total_updates) * 100 : 0,
                    color: 'blue'
                  }
                ]}
                label={
                  <Text ta="center" fw={700} size="sm">
                    {stats.recent_updates}
                  </Text>
                }
              />
              <Text size="sm" ta="center" c="dimmed">
                Updates (30 days)
              </Text>
            </Stack>

            <Stack align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[
                  {
                    value: stats.recent_updates > 0 ? (stats.recent_hard_forks / stats.recent_updates) * 100 : 0,
                    color: '#f0000'
                  }
                ]}
                label={
                  <Text ta="center" fw={700} size="sm">
                    {stats.recent_hard_forks}
                  </Text>
                }
              />
              <Text size="sm" ta="center" c="dimmed">
                Hard Forks (30 days)
              </Text>
            </Stack>

            <Stack align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[
                  {
                    value: stats.total_clients > 0 ? (stats.total_protocols / (stats.total_protocols + stats.total_clients)) * 100 : 50,
                    color: '#7fcf00'
                  }
                ]}
                label={
                  <Text ta="center" fw={700} size="sm">
                    {(stats.total_protocols / (stats.total_clients || 1)).toFixed(1)}
                  </Text>
                }
              />
              <Text size="sm" ta="center" c="dimmed">
                Protocol/Client Ratio
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Card>

      {/* Network Breakdown Table */}
      {Object.keys(stats.protocols_by_network).length > 0 && (
        <Card withBorder>
          <Stack gap="md">
            <Text fw={500}>Network Breakdown</Text>
            <ScrollArea>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Network</Table.Th>
                    <Table.Th>Protocols</Table.Th>
                    <Table.Th>Percentage</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(stats.protocols_by_network)
                    .sort(([, a], [, b]) => b - a)
                    .map(([network, count]) => (
                      <Table.Tr key={network}>
                        <Table.Td>
                          <Group gap="sm">
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: getNetworkColor(network)
                              }}
                            />
                            <Text fw={500}>{network}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{count}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Progress
                              value={(count / stats.total_protocols) * 100}
                              size="sm"
                              style={{ flex: 1 }}
                              color={getNetworkColor(network)}
                            />
                            <Text size="sm" c="dimmed">
                              {((count / stats.total_protocols) * 100).toFixed(1)}%
                            </Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// Helper function to get consistent colors for networks
function getNetworkColor(network: string): string {
  const colors = [
    '#228be6', '#40c057', '#fd7e14', '#e03131', '#ff0000', '#862e9c', 
    '#0c8599', '#495057', '#c92a2a', '#5c7cfa', '#51cf66', '#ffd43b'
  ];
  
  const index = network.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}