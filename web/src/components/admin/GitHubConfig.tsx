import { useState, useEffect } from 'react';
import { Paper, Title, TextInput, Button, Group, Alert, Stack } from '@mantine/core';
import { IconBrandGithub, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AdminService } from '../../services/admin';
import { useAuth } from '../../hooks/useAuth';
import { getApiConfig } from '../../utils';

export function GitHubConfig() {
  console.log('GitHubConfig: Component starting to render');
  
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('GitHubConfig: Component rendering, user:', user);

  if (!user?.apiKey) {
    console.log('GitHubConfig: No user API key, showing auth warning');
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">
          <Group gap="sm">
            <IconBrandGithub size={20} />
            GitHub API Configuration
          </Group>
        </Title>
        <Alert color="yellow" variant="light">
          You need to be logged in with an API key to manage GitHub configuration.
        </Alert>
      </Paper>
    );
  }

  const apiConfig = getApiConfig(user.apiKey);
  const adminService = new AdminService(apiConfig);

  // Fetch existing configuration on mount
  useEffect(() => {
    console.log('GitHubConfig: useEffect running, fetching config');
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    console.log('GitHubConfig: fetchConfig called');
    setFetchLoading(true);
    try {
      console.log('GitHubConfig: Making API call to get GitHub config');
      const config = await adminService.getGitHubConfig();
      console.log('GitHubConfig: Received config:', config);
      if (config) {
        setApiKey(config.api_key);
        setHasExistingConfig(true);
      }
    } catch (error) {
      console.error('GitHubConfig: Failed to fetch GitHub config:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status;
      
      // Don't show error notification for 404, just means no config exists yet
      if (errorStatus !== 404 && !errorMessage.includes('404')) {
        setError(errorMessage);
        notifications.show({
          title: 'Error',
          message: `Failed to fetch GitHub configuration: ${errorMessage}`,
          color: '#f0000',
        });
      }
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('GitHubConfig: handleSave called with apiKey:', apiKey);
    if (!apiKey.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'GitHub API key is required',
        color: '#f0000',
      });
      return;
    }

    setLoading(true);
    try {
      if (hasExistingConfig) {
        console.log('GitHubConfig: Updating existing config');
        await adminService.updateGitHubConfig({ api_key: apiKey });
      } else {
        console.log('GitHubConfig: Creating new config');
        await adminService.createGitHubConfig({ api_key: apiKey });
        setHasExistingConfig(true);
      }

      notifications.show({
        title: 'Success',
        message: 'GitHub API configuration saved successfully',
        color: '#7fcf00',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      console.error('GitHubConfig: Failed to save GitHub config:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save GitHub configuration',
        color: '#f0000',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    console.log('GitHubConfig: Rendering loading state');
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">
          <Group gap="sm">
            <IconBrandGithub size={20} />
            GitHub API Configuration
          </Group>
        </Title>
        <div>Loading configuration...</div>
      </Paper>
    );
  }

  console.log('GitHubConfig: Rendering main form');
  return (
    <Paper p="md" withBorder>
      <Title order={3} mb="md">
        <Group gap="sm">
          <IconBrandGithub size={20} />
          GitHub API Configuration
        </Group>
      </Title>

      <Stack gap="md">
        {error && (
          <Alert color="#f0000" variant="light">
            Error: {error}
          </Alert>
        )}
        
        <Alert color="blue" variant="light">
          Configure your GitHub API key to enable automatic repository monitoring and release tracking.
          You can generate a personal access token at{' '}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
            https://github.com/settings/tokens
          </a>
        </Alert>

        <TextInput
          label="GitHub API Key"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={apiKey}
          onChange={(event) => setApiKey(event.currentTarget.value)}
          type="password"
          description="Personal access token with repository read permissions"
        />

        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!apiKey.trim()}
            leftSection={<IconCheck size={16} />}
          >
            {hasExistingConfig ? 'Update Configuration' : 'Save Configuration'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}