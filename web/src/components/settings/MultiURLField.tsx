/**
 * Helper component for managing multiple URLs in notification settings
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

interface MultiURLFieldProps {
  label: string;
  placeholder: string;
  description: string;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  onTestUrl?: (url: string) => void;
  isTestingUrl?: string;
  disabled?: boolean;
}

export function MultiURLField({
  label,
  placeholder,
  description,
  urls,
  onUrlsChange,
  onTestUrl,
  isTestingUrl,
  disabled = false,
}: MultiURLFieldProps) {
  const handleAddUrl = () => {
    onUrlsChange([...urls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    onUrlsChange(newUrls);
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    onUrlsChange(newUrls);
  };

  const handleTestUrl = (url: string) => {
    if (onTestUrl && url.trim()) {
      onTestUrl(url);
    }
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={handleAddUrl}
          disabled={disabled}
        >
          Add URL
        </Button>
      </Group>
      
      <Text size="xs" c="dimmed">{description}</Text>

      {urls.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No URLs configured. Click "Add URL" to get started.
        </Text>
      )}

      {urls.map((url, index) => (
        <Group key={index} gap="xs">
          <TextInput
            flex={1}
            placeholder={placeholder}
            value={url}
            onChange={(e) => handleUrlChange(index, e.target.value)}
            disabled={disabled}
            rightSection={
              onTestUrl && (
                <Tooltip label="Test webhook">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => handleTestUrl(url)}
                    disabled={!url.trim() || isTestingUrl === url}
                  >
                    {isTestingUrl === url ? (
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
            onClick={() => handleRemoveUrl(index)}
            disabled={disabled}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}

      {urls.length === 0 && (
        <Group justify="center">
          <Button
            variant="outline"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddUrl}
            disabled={disabled}
          >
            Add First {label}
          </Button>
        </Group>
      )}
    </Stack>
  );
}