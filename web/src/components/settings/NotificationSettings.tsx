/**
 * Enhanced notification settings component with support for multiple URLs and Telegram
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
  Alert,
  Tabs,
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
  IconBrandDiscord,
  IconBrandSlack,
  IconBrandTelegram,
  IconWebhook,
  IconToggleRight,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/api';
import { getApiConfig } from '../../utils';
import { MultiURLField } from './MultiURLField';
import { MultiChatIdField } from './MultiChatIdField';

interface NotificationConfig {
  id: number;
  notifications_enabled: boolean;
  // Discord
  discord_enabled: boolean;
  discord_webhook_url?: string;
  discord_webhook_urls?: string[];
  // Slack
  slack_enabled: boolean;
  slack_webhook_url?: string;
  slack_webhook_urls?: string[];
  // Telegram
  telegram_enabled: boolean;
  telegram_bot_token?: string;
  telegram_chat_ids?: string[];
  // Generic
  generic_enabled: boolean;
  generic_webhook_url?: string;
  generic_webhook_urls?: Array<{url: string; headers?: Record<string, string>}>;
  generic_headers?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface NotificationFormData {
  notifications_enabled: boolean;
  discord_enabled: boolean;
  discord_webhook_urls: string[];
  slack_enabled: boolean;
  slack_webhook_urls: string[];
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_ids: string[];
  generic_enabled: boolean;
  generic_webhook_urls: Array<{url: string; headers: string}>;
}

class NotificationService extends ApiService {
  async getNotificationConfig(): Promise<NotificationConfig> {
    return this.get<NotificationConfig>('/admin/notification-config');
  }

  async updateNotificationConfig(data: Partial<NotificationFormData>): Promise<NotificationConfig> {
    return this.patch<NotificationConfig>('/admin/notification-config', data);
  }

  async testWebhook(type: string, config: { url?: string; bot_token?: string; chat_id?: string; headers?: Record<string, string> }): Promise<{ success: boolean; message: string }> {
    return this.post('/admin/test-webhook', {
      webhook_type: type,
      webhook_url: config.url,
      bot_token: config.bot_token,
      chat_id: config.chat_id,
      headers: config.headers,
    });
  }
}

export function NotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const apiConfig = getApiConfig(user?.apiKey);
  const notificationService = new NotificationService(apiConfig);

  const { data: notificationConfig, isLoading } = useQuery({
    queryKey: ['notification-config'],
    queryFn: () => notificationService.getNotificationConfig(),
  });

  const form = useForm<NotificationFormData>({
    initialValues: {
      notifications_enabled: false,
      discord_enabled: false,
      discord_webhook_urls: [],
      slack_enabled: false,
      slack_webhook_urls: [],
      telegram_enabled: false,
      telegram_bot_token: '',
      telegram_chat_ids: [],
      generic_enabled: false,
      generic_webhook_urls: [],
    },
    validate: {
      discord_webhook_urls: (value, values) =>
        values.discord_enabled && value.length === 0 ? 'At least one Discord webhook URL is required' : null,
      slack_webhook_urls: (value, values) =>
        values.slack_enabled && value.length === 0 ? 'At least one Slack webhook URL is required' : null,
      telegram_bot_token: (value, values) =>
        values.telegram_enabled && !value.trim() ? 'Telegram bot token is required' : null,
      telegram_chat_ids: (value, values) =>
        values.telegram_enabled && value.length === 0 ? 'At least one Telegram chat ID is required' : null,
      generic_webhook_urls: (value, values) =>
        values.generic_enabled && value.length === 0 ? 'At least one generic webhook URL is required' : null,
    },
  });

  // Initialize form when config loads
  React.useEffect(() => {
    if (notificationConfig) {
      const discordUrls = notificationConfig.discord_webhook_urls || [];
      if (notificationConfig.discord_webhook_url && !discordUrls.includes(notificationConfig.discord_webhook_url)) {
        discordUrls.push(notificationConfig.discord_webhook_url);
      }

      const slackUrls = notificationConfig.slack_webhook_urls || [];
      if (notificationConfig.slack_webhook_url && !slackUrls.includes(notificationConfig.slack_webhook_url)) {
        slackUrls.push(notificationConfig.slack_webhook_url);
      }

      const genericUrls = notificationConfig.generic_webhook_urls || [];
      if (notificationConfig.generic_webhook_url && !genericUrls.some(g => g.url === notificationConfig.generic_webhook_url)) {
        genericUrls.push({
          url: notificationConfig.generic_webhook_url,
          headers: notificationConfig.generic_headers || {}
        });
      }

      form.setValues({
        notifications_enabled: notificationConfig.notifications_enabled,
        discord_enabled: notificationConfig.discord_enabled,
        discord_webhook_urls: discordUrls,
        slack_enabled: notificationConfig.slack_enabled,
        slack_webhook_urls: slackUrls,
        telegram_enabled: notificationConfig.telegram_enabled,
        telegram_bot_token: notificationConfig.telegram_bot_token || '',
        telegram_chat_ids: notificationConfig.telegram_chat_ids || [],
        generic_enabled: notificationConfig.generic_enabled,
        generic_webhook_urls: genericUrls.map(g => ({
          url: g.url,
          headers: JSON.stringify(g.headers || {}, null, 2)
        })),
      });
    }
  }, [notificationConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      const payload: any = {
        notifications_enabled: data.notifications_enabled,
        discord_enabled: data.discord_enabled,
        discord_webhook_urls: data.discord_webhook_urls.filter(url => url.trim()),
        slack_enabled: data.slack_enabled,
        slack_webhook_urls: data.slack_webhook_urls.filter(url => url.trim()),
        telegram_enabled: data.telegram_enabled,
        telegram_bot_token: data.telegram_bot_token.trim() || null,
        telegram_chat_ids: data.telegram_chat_ids.filter(id => id.trim()),
        generic_enabled: data.generic_enabled,
        generic_webhook_urls: data.generic_webhook_urls
          .filter(config => config.url.trim())
          .map(config => {
            let headers = {};
            if (config.headers.trim()) {
              try {
                headers = JSON.parse(config.headers);
              } catch {
                throw new Error(`Invalid JSON format for headers in webhook: ${config.url}`);
              }
            }
            return { url: config.url, headers };
          })
      };

      return notificationService.updateNotificationConfig(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
      notifications.show({
        title: 'Success',
        message: 'Notification settings updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update notification settings',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async ({ type, config }: { type: string; config: any }) => {
      return notificationService.testWebhook(type, config);
    },
    onSuccess: (result) => {
      notifications.show({
        title: result.success ? 'Success' : 'Test Failed',
        message: result.message,
        color: result.success ? 'green' : 'red',
        icon: result.success ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />,
      });
      setTestingWebhook(null);
    },
    onError: () => {
      notifications.show({
        title: 'Test Failed',
        message: 'Failed to test webhook',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
      setTestingWebhook(null);
    },
  });

  const handleSave = useCallback((values: NotificationFormData) => {
    saveMutation.mutate(values);
  }, [saveMutation]);

  const handleTestWebhook = useCallback((type: string, config: any) => {
    setTestingWebhook(`${type}-${config.url || config.chat_id || 'test'}`);
    testWebhookMutation.mutate({ type, config });
  }, [testWebhookMutation]);

  if (isLoading) {
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
    <Card withBorder>
      <form onSubmit={form.onSubmit(handleSave)}>
        <Stack gap="lg">
          <Group>
            <IconBell size={20} />
            <Text fw={500} size="lg">Enhanced Notification Settings</Text>
          </Group>

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
                <Tabs.Tab value="telegram" leftSection={<IconBrandTelegram size={16} />}>
                  Telegram
                </Tabs.Tab>
                <Tabs.Tab value="generic" leftSection={<IconWebhook size={16} />}>
                  Generic Webhook
                </Tabs.Tab>
              </Tabs.List>

              {/* Discord Tab */}
              <Tabs.Panel value="discord" pt="md">
                <Stack gap="md">
                  <Switch
                    label="Enable Discord Notifications"
                    description="Send notifications to Discord via webhooks (supports multiple channels)"
                    {...form.getInputProps('discord_enabled', { type: 'checkbox' })}
                    disabled={saveMutation.isPending}
                  />

                  {form.values.discord_enabled && (
                    <>
                      <MultiURLField
                        label="Discord Webhook URLs"
                        placeholder="https://discord.com/api/webhooks/..."
                        description="You can add multiple Discord webhook URLs to notify different channels or servers."
                        urls={form.values.discord_webhook_urls}
                        onUrlsChange={(urls) => form.setFieldValue('discord_webhook_urls', urls)}
                        onTestUrl={(url) => handleTestWebhook('discord', { url })}
                        isTestingUrl={testingWebhook?.startsWith('discord-') ? testingWebhook.split('-')[1] : undefined}
                        disabled={saveMutation.isPending}
                      />

                      <Alert color="blue" variant="light" title="Discord Setup Instructions">
                        <Text size="sm">
                          1. Go to your Discord server settings → Integrations → Webhooks<br />
                          2. Click "New Webhook" and configure the channel<br />
                          3. Copy the webhook URL and add it above<br />
                          4. Repeat for additional channels/servers
                        </Text>
                      </Alert>
                    </>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Slack Tab */}
              <Tabs.Panel value="slack" pt="md">
                <Stack gap="md">
                  <Switch
                    label="Enable Slack Notifications"
                    description="Send notifications to Slack via webhooks (supports multiple channels)"
                    {...form.getInputProps('slack_enabled', { type: 'checkbox' })}
                    disabled={saveMutation.isPending}
                  />

                  {form.values.slack_enabled && (
                    <>
                      <MultiURLField
                        label="Slack Webhook URLs"
                        placeholder="https://hooks.slack.com/services/..."
                        description="You can add multiple Slack webhook URLs to notify different channels or workspaces."
                        urls={form.values.slack_webhook_urls}
                        onUrlsChange={(urls) => form.setFieldValue('slack_webhook_urls', urls)}
                        onTestUrl={(url) => handleTestWebhook('slack', { url })}
                        isTestingUrl={testingWebhook?.startsWith('slack-') ? testingWebhook.split('-')[1] : undefined}
                        disabled={saveMutation.isPending}
                      />

                      <Alert color="blue" variant="light" title="Slack Setup Instructions">
                        <Text size="sm">
                          1. Create a Slack app at api.slack.com/apps<br />
                          2. Enable "Incoming Webhooks" and create webhooks<br />
                          3. Select channels and copy webhook URLs<br />
                          4. Add each webhook URL above
                        </Text>
                      </Alert>
                    </>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Telegram Tab */}
              <Tabs.Panel value="telegram" pt="md">
                <Stack gap="md">
                  <Switch
                    label="Enable Telegram Notifications"
                    description="Send notifications to Telegram via bot (supports multiple chats/channels)"
                    {...form.getInputProps('telegram_enabled', { type: 'checkbox' })}
                    disabled={saveMutation.isPending}
                  />

                  {form.values.telegram_enabled && (
                    <>
                      <TextInput
                        label="Bot Token"
                        placeholder="123456789:ABCdefGHijklMNopqrsTUvwxyz"
                        description="Get this from @BotFather on Telegram"
                        {...form.getInputProps('telegram_bot_token')}
                        disabled={saveMutation.isPending}
                      />

                      <MultiChatIdField
                        chatIds={form.values.telegram_chat_ids}
                        onChatIdsChange={(chatIds) => form.setFieldValue('telegram_chat_ids', chatIds)}
                        onTestChatId={(chatId) => handleTestWebhook('telegram', { 
                          bot_token: form.values.telegram_bot_token, 
                          chat_id: chatId 
                        })}
                        isTestingChatId={testingWebhook?.startsWith('telegram-') ? testingWebhook.split('-')[1] : undefined}
                        disabled={saveMutation.isPending || !form.values.telegram_bot_token.trim()}
                      />

                      <Alert color="blue" variant="light" title="Telegram Setup Instructions">
                        <Text size="sm">
                          1. Create a bot by messaging @BotFather on Telegram<br />
                          2. Use /newbot and follow the instructions<br />
                          3. Copy the bot token and paste it above<br />
                          4. Add your bot to channels/groups or get user/chat IDs<br />
                          5. For channels: use @channel_name<br />
                          6. For groups/users: use the numeric ID (get it from @userinfobot)
                        </Text>
                      </Alert>
                    </>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Generic Webhook Tab */}
              <Tabs.Panel value="generic" pt="md">
                <Stack gap="md">
                  <Switch
                    label="Enable Generic Webhooks"
                    description="Send JSON notifications to custom endpoints (supports multiple URLs with custom headers)"
                    {...form.getInputProps('generic_enabled', { type: 'checkbox' })}
                    disabled={saveMutation.isPending}
                  />

                  {form.values.generic_enabled && (
                    <>
                      <Stack gap="sm">
                        {form.values.generic_webhook_urls.map((config, index) => (
                          <Card key={index} withBorder p="sm">
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Text size="sm" fw={500}>Webhook {index + 1}</Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  onClick={() => {
                                    const newConfigs = form.values.generic_webhook_urls.filter((_, i) => i !== index);
                                    form.setFieldValue('generic_webhook_urls', newConfigs);
                                  }}
                                  disabled={saveMutation.isPending}
                                >
                                  Remove
                                </Button>
                              </Group>
                              
                              <TextInput
                                placeholder="https://your-webhook-endpoint.com/webhook"
                                value={config.url}
                                onChange={(e) => {
                                  const newConfigs = [...form.values.generic_webhook_urls];
                                  newConfigs[index] = { ...config, url: e.target.value };
                                  form.setFieldValue('generic_webhook_urls', newConfigs);
                                }}
                                disabled={saveMutation.isPending}
                              />
                              
                              <JsonInput
                                label="Custom Headers (Optional)"
                                placeholder='{\n  "Authorization": "Bearer token"\n}'
                                minRows={2}
                                maxRows={6}
                                value={config.headers}
                                onChange={(value) => {
                                  const newConfigs = [...form.values.generic_webhook_urls];
                                  newConfigs[index] = { ...config, headers: value };
                                  form.setFieldValue('generic_webhook_urls', newConfigs);
                                }}
                                disabled={saveMutation.isPending}
                              />

                              {config.url.trim() && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => {
                                    let headers = {};
                                    try {
                                      headers = JSON.parse(config.headers || '{}');
                                    } catch {}
                                    handleTestWebhook('generic', { url: config.url, headers });
                                  }}
                                  loading={testingWebhook === `generic-${config.url}`}
                                  disabled={saveMutation.isPending}
                                >
                                  Test Webhook
                                </Button>
                              )}
                            </Stack>
                          </Card>
                        ))}

                        <Group justify="center">
                          <Button
                            variant="outline"
                            onClick={() => {
                              const newConfigs = [...form.values.generic_webhook_urls, { url: '', headers: '{}' }];
                              form.setFieldValue('generic_webhook_urls', newConfigs);
                            }}
                            disabled={saveMutation.isPending}
                          >
                            Add Generic Webhook
                          </Button>
                        </Group>
                      </Stack>

                      <Alert color="blue" variant="light" title="Generic Webhook Format">
                        <Text size="sm">
                          The webhook will receive a JSON payload like:<br />
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

          <Group justify="flex-end">
            <Button
              type="submit"
              leftSection={<IconCheck size={16} />}
              loading={saveMutation.isPending}
              disabled={!form.values.notifications_enabled}
            >
              Save Notification Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}