/**
 * Notification settings component for webhook management
 */

import React, { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  Switch,
  Button,
  Card,
  Badge,
  Alert,
  Textarea,
  Tabs,
  ActionIcon,
  Tooltip,
  Table,
  Loader,
  JsonInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconBell,
  IconCheck,
  IconAlertTriangle,
  IconTestPipe,
  IconBrandDiscord,
  IconBrandSlack,
  IconWebhook,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/api';
import { getApiConfig } from '../../utils';

interface NotificationConfig {
  id: number;
  notifications_enabled: boolean;
  discord_enabled: boolean;
  discord_webhook_url?: string;
  slack_enabled: boolean;
  slack_webhook_url?: string;
  generic_enabled: boolean;
  generic_webhook_url?: string;
  generic_headers?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface ClientNotificationSettings {
  client_id: number;
  client_name: string;
  client_string: string;
  github_url?: string;
  notifications_enabled: boolean;
}

interface NotificationFormData {
  notifications_enabled: boolean;
  discord_enabled: boolean;
  discord_webhook_url: string;
  slack_enabled: boolean;
  slack_webhook_url: string;
  generic_enabled: boolean;
  generic_webhook_url: string;
  generic_headers: string; // JSON string
}

class NotificationService extends ApiService {
  async getNotificationConfig(): Promise<NotificationConfig> {
    return this.get<NotificationConfig>('/admin/notification-config');
  }

  async updateNotificationConfig(data: Partial<NotificationFormData>): Promise<NotificationConfig> {
    return this.patch<NotificationConfig>('/admin/notification-config', data);
  }

  async getClientNotificationSettings(): Promise<ClientNotificationSettings[]> {
    return this.get<ClientNotificationSettings[]>('/admin/clients/notification-settings');
  }

  async updateClientNotificationSettings(clientId: number, enabled: boolean): Promise<void> {
    return this.patch(`/admin/clients/${clientId}/notification-settings`, {
      notifications_enabled: enabled,
    });
  }

  async testWebhook(type: string, url: string, headers?: Record<string, string>): Promise<{ success: boolean; message: string }> {
    return this.post('/admin/test-webhook', {
      webhook_type: type,
      webhook_url: url,
      headers,
    });
  }
}

export function NotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const apiConfig = getApiConfig(user?.apiKey);
  const notificationService = new NotificationService(apiConfig);

  // Get notification configuration
  const { data: notificationConfig, isLoading: configLoading } = useQuery({
    queryKey: ['notification-config'],
    queryFn: () => notificationService.getNotificationConfig(),
  });

  // Get client notification settings
  const { data: clientSettings, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-notification-settings'],
    queryFn: () => notificationService.getClientNotificationSettings(),
  });

  const form = useForm<NotificationFormData>({
    initialValues: {
      notifications_enabled: false,
      discord_enabled: false,
      discord_webhook_url: '',
      slack_enabled: false,
      slack_webhook_url: '',
      generic_enabled: false,
      generic_webhook_url: '',
      generic_headers: '{}',
    },
    validate: {
      discord_webhook_url: (value, values) =>
        values.discord_enabled && !value.trim() ? 'Discord webhook URL is required when Discord is enabled' : null,
      slack_webhook_url: (value, values) =>
        values.slack_enabled && !value.trim() ? 'Slack webhook URL is required when Slack is enabled' : null,
      generic_webhook_url: (value, values) =>
        values.generic_enabled && !value.trim() ? 'Generic webhook URL is required when generic webhook is enabled' : null,
      generic_headers: (value) => {
        if (!value.trim()) return null;
        try {
          JSON.parse(value);
          return null;
        } catch {
          return 'Invalid JSON format for headers';
        }
      },
    },
  });

  // Update form when config loads
  React.useEffect(() => {
    if (notificationConfig) {
      form.setValues({
        notifications_enabled: notificationConfig.notifications_enabled,
        discord_enabled: notificationConfig.discord_enabled,
        discord_webhook_url: notificationConfig.discord_webhook_url || '',
        slack_enabled: notificationConfig.slack_enabled,
        slack_webhook_url: notificationConfig.slack_webhook_url || '',
        generic_enabled: notificationConfig.generic_enabled,
        generic_webhook_url: notificationConfig.generic_webhook_url || '',
        generic_headers: JSON.stringify(notificationConfig.generic_headers || {}, null, 2),
      });
    }
  }, [notificationConfig]);

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      const payload: any = { ...data };
      
      // Parse headers JSON
      if (data.generic_headers.trim()) {
        try {
          payload.generic_headers = JSON.parse(data.generic_headers);
        } catch {
          throw new Error('Invalid JSON format for headers');
        }
      } else {
        payload.generic_headers = null;
      }

      return notificationService.updateNotificationConfig(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
      notifications.show({
        title: 'Success',
        message: 'Notification settings updated successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: any) => {
      console.error('Save failed:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update notification settings. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async ({ type, url, headers }: { type: string; url: string; headers?: Record<string, string> }) => {
      return notificationService.testWebhook(type, url, headers);
    },
    onSuccess: (result, variables) => {
      notifications.show({
        title: result.success ? 'Success' : 'Test Failed',
        message: result.message,
        color: result.success ? '#7fcf00' : 'red',
        icon: result.success ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />,
      });
      setTestingWebhook(null);
    },
    onError: (error: any) => {
      console.error('Test failed:', error);
      notifications.show({
        title: 'Test Failed',
        message: 'Failed to test webhook. Please check the URL and try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
      setTestingWebhook(null);
    },
  });

  // Update client notification settings
  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: number; enabled: boolean }) => {
      return notificationService.updateClientNotificationSettings(clientId, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notification-settings'] });
    },
    onError: (error: any) => {
      console.error('Failed to update client settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update client notification settings',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const handleSave = useCallback((values: NotificationFormData) => {
    saveMutation.mutate(values);
  }, [saveMutation]);

  const handleTestWebhook = useCallback((type: string, url: string, headers?: Record<string, string>) => {
    setTestingWebhook(type);
    testWebhookMutation.mutate({ type, url, headers });
  }, [testWebhookMutation]);

  const handleClientToggle = useCallback((clientId: number, enabled: boolean) => {
    updateClientMutation.mutate({ clientId, enabled });
  }, [updateClientMutation]);

  if (configLoading || clientsLoading) {
    return (
      <Card withBorder>
        <Group justify="center" p="xl">
          <Loader size="sm" />
          <Text>Loading notification settings...</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      {/* Main Settings Card */}
      <Card withBorder>
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="lg">
            <Group>
              <IconBell size={20} />
              <Text fw={500} size="lg">
                Notification Settings
              </Text>
            </Group>

            {/* Global Enable/Disable */}
            <Switch
              label="Enable Notifications"
              description="Master switch to enable or disable all notifications"
              {...form.getInputProps('notifications_enabled', { type: 'checkbox' })}
              disabled={saveMutation.isPending}
            />

            {form.values.notifications_enabled && (
              <Tabs defaultValue="discord" variant="outline">
                <Tabs.List>
                  <Tabs.Tab value="discord" leftSection={<IconBrandDiscord size={16} />}>
                    Discord
                  </Tabs.Tab>
                  <Tabs.Tab value="slack" leftSection={<IconBrandSlack size={16} />}>
                    Slack
                  </Tabs.Tab>
                  <Tabs.Tab value="generic" leftSection={<IconWebhook size={16} />}>
                    Generic Webhook
                  </Tabs.Tab>
                </Tabs.List>

                {/* Discord Tab */}
                <Tabs.Panel value="discord" pt="md">
                  <Stack gap="sm">
                    <Switch
                      label="Enable Discord Notifications"
                      description="Send notifications to Discord via webhook"
                      {...form.getInputProps('discord_enabled', { type: 'checkbox' })}
                      disabled={saveMutation.isPending}
                    />

                    {form.values.discord_enabled && (
                      <>
                        <TextInput
                          label="Discord Webhook URL"
                          placeholder="https://discord.com/api/webhooks/..."
                          description="Get this from your Discord server's webhook settings"
                          {...form.getInputProps('discord_webhook_url')}
                          disabled={saveMutation.isPending}
                          rightSection={
                            <Tooltip label="Test webhook">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleTestWebhook('discord', form.values.discord_webhook_url)}
                                disabled={!form.values.discord_webhook_url.trim() || testingWebhook === 'discord'}
                              >
                                {testingWebhook === 'discord' ? <Loader size={16} /> : <IconTestPipe size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          }
                        />

                        <Alert color="blue" variant="light" title="Discord Setup Instructions">
                          <Text size="sm">
                            1. Go to your Discord server settings → Integrations → Webhooks
                            <br />
                            2. Click "New Webhook" and configure the channel
                            <br />
                            3. Copy the webhook URL and paste it above
                          </Text>
                        </Alert>
                      </>
                    )}
                  </Stack>
                </Tabs.Panel>

                {/* Slack Tab */}
                <Tabs.Panel value="slack" pt="md">
                  <Stack gap="sm">
                    <Switch
                      label="Enable Slack Notifications"
                      description="Send notifications to Slack via webhook"
                      {...form.getInputProps('slack_enabled', { type: 'checkbox' })}
                      disabled={saveMutation.isPending}
                    />

                    {form.values.slack_enabled && (
                      <>
                        <TextInput
                          label="Slack Webhook URL"
                          placeholder="https://hooks.slack.com/services/..."
                          description="Get this from your Slack app's incoming webhooks settings"
                          {...form.getInputProps('slack_webhook_url')}
                          disabled={saveMutation.isPending}
                          rightSection={
                            <Tooltip label="Test webhook">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleTestWebhook('slack', form.values.slack_webhook_url)}
                                disabled={!form.values.slack_webhook_url.trim() || testingWebhook === 'slack'}
                              >
                                {testingWebhook === 'slack' ? <Loader size={16} /> : <IconTestPipe size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          }
                        />

                        <Alert color="blue" variant="light" title="Slack Setup Instructions">
                          <Text size="sm">
                            1. Create a new Slack app at api.slack.com/apps
                            <br />
                            2. Enable "Incoming Webhooks" and create a webhook
                            <br />
                            3. Select the channel and copy the webhook URL
                          </Text>
                        </Alert>
                      </>
                    )}
                  </Stack>
                </Tabs.Panel>

                {/* Generic Webhook Tab */}
                <Tabs.Panel value="generic" pt="md">
                  <Stack gap="sm">
                    <Switch
                      label="Enable Generic Webhook"
                      description="Send JSON notifications to any custom webhook endpoint"
                      {...form.getInputProps('generic_enabled', { type: 'checkbox' })}
                      disabled={saveMutation.isPending}
                    />

                    {form.values.generic_enabled && (
                      <>
                        <TextInput
                          label="Webhook URL"
                          placeholder="https://your-webhook-endpoint.com/webhook"
                          description="Any endpoint that accepts JSON POST requests"
                          {...form.getInputProps('generic_webhook_url')}
                          disabled={saveMutation.isPending}
                          rightSection={
                            <Tooltip label="Test webhook">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => {
                                  let headers;
                                  try {
                                    headers = JSON.parse(form.values.generic_headers || '{}');
                                  } catch {
                                    headers = {};
                                  }
                                  handleTestWebhook('generic', form.values.generic_webhook_url, headers);
                                }}
                                disabled={!form.values.generic_webhook_url.trim() || testingWebhook === 'generic'}
                              >
                                {testingWebhook === 'generic' ? <Loader size={16} /> : <IconTestPipe size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          }
                        />

                        <JsonInput
                          label="Custom Headers (Optional)"
                          placeholder='{\n  "Authorization": "Bearer token",\n  "X-API-Key": "your-key"\n}'
                          description="Additional HTTP headers to send with the request"
                          minRows={3}
                          maxRows={8}
                          {...form.getInputProps('generic_headers')}
                          disabled={saveMutation.isPending}
                        />

                        <Alert color="blue" variant="light" title="Generic Webhook Format">
                          <Text size="sm">
                            The webhook will receive a JSON payload like:
                            <br />
                            <code style={{ fontSize: '12px' }}>
                              {`{ "event": "protocol_update", "data": { "client": "lighthouse", "tag": "v1.0.0", ... } }`}
                            </code>
                          </Text>
                        </Alert>
                      </>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            )}

            {/* Save Button */}
            <Group justify="flex-end">
              <Button
                type="submit"
                leftSection={<IconCheck size={16} />}
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending || !form.values.notifications_enabled}
              >
                Save Notification Settings
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* Client-specific Settings */}
      <Card withBorder>
        <Stack gap="md">
          <Group>
            <IconToggleRight size={20} />
            <Text fw={500} size="lg">
              Per-Client Notification Settings
            </Text>
          </Group>
          
          <Text size="sm" c="dimmed">
            Enable or disable notifications for specific clients. These settings only apply when global notifications are enabled.
          </Text>

          {clientSettings && clientSettings.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>GitHub Repository</Table.Th>
                  <Table.Th>Notifications</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clientSettings.map((client) => (
                  <Table.Tr key={client.client_id}>
                    <Table.Td>
                      <Text fw={500}>{client.client_name}</Text>
                      <Text size="xs" c="dimmed">{client.client_string}</Text>
                    </Table.Td>
                    <Table.Td>
                      {client.github_url ? (
                        <Text size="sm" c="blue" component="a" href={client.github_url} target="_blank">
                          {client.github_url.replace('https://github.com/', '')}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">No GitHub URL</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={client.notifications_enabled}
                        onChange={(event) => handleClientToggle(client.client_id, event.currentTarget.checked)}
                        disabled={updateClientMutation.isPending}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No clients configured yet
            </Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}