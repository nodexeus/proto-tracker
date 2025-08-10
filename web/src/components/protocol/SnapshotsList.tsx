/**
 * Snapshots list component for displaying available snapshots using Accordion
 */

import { useState } from 'react';
import {
  Accordion,
  Card,
  Text,
  Group,
  Badge,
  Stack,
  Button,
  Progress,
  ActionIcon,
  Tooltip,
  Code,
  Divider,
  Box,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconFolder,
  IconFile,
  IconDownload,
  IconScan,
  IconAlertTriangle,
  IconDatabase,
  IconClock,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react';
import type { Snapshot } from '../../types';
import { formatBytes, formatDate, formatRelativeTime, getApiConfig } from '../../utils';
import { ProtocolService } from '../../services/protocols';
import { useAuth } from '../../hooks/useAuth';

interface SnapshotsListProps {
  snapshots: Snapshot[];
  protocolId: number;
}

interface SnapshotItemProps {
  snapshot: Snapshot;
  onScanTrigger: () => void;
  isScanning: boolean;
}

function FileTreeView({ fileTree }: { fileTree: Record<string, unknown> }) {
  const renderTree = (tree: Record<string, unknown>, depth = 0) => {
    return Object.entries(tree).map(([key, value]) => {
      const isFolder = typeof value === 'object' && value !== null;
      
      return (
        <Box key={key} pl={depth * 20}>
          <Group gap="xs" py={2}>
            {isFolder ? (
              <IconFolder size={14} color="orange" />
            ) : (
              <IconFile size={14} color="blue" />
            )}
            <Text size="xs" ff="monospace">
              {key}
            </Text>
          </Group>
          {isFolder && renderTree(value as Record<string, unknown>, depth + 1)}
        </Box>
      );
    });
  };

  return (
    <Box 
      style={{ 
        maxHeight: '300px', 
        overflow: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '8px',
        backgroundColor: '#fafafa'
      }}
    >
      {renderTree(fileTree)}
    </Box>
  );
}

function SnapshotItem({ snapshot, onScanTrigger, isScanning }: SnapshotItemProps) {
  const metadata = snapshot.snapshot_metadata;
  const hasFileTree = metadata?.file_tree && Object.keys(metadata.file_tree).length > 0;

  return (
    <Accordion.Item value={snapshot.id.toString()}>
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Group gap="sm" align="center">
              <Text fw={500} size="sm">
                {snapshot.snapshot_id}
              </Text>
              <Badge size="sm" color="blue">
                {formatBytes(snapshot.total_size)}
              </Badge>
              <Badge size="sm" color="green" variant="light">
                {snapshot.file_count.toLocaleString()} files
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Created {formatRelativeTime(snapshot.created_at)} • 
              Indexed {formatRelativeTime(snapshot.indexed_at)}
            </Text>
          </div>
          
          <Group gap="xs" onClick={(e) => e.stopPropagation()}>
            <Tooltip label="Trigger Scan">
              <ActionIcon
                variant="light"
                size="sm"
                onClick={onScanTrigger}
                loading={isScanning}
                disabled={isScanning}
              >
                <IconScan size={14} />
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="Download">
              <ActionIcon
                variant="light"
                size="sm"
                component="a"
                href={snapshot.index_file_path}
                target="_blank"
              >
                <IconDownload size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Accordion.Control>
      
      <Accordion.Panel>
        <Stack gap="md">
          {/* Snapshot Metadata */}
          <div>
            <Text fw={500} size="sm" mb="xs">
              Snapshot Information
            </Text>
            <Group grow>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Snapshot ID
                </Text>
                <Code>{snapshot.snapshot_id}</Code>
              </div>
              
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Total Size
                </Text>
                <Text size="sm">{formatBytes(snapshot.total_size)}</Text>
              </div>
              
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  File Count
                </Text>
                <Text size="sm">{snapshot.file_count.toLocaleString()}</Text>
              </div>
            </Group>
          </div>

          {/* Metadata */}
          {metadata && (
            <>
              <Divider />
              <div>
                <Text fw={500} size="sm" mb="xs">
                  Metadata
                </Text>
                <Group grow>
                  {metadata.client && (
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Client
                      </Text>
                      <Text size="sm">{metadata.client}</Text>
                    </div>
                  )}
                  
                  {metadata.network && (
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Network
                      </Text>
                      <Text size="sm">{metadata.network}</Text>
                    </div>
                  )}
                  
                  {metadata.version && (
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Version
                      </Text>
                      <Text size="sm">{metadata.version}</Text>
                    </div>
                  )}
                  
                  {metadata.node_type && (
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Node Type
                      </Text>
                      <Text size="sm">{metadata.node_type}</Text>
                    </div>
                  )}
                </Group>
              </div>
            </>
          )}

          {/* File Tree */}
          {hasFileTree && (
            <>
              <Divider />
              <div>
                <Text fw={500} size="sm" mb="xs">
                  File Structure
                </Text>
                <FileTreeView fileTree={metadata.file_tree!} />
              </div>
            </>
          )}

          {/* Timestamps */}
          <Divider />
          <Group grow>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Created At
              </Text>
              <Group gap="xs" align="center">
                <IconClock size={14} />
                <div>
                  <Text size="sm">{formatDate(snapshot.created_at)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatRelativeTime(snapshot.created_at)}
                  </Text>
                </div>
              </Group>
            </div>
            
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Indexed At
              </Text>
              <Group gap="xs" align="center">
                <IconDatabase size={14} />
                <div>
                  <Text size="sm">{formatDate(snapshot.indexed_at)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatRelativeTime(snapshot.indexed_at)}
                  </Text>
                </div>
              </Group>
            </div>
          </Group>

          {/* Actions */}
          <Group>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconDownload size={16} />}
              component="a"
              href={snapshot.index_file_path}
              target="_blank"
            >
              Download Index
            </Button>
            
            <Button
              variant="light"
              size="sm"
              leftSection={<IconScan size={16} />}
              onClick={onScanTrigger}
              loading={isScanning}
              disabled={isScanning}
            >
              Rescan
            </Button>
          </Group>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function SnapshotsList({ snapshots, protocolId }: SnapshotsListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scanningSnapshots, setScanningSnapshots] = useState<Set<number>>(new Set());

  const apiConfig = getApiConfig(user?.apiKey);

  const protocolService = new ProtocolService(apiConfig);

  const scanMutation = useMutation({
    mutationFn: async () => {
      return protocolService.scanProtocolSnapshots(protocolId);
    },
    onSuccess: (result) => {
      notifications.show({
        title: 'Scan Completed',
        message: result.message,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: ['protocol-snapshots', protocolId] });
    },
    onError: (error) => {
      console.error('Scan failed:', error);
      notifications.show({
        title: 'Scan Failed',
        message: 'Failed to scan snapshots. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const handleSnapshotScan = (snapshotId: number) => {
    setScanningSnapshots(prev => new Set(prev.add(snapshotId)));
    // Simulate individual snapshot scanning
    setTimeout(() => {
      setScanningSnapshots(prev => {
        const newSet = new Set(prev);
        newSet.delete(snapshotId);
        return newSet;
      });
      notifications.show({
        title: 'Snapshot Rescanned',
        message: 'Snapshot has been rescanned successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    }, 2000);
  };

  const handleBulkScan = () => {
    scanMutation.mutate();
  };

  if (snapshots.length === 0) {
    return (
      <Stack gap="md">
        <Card withBorder padding="xl">
          <Stack align="center" gap="md">
            <IconDatabase size={48} color="gray" />
            <div style={{ textAlign: 'center' }}>
              <Text fw={500} size="lg">
                No Snapshots Available
              </Text>
              <Text c="dimmed">
                No snapshots have been found for this protocol yet.
              </Text>
            </div>
            <Button
              leftSection={<IconScan size={16} />}
              onClick={handleBulkScan}
              loading={scanMutation.isPending}
            >
              Scan for Snapshots
            </Button>
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Scan Controls */}
      <Card withBorder padding="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500} size="sm">
              Snapshot Management
            </Text>
            <Text size="xs" c="dimmed">
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} available
            </Text>
          </div>
          
          <Group>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['protocol-snapshots', protocolId] })}
            >
              Refresh
            </Button>
            
            <Button
              size="sm"
              leftSection={<IconScan size={16} />}
              onClick={handleBulkScan}
              loading={scanMutation.isPending}
            >
              Scan for New Snapshots
            </Button>
          </Group>
        </Group>
        
        {scanMutation.isPending && (
          <Progress
            value={100}
            animated
            size="sm"
            mt="sm"
            color="blue"
          />
        )}
      </Card>

      {/* Snapshots List */}
      <Card withBorder>
        <Accordion variant="contained" radius="md">
          {snapshots
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((snapshot) => (
              <SnapshotItem
                key={snapshot.id}
                snapshot={snapshot}
                onScanTrigger={() => handleSnapshotScan(snapshot.id)}
                isScanning={scanningSnapshots.has(snapshot.id)}
              />
            ))}
        </Accordion>
      </Card>
    </Stack>
  );
}