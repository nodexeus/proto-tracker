/**
 * System settings component for configuring system-wide parameters
 */

import React, { useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  NumberInput,
  Switch,
  Button,
  Card,
  Badge,
  Alert,
  Select,
  Textarea,
  Divider,
  Grid,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconSettings,
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
  IconDatabase,
  IconClock,
  IconShield,
  IconBell,
  IconCloud,
} from '@tabler/icons-react';
import { NotificationSettings } from './NotificationSettings';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/api';
import { getApiConfig } from '../../utils';
import { APP_CONSTANTS } from '../../utils/constants';

interface SystemConfig {
  id: number;
  app_name: string;
  app_description?: string;
  max_file_size_mb: number;
  session_timeout_hours: number;
  auto_scan_enabled: boolean;
  auto_scan_interval_hours: number;
  maintenance_mode: boolean;
  rate_limit_requests_per_minute: number;
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  backup_retention_days: number;
  updated_at: string;
}

interface SystemConfigFormData {
  app_name: string;
  app_description: string;
  max_file_size_mb: number;
  session_timeout_hours: number;
  auto_scan_enabled: boolean;
  auto_scan_interval_hours: number;
  maintenance_mode: boolean;
  rate_limit_requests_per_minute: number;
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  backup_retention_days: number;
}

class SystemService extends ApiService {
  async getSystemConfig(): Promise<SystemConfig> {
    return this.get<SystemConfig>('/admin/system-config');
  }

  async updateSystemConfig(data: Partial<SystemConfigFormData>): Promise<SystemConfig> {
    return this.patch<SystemConfig>('/admin/system-config', data);
  }

  async getSystemStatus(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    version: string;
    database_status: string;
    memory_usage: number;
    disk_usage: number;
  }> {
    return this.get('/admin/system-status');
  }

  async restartServices(): Promise<{ message: string }> {
    return this.post<{ message: string }>('/admin/restart-services');
  }

  async clearCache(): Promise<{ message: string }> {
    return this.post<{ message: string }>('/admin/clear-cache');
  }
}

export function SystemSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const apiConfig = getApiConfig(user?.apiKey);

  const systemService = new SystemService(apiConfig);

  const form = useForm<SystemConfigFormData>({
    initialValues: {
      app_name: 'Protocol Tracker',
      app_description: '',
      max_file_size_mb: 100,
      session_timeout_hours: 24,
      auto_scan_enabled: true,
      auto_scan_interval_hours: 6,
      maintenance_mode: false,
      rate_limit_requests_per_minute: 60,
      log_level: 'INFO',
      backup_retention_days: 30,
    },
    validate: {
      app_name: (value) => (!value.trim() ? 'Application name is required' : null),
      max_file_size_mb: (value) => (value < 1 || value > 1000 ? 'Must be between 1 and 1000 MB' : null),
      session_timeout_hours: (value) => (value < 1 || value > 168 ? 'Must be between 1 and 168 hours' : null),
      auto_scan_interval_hours: (value) => (value < 1 || value > 168 ? 'Must be between 1 and 168 hours' : null),
      rate_limit_requests_per_minute: (value) => (value < 10 || value > 1000 ? 'Must be between 10 and 1000' : null),
      backup_retention_days: (value) => (value < 1 || value > 365 ? 'Must be between 1 and 365 days' : null),
    },
  });

  // Get system configuration
  const { data: systemConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => systemService.getSystemConfig(),
  });

  // Get system status
  const { data: systemStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => systemService.getSystemStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update form when config loads
  React.useEffect(() => {
    if (systemConfig) {
      form.setValues({
        app_name: systemConfig.app_name,
        app_description: systemConfig.app_description || '',
        max_file_size_mb: systemConfig.max_file_size_mb,
        session_timeout_hours: systemConfig.session_timeout_hours,
        auto_scan_enabled: systemConfig.auto_scan_enabled,
        auto_scan_interval_hours: systemConfig.auto_scan_interval_hours,
        maintenance_mode: systemConfig.maintenance_mode,
        rate_limit_requests_per_minute: systemConfig.rate_limit_requests_per_minute,
        log_level: systemConfig.log_level,
        backup_retention_days: systemConfig.backup_retention_days,
      });
    }
  }, [systemConfig]); // Remove 'form' to prevent infinite loop

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SystemConfigFormData) => {
      return systemService.updateSystemConfig(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      notifications.show({
        title: 'Success',
        message: 'System configuration updated successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Save failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update system configuration. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return systemService.clearCache();
    },
    onSuccess: (result) => {
      notifications.show({
        title: 'Success',
        message: result.message,
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Clear cache failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to clear cache. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const handleSave = useCallback(
    (values: SystemConfigFormData) => {
      saveMutation.mutate(values);
    },
    [saveMutation]
  );

  const handleClearCache = useCallback(() => {
    clearCacheMutation.mutate();
  }, [clearCacheMutation]);

  const handleRefreshStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['system-status'] });
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#7fcf00';
      case 'warning':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="md">
      {/* System Status */}
      <Card withBorder>
        <Group justify="space-between" align="center" mb="md">
          <Text fw={500} size="lg">
            System Status
          </Text>
          <Group>
            <Tooltip label="Refresh status">
              <ActionIcon
                variant="light"
                onClick={handleRefreshStatus}
                loading={statusLoading}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {systemStatus ? (
          <Grid>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">System Status</Text>
                  <Badge color={getStatusColor(systemStatus.status)} size='sm'>
                    {systemStatus.status.toUpperCase()}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Version</Text>
                  <Text size="sm">{APP_CONSTANTS.VERSION}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Database</Text>
                  <Badge color={getStatusColor(systemStatus.database_status)} size="sm">{systemStatus.database_status}</Badge>
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Uptime</Text>
                  <Text size="sm">{Math.floor(systemStatus.uptime / 3600)}h</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Memory Usage</Text>
                  <Text size="sm">{systemStatus.memory_usage}%</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Disk Usage</Text>
                  <Text size="sm">{systemStatus.disk_usage}%</Text>
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>
        ) : (
          <Text c="dimmed">Loading system status...</Text>
        )}
      </Card>

      {/* Maintenance Mode Alert */}
      {systemConfig?.maintenance_mode && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Maintenance Mode Active"
          color="orange"
          variant="light"
        >
          The system is currently in maintenance mode. Regular users cannot access the application.
        </Alert>
      )}

      {/* Configuration Form */}
      <Card withBorder>
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="lg">
            <Text fw={500} size="lg">
              System Configuration
            </Text>

            {/* Application Settings */}
            <div>
              <Group mb="md">
                <IconSettings size={20} />
                <Text fw={500}>Application Settings</Text>
              </Group>
              
              <Stack gap="sm">
                <TextInput
                  label="Application Name"
                  placeholder="Protocol Tracker"
                  required
                  {...form.getInputProps('app_name')}
                  disabled={saveMutation.isPending}
                />

                <Textarea
                  label="Application Description"
                  placeholder="Description of the application"
                  minRows={2}
                  {...form.getInputProps('app_description')}
                  disabled={saveMutation.isPending}
                />
              </Stack>
            </div>

            <Divider />

            {/* File & Security Settings */}
            {/* <div>
              <Group mb="md">
                <IconShield size={20} />
                <Text fw={500}>Security & File Settings</Text>
              </Group>
              
              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Max File Size (MB)"
                    placeholder="100"
                    min={1}
                    max={1000}
                    {...form.getInputProps('max_file_size_mb')}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Session Timeout (hours)"
                    placeholder="24"
                    min={1}
                    max={168}
                    {...form.getInputProps('session_timeout_hours')}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Rate Limit (requests/minute)"
                    placeholder="60"
                    min={10}
                    max={1000}
                    {...form.getInputProps('rate_limit_requests_per_minute')}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Log Level"
                    placeholder="Select log level"
                    data={[
                      { value: 'DEBUG', label: 'Debug' },
                      { value: 'INFO', label: 'Info' },
                      { value: 'WARNING', label: 'Warning' },
                      { value: 'ERROR', label: 'Error' },
                    ]}
                    {...form.getInputProps('log_level')}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
              </Grid>
            </div> */}

            {/* <Divider /> */}

            {/* Automation Settings */}
            <div>
              <Group mb="md">
                <IconClock size={20} />
                <Text fw={500}>Automation Settings</Text>
              </Group>
              
              <Stack gap="sm">
                <Switch
                  label="Enable automatic scanning"
                  description="Automatically scan for new snapshots at regular intervals"
                  {...form.getInputProps('auto_scan_enabled', { type: 'checkbox' })}
                  disabled={saveMutation.isPending}
                />

                {form.values.auto_scan_enabled && (
                  <NumberInput
                    label="Auto Scan Interval (hours)"
                    placeholder="Interval in hours"
                    min={1}
                    max={168}
                    {...form.getInputProps('auto_scan_interval_hours')}
                    disabled={saveMutation.isPending}
                  />
                )}
              </Stack>
            </div>

            {/* <Divider /> */}

            {/* Backup & Maintenance */}
            {/* <div>
              <Group mb="md">
                <IconDatabase size={20} />
                <Text fw={500}>Backup & Maintenance</Text>
              </Group>
              
              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Backup Retention (days)"
                    placeholder="30"
                    min={1}
                    max={365}
                    {...form.getInputProps('backup_retention_days')}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Switch
                    label="Maintenance Mode"
                    description="Prevent regular users from accessing the system"
                    color="orange"
                    {...form.getInputProps('maintenance_mode', { type: 'checkbox' })}
                    disabled={saveMutation.isPending}
                  />
                </Grid.Col>
              </Grid>
            </div> */}

            {/* <Divider /> */}

            {/* <Divider /> */}

            {/* Actions */}
            <Group justify="space-between">
              <Group>
                {/* <Button
                  variant="light"
                  leftSection={<IconCloud size={16} />}
                  onClick={handleClearCache}
                  loading={clearCacheMutation.isPending}
                  disabled={clearCacheMutation.isPending}
                >
                  Clear Cache
                </Button> */}
              </Group>
              
              <Button
                type="submit"
                leftSection={<IconCheck size={16} />}
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending}
              >
                Save Configuration
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* Notification Settings */}
      <NotificationSettings />
    </Stack>
  );
}