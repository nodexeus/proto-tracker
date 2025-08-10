# Project Structure

## Root Directory Layout

```
proto-tracker/
├── api/                    # FastAPI backend application
├── web/                    # New frontend (empty, future development)
├── deprecated/             # Legacy Flask frontend
├── docker-compose.yml      # Multi-service Docker configuration
└── README.md              # Project documentation
```

## API Directory (`/api`)

```
api/
├── main.py                 # FastAPI application entry point
├── models.py               # SQLAlchemy database models
├── schemas.py              # Pydantic data validation schemas
├── crud.py                 # Database operations (Create, Read, Update, Delete)
├── database.py             # Database connection and session management
├── requirements.txt        # Python dependencies
├── Dockerfile             # API container configuration
├── alembic.ini            # Database migration configuration
└── utils/                 # Database migration files
    ├── env.py
    ├── script.py.mako
    └── versions/          # Migration version files
```

## Deprecated Frontend (`/deprecated`)

```
deprecated/
├── run.py                 # Flask application entry point
├── requirements.txt       # Python dependencies
├── package.json          # Node.js build dependencies
├── Dockerfile            # Frontend container configuration
└── apps/                 # Flask application modules
    ├── __init__.py
    ├── config.py         # Flask configuration
    ├── extensions.py     # Flask extensions setup
    ├── api/              # API integration
    ├── authentication/   # User authentication
    ├── home/            # Main application views
    ├── static/          # CSS, JS, images
    └── templates/       # Jinja2 HTML templates
```

## Key Architectural Patterns

### Database Models
- Located in `api/models.py`
- Use SQLAlchemy ORM with proper relationships
- Follow naming convention: PascalCase for classes, snake_case for table names
- Include proper foreign key relationships and constraints

### API Schemas
- Located in `api/schemas.py`
- Pydantic models for request/response validation
- Separate schemas for Create, Update, and Response operations
- Use Union types for optional fields

### CRUD Operations
- Located in `api/crud.py`
- Separate functions for each database operation
- Use dependency injection for database sessions
- Include proper error handling and logging

### API Endpoints
- Located in `api/main.py`
- Use FastAPI decorators with proper tags and summaries
- Implement API key authentication via Security dependency
- Include comprehensive logging and timing

## Configuration Management

### Environment Variables
- Database connection via `DB_*` variables
- API keys and secrets via environment
- Service URLs and ports configurable
- AWS/B2 credentials for storage access

### Docker Services
- `proto-api`: FastAPI backend (port 8001)
- `proto-web`: Frontend service (port 5001)
- `postgres`: Database service (port 5432)
- Shared PostgreSQL volume for data persistence

## File Naming Conventions

- Python files: `snake_case.py`
- Database tables: `snake_case`
- API endpoints: `/kebab-case/`
- Environment variables: `UPPER_SNAKE_CASE`
- Docker services: `kebab-case`

## Development Workflow

1. Database changes: Create Alembic migrations in `api/utils/versions/`
2. API changes: Update models, schemas, and CRUD operations
3. Frontend changes: Currently in deprecated Flask app
4. Testing: Use pytest for API, manual testing for frontend
5. Deployment: Docker compose for local, containerized for production