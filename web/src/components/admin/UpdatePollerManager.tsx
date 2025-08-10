/**
 * Admin component for managing the GitHub update polling service
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  NumberInput,
  Alert,
  Progress,
  Divider,
  ActionIcon,
  Tooltip,
  Table,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconRefresh,
  IconSettings,
  IconGitBranch,
  IconAlertCircle,
  IconCheck,
  IconClock,
} from '@tabler/icons-react';
import { useUpdatePoller } from '../../hooks/useUpdatePoller';
import { AdminService } from '../../services/admin';
import { useAuth } from '../../hooks/useAuth';
import { getApiConfig } from '../../utils';
import { notifications } from '@mantine/notifications';

interface UpdatePollerManagerProps {
  githubApiKey?: string;
  onGitHubApiKeyChange?: (key: string) => void;
}

export function UpdatePollerManager({ 
  githubApiKey, 
  onGitHubApiKeyChange 
}: UpdatePollerManagerProps = {}) {
  const { user } = useAuth();
  const [localGitHubKey, setLocalGitHubKey] = useState('');
  const [localPollingInterval, setLocalPollingInterval] = useState(30);
  const [showSettings, setShowSettings] = useState(false);

  const apiConfig = getApiConfig(user?.apiKey);
  const adminService = new AdminService(apiConfig);

  // Fetch GitHub API key from database on mount
  useEffect(() => {
    const fetchGitHubConfig = async () => {
      try {
        const config = await adminService.getGitHubConfig();
        if (config?.api_key) {
          setLocalGitHubKey(config.api_key);
          console.log('UpdatePollerManager: Loaded GitHub API key from database');
        }
      } catch (error) {
        console.log('UpdatePollerManager: No GitHub config found in database, using props or empty');
        // Fallback to props if database fetch fails
        setLocalGitHubKey(githubApiKey || '');
      } finally {
        // Removed setFetchingGitHubKey since the variable was removed
      }
    };

    if (user?.apiKey) {
      fetchGitHubConfig();
    }
  }, [user?.apiKey, githubApiKey]);

  const {
    isRunning,
    start,
    stop,
    pollNow,
    status,
    recentResults,
    setGitHubApiKey,
    setPollingInterval: updatePollingInterval,
    resetPollTimestamps,
    isPolling,
    isSaving,
  } = useUpdatePoller({
    githubApiKey: localGitHubKey,
    pollingIntervalMinutes: localPollingInterval,
  });

  const handleStart = () => {
    if (!localGitHubKey.trim()) {
      notifications.show({
        title: 'GitHub API Key Required',
        message: 'Please set your GitHub API key before starting the poller',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    setGitHubApiKey(localGitHubKey);
    start();
    
    notifications.show({
      title: 'Update Poller Started',
      message: 'The GitHub update poller is now running',
      color: 'green',
      icon: <IconPlayerPlay size={16} />,
    });
  };

  const handleStop = () => {
    stop();
    notifications.show({
      title: 'Update Poller Stopped',
      message: 'The GitHub update poller has been stopped',
      color: 'blue',
      icon: <IconPlayerPause size={16} />,
    });
  };

  const handlePollNow = async () => {
    if (!localGitHubKey.trim()) {
      notifications.show({
        title: 'GitHub API Key Required',
        message: 'Please set your GitHub API key before polling',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    try {
      setGitHubApiKey(localGitHubKey);
      await pollNow();
      notifications.show({
        title: 'Manual Poll Complete',
        message: 'Successfully checked all repositories for updates',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Poll Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleSaveSettings = () => {
    if (localGitHubKey.trim()) {
      setGitHubApiKey(localGitHubKey);
      onGitHubApiKeyChange?.(localGitHubKey);
    }
    updatePollingInterval(localPollingInterval);
    setShowSettings(false);
    
    notifications.show({
      title: 'Settings Saved',
      message: 'GitHub update poller settings have been updated',
      color: 'green',
      icon: <IconSettings size={16} />,
    });
  };

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>GitHub Update Poller</Title>
            <Text size="sm" c="dimmed">
              Automatically polls GitHub repositories for new releases and updates
            </Text>
          </div>
          <Group>
            <Badge
              color={isRunning ? 'green' : 'gray'}
              variant="light"
              leftSection={isRunning ? <IconPlayerPlay size={12} /> : <IconPlayerPause size={12} />}
            >
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
          </Group>
        </Group>

        {status && (
          <Alert color={status.errors.length > 0 ? 'red' : 'blue'} icon={<IconClock size={16} />}>
            <Text size="sm">
              {status.lastRun && `Last run: ${status.lastRun.toLocaleString()}`}
              {status.nextRun && ` | Next run: ${status.nextRun.toLocaleString()}`}
            </Text>
            {status.errors.length > 0 && (
              <Text size="sm" c="red" mt={4}>
                {status.errors.length} error(s) in last run
              </Text>
            )}
          </Alert>
        )}

        <Group>
          <Button
            onClick={isRunning ? handleStop : handleStart}
            color={isRunning ? 'red' : 'green'}
            leftSection={isRunning ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            disabled={isPolling}
          >
            {isRunning ? 'Stop Poller' : 'Start Poller'}
          </Button>

          <Button
            onClick={handlePollNow}
            variant="light"
            leftSection={<IconRefresh size={16} />}
            loading={isPolling}
            disabled={!localGitHubKey.trim()}
          >
            Poll Now
          </Button>

          <Button
            onClick={() => {
              resetPollTimestamps();
              notifications.show({
                title: 'Timestamps Reset',
                message: 'Poll timestamps have been cleared to fix date issues',
                color: 'blue',
                icon: <IconClock size={16} />,
              });
            }}
            variant="outline"
            color="orange"
            leftSection={<IconClock size={16} />}
            size="sm"
          >
            Reset Timestamps
          </Button>

          <Tooltip label="Settings">
            <ActionIcon
              variant="light"
              onClick={() => setShowSettings(!showSettings)}
            >
              <IconSettings size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {showSettings && (
          <>
            <Divider />
            <Stack gap="md">
              <Title order={4}>Settings</Title>
              
              <Stack gap="xs">
                <Text size="sm" fw={500}>GitHub API Key</Text>
                <Group gap="sm">
                  <Badge color={localGitHubKey ? 'green' : 'red'} variant="light">
                    {localGitHubKey ? 'Configured' : 'Not Set'}
                  </Badge>
                  {localGitHubKey && (
                    <Text size="sm" c="dimmed">
                      {localGitHubKey.substring(0, 8)}...
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  GitHub API key is managed in the "GitHub Integration" tab.
                  {!localGitHubKey && ' Please configure it there first.'}
                </Text>
              </Stack>

              <NumberInput
                label="Polling Interval (minutes)"
                description="How often to check for updates"
                value={localPollingInterval}
                onChange={(value) => setLocalPollingInterval(Number(value) || 30)}
                min={5}
                max={1440}
              />

              <Group>
                <Button onClick={handleSaveSettings} size="sm">
                  Save Settings
                </Button>
                <Button 
                  onClick={() => setShowSettings(false)} 
                  variant="light" 
                  size="sm"
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </>
        )}

        {recentResults.length > 0 && (
          <>
            <Divider />
            <div>
              <Title order={4} mb="md">Recent Poll Results</Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Updates Found</Table.Th>
                    <Table.Th>Hard Forks</Table.Th>
                    <Table.Th>Errors</Table.Th>
                    <Table.Th>Last Polled</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recentResults.map((result) => (
                    <Table.Tr key={result.client.id}>
                      <Table.Td>
                        <Text fw={500}>{result.client.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {result.updates.length}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          variant="light" 
                          color={result.updates.some(u => u.parsed.hasHardFork) ? 'red' : 'gray'}
                          leftSection={<IconGitBranch size={12} />}
                        >
                          {result.updates.filter(u => u.parsed.hasHardFork).length}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {result.errors.length > 0 ? (
                          <Badge variant="light" color="red">
                            {result.errors.length}
                          </Badge>
                        ) : (
                          <Badge variant="light" color="green">
                            0
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {result.lastPolled.toLocaleTimeString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </>
        )}

        {isSaving && (
          <Alert color="blue" icon={<IconClock size={16} />}>
            <Text size="sm">Saving detected updates...</Text>
            <Progress value={100} mt={8} animated />
          </Alert>
        )}
      </Stack>
    </Card>
  );
}