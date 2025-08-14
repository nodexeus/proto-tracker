/**
 * ProtocolCard component for displaying protocol summaries
 */

import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Avatar, 
  Stack, 
  ActionIcon, 
  Menu,
  rem,
  Tooltip,
  Box,
} from '@mantine/core';
import { 
  IconDots, 
  IconEdit, 
  IconTrash, 
  IconExternalLink,
  IconDatabase,
  IconGitBranch,
  IconClock,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { Protocol } from '../../types';
// import { useProtocolStats } from '../../hooks'; // Disabled - stats endpoint not available

interface ProtocolCardProps {
  protocol: Protocol;
  onEdit?: (protocol: Protocol) => void;
  onDelete?: (protocol: Protocol) => void;
  showActions?: boolean;
}

export function ProtocolCard({ 
  protocol, 
  onEdit, 
  onDelete, 
  showActions = true 
}: ProtocolCardProps) {
  const navigate = useNavigate();
  // const { data: stats, isLoading: statsLoading } = useProtocolStats(protocol.id); // Disabled - stats endpoint not available
  const stats = null;
  const statsLoading = false;

  const handleCardClick = () => {
    navigate(`/protocols/${protocol.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(protocol);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(protocol);
  };

  const handleExternalLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Create avatar from protocol logo or use default
  const avatarSrc = protocol.logo ? `data:image/png;base64,${protocol.logo}` : null;

  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder
      style={{ cursor: 'pointer', height: '100%' }}
      onClick={handleCardClick}
    >
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <Group gap="sm">
            <Avatar
              src={avatarSrc}
              alt={protocol.name}
              size={32}
              radius="sm"
            >
              <IconDatabase size={16} />
            </Avatar>
            <Box>
              <Text fw={600} size="sm" lineClamp={1}>
                {protocol.name}
              </Text>
              <Text size="xs" c="dimmed">
                {protocol.network}
              </Text>
            </Box>
          </Group>

          {showActions && (
            <Menu withinPortal position="bottom-end" shadow="sm">
              <Menu.Target>
                <ActionIcon 
                  variant="subtle" 
                  color="gray"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDots style={{ width: rem(16), height: rem(16) }} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
                  onClick={handleEdit}
                >
                  Edit Protocol
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
                  color="red"
                  onClick={handleDelete}
                >
                  Delete Protocol
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Card.Section>

      <Stack gap="sm" mt="md">
        {/* Chain ID and Family */}
        <Group gap="xs">
          <Badge variant="light" size="sm">
            Chain: {protocol.chain_id}
          </Badge>
          {protocol.proto_family && (
            <Badge variant="outline" size="sm" color="blue">
              {protocol.proto_family}
            </Badge>
          )}
        </Group>

        {/* BPM if available */}
        {protocol.bpm && (
          <Group gap="xs">
            <IconClock size={14} />
            <Text size="sm" c="dimmed">
              {protocol.bpm} BPM
            </Text>
          </Group>
        )}

        {/* Statistics */}
        {!statsLoading && stats && (
          <Group gap="md">
            <Tooltip label="Total Updates">
              <Group gap={4}>
                <IconGitBranch size={14} />
                <Text size="sm" c="dimmed">
                  {stats.total_updates}
                </Text>
              </Group>
            </Tooltip>
            <Tooltip label="Total Snapshots">
              <Group gap={4}>
                <IconDatabase size={14} />
                <Text size="sm" c="dimmed">
                  {stats.total_snapshots}
                </Text>
              </Group>
            </Tooltip>
          </Group>
        )}

        {/* Recent activity indicator */}
        {!statsLoading && stats && stats.recent_updates > 0 && (
          <Badge variant="light" color="#7fcf00" size="xs">
            {stats.recent_updates} recent update{stats.recent_updates !== 1 ? 's' : ''}
          </Badge>
        )}

        {/* External links */}
        <Group gap="xs" mt="auto">
          {protocol.explorer && (
            <Tooltip label="View Explorer">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={(e) => handleExternalLink(e, protocol.explorer!)}
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {protocol.public_rpc && (
            <Tooltip label="RPC Endpoint">
              <ActionIcon
                variant="subtle"
                size="sm"
                color="blue"
                onClick={(e) => handleExternalLink(e, protocol.public_rpc!)}
              >
                <IconDatabase size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Stack>
    </Card>
  );
}