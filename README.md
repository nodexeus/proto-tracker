# proto-tracker
Protocol Tracker

# Project Overview

This project consists of an API and a web frontend, designed to work together to provide a comprehensive solution. The API is built using FastAPI and is located in the `/app` directory, while the web frontend is developed with Flask and resides in the `/web` directory. The project uses Docker for containerization, allowing for easy deployment and scaling.

### Directory Structure

- **/app**: Contains the FastAPI application.
  - `main.py`: Entry point for the API.
  - `crud.py`, `models.py`, `schemas.py`: Define the database operations, models, and data schemas.
  - `database.py`: Database connection setup.
  - `requirements.txt`: Lists the dependencies for the API.
  - `Dockerfile`: Docker configuration for the API.

- **/web**: Contains the Flask web frontend.
  - `run.py`: Entry point for the web application.
  - `package.json`: Lists the Node.js dependencies.
  - `requirements.txt`: Lists the Python dependencies for the web frontend.
  - `Dockerfile`: Docker configuration for the web frontend.

- **docker-compose.yml**: Defines the services for Docker, including the API, web frontend, and a PostgreSQL database.

### Installation Instructions

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Set Up Environment Variables**:
   - Create a `.env` file in the `/web` directory with necessary environment variables.
   - Environment variables for the API are defined in the `docker-compose.yml`.

3. **Build and Run with Docker**:
   - Ensure Docker is installed and running on your system.
   - Run the following command to build and start the services:
     ```bash
     docker compose up --build
     ```

### Development Instructions

- **API Development**:
  - The API uses FastAPI, and you can add new endpoints in `main.py`.
  - Use Alembic for database migrations; configurations are in `alembic.ini`.

- **Web Frontend Development**:
  - The web frontend uses Flask; you can add new routes in `run.py`.
  - Use Flask-Migrate for database migrations.

- **Local Development**:
  - To run the API and web frontend locally, use `docker compose up --build -d`.

### Usage

- **Accessing the API**:
  - The API is accessible at `http://localhost:8001`.
  - Swagger documentation is available at `http://localhost:8001/docs`.

- **Accessing the Web Frontend**:
  - The web frontend is accessible at `http://localhost:5001`.

### Dependencies

- **API**:
  - FastAPI, Uvicorn, SQLAlchemy, Pydantic, Alembic, and others as listed in `/app/requirements.txt`.

- **Web Frontend**:
  - Flask, Flask-Login, Flask-Migrate, WTForms, and others as listed in `/web/requirements.txt`.

### Configuration

- **Database**:
  - PostgreSQL is used as the database, configured in `docker-compose.yml`.
  - Data is persisted in a Docker volume named `postgres_data`.

### Contributing

- Follow PEP 8 style guidelines for Python code.
- Ensure all new features are covered by tests.
- Submit pull requests for review before merging.

### ToDo

- **Protocol-Client Relationship Tracking**:
  - Add formal relationship mapping between protocols and their supported clients
  - Track client-specific configuration per protocol
  - Enable easy querying of all protocols a client supports and vice versa
  - Improve organization of protocol updates by client-protocol pairs

### Known Issues

- Ensure Docker is properly installed and configured to avoid build errors.
- Check environment variable configurations if services fail to start.
