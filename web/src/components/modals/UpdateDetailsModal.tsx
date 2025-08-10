/**
 * Modal component for displaying detailed update information with markdown parsing
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Card,
  Divider,
  Alert,
  Anchor,
  ActionIcon,
  Tooltip,
  ScrollArea,
  TypographyStylesProvider,
  Box,
  Switch,
  Textarea,
  TextInput,
  Checkbox,
} from '@mantine/core';
import {
  IconExternalLink,
  IconGitBranch,
  IconCalendar,
  IconDeviceDesktop,
  IconDatabase,
  IconCode,
  IconTicket,
  IconGitFork,
  IconAlertTriangle,
  IconX,
  IconEdit,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { ProtocolUpdate } from '../../types';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import { useUpdateProtocolUpdate } from '../../hooks';

interface UpdateDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  update: ProtocolUpdate | null;
  onUpdateSaved?: () => void; // Callback to refresh parent data
}

export function UpdateDetailsModal({ opened, onClose, update, onUpdateSaved }: UpdateDetailsModalProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    hard_fork: false,
    is_draft: false,
    is_prerelease: false,
    notes: '',
  });
  const [currentUpdate, setCurrentUpdate] = useState<ProtocolUpdate | null>(update);

  const updateMutation = useUpdateProtocolUpdate();

  // Update currentUpdate when the prop changes
  useEffect(() => {
    setCurrentUpdate(update);
  }, [update]);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      setEditMode(false);
      setEditData({
        title: '',
        hard_fork: false,
        is_draft: false,
        is_prerelease: false,
        notes: '',
      });
      setNotesExpanded(false);
    }
  }, [opened]);

  // Reset state when update changes
  useEffect(() => {
    if (currentUpdate && editMode) {
      setEditData({
        title: currentUpdate.title || '',
        hard_fork: Boolean(currentUpdate.hard_fork),
        is_draft: Boolean(currentUpdate.is_draft),
        is_prerelease: Boolean(currentUpdate.is_prerelease),
        notes: currentUpdate.notes || '',
      });
    }
  }, [currentUpdate?.id, editMode]);

  // Use useCallback for stable handlers and simple value-based updates
  const handleHardForkChange = useCallback((checked: boolean) => {
    console.log('Hard fork checkbox changed:', checked);
    setEditData(prev => {
      console.log('Previous state:', prev);
      const newState = { ...prev, hard_fork: checked };
      console.log('New state:', newState);
      return newState;
    });
  }, []);

  const handleDraftChange = useCallback((checked: boolean) => {
    console.log('Draft checkbox changed:', checked);
    setEditData(prev => ({ ...prev, is_draft: checked }));
  }, []);

  const handlePrereleaseChange = useCallback((checked: boolean) => {
    console.log('Pre-release checkbox changed:', checked);
    setEditData(prev => ({ ...prev, is_prerelease: checked }));
  }, []);

  // Early return AFTER all hooks
  if (!currentUpdate) return null;

  // Initialize edit data when entering edit mode
  const handleEditToggle = () => {
    if (!editMode) {
      const newEditData = {
        title: currentUpdate.title || '',
        hard_fork: Boolean(currentUpdate.hard_fork),
        is_draft: Boolean(currentUpdate.is_draft),
        is_prerelease: Boolean(currentUpdate.is_prerelease),
        notes: currentUpdate.notes || '',
      };
      console.log('Setting edit data:', newEditData); // Debug log
      setEditData(newEditData);
    } else {
      // Reset to original values when cancelling
      setEditData({
        title: '',
        hard_fork: false,
        is_draft: false,
        is_prerelease: false,
        notes: '',
      });
    }
    setEditMode(!editMode);
  };

  // Save changes
  const handleSave = async () => {
    try {
      console.log('=== SAVE DEBUG ===');
      console.log('Original update data:', update);
      console.log('Edit data being sent:', editData);
      console.log('Update ID:', update.id);
      
      // Only send fields that actually changed
      const changedFields: any = { id: update.id };
      
      if (editData.title !== update.title) {
        changedFields.title = editData.title;
      }
      if (editData.hard_fork !== update.hard_fork) {
        changedFields.hard_fork = editData.hard_fork;
      }
      if (editData.is_draft !== update.is_draft) {
        changedFields.is_draft = editData.is_draft;
      }
      if (editData.is_prerelease !== update.is_prerelease) {
        changedFields.is_prerelease = editData.is_prerelease;
      }
      if (editData.notes !== update.notes) {
        changedFields.notes = editData.notes;
      }
      
      console.log('Sending only changed fields:', changedFields);
      
      const updatedData = await updateMutation.mutateAsync({
        id: update.id,
        data: changedFields,
      });
      
      console.log('Response from API:', updatedData);
      console.log('=== END SAVE DEBUG ===');
      
      // If API returned valid data, update the local state
      if (updatedData && updatedData.id && updatedData.name) {
        setCurrentUpdate(updatedData);
        console.log('Updated local modal data with API response');
      } else {
        console.warn('API returned invalid data, keeping original data');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Update details saved successfully',
        color: 'green',
      });
      
      setEditMode(false);
      
      // Call the callback to refresh parent data
      if (onUpdateSaved) {
        onUpdateSaved();
      }
    } catch (error) {
      console.error('Save error:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save update details',
        color: 'red',
      });
    }
  };

  const getBadgeProps = () => {
    if (!currentUpdate) return { color: 'gray', children: 'Unknown' };
    if (currentUpdate.is_draft) return { color: 'gray', children: 'Draft' };
    if (currentUpdate.is_prerelease) return { color: 'orange', children: 'Pre-release' };
    if (currentUpdate.hard_fork) return { color: 'red', children: 'Hard Fork' };
    return { color: 'green', children: 'Release' };
  };

  // Parse markdown content with support for tables and images
  const parseMarkdown = (text: string): string => {
    if (!text) return '';
    
    let parsed = text;
    
    // Parse tables first (before other processing)
    parsed = parseMarkdownTables(parsed);
    
    return parsed
      // Images - must come before links
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" />')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #228be6; text-decoration: none;">$1</a>')
      // Headers
      .replace(/^#### (.*$)/gim, '<h4 style="margin: 16px 0 8px 0; color: #343a40; font-size: 1.1em;">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 style="margin: 16px 0 8px 0; color: #343a40; font-size: 1.2em;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 20px 0 12px 0; color: #343a40; font-size: 1.4em;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 24px 0 16px 0; color: #343a40; font-size: 1.6em;">$1</h1>')
      // Code blocks - triple backticks
      .replace(/```([\s\S]*?)```/gim, '<pre style="background: #f8f9fa; padding: 12px; border-radius: 4px; overflow-x: auto; border: 1px solid #e9ecef; margin: 8px 0;"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code style="background: #f8f9fa; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/gim, '<em>$1</em>')
      .replace(/_([^_]+)_/gim, '<em>$1</em>')
      // Strikethrough
      .replace(/~~(.*?)~~/gim, '<del>$1</del>')
      // Horizontal rules
      .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid #e9ecef; margin: 16px 0;" />')
      .replace(/^___$/gim, '<hr style="border: none; border-top: 1px solid #e9ecef; margin: 16px 0;" />')
      // Parse lists (do this before line breaks)
      .replace(/((?:^\s*[\*\-\+]\s+.+$\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(line => 
          line.replace(/^\s*[\*\-\+]\s+(.+)$/, '<li style="margin: 4px 0;">$1</li>')
        ).join('');
        return `<ul style="margin: 12px 0; padding-left: 24px;">${items}</ul>`;
      })
      .replace(/((?:^\s*\d+\.\s+.+$\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(line => 
          line.replace(/^\s*\d+\.\s+(.+)$/, '<li style="margin: 4px 0;">$1</li>')
        ).join('');
        return `<ol style="margin: 12px 0; padding-left: 24px;">${items}</ol>`;
      })
      // Line breaks
      .replace(/\n/gim, '<br />');
  };

  // Parse markdown tables
  const parseMarkdownTables = (text: string): string => {
    const tableRegex = /(\|[^\n]+\|\n)+/gm;
    
    return text.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n');
      if (lines.length < 2) return match;
      
      const headers = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
      const separator = lines[1];
      const rows = lines.slice(2);
      
      // Check if second line is a separator (contains dashes)
      if (!separator.includes('-')) return match;
      
      let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #e9ecef;">';
      
      // Headers
      if (headers.length > 0) {
        tableHtml += '<thead><tr>';
        headers.forEach(header => {
          tableHtml += `<th style="border: 1px solid #e9ecef; padding: 8px 12px; background: #f8f9fa; font-weight: 600; text-align: left;">${header}</th>`;
        });
        tableHtml += '</tr></thead>';
      }
      
      // Body rows
      if (rows.length > 0) {
        tableHtml += '<tbody>';
        rows.forEach(row => {
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length > 0) {
            tableHtml += '<tr>';
            cells.forEach(cell => {
              tableHtml += `<td style="border: 1px solid #e9ecef; padding: 8px 12px;">${cell}</td>`;
            });
            tableHtml += '</tr>';
          }
        });
        tableHtml += '</tbody>';
      }
      
      tableHtml += '</table>';
      return tableHtml;
    });
  };

  // Return early if no update data
  if (!currentUpdate) {
    return (
      <Modal opened={opened} onClose={onClose} title="Update Details" centered>
        <Text>Loading update details...</Text>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={editMode ? () => {} : onClose} // Prevent closing when editing
      closeOnClickOutside={!editMode}
      closeOnEscape={!editMode}
      title={
        <Group justify="space-between" w="100%">
          <Group gap="sm">
            <IconDatabase size={20} />
            <Text fw={600} size="lg">
              Update Details
            </Text>
            {editMode && (
              <Badge color="blue" variant="light" size="sm">
                Editing
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            {editMode && (
              <Tooltip label="Save changes">
                <ActionIcon 
                  variant="filled" 
                  color="green"
                  onClick={handleSave}
                  loading={updateMutation.isPending}
                >
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {!editMode && (
              <Tooltip label="Edit update">
                <ActionIcon variant="subtle" onClick={handleEditToggle}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
      }
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
      styles={{
        title: { width: '100%' },
        header: { paddingBottom: 0 },
      }}
    >
      <Stack gap="md">
        {/* Header Info */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                {editMode ? (
                  <Stack gap="sm" mb="sm">
                    <TextInput
                      label="Title"
                      value={editData.title}
                      onChange={(e) => setEditData(prev => ({ ...prev, title: e.currentTarget.value }))}
                      placeholder="Update title"
                    />
                    <Group gap="md">
                      <Checkbox
                        label="Hard Fork"
                        checked={editData.hard_fork}
                        onChange={(event) => {
                          if (event?.currentTarget) {
                            handleHardForkChange(event.currentTarget.checked);
                          }
                        }}
                      />
                      <Checkbox
                        label="Draft"
                        checked={editData.is_draft}
                        onChange={(event) => {
                          if (event?.currentTarget) {
                            handleDraftChange(event.currentTarget.checked);
                          }
                        }}
                      />
                      <Checkbox
                        label="Pre-release"
                        checked={editData.is_prerelease}
                        onChange={(event) => {
                          if (event?.currentTarget) {
                            handlePrereleaseChange(event.currentTarget.checked);
                          }
                        }}
                      />
                    </Group>
                  </Stack>
                ) : (
                  <>
                    <Group gap="xs" mb="xs">
                      <Text fw={600} size="lg" lineClamp={2}>
                        {currentUpdate?.title || currentUpdate?.release_name}
                      </Text>
                      {currentUpdate?.hard_fork && (
                        <Tooltip label="Hard Fork">
                          <IconGitFork size={16} color="red" />
                        </Tooltip>
                      )}
                    </Group>
                    <Group gap="md" mb="sm">
                      <Badge size="sm" {...getBadgeProps()} />
                      <Badge variant="light" size="sm" color="blue">
                        {currentUpdate?.tag}
                      </Badge>
                    </Group>
                  </>
                )}
              </div>
            </Group>

            <Divider />

            {/* Metadata Grid */}
            <Group grow>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                  Protocol
                </Text>
                <Group gap="xs">
                  <IconDatabase size={14} />
                  <div>
                    <Text fw={500} size="sm">{currentUpdate?.name}</Text>
                    {currentUpdate?.client_entity?.protocols && currentUpdate.client_entity.protocols.length > 0 && (
                      <Text size="xs" c="dimmed">
                        Associated: {currentUpdate.client_entity.protocols.map(p => p.name).join(', ')}
                      </Text>
                    )}
                  </div>
                </Group>
              </div>

              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                  Client
                </Text>
                <Group gap="xs">
                  <IconDeviceDesktop size={14} />
                  <div>
                    <Text fw={500} size="sm">
                      {currentUpdate?.client_entity?.name || currentUpdate?.client}
                    </Text>
                    {currentUpdate?.client_entity?.client && currentUpdate.client_entity.client !== currentUpdate.client_entity.name && (
                      <Text size="xs" c="dimmed">
                        {currentUpdate.client_entity.client}
                      </Text>
                    )}
                  </div>
                </Group>
              </div>

              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                  Release Date
                </Text>
                <Group gap="xs">
                  <IconCalendar size={14} />
                  <div>
                    <Text fw={500} size="sm">{formatDate(currentUpdate?.date || '')}</Text>
                    <Text size="xs" c="dimmed">{formatRelativeTime(currentUpdate?.date || '')}</Text>
                  </div>
                </Group>
              </div>
            </Group>
          </Stack>
        </Card>

        {/* Release Notes */}
        {(currentUpdate?.notes || editMode) && (
          <Card withBorder p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="lg">
                Release Notes
              </Text>
              {!editMode && currentUpdate?.notes && currentUpdate.notes.length > 500 && (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setNotesExpanded(!notesExpanded)}
                >
                  {notesExpanded ? 'Show Less' : 'Show More'}
                </Button>
              )}
            </Group>
            
            {editMode ? (
              <Textarea
                value={editData.notes}
                onChange={(e) => setEditData(prev => ({ ...prev, notes: e.currentTarget.value }))}
                placeholder="Release notes (markdown supported)"
                autosize
                minRows={6}
                maxRows={20}
              />
            ) : (
              <Box
                style={{
                  maxHeight: notesExpanded ? 'none' : '300px',
                  overflow: notesExpanded ? 'visible' : 'hidden',
                  position: 'relative',
                }}
              >
                <TypographyStylesProvider>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: parseMarkdown(currentUpdate?.notes || ''),
                    }}
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.6,
                    }}
                  />
                </TypographyStylesProvider>
                
                {!notesExpanded && currentUpdate?.notes && currentUpdate.notes.length > 500 && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '60px',
                      background: 'linear-gradient(transparent, white)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </Box>
            )}
          </Card>
        )}

        {/* Alerts */}
        {currentUpdate?.hard_fork && (
          <Alert
            icon={<IconGitFork size={16} />}
            color="red"
            variant="light"
          >
            <Text size="sm">
              This is a hard fork update that requires network-wide coordination.
              {currentUpdate?.fork_date && ` Scheduled for ${formatDate(currentUpdate.fork_date)}.`}
            </Text>
          </Alert>
        )}

        {!currentUpdate?.is_closed && currentUpdate?.ticket && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
          >
            <Text size="sm">
              This update has an open ticket that may require attention.
              <Anchor
                href={currentUpdate?.ticket}
                target="_blank"
                ml="xs"
                size="sm"
              >
                View ticket
              </Anchor>
            </Text>
          </Alert>
        )}

        {/* Action Buttons */}
        <Card withBorder p="md">
          <Text fw={600} size="sm" mb="md">
            Quick Actions
          </Text>
          <Group>
            <Button
              variant="light"
              leftSection={<IconGitBranch size={16} />}
              component="a"
              href={currentUpdate?.github_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </Button>
            
            {currentUpdate?.url && (
              <Button
                variant="light"
                leftSection={<IconExternalLink size={16} />}
                component="a"
                href={currentUpdate?.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Release
              </Button>
            )}
            
            {currentUpdate?.tarball && (
              <Button
                variant="light"
                leftSection={<IconCode size={16} />}
                component="a"
                href={currentUpdate?.tarball}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source Code
              </Button>
            )}
            
            {currentUpdate?.ticket && (
              <Button
                variant="light"
                leftSection={<IconTicket size={16} />}
                component="a"
                href={currentUpdate?.ticket}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Ticket
              </Button>
            )}

            {currentUpdate?.client_entity?.github_url && (
              <Button
                variant="light"
                leftSection={<IconDeviceDesktop size={16} />}
                component="a"
                href={currentUpdate?.client_entity?.github_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Client Repository
              </Button>
            )}
          </Group>
        </Card>
      </Stack>
    </Modal>
  );
}