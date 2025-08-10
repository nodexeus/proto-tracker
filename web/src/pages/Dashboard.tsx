/**
 * Dashboard page component with statistics and overview
 */

import { SimpleGrid, Button, Group, Stack } from '@mantine/core';
import { IconPlus, IconEye } from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { QuickProtocolsOverview } from '../components/dashboard/QuickProtocolsOverview';
import type { Protocol } from '../types';

interface DashboardProps {
  onCreateProtocol?: () => void;
  onEditProtocol?: (protocol: Protocol) => void;
  onViewProtocol?: (protocol: Protocol) => void;
  onViewAllProtocols?: () => void;
}

export function Dashboard({ 
  onCreateProtocol, 
  onEditProtocol,
  onViewProtocol,
  onViewAllProtocols
}: DashboardProps) {
  return (
    <PageContainer
      title="Dashboard"
      description="Monitor your blockchain protocols and track updates across the ecosystem"
      actions={
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconEye size={16} />}
            onClick={onViewAllProtocols}
          >
            View All Protocols
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onCreateProtocol}
          >
            Add Protocol
          </Button>
        </Group>
      }
    >
      <Stack gap="xl">
        {/* Dashboard Statistics */}
        <DashboardStats />
        
        {/* Quick Protocols Overview */}
        <SimpleGrid cols={{ base: 1, lg: 1 }}>
          <QuickProtocolsOverview
            onViewProtocol={onViewProtocol}
            onEditProtocol={onEditProtocol}
            onViewAllProtocols={onViewAllProtocols}
            maxItems={8}
          />
        </SimpleGrid>
      </Stack>
    </PageContainer>
  );
}