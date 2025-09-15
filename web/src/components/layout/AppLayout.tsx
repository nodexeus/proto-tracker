import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppShell,
  Burger,
  Group,
  Text,
  UnstyledButton,
  Avatar,
  Menu,
  rem,
  Divider,
  NavLink,
  Stack,
  Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconDashboard,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconUser,
  IconDatabase,
  IconGitBranch,
  IconDeviceDesktop,
  IconShield,
} from '@tabler/icons-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const [, setUserMenuOpened] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigationItems = [
    {
      icon: IconDashboard,
      label: 'Dashboard',
      path: '/',
      description: 'Protocol overview',
    },
    {
      icon: IconDatabase,
      label: 'Protocols',
      path: '/protocols',
      description: 'Manage protocols',
    },
    {
      icon: IconDeviceDesktop,
      label: 'Clients',
      path: '/clients',
      description: 'Manage clients',
    },
    {
      icon: IconGitBranch,
      label: 'Updates',
      path: '/updates',
      description: 'Track releases',
    },
    // {
    //   icon: IconSettings,
    //   label: 'Settings',
    //   path: '/settings',
    //   description: 'User settings',
    // },
    // {
    //   icon: IconUser,
    //   label: 'Profile',
    //   path: '/profile',
    //   description: 'Manage your profile and API keys',
    // },
    // {
    //   icon: IconShield,
    //   label: 'Admin',
    //   path: '/admin',
    //   description: 'System administration',
    //   adminOnly: true,
    // },
  ];

  const filteredNavItems = navigationItems.filter(
    (item) => !item.adminOnly || Boolean(user?.is_admin)
  );

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={user ? {
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      } : undefined}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {user && (
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
              />
            )}
            <Group gap="xs">
              <IconDatabase
                size={24}
                color="var(--mantine-color-proto-green-6)"
              />
              <Text size="lg" fw={600} c="proto-green.6">
                Protocol Tracker
              </Text>
            </Group>
          </Group>

          {user && (
            <Menu
              width={260}
              position="bottom-end"
              transitionProps={{ transition: 'pop-top-right' }}
              onClose={() => setUserMenuOpened(false)}
              onOpen={() => setUserMenuOpened(true)}
              withinPortal
            >
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={7}>
                    <Avatar
                      src={user.picture}
                      alt={user.first_name || user.email}
                      radius="sm"
                      size={32}
                    />
                    <Text fw={500} size="sm" lh={1} mr={3}>
                      {user.first_name || user.email}
                    </Text>
                    <IconChevronDown
                      style={{ width: rem(12), height: rem(12) }}
                      stroke={1.5}
                    />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={
                    <IconUser
                      style={{ width: rem(16), height: rem(16) }}
                      stroke={1.5}
                    />
                  }
                >
                  <div>
                    <Text fw={500}>{user.first_name || 'User'}</Text>
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                  </div>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  to="/profile"
                  leftSection={
                    <IconUser
                      style={{ width: rem(16), height: rem(16) }}
                      stroke={1.5}
                    />
                  }
                >
                  <Text size="xs" fw={300}>
                    User Profile
                  </Text>
                </Menu.Item>

                {user?.is_admin && (
                  <Menu.Item
                    component={Link}
                    to="/settings"
                    leftSection={
                      <IconSettings
                        style={{ width: rem(16), height: rem(16) }}
                        stroke={1.5}
                      />
                    }
                  >
                    <Text size="xs" fw={300}>
                      Admin Settings
                    </Text>
                  </Menu.Item>
                )}

                <Menu.Divider />

                <Menu.Item
                  color="red"
                  leftSection={
                    <IconLogout
                      style={{ width: rem(16), height: rem(16) }}
                      stroke={1.5}
                    />
                  }
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </AppShell.Header>

      {user && (
        <AppShell.Navbar p="md">
          <AppShell.Section grow>
            <Stack gap="xs">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  href={item.path}
                  label={item.label}
                  description={item.description}
                  leftSection={<item.icon size={18} stroke={1.5} />}
                  rightSection={
                    item.adminOnly ? (
                      <Badge size="xs" variant="light" color="orange">
                        Admin
                      </Badge>
                    ) : null
                  }
                  active={location.pathname === item.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.path);
                    if (opened) toggle(); // Close mobile menu
                  }}
                />
              ))}
            </Stack>
          </AppShell.Section>

          <AppShell.Section>
            <Divider my="sm" />
            <Text size="xs" c="dimmed" ta="center">
              Protocol Tracker v1.0.1
            </Text>
          </AppShell.Section>
        </AppShell.Navbar>
      )}

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
