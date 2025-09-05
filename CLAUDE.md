# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development Commands
```bash
# Start full stack with Docker
docker compose up --build

# Backend development (FastAPI)
cd api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Frontend development (React + TypeScript)
cd web
npm install
npm run dev

# Frontend type checking and linting
npm run type-check
npm run lint
npm run lint:fix
npm run format
```

### Database Commands
```bash
# Run database migrations (from api/ directory)
alembic upgrade head

# Generate new migration after model changes
alembic revision --autogenerate -m "Description of changes"
```

### Docker Commands
```bash
# Build and start all services
docker compose up --build

# View logs for specific service
docker compose logs proto-api
docker compose logs proto-web

# Stop all services
docker compose down

# Reset database (removes data)
docker compose down -v && docker compose up --build
```

## Architecture Overview

### Service Architecture
This is a full-stack blockchain protocol monitoring platform with three main components:
- **FastAPI Backend** (`api/`): REST API server with background services
- **React Frontend** (`web/`): Modern TypeScript React app with Mantine UI
- **PostgreSQL Database**: Data persistence with Alembic migrations

### Backend Architecture (`api/`)
- **Entry Point**: `main.py` - FastAPI application with CORS, OAuth, and startup services
- **Database Layer**: SQLAlchemy ORM with models in `models.py` and CRUD operations in `crud.py`
- **Services Layer**: Modular services in `services/` directory:
  - `ai_service.py`: Multi-provider AI analysis (OpenAI, Anthropic, Ollama)
  - `background_poller.py`: GitHub repository monitoring service
  - `github_service.py`: GitHub API integration
  - `notification_service.py`: Multi-channel notifications (Discord, Slack, Telegram)
  - `protocol_service.py`: Protocol/client management
  - `background_scanner.py`: S3-based scanning services

### Frontend Architecture (`web/`)
- **Framework**: React 19 with TypeScript, built with Vite
- **UI Framework**: Mantine UI components with custom theming
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: React Router DOM v7
- **Authentication**: Google OAuth with @react-oauth/google
- **Type Safety**: Full TypeScript implementation with Zod schemas

### Key Data Flow
1. **Background Poller** monitors GitHub repos for new releases/tags
2. **AI Service** analyzes updates for hard forks, security issues, and breaking changes
3. **Notification Service** sends alerts via configured channels
4. **Frontend** displays real-time updates via React Query

### Database Schema
Core entities:
- **protocols**: Blockchain protocols being monitored
- **protocol_updates**: Individual releases/tags from GitHub
- **ai_analysis**: AI-generated analysis of updates
- **users**: OAuth-authenticated users with API keys
- **notifications**: Multi-channel notification configurations

## Development Guidelines

### Adding New Features
1. **Backend**: Add database models first, create migration, then implement CRUD operations
2. **Services**: Business logic belongs in `services/` directory, not in route handlers
3. **Frontend**: Use existing patterns - check `types/` for data models, create reusable components
4. **API**: Follow existing FastAPI patterns with proper error handling and authentication

### Authentication Flow
- Uses Google OAuth for user authentication
- API routes protected with OAuth2PasswordBearer
- Users can generate multiple API keys for external access
- Admin vs regular user roles implemented

### Background Services
- Services auto-start on application startup if previously enabled
- Background poller runs asynchronously and is configurable
- Database sessions properly managed to prevent leaks
- Error handling with comprehensive logging

### AI Integration
- Multi-provider support: OpenAI (GPT-5), Anthropic (Claude-4), Ollama (local)
- Configurable timeouts and retry logic
- Confidence scoring and structured analysis output
- Hard fork detection and security update flagging

### Notification System
- Support for Discord, Slack, Telegram webhooks
- Per-client notification filtering
- Priority-based alerting for hard forks
- Configurable notification templates

## Configuration

### Environment Variables
Required environment variables (see `.env.example`):
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `VITE_API_URL`: Frontend API endpoint configuration
- Database credentials handled by Docker Compose

### Development Setup
1. Copy `.env.example` to `.env` and configure Google OAuth
2. Use Docker Compose for full stack development
3. Individual service development requires manual database setup
4. Frontend proxy configuration in `vite.config.ts` for RPC calls