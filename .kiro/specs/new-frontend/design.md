# Design Document

## Overview

The new frontend for proto-tracker will be a modern, responsive single-page application (SPA) built with React and TypeScript. It will integrate with the existing FastAPI backend through REST APIs and implement Google OAuth for authentication. The application will provide an intuitive interface for managing blockchain protocols, tracking updates, and managing snapshots.

## Architecture

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Mantine v8 for comprehensive component library and styling
- **State Management**: React Query (TanStack Query) for server state management
- **Routing**: React Router v6 for client-side routing
- **Authentication**: Google OAuth 2.0 with react-oauth/google
- **HTTP Client**: Axios for API communication
- **Icons**: Tabler Icons (included with Mantine) for consistent iconography
- **Form Handling**: Mantine Forms with built-in validation

### Application Structure

```
web/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Basic UI components (Button, Input, etc.)
│   │   ├── layout/         # Layout components (Header, Sidebar, etc.)
│   │   └── forms/          # Form components
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx
│   │   ├── ProtocolDetail.tsx
│   │   ├── ProtocolForm.tsx
│   │   └── Settings.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── useProtocols.ts
│   ├── services/           # API service layer
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── protocols.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── api.ts
│   │   ├── protocol.ts
│   │   └── user.ts
│   ├── utils/              # Utility functions
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── mantine.config.ts
├── vite.config.ts
└── Dockerfile
```

## Components and Interfaces

### Authentication Flow

1. **Login Component**: Renders Google OAuth button using react-oauth/google
2. **Auth Context**: Manages authentication state and API key storage
3. **Protected Routes**: Wrapper component that ensures user authentication
4. **API Interceptor**: Automatically adds API key to all requests

### Core Components

#### Layout Components

- **AppLayout**: Main application shell with navigation
- **Header**: Top navigation with user menu and logout
- **Sidebar**: Navigation menu for different sections
- **PageContainer**: Consistent page wrapper with breadcrumbs

#### Protocol Components

- **ProtocolCard**: Display protocol summary in grid/list view
- **ProtocolForm**: Create/edit protocol form with validation
- **ProtocolDetail**: Comprehensive protocol information display
- **UpdatesList**: Display protocol updates with filtering
- **SnapshotsList**: Display available snapshots

#### UI Components

- **Mantine Components**: Leveraging Mantine's comprehensive component library including Button, TextInput, Modal, Loader, and Notifications
- **Custom Wrappers**: Thin wrapper components around Mantine components for application-specific styling
- **ErrorBoundary**: Error handling wrapper with Mantine Alert components
- **Theme Provider**: Mantine theme configuration for consistent styling across the application

### API Integration Layer

#### Service Classes

```typescript
class ApiService {
  private axiosInstance: AxiosInstance;
  
  constructor(apiKey: string) {
    this.axiosInstance = axios.create({
      baseURL: process.env.VITE_API_URL,
      headers: { 'x-api-key': apiKey }
    });
  }
  
  // Generic CRUD methods
  async get<T>(endpoint: string): Promise<T>
  async post<T>(endpoint: string, data: any): Promise<T>
  async patch<T>(endpoint: string, data: any): Promise<T>
  async delete(endpoint: string): Promise<void>
}

class ProtocolService extends ApiService {
  async getProtocols(): Promise<Protocol[]>
  async getProtocol(id: number): Promise<Protocol>
  async createProtocol(data: ProtocolCreate): Promise<Protocol>
  async updateProtocol(id: number, data: ProtocolUpdate): Promise<Protocol>
  async deleteProtocol(id: number): Promise<void>
  async getProtocolUpdates(id: number): Promise<ProtocolUpdate[]>
  async getProtocolSnapshots(id: number): Promise<Snapshot[]>
  async scanSnapshots(id: number): Promise<{ message: string }>
}
```

## Data Models

### TypeScript Interfaces

```typescript
interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  apiKey: string;
}

interface Protocol {
  id: number;
  name: string;
  chain_id: string;
  explorer?: string;
  public_rpc?: string;
  proto_family?: string;
  bpm?: number;
  network: string;
  logo?: string;
}

interface ProtocolUpdate {
  id: number;
  name: string;
  title: string;
  client: string;
  tag: string;
  date: string;
  url: string;
  notes: string;
  is_draft: boolean;
  is_prerelease: boolean;
  hard_fork: boolean;
  fork_date?: string;
  github_url: string;
}

interface Snapshot {
  id: number;
  protocol_id: number;
  snapshot_id: string;
  file_count: number;
  total_size: number;
  created_at: string;
  snapshot_metadata: {
    version: number;
    client: string;
    network: string;
    node_type: string;
    file_tree: Record<string, any>;
  };
}
```

## Error Handling

### Error Boundary Strategy

- **Global Error Boundary**: Catches unhandled React errors
- **API Error Handling**: Centralized error handling for API calls
- **Form Validation**: Real-time validation with user-friendly messages
- **Network Error Recovery**: Retry mechanisms for failed requests

### Error Types

```typescript
interface ApiError {
  status: number;
  message: string;
  details?: string;
}

interface ValidationError {
  field: string;
  message: string;
}
```

## Testing Strategy

### Testing Approach

- **Unit Tests**: Jest + React Testing Library for component testing
- **Integration Tests**: Test API integration and user flows
- **E2E Tests**: Playwright for critical user journeys
- **Type Safety**: TypeScript for compile-time error detection

### Test Structure

```
src/
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── utils/
├── __mocks__/
│   ├── api.ts
│   └── auth.ts
└── test-utils/
    ├── render.tsx
    └── setup.ts
```

### Key Test Scenarios

1. **Authentication Flow**: OAuth login, logout, token refresh
2. **Protocol Management**: CRUD operations, form validation
3. **Data Loading**: Loading states, error states, empty states
4. **Responsive Design**: Mobile and desktop layouts
5. **API Integration**: Request/response handling, error scenarios

## Performance Considerations

### Optimization Strategies

- **Code Splitting**: Route-based code splitting with React.lazy
- **Image Optimization**: Lazy loading and responsive images
- **Caching**: React Query for intelligent data caching
- **Bundle Optimization**: Tree shaking and minification with Vite
- **Virtual Scrolling**: For large lists of protocols/updates

### Monitoring

- **Performance Metrics**: Core Web Vitals tracking
- **Error Tracking**: Integration with error monitoring service
- **Analytics**: User interaction tracking for UX improvements

## Security Considerations

### Authentication Security

- **OAuth 2.0**: Secure authentication flow with Google
- **API Key Management**: Secure storage and transmission
- **Session Management**: Proper token expiration handling
- **CSRF Protection**: Built-in protection with SPA architecture

### Data Security

- **Input Validation**: Client and server-side validation
- **XSS Prevention**: React's built-in XSS protection
- **Secure Headers**: Proper CSP and security headers
- **HTTPS Only**: Enforce secure connections in production

## Deployment Strategy

### Docker Configuration

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Configuration

- **Development**: Local development with hot reload
- **Staging**: Docker container with staging API
- **Production**: Optimized build with production API

### CI/CD Pipeline

1. **Build**: Install dependencies and build application
2. **Test**: Run unit tests and linting
3. **Security**: Dependency vulnerability scanning
4. **Deploy**: Build and push Docker image
5. **Smoke Tests**: Basic functionality verification