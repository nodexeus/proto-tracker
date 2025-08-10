/**
 * DeleteApiKeyModal component for confirming API key deletion
 */

import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Alert,
  Code,
  Divider,
} from '@mantine/core';
import {
  IconTrash,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDeleteApiKey } from '../../hooks';
import type { ProfileApiKey } from '../../types';
import { formatDate } from '../../utils/formatters';

interface DeleteApiKeyModalProps {
  apiKey: ProfileApiKey;
  opened: boolean;
  onClose: () => void;
}

export function DeleteApiKeyModal({ apiKey, opened, onClose }: DeleteApiKeyModalProps) {
  const deleteApiKeyMutation = useDeleteApiKey();

  const handleDelete = async () => {
    try {
      await deleteApiKeyMutation.mutateAsync(apiKey.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete API key:', error);
      // Error notification is handled by the hook
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconTrash size={20} color="red" />
          <Text fw={600} c="red">
            Delete API Key
          </Text>
        </Group>
      }
      size="md"
      centered
      closeOnClickOutside={!deleteApiKeyMutation.isPending}
      closeOnEscape={!deleteApiKeyMutation.isPending}
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          variant="light"
        >
          <Text size="sm" fw={500}>
            This action cannot be undone!
          </Text>
        </Alert>

        <div>
          <Text size="sm" c="dimmed" mb="xs">
            You are about to delete the following API key:
          </Text>
          
          <Stack gap="sm">
            <Group>
              <Text size="sm" fw={500}>
                Name:
              </Text>
              <Text size="sm">
                {apiKey.name}
              </Text>
            </Group>

            {apiKey.description && (
              <Group align="flex-start">
                <Text size="sm" fw={500}>
                  Description:
                </Text>
                <Text size="sm" style={{ flex: 1 }}>
                  {apiKey.description}
                </Text>
              </Group>
            )}

            <Group>
              <Text size="sm" fw={500}>
                Key Preview:
              </Text>
              <Code style={{ fontSize: '0.875rem' }}>
                {apiKey.key_preview}
              </Code>
            </Group>

            <Group>
              <Text size="sm" fw={500}>
                Created:
              </Text>
              <Text size="sm">
                {formatDate(apiKey.created_at)}
              </Text>
            </Group>

            {apiKey.last_used && (
              <Group>
                <Text size="sm" fw={500}>
                  Last Used:
                </Text>
                <Text size="sm">
                  {formatDate(apiKey.last_used)}
                </Text>
              </Group>
            )}
          </Stack>
        </div>

        <Divider />

        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="orange"
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Before deleting this API key:
            </Text>
            <Text size="sm">
              • Make sure no applications are currently using this key
            </Text>
            <Text size="sm">
              • Update any scripts or services that depend on this key
            </Text>
            <Text size="sm">
              • Consider creating a replacement key before deletion
            </Text>
          </Stack>
        </Alert>

        <Group justify="flex-end" mt="md">
          <Button
            variant="light"
            onClick={onClose}
            disabled={deleteApiKeyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleteApiKeyMutation.isPending}
            leftSection={<IconTrash size={16} />}
          >
            Delete API Key
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}