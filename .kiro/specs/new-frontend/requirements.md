# Requirements Document

## Introduction

This document outlines the requirements for developing a new modern frontend for the proto-tracker blockchain protocol monitoring system. The new frontend will replace the deprecated Flask-based frontend and provide a clean, responsive interface for managing blockchain protocols, tracking updates, and managing snapshots. The frontend will integrate with the existing FastAPI backend and implement Google OAuth authentication with API key management.

## Requirements

### Requirement 1

**User Story:** As a blockchain infrastructure engineer, I want to authenticate using Google OAuth so that I can securely access the protocol tracker without managing separate credentials.

#### Acceptance Criteria

1. WHEN a user visits the application THEN the system SHALL present a Google OAuth login option
2. WHEN a user successfully authenticates with Google THEN the system SHALL create or retrieve their user account
3. WHEN a user completes OAuth flow THEN the system SHALL generate or retrieve their API key for backend communication
4. WHEN a user's session expires THEN the system SHALL redirect them to re-authenticate
5. WHEN a user logs out THEN the system SHALL clear their session and redirect to login

### Requirement 2

**User Story:** As a protocol developer, I want to view a dashboard of all tracked protocols so that I can quickly see the status and key information for each protocol.

#### Acceptance Criteria

1. WHEN a user accesses the main dashboard THEN the system SHALL display a list of all protocols
2. WHEN displaying protocols THEN the system SHALL show protocol name, network, chain ID, and logo
3. WHEN a protocol has recent updates THEN the system SHALL indicate this visually
4. WHEN a user clicks on a protocol THEN the system SHALL navigate to the protocol detail view
5. WHEN no protocols exist THEN the system SHALL display an appropriate empty state message

### Requirement 3

**User Story:** As a DevOps engineer, I want to create and edit protocol entries so that I can maintain accurate protocol information in the system.

#### Acceptance Criteria

1. WHEN a user clicks "Add Protocol" THEN the system SHALL display a protocol creation form
2. WHEN creating a protocol THEN the system SHALL require name, network, and chain_id fields
3. WHEN creating a protocol THEN the system SHALL allow optional fields for explorer, RPC, family, and logo
4. WHEN a user uploads a logo THEN the system SHALL validate it as PNG format and resize if needed
5. WHEN a user saves a protocol THEN the system SHALL validate uniqueness of name+network+chain_id combination
6. WHEN editing an existing protocol THEN the system SHALL pre-populate the form with current values
7. WHEN saving changes THEN the system SHALL update the protocol via the API

### Requirement 4

**User Story:** As a protocol maintainer, I want to view detailed protocol information including updates and snapshots so that I can monitor the protocol's status comprehensively.

#### Acceptance Criteria

1. WHEN viewing a protocol detail page THEN the system SHALL display all protocol metadata
2. WHEN viewing protocol details THEN the system SHALL show a list of recent protocol updates
3. WHEN viewing protocol details THEN the system SHALL display available snapshots if any exist
4. WHEN viewing updates THEN the system SHALL show update date, version, release notes, and GitHub links
5. WHEN viewing snapshots THEN the system SHALL show snapshot date, version, and file count
6. WHEN a user clicks on a snapshot THEN the system SHALL show snapshot file details

### Requirement 5

**User Story:** As a blockchain infrastructure team member, I want to track protocol updates and releases so that I can stay informed about important changes and hard forks.

#### Acceptance Criteria

1. WHEN viewing protocol updates THEN the system SHALL display updates in chronological order
2. WHEN an update is a hard fork THEN the system SHALL highlight it prominently
3. WHEN an update has open tickets THEN the system SHALL indicate this status
4. WHEN viewing update details THEN the system SHALL show release notes formatted with markdown
5. WHEN an update links to GitHub THEN the system SHALL provide clickable links to the release

### Requirement 6

**User Story:** As a system administrator, I want to manage snapshot indexing and B2 storage configuration so that I can maintain the snapshot management functionality.

#### Acceptance Criteria

1. WHEN accessing admin settings THEN the system SHALL provide B2 bucket configuration options
2. WHEN configuring B2 storage THEN the system SHALL validate connection credentials
3. WHEN initiating snapshot scanning THEN the system SHALL trigger the backend scan process
4. WHEN snapshot scanning completes THEN the system SHALL display the results and any new snapshots found
5. WHEN viewing snapshot files THEN the system SHALL display the hierarchical file tree structure

### Requirement 7

**User Story:** As a user of the system, I want a responsive and intuitive interface built with modern UI components so that I can effectively use the application on different devices and screen sizes.

#### Acceptance Criteria

1. WHEN accessing the application on mobile devices THEN the system SHALL display a mobile-optimized layout using Mantine's responsive components
2. WHEN using the application THEN the system SHALL provide clear navigation between different sections with Mantine's navigation components
3. WHEN performing actions THEN the system SHALL provide appropriate loading states and feedback using Mantine's built-in indicators
4. WHEN errors occur THEN the system SHALL display user-friendly error messages using Mantine's notification system
5. WHEN data is loading THEN the system SHALL show loading indicators using Mantine's Loader components
6. WHEN forms have validation errors THEN the system SHALL highlight the problematic fields clearly using Mantine's form validation styling

### Requirement 8

**User Story:** As a developer integrating with the system, I want the frontend to properly handle API authentication and errors so that the system is reliable and secure.

#### Acceptance Criteria

1. WHEN making API calls THEN the system SHALL include the user's API key in request headers
2. WHEN API calls fail due to authentication THEN the system SHALL prompt for re-authentication
3. WHEN API calls fail due to server errors THEN the system SHALL display appropriate error messages
4. WHEN API calls are slow THEN the system SHALL show loading states to users
5. WHEN network connectivity is lost THEN the system SHALL handle offline scenarios gracefully
6. WHEN API responses contain errors THEN the system SHALL parse and display meaningful error messages