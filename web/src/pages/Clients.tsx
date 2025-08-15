/**
 * Clients page - Manage blockchain protocol clients
 */

import { useState, useEffect } from 'react';
import {
  Table,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Text,
  Loader,
  Center,
  Alert,
  Badge,
  Anchor,
  Card,
  ScrollArea,
  Modal,
  SimpleGrid,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconAlertCircle,
  IconExternalLink,
  IconBrandGithub,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { PageContainer } from '../components/layout';
import { 
  useClients, 
  useCreateClient, 
  useUpdateClient, 
  useDeleteClient,
  useClientProtocols
} from '../hooks';
import type { Client, ClientCreate, ClientUpdate } from '../types';

// Helper component to display protocol count for a client
function ClientProtocolCount({ clientId }: { clientId: number }) {
  const { data: protocols, isLoading } = useClientProtocols(clientId);

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading...</Text>;
  }

  const count = protocols?.length || 0;
  return (
    <Text size="sm" c={count > 0 ? "blue" : "dimmed"}>
      {count} protocol{count !== 1 ? 's' : ''}
    </Text>
  );
}

interface ClientFormProps {
  opened: boolean;
  onClose: () => void;
  client?: Client | null;
  mode: 'create' | 'edit';
}

function ClientForm({ opened, onClose, client, mode }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    repo_type: '',
    github_url: '',
  });

  // Update form data when client prop changes
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        client: client.client || '',
        repo_type: client.repo_type || '',
        github_url: client.github_url || '',
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        client: '',
        repo_type: '',
        github_url: '',
      });
    }
  }, [client, mode]);

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();

  const isLoading = createClientMutation.isPending || updateClientMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (mode === 'create') {
        await createClientMutation.mutateAsync(formData as ClientCreate);
        notifications.show({
          title: 'Success',
          message: 'Client created successfully',
          color: '#7fcf00',
        });
      } else if (client) {
        await updateClientMutation.mutateAsync({
          id: client.id,
          data: formData as ClientUpdate,
        });
        notifications.show({
          title: 'Success',
          message: 'Client updated successfully',
          color: '#7fcf00',
        });
      }
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Failed to ${mode} client`,
        color: 'red',
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'Create Client' : 'Edit Client'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Client Name"
            placeholder="e.g. Geth, Besu, Nethermind"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.currentTarget.value)}
            required
          />
          <TextInput
            label="Client Implementation"
            placeholder="e.g. go-ethereum, besu"
            value={formData.client}
            onChange={(e) => handleInputChange('client', e.currentTarget.value)}
          />
          <Select
            label="Repository Type"
            placeholder="Select repository type"
            value={formData.repo_type}
            onChange={(value) => handleInputChange('repo_type', value || '')}
            data={[
              { value: 'releases', label: 'Releases' },
              { value: 'tags', label: 'Tags' }
            ]}
            description="Choose whether to monitor GitHub releases or tags"
          />
          <TextInput
            label="GitHub URL"
            placeholder="https://github.com/ethereum/go-ethereum"
            value={formData.github_url}
            onChange={(e) => handleInputChange('github_url', e.currentTarget.value)}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              {mode === 'create' ? 'Create' : 'Update'} Client
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function Clients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [repoTypeFilter, setRepoTypeFilter] = useState<string>('');
  const [opened, { open, close }] = useDisclosure(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  const {
    data: clients,
    isLoading,
    error,
  } = useClients();
  
  const deleteClientMutation = useDeleteClient();

  // Filter clients based on search query and filters
  const filteredClients = clients?.filter((client) => {
    const matchesSearch = !searchQuery || 
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.github_url?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRepoType = !repoTypeFilter || client.repo_type === repoTypeFilter;

    return matchesSearch && matchesRepoType;
  }) || [];

  // Get unique repo types for filter dropdown
  const repoTypes = Array.from(
    new Set(clients?.map(c => c.repo_type).filter(Boolean))
  ).sort();

  const handleCreateClient = () => {
    setEditingClient(null);
    setMode('create');
    open();
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setMode('edit');
    open();
  };

  const handleDeleteClient = async (client: Client) => {
    if (window.confirm(`Are you sure you want to delete client "${client.name}"?`)) {
      try {
        await deleteClientMutation.mutateAsync(client.id);
        notifications.show({
          title: 'Success',
          message: 'Client deleted successfully',
          color: '#7fcf00',
        });
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to delete client',
          color: 'red',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Clients" description="Manage blockchain protocol clients">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Clients" description="Manage blockchain protocol clients">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading clients"
          color="red"
        >
          {error instanceof Error ? error.message : 'Failed to load clients'}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Clients" description="Manage blockchain protocol clients">
      <Stack gap="lg">
        {/* Header Actions */}
        <Group justify="space-between">
          <Group gap="md">
            <TextInput
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: 200 }}
            />
            <Select
              placeholder="Filter by type"
              value={repoTypeFilter}
              onChange={(value) => setRepoTypeFilter(value || '')}
              data={repoTypes.map(type => ({ value: type, label: type }))}
              leftSection={<IconFilter size={16} />}
              clearable
              style={{ minWidth: 150 }}
            />
          </Group>

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateClient}
          >
            Add Client
          </Button>
        </Group>

        {/* Clients Stats */}
        <Group gap="md">
          <Text size="sm" c="dimmed">
            {filteredClients.length} of {clients?.length || 0} clients
          </Text>
        </Group>

        {/* Clients List */}
        {filteredClients.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">
                {searchQuery || repoTypeFilter 
                  ? 'No clients match your filters' 
                  : 'No clients found'}
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={handleCreateClient}
              >
                Add your first client
              </Button>
            </Stack>
          </Center>
        ) : (
          <Card withBorder>
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Repository Type</Table.Th>
                    <Table.Th>Protocols</Table.Th>
                    <Table.Th>GitHub</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredClients.map((client) => (
                    <Table.Tr key={client.id}>
                      <Table.Td>
                        <Text fw={500}>{client.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{client.client}</Text>
                      </Table.Td>
                      <Table.Td>
                        {client.repo_type && (
                          <Badge variant="light" size="sm">
                            {client.repo_type}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <ClientProtocolCount clientId={client.id} />
                      </Table.Td>
                      <Table.Td>
                        {client.github_url && (
                          <Anchor
                            href={client.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconBrandGithub size={16} />
                          </Anchor>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => handleEditClient(client)}
                          >
                            <IconEdit size={14} />
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteClient(client)}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        )}

        {/* Client Form Modal */}
        <ClientForm
          opened={opened}
          onClose={close}
          client={editingClient}
          mode={mode}
        />
      </Stack>
    </PageContainer>
  );
}