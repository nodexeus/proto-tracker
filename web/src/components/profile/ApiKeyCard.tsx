/**
 * ApiKeyCard component for displaying individual API keys with copy/delete actions
 */

import { useState } from 'react';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Code,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconTrash,
} from '@tabler/icons-react';
import type { ProfileApiKey } from '../../types';
import { useClipboard } from '../../hooks';
import { formatDate } from '../../utils/formatters';
import { DeleteApiKeyModal } from './DeleteApiKeyModal';

interface ApiKeyCardProps {
  apiKey: ProfileApiKey;
}

export function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { copyApiKey, getCopiedState, getCopyIcon, isLoading } = useClipboard();

  const handleCopy = async () => {
    await copyApiKey(apiKey.id, apiKey.name);
  };

  const copiedStateKey = `apikey-${apiKey.id}`;
  const isCopied = getCopiedState(copiedStateKey);

  return (
    <>
      <Card withBorder p="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" flex={1}>
            <Group gap="sm" align="center">
              <Text fw={500} size="sm">
                {apiKey.name}
              </Text>
              <Badge 
                color={apiKey.is_active ? 'green' : 'gray'} 
                variant="light" 
                size="sm"
              >
                {apiKey.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </Group>
            
            {apiKey.description && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {apiKey.description}
              </Text>
            )}
            
            <Code block style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {apiKey.key_preview}
            </Code>
            
            <Group gap="md">
              <Text size="xs" c="dimmed">
                Created: {formatDate(apiKey.created_at)}
              </Text>
              {apiKey.last_used && (
                <Text size="xs" c="dimmed">
                  Last used: {formatDate(apiKey.last_used)}
                </Text>
              )}
              {apiKey.expires_at && (
                <Text size="xs" c={new Date(apiKey.expires_at) < new Date() ? "red" : "dimmed"}>
                  Expires: {formatDate(apiKey.expires_at)}
                </Text>
              )}
            </Group>
          </Stack>
          
          <Group gap="xs">
            <Tooltip 
              label={isCopied ? 'Copied!' : 'Copy API key'} 
              position="top"
            >
              <ActionIcon
                variant="light"
                color={isCopied ? 'green' : 'blue'}
                onClick={handleCopy}
                loading={isLoading}
                disabled={!apiKey.is_active}
              >
                {getCopyIcon(copiedStateKey, 16)}
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="Delete API key" position="top">
              <ActionIcon
                variant="light"
                color="red"
                onClick={() => setDeleteModalOpen(true)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Card>

      <DeleteApiKeyModal
        apiKey={apiKey}
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />
    </>
  );
}