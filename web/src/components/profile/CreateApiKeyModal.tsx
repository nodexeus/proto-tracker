/**
 * CreateApiKeyModal component for creating new API keys with form validation
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Text,
  Alert,
  Code,
  Paper,
  Divider,
  Checkbox,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconKey,
  IconAlertTriangle,
  IconCheck,
  IconCopy,
} from '@tabler/icons-react';
import { useCreateApiKey } from '../../hooks';
import type { ProfileApiKeyCreate, ProfileApiKeyResponse } from '../../types';

interface CreateApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
}

interface FormValues {
  name: string;
  description: string;
  hasExpiry: boolean;
  expiresAt: Date | null;
}

export function CreateApiKeyModal({ opened, onClose }: CreateApiKeyModalProps) {
  const [createdApiKey, setCreatedApiKey] = useState<ProfileApiKeyResponse | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const createApiKeyMutation = useCreateApiKey();

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      description: '',
      hasExpiry: false,
      expiresAt: null,
    },
    validate: {
      name: (value) => {
        if (!value.trim()) {
          return 'API key name is required';
        }
        if (value.trim().length < 3) {
          return 'API key name must be at least 3 characters long';
        }
        if (value.trim().length > 50) {
          return 'API key name must be less than 50 characters';
        }
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(value.trim())) {
          return 'API key name can only contain letters, numbers, spaces, hyphens, and underscores';
        }
        return null;
      },
      description: (value) => {
        if (value && value.length > 200) {
          return 'Description must be less than 200 characters';
        }
        return null;
      },
      expiresAt: (value, values) => {
        if (values.hasExpiry && !value) {
          return 'Expiry date is required when expiry is enabled';
        }
        if (values.hasExpiry && value && value <= new Date()) {
          return 'Expiry date must be in the future';
        }
        return null;
      },
    },
  });

  // Reset form and state when modal opens/closes
  useEffect(() => {
    if (opened) {
      form.reset();
      setCreatedApiKey(null);
      setHasAcknowledged(false);
    }
  }, [opened]); // Removed form from dependencies to avoid infinite loop

  const handleSubmit = async (values: FormValues) => {
    try {
      const apiKeyData: ProfileApiKeyCreate = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        expires_at: values.hasExpiry && values.expiresAt 
          ? values.expiresAt.toISOString() 
          : undefined,
      };

      const newApiKey = await createApiKeyMutation.mutateAsync(apiKeyData);
      setCreatedApiKey(newApiKey);
    } catch (error) {
      console.error('Failed to create API key:', error);
      // Error notification is handled by the hook
    }
  };

  const handleCopyKey = async () => {
    if (createdApiKey?.key) {
      try {
        await navigator.clipboard.writeText(createdApiKey.key);
        notifications.show({
          title: 'Copied!',
          message: 'API key copied to clipboard',
          color: '#7fcf00',
          icon: <IconCheck size={16} />,
        });
      } catch (error) {
        notifications.show({
          title: 'Copy Failed',
          message: 'Failed to copy API key to clipboard',
          color: 'red',
        });
      }
    }
  };

  const handleClose = () => {
    if (createdApiKey && !hasAcknowledged) {
      // Don't allow closing without acknowledgment
      return;
    }
    onClose();
  };

  const handleAcknowledge = () => {
    setHasAcknowledged(true);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <IconKey size={20} />
          <Text fw={600}>
            {createdApiKey ? 'API Key Created' : 'Create New API Key'}
          </Text>
        </Group>
      }
      size="md"
      centered
      closeOnClickOutside={!createdApiKey}
      closeOnEscape={!createdApiKey}
    >
      {!createdApiKey ? (
        // Creation form
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="API Key Name"
              placeholder="Enter a descriptive name for your API key"
              required
              {...form.getInputProps('name')}
              disabled={createApiKeyMutation.isPending}
            />

            <Textarea
              label="Description (Optional)"
              placeholder="Describe what this API key will be used for"
              rows={3}
              {...form.getInputProps('description')}
              disabled={createApiKeyMutation.isPending}
            />

            <Checkbox
              label="Set expiry date"
              description="API key will automatically become inactive after this date"
              {...form.getInputProps('hasExpiry', { type: 'checkbox' })}
              disabled={createApiKeyMutation.isPending}
            />

            {form.values.hasExpiry && (
              <DateTimePicker
                label="Expiry Date"
                placeholder="Select when this API key should expire"
                minDate={new Date()}
                {...form.getInputProps('expiresAt')}
                disabled={createApiKeyMutation.isPending}
              />
            )}

            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="yellow"
              variant="light"
            >
              <Text size="sm">
                The API key will be shown only once after creation. Make sure to copy and store it securely.
              </Text>
            </Alert>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={onClose}
                disabled={createApiKeyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createApiKeyMutation.isPending}
              >
                Create API Key
              </Button>
            </Group>
          </Stack>
        </form>
      ) : (
        // Success state with API key display
        <Stack gap="md">
          <Alert
            icon={<IconCheck size={16} />}
            color="#7fcf00"
            variant="light"
          >
            <Text size="sm" fw={500}>
              API key "{createdApiKey.name}" has been created successfully!
            </Text>
          </Alert>

          <div>
            <Text size="sm" fw={500} mb="xs">
              Your API Key:
            </Text>
            <Paper p="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
              <Group justify="space-between" align="center">
                <Code 
                  block 
                  style={{ 
                    flex: 1, 
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all'
                  }}
                >
                  {createdApiKey.key}
                </Code>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconCopy size={14} />}
                  onClick={handleCopyKey}
                >
                  Copy
                </Button>
              </Group>
            </Paper>
          </div>

          <Divider />

          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
          >
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Important Security Notice:
              </Text>
              <Text size="sm">
                • This is the only time you'll see the complete API key
              </Text>
              <Text size="sm">
                • Copy and store it in a secure location immediately
              </Text>
              <Text size="sm">
                • If you lose this key, you'll need to create a new one
              </Text>
            </Stack>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button
              onClick={handleAcknowledge}
            >
              I've Saved the API Key
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}