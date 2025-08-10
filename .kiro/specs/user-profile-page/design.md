# Design Document

## Overview

The user profile page will be a dedicated React component that provides users with account management capabilities, specifically focusing on API key management. The page will integrate with the existing proto-tracker frontend architecture, using Mantine components for consistent UI/UX and the established API service layer for backend communication.

## Architecture

### Technology Integration

The profile page will leverage the existing technology stack:
- **React 18 with TypeScript** for component development
- **Mantine v8** for UI components and styling
- **React Query (TanStack Query)** for API state management
- **Existing API service layer** for backend communication
- **React Router v6** for navigation integration

### Component Structure

```
src/
├── pages/
│   └── Profile.tsx                 # Main profile page component
├── components/
│   ├── profile/
│   │   ├── ProfileHeader.tsx       # User info display
│   │   ├── ApiKeySection.tsx       # API key management section
│   │   ├── ApiKeyCard.tsx          # Individual API key display
│   │   ├── CreateApiKeyModal.tsx   # New API key creation modal
│   │   └── DeleteApiKeyModal.tsx   # API key deletion confirmation
│   └── ui/
│       └── CopyButton.tsx          # Reusable copy-to-clipboard button
├── hooks/
│   ├── useProfile.ts               # Profile data management
│   ├── useApiKeys.ts               # API key operations
│   └── useClipboard.ts             # Clipboard functionality
├── services/
│   └── profile.ts                  # Profile and API key API calls
└── types/
    └── profile.ts                  # Profile-related TypeScript types
```

## Components and Interfaces

### Data Models

```typescript
interface UserProfile {
  id: number;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
  last_login?: string;
}

interface ApiKey {
  id: number;
  name: string;
  description?: string;
  key_preview: string;  // Truncated version for display
  created_at: string;
  last_used?: string;
  is_active: boolean;
}

interface ApiKeyCreate {
  name: string;
  description?: string;
}

interface ApiKeyResponse {
  id: number;
  name: string;
  description?: string;
  key: string;  // Full key shown only once
  created_at: string;
}
```

### Core Components

#### Profile Page Layout

```typescript
// Profile.tsx
const Profile: React.FC = () => {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <ProfileHeader />
        <ApiKeySection />
      </Stack>
    </Container>
  );
};
```

#### Profile Header Component

```typescript
// ProfileHeader.tsx
const ProfileHeader: React.FC = () => {
  const { data: profile, isLoading } = useProfile();
  
  return (
    <Paper p="md" withBorder>
      <Group>
        <Avatar src={profile?.picture} size="lg" />
        <Stack gap="xs">
          <Title order={2}>{profile?.name}</Title>
          <Text c="dimmed">{profile?.email}</Text>
          <Text size="sm" c="dimmed">
            Member since {formatDate(profile?.created_at)}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
};
```

#### API Key Management Section

```typescript
// ApiKeySection.tsx
const ApiKeySection: React.FC = () => {
  const { data: apiKeys, isLoading } = useApiKeys();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>API Keys</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create New API Key
        </Button>
      </Group>
      
      {apiKeys?.length === 0 ? (
        <EmptyState />
      ) : (
        <Stack gap="sm">
          {apiKeys?.map(key => (
            <ApiKeyCard key={key.id} apiKey={key} />
          ))}
        </Stack>
      )}
      
      <CreateApiKeyModal 
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </Paper>
  );
};
```

#### Individual API Key Card

```typescript
// ApiKeyCard.tsx
const ApiKeyCard: React.FC<{ apiKey: ApiKey }> = ({ apiKey }) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  return (
    <Card withBorder>
      <Group justify="space-between">
        <Stack gap="xs" flex={1}>
          <Group gap="sm">
            <Text fw={500}>{apiKey.name}</Text>
            <Badge color={apiKey.is_active ? 'green' : 'gray'}>
              {apiKey.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </Group>
          {apiKey.description && (
            <Text size="sm" c="dimmed">{apiKey.description}</Text>
          )}
          <Code>{apiKey.key_preview}</Code>
          <Group gap="sm">
            <Text size="xs" c="dimmed">
              Created: {formatDate(apiKey.created_at)}
            </Text>
            {apiKey.last_used && (
              <Text size="xs" c="dimmed">
                Last used: {formatDate(apiKey.last_used)}
              </Text>
            )}
          </Group>
        </Stack>
        
        <Group gap="sm">
          <CopyButton value={apiKey.id} />
          <ActionIcon 
            color="red" 
            variant="light"
            onClick={() => setDeleteModalOpen(true)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
      
      <DeleteApiKeyModal
        apiKey={apiKey}
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />
    </Card>
  );
};
```

### API Service Layer

```typescript
// services/profile.ts
class ProfileService extends ApiService {
  async getProfile(): Promise<UserProfile> {
    return this.get<UserProfile>('/profile');
  }
  
  async getApiKeys(): Promise<ApiKey[]> {
    return this.get<ApiKey[]>('/profile/api-keys');
  }
  
  async createApiKey(data: ApiKeyCreate): Promise<ApiKeyResponse> {
    return this.post<ApiKeyResponse>('/profile/api-keys', data);
  }
  
  async deleteApiKey(keyId: number): Promise<void> {
    return this.delete(`/profile/api-keys/${keyId}`);
  }
  
  async getFullApiKey(keyId: number): Promise<{ key: string }> {
    return this.get<{ key: string }>(`/profile/api-keys/${keyId}/full`);
  }
}
```

### Custom Hooks

```typescript
// hooks/useProfile.ts
export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => profileService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// hooks/useApiKeys.ts
export const useApiKeys = () => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => profileService.getApiKeys(),
  });
  
  const createMutation = useMutation({
    mutationFn: profileService.createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      notifications.show({
        title: 'Success',
        message: 'API key created successfully',
        color: 'green',
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: profileService.deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      notifications.show({
        title: 'Success',
        message: 'API key deleted successfully',
        color: 'green',
      });
    },
  });
  
  return {
    ...query,
    createApiKey: createMutation.mutate,
    deleteApiKey: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

// hooks/useClipboard.ts
export const useClipboard = () => {
  const copyToClipboard = async (keyId: number) => {
    try {
      const { key } = await profileService.getFullApiKey(keyId);
      await navigator.clipboard.writeText(key);
      
      notifications.show({
        title: 'Copied!',
        message: 'API key copied to clipboard',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to copy API key',
        color: 'red',
      });
    }
  };
  
  return { copyToClipboard };
};
```

## User Experience Design

### Page Layout

The profile page will use a clean, card-based layout:

1. **Profile Header**: User avatar, name, email, and account info
2. **API Keys Section**: Management interface for API keys
3. **Responsive Design**: Mobile-first approach with Mantine's responsive system

### Interaction Patterns

#### API Key Creation Flow

1. User clicks "Create New API Key" button
2. Modal opens with form fields (name required, description optional)
3. Form validation ensures unique key names
4. On success, modal shows the full API key with warning message
5. User must acknowledge they've saved the key before closing
6. New key appears in the list with truncated display

#### Copy to Clipboard Flow

1. User clicks copy button next to API key
2. System fetches full key from backend
3. Key is copied to clipboard
4. Success notification appears
5. Copy button temporarily shows success state

#### API Key Deletion Flow

1. User clicks delete button
2. Confirmation modal shows key details
3. User confirms deletion
4. Key is removed from backend and UI
5. Success notification appears

### Error Handling

- **Network Errors**: Retry mechanisms with user-friendly messages
- **Authentication Errors**: Redirect to login with context preservation
- **Validation Errors**: Inline form validation with Mantine styling
- **API Errors**: Toast notifications with actionable error messages

## Security Considerations

### API Key Security

- **Limited Display**: Only show truncated keys in the UI
- **One-time Full Display**: Show complete key only once during creation
- **Secure Transmission**: Use HTTPS for all API key operations
- **Backend Validation**: Validate all operations server-side

### Access Control

- **Authentication Required**: All profile operations require valid session
- **User Isolation**: Users can only access their own profile and keys
- **Session Management**: Handle expired sessions gracefully

## Performance Considerations

### Optimization Strategies

- **Query Caching**: Cache profile data for 5 minutes
- **Optimistic Updates**: Immediate UI updates for better UX
- **Lazy Loading**: Load API key details on demand
- **Debounced Operations**: Prevent rapid-fire API calls

### Loading States

- **Skeleton Loading**: Use Mantine Skeleton for profile data
- **Button Loading**: Show loading states on action buttons
- **Progressive Loading**: Load profile first, then API keys

## Accessibility

### WCAG Compliance

- **Keyboard Navigation**: Full keyboard accessibility for all interactions
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: Meet WCAG AA standards for all text
- **Focus Management**: Clear focus indicators and logical tab order

### Assistive Technology

- **Screen Reader Announcements**: Announce state changes and notifications
- **High Contrast Support**: Ensure visibility in high contrast mode
- **Reduced Motion**: Respect user's motion preferences

## Integration Points

### Routing Integration

```typescript
// Add to existing router configuration
{
  path: '/profile',
  element: <Profile />,
  loader: requireAuth, // Existing auth guard
}
```

### Navigation Integration

```typescript
// Add to existing navigation menu
<NavLink
  href="/profile"
  label="Profile"
  leftSection={<IconUser size={16} />}
/>
```

### Theme Integration

The profile page will use the existing Mantine theme configuration and follow established design patterns from the current application for consistency.