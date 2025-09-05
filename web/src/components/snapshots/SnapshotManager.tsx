/**
 * Comprehensive snapshot management component with scanning and file browser
 */

import { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Badge,
  Alert,
  Progress,
  Loader,
  Modal,
  Timeline,
  Divider,
  ActionIcon,
  Tooltip,
  Grid,
  NumberFormatter,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconScan,
  IconRefresh,
  IconFolder,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconDatabase,
  IconEye,
  IconDownload,
  IconGitBranch,
} from '@tabler/icons-react';
import { FileBrowser } from './FileBrowser';
import { ProtocolService } from '../../services/protocols';
import { useAuth } from '../../hooks/useAuth';
import { formatBytes, formatDate, formatRelativeTime, getApiConfig } from '../../utils';
import type { Snapshot, SnapshotScanResult } from '../../types';

interface SnapshotManagerProps {
  protocolId: number;
  snapshots: Snapshot[];
}

interface ScanProgressProps {
  isScanning: boolean;
  progress?: number;
  message?: string;
}

function ScanProgress({ isScanning, progress, message }: ScanProgressProps) {
  if (!isScanning) return null;

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group>
            <Loader size="sm" />
            <Text fw={500}>Scanning for snapshots...</Text>
          </Group>
          <Badge color="blue" variant="light">
            In Progress
          </Badge>
        </Group>
        
        {progress !== undefined && (
          <Progress
            value={progress}
            animated
            size="md"
            color="blue"
          />
        )}
        
        {message && (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

interface ScanResultsProps {
  results: SnapshotScanResult | null;
  onClose: () => void;
}

function ScanResults({ results, onClose }: ScanResultsProps) {
  if (!results) return null;

  return (
    <Alert
      icon={<IconCheck size={16} />}
      title="Scan Completed"
      color="#7fcf00"
      withCloseButton
      onClose={onClose}
    >
      <Stack gap="xs">
        <Text size="sm">{results.message}</Text>
        
        {results.new_snapshots_found !== undefined && (
          <Group gap="md">
            <Badge color="#7fcf00" variant="light">
              {results.new_snapshots_found} new snapshots
            </Badge>
            
            {results.total_snapshots !== undefined && (
              <Badge color="blue" variant="light">
                {results.total_snapshots} total
              </Badge>
            )}
            
            {results.scan_duration !== undefined && (
              <Badge color="gray" variant="light">
                {results.scan_duration}s scan time
              </Badge>
            )}
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

export function SnapshotManager({ protocolId, snapshots }: SnapshotManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [scanResults, setScanResults] = useState<SnapshotScanResult | null>(null);
  const [fileBrowserOpened, fileBrowserHandlers] = useDisclosure(false);

  const apiConfig = getApiConfig(user?.apiKey);

  const protocolService = new ProtocolService(apiConfig);

  // Scan mutation with progress tracking
  const scanMutation = useMutation({
    mutationFn: async () => {
      return protocolService.scanProtocolSnapshots(protocolId);
    },
    onSuccess: (result) => {
      setScanResults(result);
      queryClient.invalidateQueries({ queryKey: ['protocol-snapshots', protocolId] });
      
      notifications.show({
        title: 'Scan Completed',
        message: result.message,
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
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

  // Get file tree for selected snapshot
  const { data: fileTree, isLoading: fileTreeLoading } = useQuery({
    queryKey: ['snapshot-files', protocolId, selectedSnapshot?.snapshot_id],
    queryFn: () => protocolService.getSnapshotFileTree(protocolId, selectedSnapshot!.snapshot_id),
    enabled: !!selectedSnapshot,
  });

  const handleStartScan = useCallback(() => {
    setScanResults(null);
    scanMutation.mutate();
  }, [scanMutation]);

  const handleViewSnapshot = useCallback((snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    fileBrowserHandlers.open();
  }, [fileBrowserHandlers]);

  const handleFileSelect = useCallback((filePath: string) => {
    console.log('Selected file:', filePath);
  }, []);

  const handleFileDownload = useCallback((filePath: string) => {
    // Implement file download logic
    notifications.show({
      title: 'Download Started',
      message: `Downloading ${filePath}...`,
      color: 'blue',
    });
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['protocol-snapshots', protocolId] });
    setScanResults(null);
  }, [queryClient, protocolId]);

  const handleCloseScanResults = useCallback(() => {
    setScanResults(null);
  }, []);

  // Calculate statistics
  const totalSize = snapshots.reduce((sum, s) => sum + s.total_size, 0);
  const totalFiles = snapshots.reduce((sum, s) => sum + s.file_count, 0);
  const recentSnapshots = snapshots.filter(s => 
    new Date(s.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <Stack gap="lg">
      {/* Scan Progress */}
      <ScanProgress
        isScanning={scanMutation.isPending}
        message="Searching storage buckets for new snapshots..."
      />

      {/* Scan Results */}
      <ScanResults results={scanResults} onClose={handleCloseScanResults} />

      {/* Controls and Statistics */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={500} size="lg">Snapshot Management</Text>
                <Text size="sm" c="dimmed">
                  Manage and browse protocol snapshots
                </Text>
              </div>
              
              <Group>
                <Tooltip label="Refresh snapshots list">
                  <ActionIcon
                    variant="light"
                    onClick={handleRefresh}
                  >
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Tooltip>
                
                <Button
                  leftSection={<IconScan size={16} />}
                  onClick={handleStartScan}
                  loading={scanMutation.isPending}
                  disabled={scanMutation.isPending}
                >
                  Scan for Snapshots
                </Button>
              </Group>
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text fw={500} size="sm">Statistics</Text>
              
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Total Snapshots</Text>
                <Badge variant="light">
                  <NumberFormatter value={snapshots.length} />
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Total Size</Text>
                <Badge variant="light" color="blue">
                  {formatBytes(totalSize)}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Total Files</Text>
                <Badge variant="light" color="#7fcf00">
                  <NumberFormatter value={totalFiles} />
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Recent (7 days)</Text>
                <Badge variant="light" color="orange">
                  <NumberFormatter value={recentSnapshots} />
                </Badge>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Snapshots Timeline */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500} size="lg">Available Snapshots</Text>
            <Badge variant="light">
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </Badge>
          </Group>

          {snapshots.length === 0 ? (
            <Stack align="center" gap="md" py="xl">
              <IconDatabase size={48} color="gray" />
              <div style={{ textAlign: 'center' }}>
                <Text fw={500} size="lg">No Snapshots Available</Text>
                <Text c="dimmed">
                  No snapshots have been found for this protocol yet.
                </Text>
                <Text c="dimmed" size="sm">
                  Click "Scan for Snapshots" to search for available snapshots.
                </Text>
              </div>
            </Stack>
          ) : (
            <Timeline active={snapshots.length} bulletSize={24}>
              {snapshots
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((snapshot) => (
                  <Timeline.Item
                    key={snapshot.id}
                    bullet={<IconGitBranch size={12} />}
                    title={
                      <Group justify="space-between" align="center">
                        <div>
                          <Text fw={500} size="sm">
                            {snapshot.snapshot_id}
                          </Text>
                          <Group gap="xs" mt={2}>
                            <Badge size="xs" variant="light" color="blue">
                              {snapshot.metadata_summary?.total_size_formatted || formatBytes(snapshot.total_size)}
                            </Badge>
                            <Badge size="xs" variant="light" color="#7fcf00">
                              {snapshot.file_count.toLocaleString()} files
                            </Badge>
                            {snapshot.metadata_summary?.chunks_formatted && (
                              <Badge size="xs" variant="light" color="orange">
                                {snapshot.metadata_summary.chunks_formatted} chunks
                              </Badge>
                            )}
                          </Group>
                        </div>
                        
                        <Group gap="xs">
                          <Tooltip label="Browse files">
                            <ActionIcon
                              variant="light"
                              size="sm"
                              onClick={() => handleViewSnapshot(snapshot)}
                            >
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                          
                          <Tooltip label="Download index">
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
                    }
                  >
                    <Group gap="xs" align="center">
                      <IconClock size={12} />
                      <Text size="xs" c="dimmed">
                        Created {formatRelativeTime(snapshot.created_at)}
                      </Text>
                    </Group>
                    
                    {snapshot.metadata_summary && (
                      <Group gap="xs" mt="xs">
                        {snapshot.metadata_summary.client && (
                          <Badge size="xs" variant="outline">
                            {snapshot.metadata_summary.client}
                          </Badge>
                        )}
                        {snapshot.metadata_summary.network && (
                          <Badge size="xs" variant="outline">
                            {snapshot.metadata_summary.network}
                          </Badge>
                        )}
                      </Group>
                    )}
                  </Timeline.Item>
                ))}
            </Timeline>
          )}
        </Stack>
      </Card>

      {/* File Browser Modal */}
      <Modal
        opened={fileBrowserOpened}
        onClose={fileBrowserHandlers.close}
        title={
          <Group>
            <IconFolder size={20} />
            <div>
              <Text fw={500}>File Browser</Text>
              <Text size="sm" c="dimmed">
                {selectedSnapshot?.snapshot_id}
              </Text>
            </div>
          </Group>
        }
        size="xl"
        centered
      >
        {selectedSnapshot && (
          <Stack gap="md">
            {/* Snapshot Info */}
            <Card withBorder bg="dark.6">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>Snapshot Information</Text>
                  <Group gap="md" mt="xs">
                    <div>
                      <Text size="xs" c="dimmed">Total Size</Text>
                      <Text size="sm">{selectedSnapshot.metadata_summary?.total_size_formatted || formatBytes(selectedSnapshot.total_size)}</Text>
                    </div>
                    {selectedSnapshot.metadata_summary?.chunks_formatted && (
                      <div>
                        <Text size="xs" c="dimmed">Chunks</Text>
                        <Text size="sm">{selectedSnapshot.metadata_summary.chunks_formatted}</Text>
                      </div>
                    )}
                    <div>
                      <Text size="xs" c="dimmed">File Count</Text>
                      <Text size="sm">{selectedSnapshot.file_count.toLocaleString()}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Created</Text>
                      <Text size="sm">{formatDate(selectedSnapshot.created_at)}</Text>
                    </div>
                  </Group>
                </div>
              </Group>
            </Card>

            <Divider />

            {/* File Browser */}
            <FileBrowser
              fileTree={fileTree || {}}
              loading={fileTreeLoading}
              onFileSelect={handleFileSelect}
              onDownload={handleFileDownload}
            />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}