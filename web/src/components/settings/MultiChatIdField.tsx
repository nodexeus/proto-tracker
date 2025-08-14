/**
 * Helper component for managing multiple Telegram chat IDs
 */

import React from 'react';
import {
  Stack,
  Group,
  TextInput,
  Button,
  ActionIcon,
  Tooltip,
  Loader,
  Text,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconTestPipe,
} from '@tabler/icons-react';

interface MultiChatIdFieldProps {
  chatIds: string[];
  onChatIdsChange: (chatIds: string[]) => void;
  onTestChatId?: (chatId: string) => void;
  isTestingChatId?: string;
  disabled?: boolean;
}

export function MultiChatIdField({
  chatIds,
  onChatIdsChange,
  onTestChatId,
  isTestingChatId,
  disabled = false,
}: MultiChatIdFieldProps) {
  const handleAddChatId = () => {
    onChatIdsChange([...chatIds, '']);
  };

  const handleRemoveChatId = (index: number) => {
    const newChatIds = chatIds.filter((_, i) => i !== index);
    onChatIdsChange(newChatIds);
  };

  const handleChatIdChange = (index: number, value: string) => {
    const newChatIds = [...chatIds];
    newChatIds[index] = value;
    onChatIdsChange(newChatIds);
  };

  const handleTestChatId = (chatId: string) => {
    if (onTestChatId && chatId.trim()) {
      onTestChatId(chatId);
    }
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" fw={500}>Telegram Chat IDs</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={handleAddChatId}
          disabled={disabled}
        >
          Add Chat ID
        </Button>
      </Group>
      
      <Text size="xs" c="dimmed">
        Add the chat IDs where you want to receive notifications. Can be user IDs, group IDs, or channel IDs (include @ for channels).
      </Text>

      {chatIds.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No chat IDs configured. Click "Add Chat ID" to get started.
        </Text>
      )}

      {chatIds.map((chatId, index) => (
        <Group key={index} gap="xs">
          <TextInput
            flex={1}
            placeholder="@channel_name, -1001234567890, or 1234567890"
            value={chatId}
            onChange={(e) => handleChatIdChange(index, e.target.value)}
            disabled={disabled}
            rightSection={
              onTestChatId && (
                <Tooltip label="Test chat ID">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => handleTestChatId(chatId)}
                    disabled={!chatId.trim() || isTestingChatId === chatId}
                  >
                    {isTestingChatId === chatId ? (
                      <Loader size={16} />
                    ) : (
                      <IconTestPipe size={16} />
                    )}
                  </ActionIcon>
                </Tooltip>
              )
            }
          />
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleRemoveChatId(index)}
            disabled={disabled}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}

      {chatIds.length === 0 && (
        <Group justify="center">
          <Button
            variant="outline"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddChatId}
            disabled={disabled}
          >
            Add First Chat ID
          </Button>
        </Group>
      )}
    </Stack>
  );
}