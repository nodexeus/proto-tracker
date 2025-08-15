/**
 * AI Configuration Settings Component
 */

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Group,
  Text,
  Switch,
  Select,
  TextInput,
  PasswordInput,
  NumberInput,
  Button,
  Alert,
  Card,
  Divider,
  Code,
  List,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconRobot,
  IconInfoCircle,
  IconTestPipe,
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
} from '@tabler/icons-react';
import { useAIConfig, useUpdateAIConfig, useTestAIConfig } from '../../hooks/useAI';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI (GPT-5)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'local', label: 'Local LLM (Ollama)' },
];

const DEFAULT_MODELS = {
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-4-20250514',
  local: 'llama2',
};

const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  local: 'http://localhost:11434/v1',
};

export function AISettings() {
  const { data: config, isLoading, error } = useAIConfig();
  const updateMutation = useUpdateAIConfig();
  const testMutation = useTestAIConfig();

  const [formData, setFormData] = useState({
    ai_enabled: false,
    provider: 'openai',
    api_key: '',
    model: '',
    base_url: '',
    auto_analyze_enabled: true,
    analysis_timeout_seconds: 60,
  });

  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        ai_enabled: config.ai_enabled,
        provider: config.provider,
        api_key: config.api_key || '',
        model: config.model || DEFAULT_MODELS[config.provider as keyof typeof DEFAULT_MODELS] || '',
        base_url: config.base_url || DEFAULT_BASE_URLS[config.provider as keyof typeof DEFAULT_BASE_URLS] || '',
        auto_analyze_enabled: config.auto_analyze_enabled,
        analysis_timeout_seconds: config.analysis_timeout_seconds,
      });
    }
  }, [config]);

  const handleProviderChange = (provider: string) => {
    setFormData(prev => ({
      ...prev,
      provider,
      // Only update model and base_url if they're currently using default values or are empty
      model: prev.model || DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || '',
      base_url: prev.base_url || DEFAULT_BASE_URLS[provider as keyof typeof DEFAULT_BASE_URLS] || '',
    }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleTest = () => {
    testMutation.mutate(undefined, {
      onSuccess: (data) => {
        setTestResult(data);
      },
      onError: (error) => {
        setTestResult({
          status: 'error',
          message: error.message,
        });
      },
    });
  };

  const isFormValid = () => {
    if (!formData.ai_enabled) return true;
    if (!formData.provider) return false;
    if (formData.provider !== 'local' && !formData.api_key) return false;
    return true;
  };

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'openai':
        return {
          description: 'Use OpenAI\'s GPT models for analysis',
          apiKeyLabel: 'OpenAI API Key',
          apiKeyPlaceholder: 'sk-...',
          docsUrl: 'https://platform.openai.com/api-keys',
        };
      case 'anthropic':
        return {
          description: 'Use Anthropic\'s Claude models for analysis',
          apiKeyLabel: 'Anthropic API Key',
          apiKeyPlaceholder: 'sk-ant-...',
          docsUrl: 'https://console.anthropic.com/',
        };
      case 'local':
        return {
          description: 'Use a local LLM via Ollama (no API key required)',
          apiKeyLabel: 'API Key (Optional)',
          apiKeyPlaceholder: 'Leave empty for local models',
          docsUrl: 'https://ollama.ai/',
        };
      default:
        return {
          description: '',
          apiKeyLabel: 'API Key',
          apiKeyPlaceholder: '',
          docsUrl: '',
        };
    }
  };

  const providerInfo = getProviderInfo(formData.provider);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text>Loading AI configuration...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertTriangle size={16} />} color="red">
        Failed to load AI configuration: {error.message}
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Group gap="xs" mb="xs">
          <IconRobot size={20} />
          <Text fw={500} size="lg">AI Analysis Configuration</Text>
        </Group>
        <Text size="sm" c="dimmed">
          Configure AI-powered analysis of protocol updates and release notes
        </Text>
      </div>

      <Card withBorder p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Enable AI Analysis</Text>
              <Text size="sm" c="dimmed">
                Automatically analyze protocol updates with AI
              </Text>
            </div>
            <Switch
              checked={formData.ai_enabled}
              onChange={(event) => {
                const checked = event?.currentTarget?.checked;
                if (checked !== undefined) {
                  setFormData(prev => ({ ...prev, ai_enabled: checked }));
                }
              }}
            />
          </Group>

          {formData.ai_enabled && (
            <>
              <Divider />

              <Select
                label="AI Provider"
                description={providerInfo.description}
                value={formData.provider}
                onChange={(value) => value && handleProviderChange(value)}
                data={AI_PROVIDERS}
                rightSection={
                  providerInfo.docsUrl && (
                    <Tooltip label="Provider documentation">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        component="a"
                        href={providerInfo.docsUrl}
                        target="_blank"
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )
                }
              />

              {formData.provider !== 'local' && (
                <PasswordInput
                  label={providerInfo.apiKeyLabel}
                  description="Keep your API key secure and never share it"
                  placeholder={providerInfo.apiKeyPlaceholder}
                  value={formData.api_key}
                  onChange={(event) => {
                    const value = event?.currentTarget?.value;
                    if (value !== undefined) {
                      setFormData(prev => ({ ...prev, api_key: value }));
                    }
                  }}
                />
              )}

              {formData.provider === 'local' && (
                <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>Local LLM Setup</Text>
                    <Text size="sm">
                      To use local models, you need to have Ollama running on your system.
                    </Text>
                    <List size="sm" spacing="xs">
                      <List.Item>Install Ollama from ollama.ai</List.Item>
                      <List.Item>Pull a model: <Code>ollama pull llama2</Code></List.Item>
                      <List.Item>Ensure Ollama is running on the configured URL</List.Item>
                    </List>
                  </Stack>
                </Alert>
              )}

              <Group grow>
                <TextInput
                  label="Model"
                  description="The specific model to use for analysis"
                  value={formData.model}
                  onChange={(event) => {
                    const value = event?.currentTarget?.value;
                    if (value !== undefined) {
                      setFormData(prev => ({ ...prev, model: value }));
                    }
                  }}
                  placeholder={DEFAULT_MODELS[formData.provider as keyof typeof DEFAULT_MODELS]}
                />

                <TextInput
                  label="Base URL"
                  description="API base URL (leave default unless using custom endpoint)"
                  value={formData.base_url}
                  onChange={(event) => {
                    const value = event?.currentTarget?.value;
                    if (value !== undefined) {
                      setFormData(prev => ({ ...prev, base_url: value }));
                    }
                  }}
                  placeholder={DEFAULT_BASE_URLS[formData.provider as keyof typeof DEFAULT_BASE_URLS]}
                />
              </Group>

              <Group grow>
                <div>
                  <Switch
                    label="Auto-analyze new updates"
                    description="Automatically run AI analysis when new updates are detected"
                    checked={formData.auto_analyze_enabled}
                    onChange={(event) => {
                      const checked = event?.currentTarget?.checked;
                      if (checked !== undefined) {
                        setFormData(prev => ({ ...prev, auto_analyze_enabled: checked }));
                      }
                    }}
                  />
                </div>

                <NumberInput
                  label="Analysis timeout (seconds)"
                  description="Maximum time to wait for AI analysis"
                  value={formData.analysis_timeout_seconds}
                  onChange={(value) =>
                    setFormData(prev => ({ ...prev, analysis_timeout_seconds: Number(value) || 60 }))
                  }
                  min={10}
                  max={300}
                  step={10}
                />
              </Group>
            </>
          )}
        </Stack>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Alert
          icon={testResult.status === 'success' ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          color={testResult.status === 'success' ? 'green' : 'red'}
          onClose={() => setTestResult(null)}
          withCloseButton
        >
          <Stack gap="xs">
            <Text fw={500}>{testResult.status === 'success' ? 'Test Successful' : 'Test Failed'}</Text>
            <Text size="sm">{testResult.message}</Text>
            {testResult.test_result && (
              <div>
                <Text size="xs" c="dimmed" mb="xs">Sample Analysis:</Text>
                <Code block size="xs">
                  {JSON.stringify(testResult.test_result, null, 2)}
                </Code>
              </div>
            )}
          </Stack>
        </Alert>
      )}

      {/* Action Buttons */}
      <Group justify="flex-end">
        <Button
          variant="light"
          leftSection={<IconTestPipe size={16} />}
          onClick={handleTest}
          loading={testMutation.isPending}
          disabled={!formData.ai_enabled || !isFormValid()}
        >
          Test Configuration
        </Button>
        <Button
          leftSection={<IconCheck size={16} />}
          onClick={handleSave}
          loading={updateMutation.isPending}
          disabled={!isFormValid()}
        >
          Save Configuration
        </Button>
      </Group>

      {/* AI Analysis Features */}
      <Card withBorder p="md">
        <Stack gap="md">
          <Text fw={500}>AI Analysis Features</Text>
          <Text size="sm" c="dimmed">
            When enabled, AI analysis provides the following features:
          </Text>
          <Group gap="xs">
            <Badge variant="light" color="blue">Release summarization</Badge>
            <Badge variant="light" color="orange">Breaking change detection</Badge>
            <Badge variant="light" color="red">Hard fork identification</Badge>
            <Badge variant="light" color="green">Security update flagging</Badge>
            <Badge variant="light" color="purple">Risk assessment</Badge>
            <Badge variant="light" color="teal">Impact analysis</Badge>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}