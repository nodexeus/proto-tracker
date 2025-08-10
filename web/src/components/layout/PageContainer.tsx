import type { ReactNode } from 'react';
import {
  Container,
  Title,
  Text,
  Breadcrumbs,
  Anchor,
  Stack,
  Group,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconHome, IconChevronRight } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface PageContainerProps {
  children: ReactNode;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withPadding?: boolean;
}

export function PageContainer({
  children,
  title,
  description,
  breadcrumbs = [],
  actions,
  size = 'lg',
  withPadding = true,
}: PageContainerProps) {
  const navigate = useNavigate();

  const allBreadcrumbs = [
    { title: 'Dashboard', href: '/' },
    ...breadcrumbs,
  ];

  const breadcrumbItems = allBreadcrumbs.map((item, index) => {
    const isLast = index === allBreadcrumbs.length - 1;
    
    if (isLast || !item.href) {
      return (
        <Text key={index} size="sm" c="dimmed">
          {item.title}
        </Text>
      );
    }

    return (
      <Anchor
        key={index}
        component={Link}
        to={item.href}
        size="sm"
        c="proto-blue.6"
      >
        {item.title}
      </Anchor>
    );
  });

  return (
    <Container size={size} py={withPadding ? 'md' : 0}>
      <Stack gap="lg">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <Group gap="xs">
            <Tooltip label="Go to Dashboard">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => navigate('/')}
              >
                <IconHome size={16} />
              </ActionIcon>
            </Tooltip>
            <Breadcrumbs
              separator={<IconChevronRight size={14} stroke={1.5} />}
            >
              {breadcrumbItems}
            </Breadcrumbs>
          </Group>
        )}

        {/* Page Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1} size="h2">
              {title}
            </Title>
            {description && (
              <Text size="lg" c="dimmed">
                {description}
              </Text>
            )}
          </Stack>
          {actions && (
            <Group gap="sm">
              {actions}
            </Group>
          )}
        </Group>

        {/* Page Content */}
        {children}
      </Stack>
    </Container>
  );
}