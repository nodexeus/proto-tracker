/**
 * Admin settings page with B2 configuration and other admin functionality
 */

import { useState } from 'react';
import {
  Tabs,
  Stack,
  Text,
  Title,
  Alert,
  Card,
  Button,
  Divider,
} from '@mantine/core';
import {
  IconSettings,
  IconCloud,
  IconUser,
  IconShield,
  IconLock,
  IconBrandGithub,
  IconRobot,
} from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { S3StorageConfig } from '../components/settings/S3StorageConfig';
import { AdminUserManagement } from '../components/settings/AdminUserManagement';
import { SystemSettings } from '../components/settings/SystemSettings';
import { GitHubConfig } from '../components/admin/GitHubConfig';
import { UpdatePollerManager } from '../components/admin/UpdatePollerManager';
import { AISettings } from '../components/settings/AISettings';
import { useAuth } from '../hooks/useAuth';

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('storage');

  const isAdmin = user?.is_admin;

  if (!isAdmin) {
    return (
      <PageContainer title="Access Denied">
        <Stack gap="lg" align="center" py="xl">
          <IconLock size={64} color="gray" />
          <div style={{ textAlign: 'center' }}>
            <Title order={2} c="dimmed">Access Denied</Title>
            <Text c="dimmed" mt="sm">
              You don't have permission to access the admin settings.
            </Text>
            <Text c="dimmed" size="sm">
              Only administrators can manage system settings.
            </Text>
          </div>
          <Button variant="light" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </Stack>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Settings" description="Manage system configuration and administrative settings">
      <Stack gap="lg">
        {/* Admin Warning */}
        <Alert
          icon={<IconShield size={16} />}
          title="Administrator Area"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            These settings affect the entire system. Please be careful when making changes.
            Always test configuration changes before applying them to production.
          </Text>
        </Alert>

        {/* Settings Tabs */}
        <Card withBorder>
          <Tabs value={activeTab} onChange={setActiveTab as (value: string | null) => void}>
            <Tabs.List>
              <Tabs.Tab value="storage" leftSection={<IconCloud size={16} />}>
                Storage Configuration
              </Tabs.Tab>
              <Tabs.Tab value="users" leftSection={<IconUser size={16} />}>
                User Management
              </Tabs.Tab>
              <Tabs.Tab value="github" leftSection={<IconBrandGithub size={16} />}>
                GitHub Integration
              </Tabs.Tab>
              <Tabs.Tab value="ai" leftSection={<IconRobot size={16} />}>
                AI Analysis
              </Tabs.Tab>
              <Tabs.Tab value="system" leftSection={<IconSettings size={16} />}>
                System Settings
              </Tabs.Tab>
            </Tabs.List>

            <Divider mt="md" />

            <Tabs.Panel value="storage" pt="md">
              <Stack gap="md">
                <div>
                  <Text fw={500} size="lg" mb="xs">
                    S3-Compatible Storage Configuration
                  </Text>
                  <Text size="sm" c="dimmed">
                    Configure S3-compatible cloud storage for snapshot management and file storage.
                  </Text>
                </div>
                
                <S3StorageConfig />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="users" pt="md">
              <Stack gap="md">
                <div>
                  <Text fw={500} size="lg" mb="xs">
                    User Management
                  </Text>
                  <Text size="sm" c="dimmed">
                    Manage user accounts, permissions, and access controls.
                  </Text>
                </div>
                
                <AdminUserManagement />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="github" pt="md">
              <Stack gap="md">
                <div>
                  <Text fw={500} size="lg" mb="xs">
                    GitHub Integration
                  </Text>
                  <Text size="sm" c="dimmed">
                    Configure GitHub API settings for repository monitoring and release tracking.
                  </Text>
                </div>
                
                <GitHubConfig />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="system" pt="md">
              <Stack gap="md">
                <div>
                  <Text fw={500} size="lg" mb="xs">
                    System Configuration
                  </Text>
                  <Text size="sm" c="dimmed">
                    Configure system-wide settings and operational parameters.
                  </Text>
                </div>
                
                <SystemSettings />
                
                <div>
                  <Text fw={500} size="lg" mb="xs" mt="xl">
                    Update Polling Service
                  </Text>
                  <Text size="sm" c="dimmed">
                    Monitor GitHub repositories for new releases and updates automatically.
                  </Text>
                </div>
                
                <UpdatePollerManager />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="ai" pt="md">
              <AISettings />
            </Tabs.Panel>
          </Tabs>
        </Card>
      </Stack>
    </PageContainer>
  );
}