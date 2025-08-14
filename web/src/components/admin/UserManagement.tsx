import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Table,
  Button,
  Group,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Switch,
  Stack,
  Pagination,
  Text,
  Loader,
  Alert
} from '@mantine/core';
import {
  IconUsers,
  IconEdit,
  IconTrash,
  IconUserPlus,
  IconCheck,
  IconAlertCircle,
  IconPlayerPlay,
  IconPlayerPause
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { AdminService, type AdminUser, type AdminUserCreate, type AdminUserUpdate } from '../../services/admin';
import { useAuth } from '../../hooks/useAuth';
import { getApiConfig } from '../../utils';

export function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const apiConfig = getApiConfig(user?.apiKey);
  const adminService = new AdminService(apiConfig);

  // Modal state
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState<AdminUserCreate>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    is_admin: false,
    is_active: true,
  });

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]);

  const fetchUsers = async (page: number) => {
    setLoading(true);
    try {
      const response = await adminService.getUsers(page, 20);
      setUsers(response.users);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch users',
        color: '#f0000',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      is_admin: false,
      is_active: true,
    });
    openModal();
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_admin: user.is_admin,
      is_active: user.is_active,
    });
    openModal();
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        const updateData: AdminUserUpdate = {
          username: formData.username !== editingUser.username ? formData.username : undefined,
          email: formData.email !== editingUser.email ? formData.email : undefined,
          first_name: formData.first_name !== editingUser.first_name ? formData.first_name : undefined,
          last_name: formData.last_name !== editingUser.last_name ? formData.last_name : undefined,
          is_admin: formData.is_admin !== editingUser.is_admin ? formData.is_admin : undefined,
          is_active: formData.is_active !== editingUser.is_active ? formData.is_active : undefined,
        };

        await adminService.updateUser(editingUser.id, updateData);
        notifications.show({
          title: 'Success',
          message: 'User updated successfully',
          color: '#7fcf00',
          icon: <IconCheck size={16} />,
        });
      } else {
        await adminService.createUser(formData);
        notifications.show({
          title: 'Success',
          message: 'User created successfully',
          color: '#7fcf00',
          icon: <IconCheck size={16} />,
        });
      }

      closeModal();
      fetchUsers(currentPage);
    } catch (error) {
      console.error('Failed to save user:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save user',
        color: '#f0000',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setActionLoading(userId);
    try {
      await adminService.deleteUser(userId);
      notifications.show({
        title: 'Success',
        message: 'User deleted successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
      fetchUsers(currentPage);
    } catch (error) {
      console.error('Failed to delete user:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete user',
        color: '#f0000',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUserStatus = async (userId: number) => {
    setActionLoading(userId);
    try {
      await adminService.toggleUserStatus(userId);
      notifications.show({
        title: 'Success',
        message: 'User status updated successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
      fetchUsers(currentPage);
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update user status',
        color: '#f0000',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Group gap="sm" mb="md">
          <IconUsers size={20} />
          <Title order={3}>User Management</Title>
        </Group>
        <Group justify="center">
          <Loader />
        </Group>
      </Paper>
    );
  }

  return (
    <>
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconUsers size={20} />
            <Title order={3}>User Management</Title>
          </Group>
          <Button leftSection={<IconUserPlus size={16} />} onClick={handleCreateUser}>
            Add User
          </Button>
        </Group>

        {users.length === 0 ? (
          <Alert color="blue" variant="light">
            No users found. Click "Add User" to create your first user.
          </Alert>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Admin</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : '-'}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={user.is_admin ? 'blue' : 'gray'}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={user.is_active ? '#7fcf00' : '#f0000'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => handleEditUser(user)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color={user.is_active ? 'orange' : '#7fcf00'}
                          onClick={() => handleToggleUserStatus(user.id)}
                          loading={actionLoading === user.id}
                        >
                          {user.is_active ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => handleDeleteUser(user.id)}
                          loading={actionLoading === user.id}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {pages > 1 && (
              <Group justify="center" mt="md">
                <Pagination
                  value={currentPage}
                  onChange={setCurrentPage}
                  total={pages}
                />
              </Group>
            )}

            <Text size="sm" c="dimmed" mt="sm">
              Showing {users.length} of {total} users
            </Text>
          </>
        )}
      </Paper>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Username"
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <TextInput
            label="Email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextInput
            label="First Name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          />
          <TextInput
            label="Last Name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
          />
          <Switch
            label="Administrator"
            checked={formData.is_admin}
            onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
          />
          <Switch
            label="Active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}