/**
 * Updates list component for displaying protocol updates in a table format
 */

import { useState } from 'react';
import {
  Table,
  Badge,
  Text,
  Group,
  Button,
  Card,
  Stack,
  Alert,
  Anchor,
  TypographyStylesProvider,
  Collapse,
  ActionIcon,
  Tooltip,
  Pagination,
  Center,
} from '@mantine/core';
import {
  IconExternalLink,
  IconGitFork,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconTicket,
  IconCalendar,
  IconCode,
} from '@tabler/icons-react';
import type { ProtocolUpdate } from '../../types';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

interface UpdatesListProps {
  updates: ProtocolUpdate[];
}

interface UpdateRowProps {
  update: ProtocolUpdate;
}

function UpdateRow({ update }: UpdateRowProps) {
  const [expanded, setExpanded] = useState(false);

  const getBadgeProps = () => {
    if (update.is_draft) return { color: 'gray', children: 'Draft' };
    if (update.is_prerelease) return { color: 'yellow', children: 'Pre-release' };
    if (update.hard_fork) return { color: 'red', children: 'Hard Fork' };
    return { color: '#7fcf00', children: 'Release' };
  };

  return (
    <>
      <Table.Tr>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
            </ActionIcon>
            <div>
              <Group gap="xs" align="center">
                <Text fw={500} size="sm">
                  {update.title}
                </Text>
                {update.hard_fork && (
                  <Tooltip label="Hard Fork">
                    <IconGitFork size={14} color="red" />
                  </Tooltip>
                )}
                {!update.is_closed && update.ticket && (
                  <Tooltip label="Open Ticket">
                    <IconAlertTriangle size={14} color="orange" />
                  </Tooltip>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {update.release_name || update.tag}
              </Text>
            </div>
          </Group>
        </Table.Td>

        <Table.Td>
          <Badge size="sm" {...getBadgeProps()} />
        </Table.Td>


        <Table.Td>
          <Text size="sm">{formatDate(update.date)}</Text>
          <Text size="xs" c="dimmed">
            {formatRelativeTime(update.date)}
          </Text>
        </Table.Td>

        <Table.Td>
          <Group gap="xs">
            <Tooltip label="View on GitHub">
              <ActionIcon
                variant="subtle"
                size="sm"
                component="a"
                href={update.github_url}
                target="_blank"
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
            
            {update.url && (
              <Tooltip label="Download Release">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  component="a"
                  href={update.url}
                  target="_blank"
                >
                  <IconCode size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            
            {update.ticket && (
              <Tooltip label="View Ticket">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  component="a"
                  href={update.ticket}
                  target="_blank"
                >
                  <IconTicket size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>

      <Table.Tr>
        <Table.Td colSpan={5} p={0}>
          <Collapse in={expanded}>
            <Card withBorder={false} p="md" bg="dark.6" radius={0}>
              <Stack gap="sm">
                {/* Update Details */}
                <Group wrap="nowrap">
                  <Group gap="xl" flex={1}>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Tag
                      </Text>
                      <Text size="sm">{update.tag}</Text>
                    </div>
                    
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Date
                      </Text>
                      <Group gap="xs" align="center">
                        <IconCalendar size={14} />
                        <Text size="sm">{formatDate(update.date)}</Text>
                      </Group>
                    </div>
                    
                    {update.hard_fork && update.fork_date && (
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Fork Date
                        </Text>
                        <Group gap="xs" align="center">
                          <IconGitFork size={14} color="red" />
                          <Text size="sm" c="red">
                            {formatDate(update.fork_date)}
                          </Text>
                        </Group>
                      </div>
                    )}
                  </Group>
                </Group>

                {/* Release Notes */}
                {update.notes && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Release Notes
                    </Text>
                    <TypographyStylesProvider>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: update.notes.replace(/\n/g, '<br />'),
                        }}
                        style={{
                          fontSize: '14px',
                          lineHeight: 1.5,
                          maxHeight: '200px',
                          overflow: 'auto',
                        }}
                      />
                    </TypographyStylesProvider>
                  </div>
                )}

                {/* Alerts for Special States */}
                {update.hard_fork && (
                  <Alert
                    icon={<IconGitFork size={16} />}
                    color="red"
                    variant="light"
                  >
                    <Text size="sm">
                      This is a hard fork update that requires network-wide coordination.
                      {update.fork_date && ` Scheduled for ${formatDate(update.fork_date)}.`}
                    </Text>
                  </Alert>
                )}

                {!update.is_closed && update.ticket && (
                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="yellow"
                    variant="light"
                  >
                    <Text size="sm">
                      This update has an open ticket that may require attention.
                      <Anchor
                        href={update.ticket}
                        target="_blank"
                        ml="xs"
                        size="sm"
                      >
                        View ticket
                      </Anchor>
                    </Text>
                  </Alert>
                )}

                {/* Quick Links */}
                <Group>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconExternalLink size={14} />}
                    component="a"
                    href={update.github_url}
                    target="_blank"
                  >
                    GitHub
                  </Button>
                  
                  {update.url && (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconCode size={14} />}
                      component="a"
                      href={update.url}
                      target="_blank"
                    >
                      Download
                    </Button>
                  )}
                  
                  {update.tarball && (
                    <Button
                      variant="light"
                      size="xs"
                      component="a"
                      href={update.tarball}
                      target="_blank"
                    >
                      Tarball
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>
          </Collapse>
        </Table.Td>
      </Table.Tr>
    </>
  );
}

interface ClientCardProps {
  clientName: string;
  clientUpdates: ProtocolUpdate[];
}

function ClientCard({ clientName, clientUpdates }: ClientCardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const updatesPerPage = 10;
  
  const totalPages = Math.ceil(clientUpdates.length / updatesPerPage);
  const startIndex = (currentPage - 1) * updatesPerPage;
  const endIndex = startIndex + updatesPerPage;
  const paginatedUpdates = clientUpdates.slice(startIndex, endIndex);

  return (
    <Card key={clientName} withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600} size="lg">
            {clientName}
          </Text>
          <Badge variant="light" size="sm">
            {clientUpdates.length} update{clientUpdates.length !== 1 ? 's' : ''}
          </Badge>
        </Group>

        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedUpdates.map((update) => (
              <UpdateRow key={update.id} update={update} />
            ))}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Center>
            <Pagination
              value={currentPage}
              onChange={setCurrentPage}
              total={totalPages}
              size="sm"
            />
          </Center>
        )}
      </Stack>
    </Card>
  );
}

export function UpdatesList({ updates }: UpdatesListProps) {
  if (updates.length === 0) {
    return (
      <Card withBorder padding="xl">
        <Stack align="center" gap="md">
          <IconAlertTriangle size={48} color="gray" />
          <div style={{ textAlign: 'center' }}>
            <Text fw={500} size="lg">
              No Updates Available
            </Text>
            <Text c="dimmed">
              This protocol doesn't have any updates recorded yet.
            </Text>
          </div>
        </Stack>
      </Card>
    );
  }

  // Group updates by client
  const updatesByClient = updates.reduce((acc, update) => {
    const clientName = update.client.toUpperCase() || 'Unknown';
    if (!acc[clientName]) {
      acc[clientName] = [];
    }
    acc[clientName].push(update);
    return acc;
  }, {} as Record<string, ProtocolUpdate[]>);

  // Sort clients by name and sort updates within each client by date
  const sortedClients = Object.keys(updatesByClient).sort();

  return (
    <Stack gap="md">
      {sortedClients.map((clientName) => {
        const clientUpdates = updatesByClient[clientName].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return (
          <ClientCard
            key={clientName}
            clientName={clientName}
            clientUpdates={clientUpdates}
          />
        );
      })}
    </Stack>
  );
}