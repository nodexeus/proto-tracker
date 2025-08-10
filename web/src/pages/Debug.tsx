/**
 * Debug page to test API configuration and environment variables
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Button,
  Card,
  Code,
  Group,
  Alert,
} from '@mantine/core';
import { IconBug, IconRefresh, IconTrash } from '@tabler/icons-react';
import { PageContainer } from '../components/layout';
import { getApiConfig } from '../utils';
import { ProtocolService } from '../services/protocols';
import { useAuth } from '../hooks/useAuth';

export function Debug() {
  const { user, logout } = useAuth();
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiConfig = getApiConfig(user?.apiKey);

  const testApiCall = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const protocolService = new ProtocolService(apiConfig);
      const protocols = await protocolService.getProtocols();
      setTestResult({
        success: true,
        data: protocols,
        message: 'API call successful'
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error,
        message: 'API call failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthCache = async () => {
    try {
      await logout();
      // Also clear localStorage manually to be sure
      localStorage.clear();
      sessionStorage.clear();
      alert('Auth cache cleared! Please refresh the page and log in again.');
    } catch (error) {
      console.error('Failed to clear auth cache:', error);
      alert('Error clearing auth cache, but storage was cleared. Please refresh and log in again.');
    }
  };

  return (
    <PageContainer title="Debug Information" description="Environment and API configuration debugging">
      <Stack gap="lg">
        {/* Environment Variables */}
        <Card withBorder>
          <Stack gap="md">
            <Group>
              <IconBug size={20} />
              <Text fw={500} size="lg">Environment Variables</Text>
            </Group>
            
            <div>
              <Text size="sm" fw={500} mb="xs">Available VITE_ Environment Variables:</Text>
              <Code block>
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(import.meta.env).filter(([key]) => key.startsWith('VITE_'))
                  ),
                  null,
                  2
                )}
              </Code>
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">Specific API Key Check:</Text>
              <Code block>
                {JSON.stringify({
                  'import.meta.env.VITE_API_KEY': import.meta.env.VITE_API_KEY,
                  'typeof': typeof import.meta.env.VITE_API_KEY,
                  'length': import.meta.env.VITE_API_KEY?.length,
                }, null, 2)}
              </Code>
            </div>
          </Stack>
        </Card>

        {/* API Configuration */}
        <Card withBorder>
          <Stack gap="md">
            <Text fw={500} size="lg">API Configuration</Text>
            
            <div>
              <Text size="sm" fw={500} mb="xs">Current API Config:</Text>
              <Code block>
                {JSON.stringify(apiConfig, null, 2)}
              </Code>
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">User Info:</Text>
              <Code block>
                {JSON.stringify(user ? { ...user, apiKey: user.apiKey ? '***masked***' : undefined } : null, null, 2)}
              </Code>
            </div>
          </Stack>
        </Card>

        {/* Auth Cache Management */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500} size="lg">Authentication Cache</Text>
              <Button
                leftSection={<IconTrash size={16} />}
                onClick={clearAuthCache}
                color="red"
                variant="outline"
              >
                Clear Auth Cache
              </Button>
            </Group>
            
            <Alert color="yellow" title="Clear Cache">
              If you're seeing the wrong API key being used (like 'mock-api-key-for-testing'), 
              click "Clear Auth Cache" to remove cached authentication data and force a re-login.
            </Alert>
          </Stack>
        </Card>

        {/* API Test */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500} size="lg">API Test</Text>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={testApiCall}
                loading={isLoading}
              >
                Test API Call
              </Button>
            </Group>

            {testResult && (
              <Alert
                color={testResult.success ? 'green' : 'red'}
                title={testResult.message}
              >
                <Code block>
                  {JSON.stringify(testResult, null, 2)}
                </Code>
              </Alert>
            )}
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
}