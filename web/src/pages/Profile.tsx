/**
 * Profile page component for user account management and API key operations
 */

import { useState } from 'react';
import {
  Stack,
  Paper,
  Group,
  Avatar,
  Title,
  Text,
  Button,
  Alert,
  SimpleGrid,
  Skeleton,
  Center,
  Box,
} from '@mantine/core';
import {
  IconUser,
  IconPlus,
  IconAlertCircle,
  IconKey,
} from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { ApiKeyCard, CreateApiKeyModal } from '../components/profile';
import { useProfile, useApiKeys } from '../hooks';
import { formatDate } from '../utils/formatters';

export function Profile() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useProfile();
  
  const {
    data: apiKeys,
    isLoading: apiKeysLoading,
    error: apiKeysError,
  } = useApiKeys();

  // Loading state for the entire page
  if (profileLoading) {
    return (
      <PageContainer
        title="Profile"
        description="Manage your account information and API keys"
      >
        <Stack gap="xl">
          {/* Profile Header Skeleton */}
          <Paper p="xl" withBorder>
            <Group gap="lg">
              <Skeleton height={80} circle />
              <Stack gap="xs" flex={1}>
                <Skeleton height={32} width="40%" />
                <Skeleton height={20} width="60%" />
                <Skeleton height={16} width="50%" />
              </Stack>
            </Group>
          </Paper>

          {/* API Keys Section Skeleton */}
          <Paper p="xl" withBorder>
            <Group justify="space-between" mb="lg">
              <Skeleton height={28} width="30%" />
              <Skeleton height={36} width="150px" />
            </Group>
            <Stack gap="md">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </Stack>
          </Paper>
        </Stack>
      </PageContainer>
    );
  }

  // Error state for profile
  if (profileError) {
    return (
      <PageContainer
        title="Profile"
        description="Manage your account information and API keys"
      >
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading profile"
          color="red"
          variant="light"
        >
          {profileError instanceof Error 
            ? profileError.message 
            : 'Failed to load profile information. Please try refreshing the page.'
          }
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Profile"
      description="Manage your account information and API keys"
    >
      <Stack gap="xl">
        {/* Profile Header */}
        <Paper p="xl" withBorder>
          <Group gap="lg" align="flex-start">
            <Avatar
              src={profile?.picture}
              size={80}
              radius="md"
              alt={profile?.name || 'User avatar'}
            >
              <IconUser size={40} />
            </Avatar>
            
            <Stack gap="xs" flex={1}>
              <Title order={2} size="h3">
                {profile?.name || 'Unknown User'}
              </Title>
              
              <Text size="lg" c="dimmed">
                {profile?.email}
              </Text>
              
              <Group gap="md" mt="xs">
                <Text size="sm" c="dimmed">
                  <Text component="span" fw={500}>
                    Member since:
                  </Text>{' '}
                  {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}
                </Text>
                
                {profile?.last_login && (
                  <Text size="sm" c="dimmed">
                    <Text component="span" fw={500}>
                      Last login:
                    </Text>{' '}
                    {formatDate(profile.last_login)}
                  </Text>
                )}
              </Group>
            </Stack>
          </Group>
        </Paper>

        {/* API Keys Section */}
        <Paper p="xl" withBorder>
          <Group justify="space-between" align="center" mb="lg">
            <Group gap="sm">
              <IconKey size={24} />
              <Title order={3} size="h4">
                API Keys
              </Title>
            </Group>
            
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
              variant="filled"
            >
              Create New API Key
            </Button>
          </Group>

          {/* API Keys Content */}
          {apiKeysLoading ? (
            <Stack gap="md">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={140} />
              ))}
            </Stack>
          ) : apiKeysError ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Error loading API keys"
              color="red"
              variant="light"
            >
              {apiKeysError instanceof Error 
                ? apiKeysError.message 
                : 'Failed to load API keys. Please try refreshing the page.'
              }
            </Alert>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <Box py="xl">
              <Center>
                <Stack gap="md" align="center" maw={400}>
                  <IconKey size={48} stroke={1} color="var(--mantine-color-dimmed)" />
                  <Title order={4} ta="center" c="dimmed">
                    No API Keys Yet
                  </Title>
                  <Text ta="center" c="dimmed" size="sm">
                    Create your first API key to start using the proto-tracker API. 
                    API keys allow you to authenticate and access your protocols programmatically.
                  </Text>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={() => setCreateModalOpen(true)}
                    mt="sm"
                  >
                    Create Your First API Key
                  </Button>
                </Stack>
              </Center>
            </Box>
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 1 }} spacing="md">
              {apiKeys.map((apiKey) => (
                <ApiKeyCard key={apiKey.id} apiKey={apiKey} />
              ))}
            </SimpleGrid>
          )}
        </Paper>
      </Stack>

      {/* Create API Key Modal */}
      <CreateApiKeyModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </PageContainer>
  );
}