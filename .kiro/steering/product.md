# Product Overview

Proto-tracker is a protocol monitoring and management system designed for blockchain protocols. The system tracks protocol updates, manages protocol metadata, and provides snapshot management capabilities for blockchain data.

## Core Features

- **Protocol Management**: Track blockchain protocols with metadata including chain IDs, explorers, RPC endpoints, and network information
- **Update Tracking**: Monitor protocol releases, updates, and hard forks with GitHub integration
- **Snapshot Management**: Index and manage blockchain snapshots stored in B2-compatible storage
- **Client Management**: Track different blockchain clients and their relationships to protocols
- **User Authentication**: API key-based authentication system with OAuth support

## Target Users

- Blockchain infrastructure teams
- Protocol developers
- DevOps engineers managing blockchain nodes
- Teams requiring protocol update monitoring and snapshot management

## Architecture

The system follows a microservices architecture with:
- FastAPI backend for core API functionality
- Flask frontend (deprecated, being replaced)
- PostgreSQL database for persistence
- Docker containerization for deployment
- B2/S3-compatible storage for snapshot data