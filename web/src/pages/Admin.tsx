/**
 * Admin page for managing system settings and services
 */

import { Stack, Container, Title } from '@mantine/core';
import { PageContainer } from '../components/layout';
import { UpdatePollerManager } from '../components/admin/UpdatePollerManager';
import { GitHubConfig } from '../components/admin/GitHubConfig';
import { UserManagement } from '../components/admin/UserManagement';

export function Admin() {
  return (
    <PageContainer title="Admin Dashboard">
      <Container size="lg">
        <Stack gap="xl">
          <div>
            <Title order={1} mb="md">System Administration</Title>
          </div>

          <GitHubConfig />
          <UserManagement />
          <UpdatePollerManager />
        </Stack>
      </Container>
    </PageContainer>
  );
}