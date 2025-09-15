/**
 * Protocol creation and editing form component
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  NumberInput,
  Button,
  Group,
  Text,
  Loader,
  Divider,
  MultiSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconX, IconPhoto, IconAlertCircle, IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import type { Protocol, ProtocolCreate, ProtocolUpdateData } from '../../types';
import { useClients, useProtocolClients, useAddClientToProtocol, useRemoveClientFromProtocol } from '../../hooks';
import { useAuth } from '../../hooks/useAuth';
import { ProtocolService } from '../../services/protocols';
import { getApiConfig } from '../../utils';
import {
  validateProtocolName,
  validateChainId,
  validateNetwork,
  validateUrl,
  validateBpm,
  validateImageFile,
} from '../../utils/validators';

interface ProtocolFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: ProtocolCreate | ProtocolUpdateData) => Promise<Protocol>;
  protocol?: Protocol | null;
  loading?: boolean;
  mode: 'create' | 'edit';
}

interface FormValues {
  name: string;
  chain_id: string;
  network: string;
  explorer: string;
  public_rpc: string;
  proto_family: string;
  bpm: number | '';
  snapshot_prefixes: string[];
  logo: string;
}

export function ProtocolForm({
  opened,
  onClose,
  onSubmit,
  protocol,
  loading = false,
  mode,
}: ProtocolFormProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [loadingPrefixes, setLoadingPrefixes] = useState(false);
  const { user } = useAuth();
  
  // Fetch available clients
  const { data: clients } = useClients();
  
  // Fetch protocol clients if in edit mode
  const { data: protocolClients } = useProtocolClients(protocol?.id || 0);
  
  // Client association mutations
  const addClientMutation = useAddClientToProtocol();
  const removeClientMutation = useRemoveClientFromProtocol();

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      chain_id: '',
      network: '',
      explorer: '',
      public_rpc: '',
      proto_family: '',
      bpm: '',
      snapshot_prefixes: [''],
      logo: '',
    },
    validate: {
      name: (value) => {
        const result = validateProtocolName(value);
        return result.isValid ? null : result.errors[0];
      },
      chain_id: (value) => {
        const result = validateChainId(value);
        return result.isValid ? null : result.errors[0];
      },
      network: (value) => {
        const result = validateNetwork(value);
        return result.isValid ? null : result.errors[0];
      },
      explorer: (value) => {
        if (!value) return null;
        const result = validateUrl(value, 'Explorer URL');
        return result.isValid ? null : result.errors[0];
      },
      public_rpc: (value) => {
        if (!value) return null;
        const result = validateUrl(value, 'Public RPC URL');
        return result.isValid ? null : result.errors[0];
      },
      bpm: (value) => {
        if (value === '') return null;
        const result = validateBpm(typeof value === 'number' ? value : undefined);
        return result.isValid ? null : result.errors[0];
      },
    },
  });

  // Reset form when protocol changes or modal opens/closes
  useEffect(() => {
    if (opened) {
      if (mode === 'edit' && protocol) {
        form.setValues({
          name: protocol.name || '',
          chain_id: protocol.chain_id || '',
          network: protocol.network || '',
          explorer: protocol.explorer || '',
          public_rpc: protocol.public_rpc || '',
          proto_family: protocol.proto_family || '',
          bpm: protocol.bpm ?? '',
          snapshot_prefixes: [''], // Will be loaded separately
          logo: protocol.logo || '',
        });
        
        // Load snapshot prefixes for editing
        const loadSnapshotPrefixes = async () => {
          if (!user?.apiKey) return;
          
          setLoadingPrefixes(true);
          try {
            const apiConfig = getApiConfig(user.apiKey);
            const protocolService = new ProtocolService(apiConfig);
            const prefixes = await protocolService.getProtocolSnapshotPrefixes(protocol.id);
            
            if (prefixes.length > 0) {
              form.setFieldValue('snapshot_prefixes', prefixes.map(p => p.prefix));
            } else {
              // Fall back to legacy snapshot_prefix if no new prefixes found
              form.setFieldValue('snapshot_prefixes', protocol.snapshot_prefix ? [protocol.snapshot_prefix] : ['']);
            }
          } catch (error) {
            console.error('Failed to load snapshot prefixes:', error);
            // Fall back to legacy snapshot_prefix
            form.setFieldValue('snapshot_prefixes', protocol.snapshot_prefix ? [protocol.snapshot_prefix] : ['']);
          } finally {
            setLoadingPrefixes(false);
          }
        };
        
        loadSnapshotPrefixes();
        
        // Set selected clients if editing
        if (protocolClients) {
          setSelectedClientIds(protocolClients.map(client => client.id.toString()));
        }
      } else {
        form.reset();
        form.setFieldValue('snapshot_prefixes', ['']);
        setSelectedClientIds([]);
      }
    }
  }, [opened, protocol, mode, protocolClients, user?.apiKey]); // Removed 'form' from dependencies

  const handleLogoUpload = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      notifications.show({
        title: 'Invalid Image',
        message: validation.errors.join(', '),
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Extract just the base64 data without the data URL prefix (data:image/png;base64,)
      const base64 = dataUrl.split(',')[1];
      form.setFieldValue('logo', base64);
      notifications.show({
        title: 'Logo Uploaded',
        message: 'Logo has been uploaded successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    };
    reader.readAsDataURL(file);
  }, [form]);

  const handleRemoveLogo = useCallback(() => {
    form.setFieldValue('logo', '');
  }, [form]);

  const addSnapshotPrefix = useCallback(() => {
    const currentPrefixes = form.values.snapshot_prefixes;
    form.setFieldValue('snapshot_prefixes', [...currentPrefixes, '']);
  }, [form]);

  const removeSnapshotPrefix = useCallback((index: number) => {
    const currentPrefixes = form.values.snapshot_prefixes;
    if (currentPrefixes.length > 1) {
      form.setFieldValue('snapshot_prefixes', currentPrefixes.filter((_, i) => i !== index));
    }
  }, [form]);

  const handleSubmit = useCallback(async (values: FormValues) => {
    try {
      const formData: ProtocolCreate | ProtocolUpdateData = {
        name: values.name.trim(),
        chain_id: values.chain_id.trim(),
        network: values.network.trim(),
        explorer: values.explorer.trim() || undefined,
        public_rpc: values.public_rpc.trim() || undefined,
        proto_family: values.proto_family.trim() || undefined,
        bpm: typeof values.bpm === 'number' ? values.bpm : undefined,
        snapshot_prefix: values.snapshot_prefixes.filter(p => p.trim()).length > 0 ? values.snapshot_prefixes[0].trim() : undefined,
        snapshot_prefixes: values.snapshot_prefixes.filter(p => p.trim()).map(p => p.trim()),
        logo: values.logo || undefined,
      };

      if (mode === 'edit' && protocol) {
        (formData as ProtocolUpdateData).id = protocol.id;
      }

      // Create or update the protocol
      const savedProtocol = await onSubmit(formData);
      
      // Handle client associations
      const protocolId = savedProtocol.id;
      const currentClientIds = protocolClients?.map(client => client.id.toString()) || [];
      const newClientIds = selectedClientIds;
      
      // Find clients to add and remove
      const clientsToAdd = newClientIds.filter(id => !currentClientIds.includes(id));
      const clientsToRemove = currentClientIds.filter(id => !newClientIds.includes(id));
      
      // Add new client associations
      for (const clientId of clientsToAdd) {
        try {
          await addClientMutation.mutateAsync({
            protocolId,
            data: {
              client_id: parseInt(clientId),
              is_primary: false
            }
          });
        } catch (error) {
          console.error(`Failed to add client ${clientId}:`, error);
        }
      }
      
      // Remove old client associations
      for (const clientId of clientsToRemove) {
        try {
          await removeClientMutation.mutateAsync({
            protocolId,
            clientId: parseInt(clientId)
          });
        } catch (error) {
          console.error(`Failed to remove client ${clientId}:`, error);
        }
      }
      
      notifications.show({
        title: mode === 'create' ? 'Protocol Created' : 'Protocol Updated',
        message: `Protocol has been ${mode === 'create' ? 'created' : 'updated'} successfully`,
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
      
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to ${mode} protocol. Please try again.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  }, [mode, protocol, onSubmit, onClose, selectedClientIds, protocolClients, addClientMutation, removeClientMutation]);

  const title = mode === 'create' ? 'Create New Protocol' : 'Edit Protocol';


  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="lg"
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Required Fields Section */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Required Information
            </Text>
            <Stack gap="sm">
              <TextInput
                label="Protocol Name"
                placeholder="Enter protocol name"
                required
                {...form.getInputProps('name')}
                disabled={loading}
              />
              
              <Group grow>
                <TextInput
                  label="Chain ID"
                  placeholder="e.g., 1, 56, 137"
                  required
                  {...form.getInputProps('chain_id')}
                  disabled={loading}
                />
                
                <TextInput
                  label="Network"
                  placeholder="e.g., mainnet, testnet"
                  required
                  {...form.getInputProps('network')}
                  disabled={loading}
                />
              </Group>
            </Stack>
          </div>

          <Divider />

          {/* Optional Fields Section */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Optional Information
            </Text>
            <Stack gap="sm">
              <TextInput
                label="Explorer URL"
                placeholder="https://etherscan.io"
                {...form.getInputProps('explorer')}
                disabled={loading}
              />
              
              <TextInput
                label="Public RPC URL"
                placeholder="https://rpc.example.com"
                {...form.getInputProps('public_rpc')}
                disabled={loading}
              />
              
              <Group grow>
                <TextInput
                  label="Protocol Family"
                  placeholder="e.g., ethereum, cosmos"
                  {...form.getInputProps('proto_family')}
                  disabled={loading}
                />
                
                <NumberInput
                  label="BPM (Blocks Per Minute)"
                  placeholder="e.g., 5"
                  min={0}
                  max={1000}
                  {...form.getInputProps('bpm')}
                  disabled={loading}
                />
              </Group>
              
              <div>
                <Group justify="space-between" align="center" mb="xs">
                  <Text size="sm" fw={500}>Snapshot Prefixes</Text>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={addSnapshotPrefix}
                    disabled={loading}
                  >
                    Add Prefix
                  </Button>
                </Group>
                <Stack gap="xs">
                  {form.values.snapshot_prefixes.map((prefix, index) => (
                    <Group key={index} align="flex-end">
                      <TextInput
                        style={{ flex: 1 }}
                        placeholder="e.g., ethereum-reth-mainnet-archive-v1"
                        value={prefix}
                        onChange={(e) => {
                          const newPrefixes = [...form.values.snapshot_prefixes];
                          newPrefixes[index] = e.currentTarget.value;
                          form.setFieldValue('snapshot_prefixes', newPrefixes);
                        }}
                        disabled={loading}
                      />
                      {form.values.snapshot_prefixes.length > 1 && (
                        <Button
                          variant="light"
                          color="red"
                          size="sm"
                          onClick={() => removeSnapshotPrefix(index)}
                          disabled={loading}
                        >
                          <IconTrash size={14} />
                        </Button>
                      )}
                    </Group>
                  ))}
                </Stack>
                <Text size="xs" c="dimmed" mt="xs">
                  Add snapshot prefixes that will be used when scanning for snapshots
                </Text>
              </div>
            </Stack>
          </div>

          <Divider />

          {/* Client Association Section */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Associated Clients
            </Text>
            <MultiSelect
              label="Select clients that implement this protocol"
              placeholder="Choose clients..."
              data={clients?.map(client => ({
                value: client.id.toString(),
                label: `${client.name} (${client.client})` || client.name || 'Unnamed Client'
              })) || []}
              value={selectedClientIds}
              onChange={setSelectedClientIds}
              searchable
              clearable
              disabled={loading}
              description="Select which clients can be used to interact with this protocol"
            />
            {selectedClientIds.length > 0 && (
              <Text size="xs" c="dimmed" mt="xs">
                {selectedClientIds.length} client{selectedClientIds.length !== 1 ? 's' : ''} selected
              </Text>
            )}
          </div>

          <Divider />

          {/* Logo Upload Section */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Protocol Logo
            </Text>
            
            {form.values.logo ? (
              <Stack gap="sm">
                <Group>
                  <img
                    src={form.values.logo.startsWith('data:') ? form.values.logo : `data:image/png;base64,${form.values.logo}`}
                    alt="Protocol logo"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'contain',
                      border: '1px solid #e0e0e0',
                      borderRadius: 8,
                    }}
                  />
                  <div>
                    <Text size="sm" fw={500}>Logo uploaded</Text>
                    <Text size="xs" c="dimmed">PNG format</Text>
                  </div>
                </Group>
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  onClick={handleRemoveLogo}
                  disabled={loading}
                >
                  Remove Logo
                </Button>
              </Stack>
            ) : (
              <Dropzone
                onDrop={handleLogoUpload}
                accept={IMAGE_MIME_TYPE}
                maxFiles={1}
                disabled={loading}
              >
                <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={52} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={52} stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconPhoto size={52} stroke={1.5} />
                  </Dropzone.Idle>

                  <div>
                    <Text size="xl" inline>
                      Drag logo here or click to select
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7}>
                      PNG files only, max 5MB
                    </Text>
                  </div>
                </Group>
              </Dropzone>
            )}
          </div>

          {/* Form Actions */}
          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              leftSection={loading ? <Loader size={16} /> : undefined}
            >
              {mode === 'create' ? 'Create Protocol' : 'Update Protocol'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}