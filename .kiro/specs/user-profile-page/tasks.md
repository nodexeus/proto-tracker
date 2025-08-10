# Implementation Plan

- [x] 1. Create profile types and API service

  - Add UserProfile and ApiKey interfaces to src/types/profile.ts
  - Create ProfileService in src/services/profile.ts with getProfile, getApiKeys, createApiKey, deleteApiKey methods
  - _Requirements: 1.3, 2.3, 7.1, 7.4_

- [x] 2. Build profile data hooks

  - Create useProfile and useApiKeys hooks in src/hooks/ using React Query
  - Add clipboard functionality for copying API keys with notifications
  - _Requirements: 1.5, 2.5, 3.2, 3.3, 3.4_

- [x] 3. Create API key management components

  - Build ApiKeyCard component to display individual keys with copy/delete buttons
  - Create CreateApiKeyModal for new key creation with form validation
  - Add DeleteApiKeyModal for confirmation dialogs
  - _Requirements: 2.2, 3.1, 4.1, 4.2, 4.6, 5.1, 5.2_

- [x] 4. Build main Profile page

  - Create Profile page component with user info header and API keys section
  - Display user avatar, name, email using Mantine components
  - Add responsive layout and proper loading/error states
  - _Requirements: 1.1, 1.2, 2.1, 6.1, 6.4_

- [x] 5. Add routing and navigation
  - Add /profile route to React Router with authentication guard
  - Update navigation menu to include Profile link
  - Test complete user flow and integration with existing auth system
  - _Requirements: 1.1, 7.2, 7.3_
