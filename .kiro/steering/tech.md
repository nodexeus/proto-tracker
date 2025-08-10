# Technology Stack

## Backend (API)
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn 0.24.0
- **Database ORM**: SQLAlchemy 2.0.23
- **Data Validation**: Pydantic 2.5.1
- **Database Migrations**: Alembic 1.12.1
- **Database Driver**: psycopg2-binary 2.9.9
- **Authentication**: API key-based with python-jose
- **Image Processing**: Pillow 10.1.0
- **Cloud Storage**: boto3 for B2/S3 compatibility

## Frontend (Deprecated)
- **Framework**: Flask 2.0.2
- **Authentication**: Flask-Login, OAuth with Google
- **Database**: Flask-SQLAlchemy, Flask-Migrate
- **Forms**: WTForms, Flask-WTF
- **Templates**: Jinja2
- **Build Tools**: Gulp, Node-sass, Browser-sync

## Database
- **Production**: PostgreSQL 14
- **Connection**: Environment-based configuration
- **Migrations**: Alembic for API, Flask-Migrate for deprecated frontend

## Infrastructure
- **Containerization**: Docker with docker-compose
- **Storage**: B2-compatible object storage for snapshots
- **Environment**: Environment variables for configuration

## Common Commands

### Development Setup
```bash
# Start all services
docker compose up --build

# API only (development)
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Database migrations
cd api
alembic upgrade head
```

### API Access
- **API Base URL**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **Authentication**: x-api-key header required

### Testing
```bash
# Run API tests
cd api
python -m pytest

# Test deprecated frontend
cd deprecated
python test_api.py
```

## Code Style
- Follow PEP 8 for Python code
- Use type hints with Pydantic models
- Async/await patterns for FastAPI endpoints
- SQLAlchemy ORM models with proper relationships