import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import {
  Alert,
  Button,
  Container,
  Stack,
  Title,
  Text,
  Code,
  Collapse,
  Group,
} from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconChevronDown } from '@tabler/icons-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" py="xl">
          <Stack gap="lg" align="center">
            <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />
            
            <Stack gap="sm" align="center">
              <Title order={2} ta="center">
                Something went wrong
              </Title>
              <Text size="lg" c="dimmed" ta="center">
                An unexpected error occurred while rendering this page.
              </Text>
            </Stack>

            <Alert
              variant="light"
              color="red"
              icon={<IconAlertTriangle size={16} />}
              title="Error Details"
              w="100%"
            >
              <Stack gap="sm">
                <Text size="sm">
                  {this.state.error?.message || 'Unknown error occurred'}
                </Text>
                
                {this.state.errorInfo && (
                  <>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconChevronDown size={14} />}
                      onClick={this.toggleDetails}
                    >
                      {this.state.showDetails ? 'Hide' : 'Show'} technical details
                    </Button>
                    
                    <Collapse in={this.state.showDetails}>
                      <Stack gap="xs">
                        <Text size="xs" fw={500}>
                          Stack Trace:
                        </Text>
                        <Code block fz="xs" mah={200} style={{ overflow: 'auto' }}>
                          {this.state.error?.stack}
                        </Code>
                        
                        <Text size="xs" fw={500} mt="sm">
                          Component Stack:
                        </Text>
                        <Code block fz="xs" mah={200} style={{ overflow: 'auto' }}>
                          {this.state.errorInfo.componentStack}
                        </Code>
                      </Stack>
                    </Collapse>
                  </>
                )}
              </Stack>
            </Alert>

            <Group gap="sm">
              <Button
                variant="filled"
                leftSection={<IconRefresh size={16} />}
                onClick={this.handleRetry}
              >
                Try Again
              </Button>
              <Button
                variant="light"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </Group>

            {process.env.NODE_ENV === 'development' && (
              <Text size="xs" c="dimmed" ta="center">
                This error boundary is only shown in development. In production,
                users would see a more user-friendly error page.
              </Text>
            )}
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught by error handler:', error, errorInfo);
    // In a real app, you might want to send this to an error reporting service
  };
}