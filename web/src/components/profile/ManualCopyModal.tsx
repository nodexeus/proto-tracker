/**
 * Modal for manual copying when clipboard API fails
 */

import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Code,
  Button,
  Group,
  Alert,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';

interface ManualCopyModalProps {
  opened: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
}

export function ManualCopyModal({ opened, onClose, apiKey, keyName }: ManualCopyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleSelectAll = () => {
    // Select all text in the code block
    const codeElement = document.getElementById('manual-copy-key');
    if (codeElement) {
      const range = document.createRange();
      range.selectNodeContents(codeElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const handleTryAgain = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          onClose();
        }, 1500);
      } else {
        // Try the fallback method one more time
        const textArea = document.createElement('textarea');
        textArea.value = apiKey;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '0';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
            onClose();
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Still failed to copy:', error);
      // Keep modal open for manual copy
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Manual Copy Required - ${keyName}`}
      size="md"
      centered
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          title="Automatic Copy Failed"
        >
          Your browser's security settings prevent automatic copying. Please manually copy the API key below.
        </Alert>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            API Key:
          </Text>
          <Code
            id="manual-copy-key"
            block
            style={{ 
              fontFamily: 'monospace', 
              fontSize: '0.875rem',
              cursor: 'text',
              userSelect: 'text',
              wordBreak: 'break-all'
            }}
            onClick={handleSelectAll}
          >
            {apiKey}
          </Code>
          <Text size="xs" c="dimmed">
            Click the code above to select all, then press Ctrl+C (Cmd+C on Mac) to copy
          </Text>
        </Stack>

        <Group justify="space-between">
          <Button variant="subtle" onClick={onClose}>
            Done
          </Button>
          
          <Group gap="xs">
            <Button
              variant="light"
              onClick={handleSelectAll}
              leftSection={<IconCopy size={16} />}
            >
              Select All
            </Button>
            
            <Tooltip label={copied ? "Copied!" : "Try automatic copy again"}>
              <ActionIcon
                variant="filled"
                color={copied ? "#7fcf00" : "blue"}
                size="lg"
                onClick={handleTryAgain}
              >
                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}