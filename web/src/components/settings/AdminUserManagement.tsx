/**
 * Admin user management component for managing user accounts and permissions
 */

import { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Table,
  Badge,
  Avatar,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Select,
  Loader,
  Pagination,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconShield,
  IconTrash,
  IconEdit,
  IconPlus,
  IconAlertTriangle,
  IconCheck,
  IconCrown,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/api';
import { formatDate, getInitials, getApiConfig } from '../../utils';

interface User {
  id: number;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface UserFormData {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

class UserManagementService extends ApiService {
  async getUsers(page = 1, limit = 20): Promise<{ users: User[]; total: number; pages: number }> {
    return this.get<{ users: User[]; total: number; pages: number }>(`/admin/users?page=${page}&limit=${limit}`);
  }

  async createUser(data: UserFormData): Promise<User> {
    return this.post<User>('/admin/users', data);
  }

  async updateUser(id: number, data: Partial<UserFormData>): Promise<User> {
    return this.patch<User>(`/admin/users/${id}`, data);
  }

  async deleteUser(id: number): Promise<void> {
    return this.delete<void>(`/admin/users/${id}`);
  }

  async toggleUserStatus(id: number): Promise<User> {
    return this.patch<User>(`/admin/users/${id}/toggle-status`);
  }
}

interface UserFormProps {
  opened: boolean;
  onClose: () => void;
  user?: User | null;
  onSubmit: (data: UserFormData) => Promise<void>;
  loading: boolean;
}

function UserForm({ opened, onClose, user, onSubmit, loading }: UserFormProps) {
  const form = useForm<UserFormData>({
    initialValues: {
      email: user?.email || '',
      name: user?.name || '',
      role: user?.role || 'user',
      isActive: user?.isActive ?? true,
    },
    validate: {
      email: (value) => {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Invalid email address';
      },
    },
  });

  const handleSubmit = useCallback(
    async (values: UserFormData) => {
      await onSubmit(values);
      form.reset();
    },
    [onSubmit, form]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={user ? 'Edit User' : 'Create New User'}
      size="md"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Email Address"
            placeholder="user@example.com"
            required
            {...form.getInputProps('email')}
            disabled={loading}
          />

          <TextInput
            label="Full Name"
            placeholder="Enter user's full name"
            {...form.getInputProps('name')}
            disabled={loading}
          />

          <Select
            label="Role"
            placeholder="Select user role"
            required
            data={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Administrator' },
            ]}
            {...form.getInputProps('role')}
            disabled={loading}
          />

          <Select
            label="Status"
            placeholder="Select user status"
            required
            data={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
            disabled={loading}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {user ? 'Update User' : 'Create User'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function AdminUserManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formOpened, formHandlers] = useDisclosure(false);

  const apiConfig = getApiConfig(currentUser?.apiKey);

  const userService = new UserManagementService(apiConfig);

  // Get users with pagination
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => userService.getUsers(page),
    retry: 1, // Only retry once to avoid spam
  });

  // Create/update user mutation
  const saveMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (selectedUser) {
        return userService.updateUser(selectedUser.id, data);
      } else {
        return userService.createUser(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      notifications.show({
        title: 'Success',
        message: selectedUser ? 'User updated successfully' : 'User created successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
      handleCloseForm();
    },
    onError: (error) => {
      console.error('Save failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save user. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      return userService.deleteUser(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      notifications.show({
        title: 'Success',
        message: 'User deleted successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete user. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (userId: number) => {
      return userService.toggleUserStatus(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      notifications.show({
        title: 'Success',
        message: 'User status updated successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error) => {
      console.error('Toggle status failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update user status. Please try again.',
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    },
  });

  const handleCreateUser = useCallback(() => {
    setSelectedUser(null);
    formHandlers.open();
  }, [formHandlers]);

  const handleEditUser = useCallback(
    (user: User) => {
      setSelectedUser(user);
      formHandlers.open();
    },
    [formHandlers]
  );

  const handleCloseForm = useCallback(() => {
    setSelectedUser(null);
    formHandlers.close();
  }, [formHandlers]);

  const handleDeleteUser = useCallback(
    (user: User) => {
      if (user.id === currentUser?.id) {
        notifications.show({
          title: 'Error',
          message: 'You cannot delete your own account.',
          color: 'red',
          icon: <IconAlertTriangle size={16} />,
        });
        return;
      }

      if (window.confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
        deleteMutation.mutate(user.id);
      }
    },
    [currentUser?.id, deleteMutation]
  );

  const handleToggleStatus = useCallback(
    (user: User) => {
      if (user.id === currentUser?.id) {
        notifications.show({
          title: 'Error',
          message: 'You cannot change your own account status.',
          color: 'red',
          icon: <IconAlertTriangle size={16} />,
        });
        return;
      }

      toggleStatusMutation.mutate(user.id);
    },
    [currentUser?.id, toggleStatusMutation]
  );

  const handleFormSubmit = useCallback(
    async (data: UserFormData) => {
      await saveMutation.mutateAsync(data);
    },
    [saveMutation]
  );

  if (isLoading) {
    return (
      <Card withBorder>
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading users...</Text>
        </Group>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder>
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="User Management Not Available"
          color="orange"
          variant="light"
        >
          <Stack gap="sm">
            <Text size="sm">
              The user management feature requires additional backend API endpoints that are not yet implemented.
            </Text>
            <Text size="sm" c="dimmed">
              Missing endpoints: <code>/admin/users</code>
            </Text>
            <Text size="sm" fw={500}>
              Current Status: You have been granted temporary admin access for development purposes.
            </Text>
          </Stack>
        </Alert>
      </Card>
    );
  }

  const users = usersData?.users || [];
  const totalPages = usersData?.pages || 1;

  return (
    <Stack gap="md">
      {/* Header */}
      <Card withBorder>
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500} size="lg">
              User Management
            </Text>
            <Text size="sm" c="dimmed">
              {usersData?.total || 0} total user{(usersData?.total || 0) !== 1 ? 's' : ''}
            </Text>
          </div>

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateUser}
          >
            Create User
          </Button>
        </Group>
      </Card>

      {/* Users Table */}
      <Card withBorder>
        {users.length === 0 ? (
          <Stack align="center" gap="md" py="xl">
            <IconUser size={48} color="gray" />
            <div style={{ textAlign: 'center' }}>
              <Text fw={500} size="lg">
                No Users Found
              </Text>
              <Text c="dimmed">
                Create your first user account to get started.
              </Text>
            </div>
          </Stack>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last Login</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size={32} radius="xl" color="blue">
                        {getInitials(user.name || user.email)}
                      </Avatar>
                      <div>
                        <Text fw={500} size="sm">
                          {user.name || user.email}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.email}
                        </Text>
                      </div>
                      {user.id === currentUser?.id && (
                        <Badge size="xs" color="blue">
                          You
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>

                  <Table.Td>
                    <Badge
                      color={user.role === 'admin' ? 'red' : 'blue'}
                      variant="light"
                      leftSection={
                        user.role === 'admin' ? (
                          <IconCrown size={12} />
                        ) : (
                          <IconUser size={12} />
                        )
                      }
                    >
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    <Badge
                      color={user.isActive ? '#7fcf00' : 'gray'}
                      variant={user.isActive ? 'light' : 'outline'}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                    </Text>
                  </Table.Td>

                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDate(user.createdAt)}
                    </Text>
                  </Table.Td>

                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Edit user">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label={user.isActive ? 'Deactivate' : 'Activate'}>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color={user.isActive ? 'orange' : '#7fcf00'}
                          onClick={() => handleToggleStatus(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          <IconShield size={14} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="Delete user">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            size="sm"
          />
        </Group>
      )}

      {/* User Form Modal */}
      <UserForm
        opened={formOpened}
        onClose={handleCloseForm}
        user={selectedUser}
        onSubmit={handleFormSubmit}
        loading={saveMutation.isPending}
      />
    </Stack>
  );
}