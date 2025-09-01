/**
 * S3-Compatible Storage configuration form component with connection validation
 */

import React, { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Card,
  Badge,
  Alert,
  Loader,
  Divider,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconCloud,
  IconCheck,
  IconAlertTriangle,
  IconTestPipe,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/api';
import { getApiConfig } from '../../utils';
import type { S3Config, S3ConfigCreate, S3ConfigUpdate, S3ConnectionTest } from '../../types';

interface FormValues {
  bucket_name: string;
  endpoint_url: string;
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

class SettingsService extends ApiService {
  async getS3Config(): Promise<S3Config | null> {
    try {
      return this.get<S3Config>('/s3-config');
    } catch {
      // Return null if no config exists yet
      return null;
    }
  }

  async createS3Config(data: S3ConfigCreate): Promise<S3Config> {
    return this.post<S3Config>('/s3-config', data);
  }

  async updateS3Config(data: S3ConfigUpdate): Promise<S3Config> {
    return this.patch<S3Config>('/s3-config', data);
  }

  async testS3Connection(): Promise<S3ConnectionTest> {
    return this.post<S3ConnectionTest>('/s3-config/test');
  }
}

export function S3StorageConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSecretKey, setShowSecretKey] = useState(false);

  const apiConfig = getApiConfig(user?.apiKey);

  const settingsService = new SettingsService(apiConfig);

  // Helper function to check if config truly exists
  const hasValidConfig = (config: S3Config | null) => {
    return config && config.id > 0 && config.bucket_name;
  };

  const form = useForm<FormValues>({
    initialValues: {
      bucket_name: '',
      endpoint_url: 'https://s3.us-west-002.backblazeb2.com',
      access_key_id: '',
      secret_access_key: '',
      region: 'us-west-002',
    },
    validate: {
      bucket_name: (value) => (!value.trim() ? 'Bucket name is required' : null),
      endpoint_url: (value) => {
        if (!value.trim()) return 'Endpoint URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Must be a valid URL';
        }
      },
      access_key_id: (value) => (!value.trim() ? 'Access Key ID is required' : null),
      secret_access_key: (value) => (!value.trim() ? 'Secret Access Key is required' : null),
    },
  });

  // Get existing configuration
  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['s3-config'],
    queryFn: () => settingsService.getS3Config(),
  });

  // Update form when config loads
  React.useEffect(() => {
    if (hasValidConfig(existingConfig)) {
      form.setValues({
        bucket_name: existingConfig.bucket_name,
        endpoint_url: existingConfig.endpoint_url,
        access_key_id: '', // Don't pre-fill sensitive data
        secret_access_key: '', // Don't pre-fill sensitive data
        region: existingConfig.region || 'us-west-002',
      });
    }
  }, [existingConfig]); // Remove 'form' from dependencies to prevent infinite loop

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Check if config truly exists
      if (hasValidConfig(existingConfig)) {
        return settingsService.updateS3Config(data);
      } else {
        return settingsService.createS3Config(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['s3-config'] });
      notifications.show({
        title: 'Success',
        message: 'S3 storage configuration saved successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Save failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save S3 storage configuration. Please check your settings and try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      return settingsService.testS3Connection();
    },
    onSuccess: (result) => {
      if (result.status === 'success') {
        notifications.show({
          title: 'Connection Successful',
          message: result.message,
          color: '#7fcf00',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'Connection Failed',
          message: result.message,
          color: 'red',
          icon: <IconAlertTriangle size={16} />,
        });
      }
    },
    onError: (error) => {
      console.error('Test failed:', error);
      notifications.show({
        title: 'Test Failed',
        message: 'Unable to test S3 storage connection. Please check your configuration.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const handleSave = useCallback(
    (values: FormValues) => {
      saveMutation.mutate(values);
    },
    [saveMutation]
  );

  const handleTest = useCallback(() => {
    testMutation.mutate();
  }, [testMutation]);


  if (configLoading) {
    return (
      <Card withBorder>
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading configuration...</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {/* Configuration Status */}
      <Card withBorder>
        <Group justify="space-between" align="center">
          <Group>
            <IconCloud size={24} color={hasValidConfig(existingConfig) ? '#7fcf00' : 'gray'} />
            <div>
              <Text fw={500}>
                S3-Compatible Storage {hasValidConfig(existingConfig) ? 'Configured' : 'Not Configured'}
              </Text>
              <Text size="sm" c="dimmed">
                {hasValidConfig(existingConfig)
                  ? `Connected to bucket: ${existingConfig.bucket_name}`
                  : 'No storage configuration found'
                }
              </Text>
            </div>
          </Group>
          
          <Group>
            {hasValidConfig(existingConfig) && (
              <Badge color="#7fcf00" variant="light">
                Active
              </Badge>
            )}
            
            <Tooltip label="Test connection">
              <ActionIcon
                variant="light"
                onClick={handleTest}
                loading={testMutation.isPending}
                disabled={!hasValidConfig(existingConfig) || testMutation.isPending}
              >
                <IconTestPipe size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Card>

      {/* Configuration Form */}
      <Card withBorder>
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="md">
            <Text fw={500} size="lg">
              {hasValidConfig(existingConfig) ? 'Update Configuration' : 'Configure S3-Compatible Storage'}
            </Text>

            {/* Basic Configuration */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                Basic Settings
              </Text>
              <Stack gap="sm">
                <TextInput
                  label="Bucket Name"
                  placeholder="my-protocol-snapshots"
                  required
                  {...form.getInputProps('bucket_name')}
                  disabled={saveMutation.isPending}
                />

                <TextInput
                  label="Endpoint URL"
                  placeholder="https://s3.us-west-002.backblazeb2.com"
                  description="Use your S3-compatible storage endpoint (Backblaze B2, MinIO, AWS S3, etc.)"
                  required
                  {...form.getInputProps('endpoint_url')}
                  disabled={saveMutation.isPending}
                />

                <TextInput
                  label="Region"
                  placeholder="us-west-002"
                  {...form.getInputProps('region')}
                  disabled={saveMutation.isPending}
                />
              </Stack>
            </div>

            <Divider />

            {/* Credentials */}
            <div>
              <Group justify="space-between" align="center" mb="xs">
                <Text size="sm" fw={500}>
                  Authentication Credentials
                </Text>
                <Badge size="sm" color="red" variant="light">
                  Sensitive Data
                </Badge>
              </Group>
              
              <Alert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                variant="light"
                mb="sm"
              >
                <Text size="sm">
                  Credentials are stored securely and encrypted. 
                  For security, existing credentials are not displayed.
                </Text>
              </Alert>

              <Stack gap="sm">
                <TextInput
                  label="Access Key ID"
                  placeholder={hasValidConfig(existingConfig) ? "••••••••••••" : "Enter your Access Key ID"}
                  required
                  {...form.getInputProps('access_key_id')}
                  disabled={saveMutation.isPending}
                />

                <PasswordInput
                  label="Secret Access Key"
                  placeholder={hasValidConfig(existingConfig) ? "••••••••••••••••••••" : "Enter your Secret Access Key"}
                  required
                  {...form.getInputProps('secret_access_key')}
                  disabled={saveMutation.isPending}
                  visible={showSecretKey}
                  onVisibilityChange={setShowSecretKey}
                />
              </Stack>
            </div>

            <Divider />

            {/* Actions */}
            <Group justify="flex-end">
              <Button
                variant="light"
                leftSection={<IconTestPipe size={16} />}
                onClick={handleTest}
                loading={testMutation.isPending}
                disabled={!hasValidConfig(existingConfig) || testMutation.isPending || saveMutation.isPending}
              >
                Test Connection
              </Button>
              
              <Button
                type="submit"
                leftSection={<IconCheck size={16} />}
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending}
              >
                {hasValidConfig(existingConfig) ? 'Update Configuration' : 'Save Configuration'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* Usage Information */}
      <Card withBorder bg="blue.0">
        <Stack gap="sm">
          <Group>
            <IconCloud size={20} color="blue" />
            <Text fw={500} c="blue">
              About S3-Compatible Storage
            </Text>
          </Group>
          
          <Text size="sm" c="blue.8">
            This configuration enables the system to store and manage protocol snapshots
            in any S3-compatible cloud storage service including Backblaze B2, MinIO, AWS S3,
            and other compatible providers. Make sure your bucket has the appropriate
            permissions for reading and writing files.
          </Text>
          
          <div>
            <Text size="sm" fw={500} c="blue.8" mb="xs">
              Required Bucket Permissions:
            </Text>
            <Stack gap={4}>
              <Text size="xs" c="blue.7">• Read files and file information</Text>
              <Text size="xs" c="blue.7">• Write files</Text>
              <Text size="xs" c="blue.7">• List files in bucket</Text>
              <Text size="xs" c="blue.7">• Delete files (for cleanup operations)</Text>
            </Stack>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
}