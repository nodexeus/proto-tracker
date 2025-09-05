from typing import Union, Annotated, List, Dict, Any

from fastapi import Depends, FastAPI, HTTPException, status, Security, File, UploadFile, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader, APIKeyQuery
import base64
from PIL import Image
from io import BytesIO
import logging
import time
from fastapi.middleware.cors import CORSMiddleware
from contextlib import contextmanager
from datetime import datetime
import secrets
import string
import os
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import crud, models, schemas
from database import SessionLocal, engine
from utils.formatting import format_bytes, format_number_with_commas
from alembic.config import Config
from alembic import command

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@contextmanager
def timer(name: str):
    start_time = time.time()
    yield
    duration = time.time() - start_time
    logger.debug(f"{name} took {duration:.2f} seconds")


# Run database migrations at startup
logger.info("Running database migrations...")
try:
    alembic_cfg = Config("alembic.ini")
    # Set the database URL in the config
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    
    # Add debug info about what migrations Alembic can see
    from alembic.script import ScriptDirectory
    from alembic.runtime.migration import MigrationContext
    script = ScriptDirectory.from_config(alembic_cfg)
    logger.info(f"Alembic script location: {script.dir}")
    logger.info(f"Available migrations:")
    for revision in script.walk_revisions():
        logger.info(f"  - {revision.revision} (down: {revision.down_revision}): {revision.doc}")
    
    # Check current database version
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        current_rev = context.get_current_revision()
        logger.info(f"Current database revision: {current_rev}")
    
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations completed successfully!")
except Exception as e:
    logger.error(f"Failed to run database migrations: {e}")
    logger.exception("Migration error details:")
    # Still create tables as fallback for new installations
    logger.info("Falling back to creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully!")

app = FastAPI(
    title="ProtoTracker API",
    description="Nodexeus Protocol Tracker",
    version="1.0.1",
    swagger_ui_parameters={"syntaxHighlight.theme": "nord"},
    openapi_version="3.0.2",
)

app.openapi_version = "3.0.2"

# Startup event to auto-start background poller if it was previously enabled
@app.on_event("startup")
async def startup_event():
    """Start background services if they were previously enabled"""
    db = next(get_db())
    try:
        # Auto-start background poller if enabled
        try:
            from services.background_poller import background_poller
            
            github_config = crud.get_github_config(db)
            if github_config and github_config.poller_enabled and github_config.api_key:
                logger.info("Auto-starting background poller (was previously enabled)")
                await background_poller.start(db)
            else:
                logger.info("Background poller not auto-started (not previously enabled or no API key)")
        except Exception as e:
            logger.error(f"Error during startup auto-start of background poller: {e}")
        
        # Auto-start background scanner if enabled
        try:
            from services.background_scanner import background_scanner
            
            system_config = crud.get_system_config(db)
            if system_config and system_config.auto_scan_enabled:
                s3_config = crud.get_s3_config(db)
                if s3_config and s3_config.bucket_name:
                    logger.info("Auto-starting background scanner (auto-scan enabled)")
                    await background_scanner.start(db)
                else:
                    logger.info("Background scanner not auto-started (S3 not configured)")
            else:
                logger.info("Background scanner not auto-started (auto-scan not enabled)")
        except Exception as e:
            logger.error(f"Error during startup auto-start of background scanner: {e}")
            
    finally:
        db.close()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3000", 
        "http://127.0.0.1:3001",
        "http://proto-web:3000",  # Internal Docker network
        "http://0.0.0.0:3000",    # Docker internal IP
        "*"  # Allow all origins for now to debug
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(
        f"Response: {request.method} {request.url} - Status: {response.status_code} - Duration: {duration:.2f}s"
    )
    return response


def get_db():
    logger.debug("Opening new database connection")
    db = SessionLocal()
    try:
        yield db
    finally:
        logger.debug("Closing database connection")
        db.close()


api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


def get_api_key(
    api_key_header: str = Security(api_key_header), db: Session = Depends(get_db)
) -> str:
    """Retrieve and validate an API key from the HTTP header.

    Args:
        api_key_header: The API key passed in the HTTP header.
        db: Database session.

    Returns:
        The validated API key.

    Raises:
        HTTPException: If the API key is invalid, missing, expired, or inactive.
    """
    if not api_key_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No API key provided",
        )

    # Query the database for the API key
    api_key = (
        db.query(models.ApiKey).filter(models.ApiKey.key == api_key_header).first()
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    # Check if the key is active
    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is inactive",
        )

    # Check if the key has expired
    if api_key.expires_at and api_key.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
        )

    # Update last used timestamp
    api_key.last_used_at = datetime.utcnow()
    db.add(api_key)
    db.commit()

    return api_key_header

def get_current_user(
    api_key: str = Security(get_api_key), db: Session = Depends(get_db)
) -> models.Users:
    """Get current user from API key"""
    # Get the API key object to find the user
    api_key_obj = (
        db.query(models.ApiKey).filter(models.ApiKey.key == api_key).first()
    )
    
    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    user = db.query(models.Users).filter(models.Users.id == api_key_obj.user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )
    
    return user

def get_current_admin_user(
    api_key: str = Security(get_api_key), db: Session = Depends(get_db)
) -> models.Users:
    """Get current user and verify admin status"""
    user = get_current_user(api_key, db)
    
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    return user

def generate_api_key() -> str:
    """Generate a secure random API key"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(64))

def verify_google_token(access_token: str) -> dict:
    """Verify Google access token by fetching user info and return user information"""
    try:
        # Get Google OAuth client ID from environment (for reference, not needed for access token)
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured on server"
            )
        
        # Use the access token to fetch user info from Google's userinfo endpoint
        import requests as python_requests
        
        response = python_requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if response.status_code != 200:
            raise ValueError('Invalid access token or failed to fetch user info')
            
        user_info = response.json()
        
        # Validate that we got the required fields
        if not user_info.get('id') or not user_info.get('email'):
            raise ValueError('Incomplete user information from Google')
        
        # Convert to the format expected by our code (similar to ID token format)
        return {
            'sub': user_info['id'],
            'email': user_info['email'],
            'given_name': user_info.get('given_name'),
            'family_name': user_info.get('family_name'),
            'picture': user_info.get('picture'),
            'verified_email': user_info.get('verified_email', True),
        }
        
    except ValueError as e:
        logger.error(f"Google token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

def create_or_get_user_from_google(db: Session, google_user_info: dict) -> models.Users:
    """Create or get user from Google OAuth information"""
    google_id = google_user_info.get('sub')
    email = google_user_info.get('email')
    
    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google user information"
        )
    
    # Check if user exists by Google ID
    user = db.query(models.Users).filter(models.Users.oauth_google == google_id).first()
    
    if not user:
        # Check if user exists by email
        user = db.query(models.Users).filter(models.Users.email == email).first()
        
        if user:
            # Update existing user with Google OAuth info
            user.oauth_google = google_id
            user.picture = google_user_info.get('picture')
            if not user.first_name:
                user.first_name = google_user_info.get('given_name')
            if not user.last_name:
                user.last_name = google_user_info.get('family_name')
        else:
            # Create new user
            user = models.Users(
                username=email,
                email=email,
                oauth_google=google_id,
                first_name=google_user_info.get('given_name'),
                last_name=google_user_info.get('family_name'),
                picture=google_user_info.get('picture'),
                is_admin=False,
                is_active=True
            )
            
            # If this is the first user, make them admin
            user_count = db.query(models.Users).count()
            if user_count == 0:
                user.is_admin = True
                logger.info("First user created - granted admin privileges")
            
            db.add(user)
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
    
    return user

def create_api_key_for_user(db: Session, user: models.Users) -> str:
    """Create an API key for a user, or return existing one"""
    # Check if user already has an active API key
    existing_key = db.query(models.ApiKey).filter(
        models.ApiKey.user_id == user.id,
        models.ApiKey.is_active == True
    ).first()
    
    if existing_key:
        return existing_key.key
    
    # Create new API key
    api_key = generate_api_key()
    
    db_api_key = models.ApiKey(
        user_id=user.id,
        key=api_key,
        name="Default API Key",
        description="Auto-created during OAuth login",
        is_active=True
    )
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    logger.info(f"Created API key for user {user.email}")
    return api_key


def process_logo_image(logo_data: bytes) -> bytes:
    """Process and validate logo image"""
    try:
        # Open image using PIL
        img = Image.open(BytesIO(logo_data))

        # Validate format
        if img.format != "PNG":
            raise HTTPException(status_code=400, detail="Logo must be a PNG image")

        # Validate dimensions
        if img.size[0] > 1024 or img.size[1] > 1024:
            # Resize if too large while maintaining aspect ratio
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        # Convert to RGBA if not already
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Save processed image to bytes
        output = BytesIO()
        img.save(output, format="PNG", optimize=True, quality=85)
        return output.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


# Import boto3 for S3/B2 operations
import boto3
import json
from botocore.config import Config


# S3-Compatible Storage Configuration endpoints
@app.get("/s3-config", 
    response_model=schemas.S3Config,
    tags=["S3 Config"]
)
def get_s3_config(
    api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    """Get the current S3 storage configuration."""
    config = crud.get_s3_config(db)
    if not config:
        # Return empty config instead of 404 when not configured
        return schemas.S3Config(
            id=0,
            bucket_name="",
            endpoint_url="",
            access_key_id="",
            secret_access_key="",
            region="us-west-004",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    return config


@app.post("/s3-config", 
    response_model=schemas.S3Config,
    tags=["S3 Config"]
)
def create_s3_config(
    config: schemas.S3ConfigCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    """Create or update the S3 storage configuration."""
    return crud.create_s3_config(db, config)


@app.patch("/s3-config", 
    response_model=schemas.S3Config,
    tags=["S3 Config"]
)
def update_s3_config(
    config: schemas.S3ConfigUpdate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    """Update the S3 storage configuration."""
    return crud.update_s3_config(db, config)


@app.post("/s3-config/test", 
    response_model=schemas.S3ConnectionTest,
    tags=["S3 Config"]
)
def test_s3_connection(
    api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    """Test the S3 storage connection."""
    import boto3
    from botocore.exceptions import ClientError
    
    config = crud.get_s3_config(db)
    if not config:
        raise HTTPException(status_code=404, detail="S3 storage configuration not found")
    
    try:
        # Create S3 client
        s3_client = boto3.client(
            's3',
            endpoint_url=config.endpoint_url,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            region_name=config.region
        )
        
        # Test connection by listing bucket
        s3_client.list_objects_v2(Bucket=config.bucket_name, MaxKeys=1)
        
        return schemas.S3ConnectionTest(
            status="success",
            message=f"Successfully connected to S3-compatible storage bucket '{config.bucket_name}'"
        )
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            return schemas.S3ConnectionTest(
                status="error",
                message=f"Bucket '{config.bucket_name}' does not exist or is not accessible"
            )
        elif error_code == 'AccessDenied':
            return schemas.S3ConnectionTest(
                status="error", 
                message="Access denied. Check your credentials and bucket permissions"
            )
        else:
            return schemas.S3ConnectionTest(
                status="error",
                message=f"Connection failed: {e.response['Error']['Message']}"
            )
    except Exception as e:
        return schemas.S3ConnectionTest(
            status="error",
            message=f"Connection failed: {str(e)}"
        )


# Helper function to create S3 client
def get_s3_client(db: Session):
    config = crud.get_s3_config(db)
    if not config:
        raise HTTPException(status_code=404, detail="S3 storage configuration not found")

    return boto3.client(
        service_name="s3",
        endpoint_url=config.endpoint_url,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        config=Config(
            connect_timeout=30,
            read_timeout=30,
            signature_version="s3v4",
            retries={
                "max_attempts": 3, 
                "mode": "standard"
            },
            request_checksum_calculation = 'when_required',
            response_checksum_validation = 'when_required',
        ),
    )


# Snapshot management endpoints
@app.post("/protocols/{protocol_id}/snapshots/scan",    
   tags=["Snapshots"]
)
async def scan_protocol_snapshots(
    protocol_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    """Scan the B2 bucket for snapshots of the specified protocol."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    # Get all active snapshot prefixes for the protocol
    protocol_prefixes = crud.get_active_protocol_snapshot_prefixes(db, protocol_id)
    
    # If no prefixes defined, fall back to legacy behavior
    if not protocol_prefixes:
        if protocol.snapshot_prefix:
            prefixes_to_scan = [protocol.snapshot_prefix]
        else:
            # Fallback: convert protocol name to a basic prefix
            protocol_name = protocol.name.lower().replace(" ", "-")
            prefixes_to_scan = [f"{protocol_name}-"]
    else:
        prefixes_to_scan = [prefix.prefix for prefix in protocol_prefixes]
    
    logger.info(f"Scanning snapshots for protocol {protocol.name}")
    logger.info(f"Using {len(prefixes_to_scan)} prefixes: {prefixes_to_scan}")

    try:
        client = get_s3_client(db)
        config = crud.get_s3_config(db)

        logger.info(f"Using bucket: {config.bucket_name}")
        logger.info(f"Using endpoint: {config.endpoint_url}")

        # Track snapshots by their full path and stats
        snapshot_info = {}
        total_directories = 0
        total_manifests_checked = 0
        found_any_manifests = False
        new_snapshots = []

        # List all top-level directories that start with any of our protocol prefixes
        paginator = client.get_paginator("list_objects_v2")

        # Scan each prefix
        for prefix in prefixes_to_scan:
            logger.info(f"Looking for snapshots with prefix: {prefix}")
            
            try:
                # Get all directories that start with this prefix
                for page in paginator.paginate(
                    Bucket=config.bucket_name, Prefix=prefix, Delimiter="/"
                ):
                    if "CommonPrefixes" not in page:
                        logger.info(f"No matching protocol directories found for prefix: {prefix}")
                        continue

                    # For each protocol directory, list its version subdirectories
                    for prefix_obj in page["CommonPrefixes"]:
                        protocol_dir = prefix_obj.get("Prefix", "")
                        if not protocol_dir:
                            continue

                        total_directories += 1
                        logger.info(f"Checking protocol directory: {protocol_dir}")
                        
                        # List all version subdirectories
                        try:
                            for version_page in paginator.paginate(
                                Bucket=config.bucket_name,
                                Prefix=protocol_dir,
                                Delimiter="/"
                            ):
                                if "CommonPrefixes" not in version_page:
                                    logger.debug(f"No version subdirectories found in {protocol_dir}")
                                    continue

                                # Check each version directory for manifest
                                for version_prefix in version_page["CommonPrefixes"]:
                                    version_dir = version_prefix.get("Prefix", "")
                                    if not version_dir:
                                        continue

                                    logger.info(f"Checking version directory: {version_dir}")
                                    manifest_path = f"{version_dir}manifest-body.json"
                                    total_manifests_checked += 1
                                    logger.info(f"Looking for manifest at: {manifest_path}")

                                    try:
                                        # Try to get the manifest file
                                        response = client.get_object(
                                            Bucket=config.bucket_name, Key=manifest_path
                                        )
                                        found_any_manifests = True
                                        logger.info(f"Found manifest: {manifest_path}")

                                        # Also try to get the manifest-header.json file for additional metadata
                                        header_manifest_path = f"{version_dir}manifest-header.json"
                                        header_data = None
                                        try:
                                            header_response = client.get_object(
                                                Bucket=config.bucket_name, Key=header_manifest_path
                                            )
                                            header_data = json.loads(
                                                header_response["Body"].read().decode("utf-8")
                                            )
                                            logger.info(f"Found header manifest: {header_manifest_path}")
                                        except client.exceptions.NoSuchKey:
                                            logger.debug(f"No header manifest found at {header_manifest_path}")
                                        except json.JSONDecodeError as e:
                                            logger.error(f"Invalid JSON in header manifest at {header_manifest_path}: {str(e)}")

                                        def build_file_tree(paths):
                                            """Build a hierarchical tree structure from file paths.
                                            
                                            Args:
                                                paths (list): List of file paths
                                                
                                            Returns:
                                                dict: Tree structure where each key is a directory/file and value is either
                                                     None for files or another dict for directories
                                            """
                                            tree = {}
                                            for path in sorted(set(paths)):  # Deduplicate and sort paths
                                                parts = path.split('/')
                                                current = tree
                                                for i, part in enumerate(parts):
                                                    if i == len(parts) - 1:  # Leaf/file node
                                                        current[part] = None
                                                    else:  # Directory node
                                                        if part not in current:
                                                            current[part] = {}
                                                        current = current[part]
                                            return tree

                                        # Parse manifest data
                                        manifest_data = json.loads(
                                            response["Body"].read().decode("utf-8")
                                        )

                                        # Extract paths and total parts from manifest
                                        raw_paths = []
                                        total_parts = len(manifest_data.get("chunks", []))
                                        for chunk in manifest_data.get("chunks", []):
                                            # Each chunk represents a part
                                            if "destinations" in chunk:
                                                for dest in chunk["destinations"]:
                                                    if "path" in dest:
                                                        raw_paths.append(dest["path"])
                                        
                                        # Build file tree and get unique paths
                                        file_tree = build_file_tree(raw_paths)
                                        paths = sorted(set(raw_paths))  # Deduplicate paths

                                        if not paths:
                                            logger.debug(
                                                f"No valid paths found in manifest: {manifest_path}"
                                            )
                                            continue

                                        # Get the client, network, node type, and version from the prefix
                                        prefix_parts = protocol_dir.rstrip("/").split("-")
                                        client_name = (
                                            prefix_parts[1]
                                            if len(prefix_parts) > 1
                                            else "unknown"
                                        )
                                        network = (
                                            prefix_parts[2]
                                            if len(prefix_parts) > 2
                                            else "unknown"
                                        )
                                        node_type = (
                                            prefix_parts[3]
                                            if len(prefix_parts) > 3
                                            else "unknown"
                                        )
                                        version = (
                                            prefix_parts[4]
                                            if len(prefix_parts) > 4
                                            else "v1"
                                        )

                                        # Get the backup version from the version directory
                                        version_num = version_dir.rstrip("/").split("/")[-1]

                                        # Create snapshot record in database
                                        try:
                                            snapshot_key = f"{protocol_dir}{version_num}"
                                            snapshot_metadata = {
                                                "version": int(version_num),
                                                "manifest_path": manifest_path,
                                                "total_parts": total_parts,
                                                "paths": paths,
                                                "file_tree": file_tree,  # Add hierarchical file structure
                                                "client": client_name,
                                                "network": network,
                                                "node_type": node_type,
                                                "version_tag": version
                                            }
                                            
                                            # Add header data if available
                                            if header_data:
                                                total_size_bytes = header_data.get("total_size", 0)
                                                chunks_count = header_data.get("chunks", 0)
                                                
                                                snapshot_metadata.update({
                                                    "total_size_bytes": total_size_bytes,
                                                    "total_size_formatted": format_bytes(total_size_bytes),
                                                    "chunks_count": chunks_count,
                                                    "chunks_formatted": format_number_with_commas(chunks_count),
                                                    "compression": header_data.get("compression", {})
                                                })

                                            # Use actual total size from header data if available
                                            actual_total_size = header_data.get("total_size", 0) if header_data else 0
                                            
                                            new_snapshot = models.SnapshotIndex(
                                                protocol_id=protocol_id,
                                                snapshot_id=snapshot_key,
                                                index_file_path=manifest_path,
                                                file_count=len(paths),
                                                total_size=actual_total_size,
                                                created_at=response["LastModified"],
                                                snapshot_metadata=snapshot_metadata
                                            )
                                            db.add(new_snapshot)
                                            db.commit()
                                            new_snapshots.append(new_snapshot)

                                            # Add to snapshot_info for tracking
                                            snapshot_info[snapshot_key] = snapshot_metadata

                                            logger.info(
                                                f"Found and indexed snapshot: {snapshot_key} (version {version_num}) with {len(paths)} paths and {total_parts} parts"
                                            )
                                        except Exception as e:
                                            logger.error(f"Error saving snapshot to database: {str(e)}")
                                            db.rollback()
                                            continue
                                        logger.info(
                                            f"Found snapshot: {snapshot_key} (version {version_num}) with {len(paths)} paths and {total_parts} parts"
                                        )
                                    except client.exceptions.NoSuchKey:
                                        logger.debug(
                                            f"No manifest found at {manifest_path}"
                                        )
                                        continue
                                    except json.JSONDecodeError as e:
                                        logger.error(
                                            f"Invalid JSON format in manifest at {manifest_path}. Error: {str(e)}"
                                        )
                                        continue
                                    except client.exceptions.ClientError as e:
                                        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                                        logger.error(
                                            f"B2 client error accessing manifest at {manifest_path}. Error code: {error_code}. Details: {str(e)}"
                                        )
                                        continue
                        except Exception as e:
                            logger.error(
                                f"Unexpected error processing manifest at {manifest_path}. Error type: {type(e).__name__}. Details: {str(e)}"
                            )
                            continue
            except Exception as e:
                logger.error(f"Error scanning snapshots for prefix {prefix}: {str(e)}")
                continue

        # Create or update snapshot entries
        new_snapshots = []
        logger.info(f"Found {len(snapshot_info)} total snapshots to process")

        for snapshot_key, info in snapshot_info.items():
            # Check if this snapshot is already indexed
            existing = crud.get_snapshot_by_id(db, snapshot_key, protocol_id)
            if existing:
                logger.info(f"Updating existing snapshot: {snapshot_key}")
                # Update existing snapshot with new metadata including header data
                existing.file_count = len(info["paths"])
                existing.total_size = info["metadata"].get("total_size_bytes", 0)
                existing.snapshot_metadata = info["metadata"]
                existing.indexed_at = datetime.utcnow()
                db.commit()
                new_snapshots.append(existing)
                logger.info(f"Updated snapshot {snapshot_key} with size {format_bytes(existing.total_size)}")
                continue

            logger.info(f"Creating new snapshot index for {snapshot_key}")
            # Create new snapshot index
            snapshot = schemas.SnapshotIndexCreate(
                protocol_id=protocol_id,
                snapshot_id=info["prefix"],  # Use the full prefix as the snapshot ID
                index_file_path=info["manifest_path"],
                file_count=len(info["paths"]),
                total_size=info["metadata"].get("total_size_bytes", 0),
                created_at=info["created_at"],
                snapshot_metadata=info["metadata"],  # Use the pre-built metadata
            )
            new_snapshots.append(crud.create_snapshot_index(db, snapshot))

        logger.info(f"Scan summary:")
        logger.info(f"- Total directories checked: {total_directories}")
        logger.info(f"- Total manifests checked: {total_manifests_checked}")
        logger.info(f"- Total snapshots found: {len(snapshot_info)}")
        logger.info(f"- New snapshots indexed: {len(new_snapshots)}")

        # Only warn if we checked directories but found no manifests
        if total_directories > 0 and not found_any_manifests:
            logger.warning("No valid manifest files were found in the checked directories")

        return {"message": f"Indexed {len(new_snapshots)} new snapshots"}

    except Exception as e:
        logger.error(f"Error scanning snapshots: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error scanning snapshots: {str(e)}"
        )


@app.get("/protocols/{protocol_id}/snapshots", response_model=List[schemas.SnapshotIndex])
def get_protocol_snapshots(
    protocol_id: int, 
    skip: int = Query(0, ge=0), 
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get snapshots for a specific protocol"""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    return crud.get_protocol_snapshots_summary(db, protocol_id, skip, limit)


@app.post("/protocols/{protocol_id}/snapshots/update-metadata")
def update_snapshots_metadata(
    protocol_id: int,
    db: Session = Depends(get_db)
):
    """Update existing snapshots with manifest-header.json data"""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    
    # Get S3 configuration
    config = crud.get_s3_config(db)
    if not config:
        raise HTTPException(status_code=400, detail="S3 configuration not found")
    
    # Create S3 client
    client = get_s3_client(db)
    
    # Get all snapshots for this protocol
    snapshots = crud.get_protocol_snapshots(db, protocol_id, skip=0, limit=1000)
    
    updated_count = 0
    errors = []
    
    for snapshot in snapshots:
        try:
            # Extract version directory from index_file_path
            # e.g., "ethereum-reth-mainnet-archive-v1/2/manifest-body.json" -> "ethereum-reth-mainnet-archive-v1/2/"
            version_dir = "/".join(snapshot.index_file_path.split("/")[:-1]) + "/"
            header_manifest_path = f"{version_dir}manifest-header.json"
            
            try:
                # Try to get the manifest-header.json file
                header_response = client.get_object(
                    Bucket=config.bucket_name, Key=header_manifest_path
                )
                header_data = json.loads(
                    header_response["Body"].read().decode("utf-8")
                )
                logger.info(f"Found header manifest for snapshot {snapshot.snapshot_id}: {header_manifest_path}")
                
                # Extract data from header
                total_size_bytes = header_data.get("total_size", 0)
                chunks_count = header_data.get("chunks", 0)
                
                # Update snapshot metadata
                if snapshot.snapshot_metadata:
                    updated_metadata = snapshot.snapshot_metadata.copy()
                else:
                    updated_metadata = {}
                
                updated_metadata.update({
                    "total_size_bytes": total_size_bytes,
                    "total_size_formatted": format_bytes(total_size_bytes),
                    "chunks_count": chunks_count,
                    "chunks_formatted": format_number_with_commas(chunks_count),
                    "compression": header_data.get("compression", {})
                })
                
                # Update the snapshot in database
                snapshot.total_size = total_size_bytes
                snapshot.snapshot_metadata = updated_metadata
                db.commit()
                
                updated_count += 1
                logger.info(f"Updated snapshot {snapshot.snapshot_id} with size {format_bytes(total_size_bytes)} and {format_number_with_commas(chunks_count)} chunks")
                
            except client.exceptions.NoSuchKey:
                logger.debug(f"No header manifest found for snapshot {snapshot.snapshot_id} at {header_manifest_path}")
                continue
            except json.JSONDecodeError as e:
                error_msg = f"Invalid JSON in header manifest for snapshot {snapshot.snapshot_id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"Error updating snapshot {snapshot.snapshot_id}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
            continue
    
    return {
        "status": "completed",
        "updated_snapshots": updated_count,
        "total_snapshots": len(snapshots),
        "errors": errors
    }


@app.get("/protocols/{protocol_id}/snapshot-files/{snapshot_id:path}",    
   tags=["Snapshots"],
   summary="Get snapshot file tree"
)
async def list_snapshot_files(
    protocol_id: int,
    snapshot_id: str,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    """List all files in a specific snapshot."""
    # URL decode the snapshot_id since it may contain forward slashes
    from urllib.parse import unquote
    decoded_snapshot_id = unquote(snapshot_id)
    logger.info(f"Getting snapshot files for protocol {protocol_id}, snapshot {decoded_snapshot_id} (original: {snapshot_id})")
    
    snapshot = crud.get_snapshot_by_id(db, decoded_snapshot_id, protocol_id)
    if not snapshot:
        logger.warning(f"Snapshot not found: {decoded_snapshot_id} for protocol {protocol_id}")
        raise HTTPException(status_code=404, detail="Snapshot not found")

    logger.info(f"Found snapshot {snapshot.id} with metadata keys: {list(snapshot.snapshot_metadata.keys()) if snapshot.snapshot_metadata else 'No metadata'}")

    try:
        # Get file tree and paths directly from snapshot metadata
        metadata = snapshot.snapshot_metadata or {}
        
        # Try to get file tree from metadata first (preferred)
        file_tree = metadata.get("file_tree", {})
        all_paths = metadata.get("paths", [])
        
        # If no pre-built file tree, build it from paths
        if not file_tree and all_paths:
            logger.info(f"Building file tree from {len(all_paths)} paths")
            file_tree = {}
            
            for path in sorted(set(all_paths)):
                if not path:  # Skip empty paths
                    continue
                current = file_tree
                parts = path.split('/')
                for i, part in enumerate(parts):
                    if not part:  # Skip empty parts
                        continue
                    if i == len(parts) - 1:  # File
                        current[part] = None
                    else:  # Directory
                        if part not in current:
                            current[part] = {}
                        current = current[part]
        
        # Fallback: try to fetch from S3 if no metadata available
        if not file_tree and not all_paths:
            logger.info(f"No file data in metadata, attempting to fetch from S3")
            try:
                client = get_s3_client(db)
                config = crud.get_s3_config(db)

                # Download and parse the index file
                response = client.get_object(
                    Bucket=config.bucket_name, Key=snapshot.index_file_path
                )
                index_data = json.loads(response["Body"].read().decode("utf-8"))
                
                # Extract paths from manifest chunks
                raw_paths = []
                for chunk in index_data.get("chunks", []):
                    if "destinations" in chunk:
                        for dest in chunk["destinations"]:
                            if "path" in dest:
                                raw_paths.append(dest["path"])
                
                all_paths = sorted(set(raw_paths))
                
                # Build file tree from fetched paths
                for path in all_paths:
                    if not path:
                        continue
                    current = file_tree
                    parts = path.split('/')
                    for i, part in enumerate(parts):
                        if not part:
                            continue
                        if i == len(parts) - 1:
                            current[part] = None
                        else:
                            if part not in current:
                                current[part] = {}
                            current = current[part]
                            
                logger.info(f"Fetched {len(all_paths)} paths from S3 manifest")
                
            except Exception as s3_error:
                logger.error(f"Failed to fetch from S3: {str(s3_error)}")
                # Return empty structure rather than failing
                file_tree = {}
                all_paths = []
        
        logger.info(f"Returning file tree with {len(all_paths)} total files")
        
        return {
            "snapshot_id": decoded_snapshot_id,
            "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
            "indexed_at": snapshot.indexed_at.isoformat() if hasattr(snapshot, 'indexed_at') and snapshot.indexed_at else None,
            "metadata_summary": {
                "client": metadata.get("client"),
                "network": metadata.get("network"),
                "node_type": metadata.get("node_type"),
                "version": metadata.get("version")
            },
            "file_tree": file_tree,
            "files": all_paths,
            "total_files": len(all_paths)
        }

    except Exception as e:
        logger.error(f"Error listing snapshot files: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error listing snapshot files: {str(e)}"
        )


# Snapshot Prefix Management endpoints
@app.get(
    "/protocols/{protocol_id}/snapshot-prefixes",
    response_model=list[schemas.ProtocolSnapshotPrefix],
    tags=["Snapshot Prefixes"]
)
def get_protocol_snapshot_prefixes_endpoint(
    protocol_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db)
):
    """Get all snapshot prefixes for a protocol"""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    
    return crud.get_protocol_snapshot_prefixes(db, protocol_id)


@app.post(
    "/protocols/{protocol_id}/snapshot-prefixes",
    response_model=schemas.ProtocolSnapshotPrefix,
    tags=["Snapshot Prefixes"]
)
def create_protocol_snapshot_prefix_endpoint(
    protocol_id: int,
    prefix_data: schemas.ProtocolSnapshotPrefixCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db)
):
    """Create a new snapshot prefix for a protocol"""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    
    # Ensure protocol_id matches
    prefix_data.protocol_id = protocol_id
    
    try:
        return crud.create_protocol_snapshot_prefix(db, prefix_data)
    except Exception as e:
        # Handle unique constraint violations
        if "unique_protocol_prefix" in str(e):
            raise HTTPException(
                status_code=400, 
                detail="This prefix already exists for this protocol"
            )
        raise HTTPException(status_code=400, detail=str(e))


@app.put(
    "/snapshot-prefixes/{prefix_id}",
    response_model=schemas.ProtocolSnapshotPrefix,
    tags=["Snapshot Prefixes"]
)
def update_protocol_snapshot_prefix_endpoint(
    prefix_id: int,
    prefix_update: schemas.ProtocolSnapshotPrefixUpdate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db)
):
    """Update a snapshot prefix"""
    updated_prefix = crud.update_protocol_snapshot_prefix(db, prefix_id, prefix_update)
    if not updated_prefix:
        raise HTTPException(status_code=404, detail="Snapshot prefix not found")
    return updated_prefix


@app.delete(
    "/snapshot-prefixes/{prefix_id}",
    tags=["Snapshot Prefixes"]
)
def delete_protocol_snapshot_prefix_endpoint(
    prefix_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db)
):
    """Delete a snapshot prefix"""
    deleted_prefix = crud.delete_protocol_snapshot_prefix(db, prefix_id)
    if not deleted_prefix:
        raise HTTPException(status_code=404, detail="Snapshot prefix not found")
    return {"message": "Snapshot prefix deleted successfully"}


# ------------


@app.post(
    "/protocol_updates/",
    response_model=schemas.ProtocolUpdates,
    tags=["Protocol Updates"],
    summary=["Adds a new protocol update"],
)
def create_protocol_update(
    protocol_update: schemas.ProtocolUpdatesCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("create_protocol_update"):
        logger.info(f"Creating protocol update for {protocol_update.name}")
        db_protocol_update = crud.get_protocol_updates_by_url(
            db,
            url=protocol_update.url,
            name=protocol_update.name,
            client=protocol_update.client,
        )
        if db_protocol_update:
            logger.warning(f"Duplicate update attempted for {protocol_update.name}")
            raise HTTPException(status_code=400, detail="Update already registered")
        return crud.create_protocol_updates(db=db, protocol_update=protocol_update)


@app.get(
    "/protocol_updates/",
    response_model=list[schemas.ProtocolUpdates],
    tags=["Protocol Updates"],
    summary=["Get a list of all protocol updates"],
)
async def read_protocols_update(
    api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    with timer("read_protocols_update"):
        logger.info("Fetching all protocol updates")
        protocol_updates = crud.get_protocol_updates(db)
        return protocol_updates


@app.patch(
    "/protocol_updates/",
    response_model=schemas.ProtocolUpdates,
    tags=["Protocol Updates"],
    summary=["Update a protocol update"],
)
def patch_protocol_update(
    protocol: schemas.ProtocolUpdates,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("patch_protocol_update"):
        logger.info(f"Updating protocol update for ID {protocol.id}")
        db_protocol = crud.patch_protocol_updates(db=db, protocol=protocol)
        logger.info(f"Successfully updated protocol update {db_protocol.id} - protocol name: {db_protocol.name}")
        return db_protocol


@app.get(
    "/protocol_updates/{name_or_id}",
    response_model=Union[list[schemas.ProtocolUpdatesBase], schemas.ProtocolUpdates],
    tags=["Protocol Updates"],
    summary=["Get a list of protocol updates by protocol name or protocol ID"],
)
def get_protocol_update(
    name_or_id: str, api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    with timer("get_protocol_update"):
        logger.info(f"Fetching protocol update for {name_or_id}")
        # Check if the identifier is an integer
        if name_or_id.isdigit():
            update_id = int(name_or_id)
            db_protocol_update = crud.get_protocol_update(db, update_id=update_id)
            if db_protocol_update is None:
                logger.warning(f"Protocol not found for {name_or_id}")
                raise HTTPException(status_code=404, detail="Protocol not found")
            return db_protocol_update

        # Otherwise, treat the identifier as a string (protocol_name)
        db_protocol_update_by_name = crud.get_protocol_updates_by_name(
            db, protocol_name=name_or_id
        )
        if not db_protocol_update_by_name:
            logger.warning(f"Protocol not found for {name_or_id}")
            raise HTTPException(status_code=404, detail="Protocol not found")
        return db_protocol_update_by_name


# @app.get("/protocol_updates/{protocol_name}", response_model=list[schemas.ProtocolUpdatesBase])
# def read_protocol_update_by_name(protocol_name: str, api_key: str = Security(get_api_key), db: Session = Depends(get_db)):
#     db_protocol_update_by_name = crud.get_protocol_updates_by_name(db, protocol_name=protocol_name)
#     if db_protocol_update_by_name is None:
#         raise HTTPException(status_code=404, detail="Protocol not found")
#     return db_protocol_update_by_name
#
#
# @app.get("/protocol_updates/{update_id}", response_model=schemas.ProtocolUpdates)
# def get_protocol_update(update_id: int, api_key: str = Security(get_api_key), db: Session = Depends(get_db)):
#     db_protocol_update = crud.get_protocol_update(
#         db, update_id=update_id
#     )
#     if db_protocol_update is None:
#         raise HTTPException(status_code=404, detail="Protocol not found")
#     return db_protocol_update
#
# @app.get("/protocol_updates/{name}", response_model=schemas.ProtocolUpdates)
# def get_protocol_update_by_name(name: str, api_key: str = Security(get_api_key), db: Session = Depends(get_db)):
#     db_protocol_update_by_name = crud.get_protocol_updates_by_name(db, name=name)
#     if db_protocol_update_by_name is None:
#         raise HTTPException(status_code=404, detail="Protocol not found")
#     return db_protocol_update_by_name


@app.post(
    "/protocol/",
    response_model=schemas.Protocol,
    tags=["Protocols"],
    summary=["Create a new protocol to be tracked"],
)
async def create_protocol(
    protocol: schemas.ProtocolCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("create_protocol"):
        logger.info(f"Creating protocol for {protocol.name}")
        # Check if protocol with same name, network, and chain_id exists
        db_protocol = (
            db.query(models.Protocol)
            .filter(
                models.Protocol.name == protocol.name,
                models.Protocol.network == protocol.network,
                models.Protocol.chain_id == protocol.chain_id
            )
            .first()
        )
        if db_protocol:
            logger.warning(f"Duplicate protocol attempted for {protocol.name} on network {protocol.network} with chain_id {protocol.chain_id}")
            raise HTTPException(status_code=400, detail="Protocol already registered with this name, network, and chain_id")

        # Create new protocol - exclude snapshot_prefixes from dict() to avoid model error
        protocol_data = protocol.dict()
        snapshot_prefixes = protocol_data.pop('snapshot_prefixes', None)
        db_protocol = models.Protocol(**protocol_data)

        # Process logo if provided
        if hasattr(protocol, "logo") and protocol.logo:
            try:
                # Decode base64 logo data
                logo_data = base64.b64decode(protocol.logo)
                # Process and validate image
                processed_logo = process_logo_image(logo_data)
                db_protocol.logo = processed_logo
            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid logo data: {str(e)}"
                )

        db.add(db_protocol)
        db.commit()
        db.refresh(db_protocol)
        
        # Create snapshot prefixes if provided
        if snapshot_prefixes:
            for prefix in snapshot_prefixes:
                if prefix.strip():  # Only create non-empty prefixes
                    prefix_data = schemas.ProtocolSnapshotPrefixCreate(
                        protocol_id=db_protocol.id,
                        prefix=prefix.strip(),
                        is_active=True
                    )
                    crud.create_protocol_snapshot_prefix(db, prefix_data)
                    db.commit()
        
        # Create response object manually to handle logo conversion
        response_protocol = schemas.Protocol(
            id=db_protocol.id,
            name=db_protocol.name,
            chain_id=db_protocol.chain_id,
            explorer=db_protocol.explorer,
            public_rpc=db_protocol.public_rpc,
            proto_family=db_protocol.proto_family,
            bpm=db_protocol.bpm,
            network=db_protocol.network,
            snapshot_prefix=db_protocol.snapshot_prefix,
            logo=base64.b64encode(db_protocol.logo).decode("utf-8") if db_protocol.logo else None
        )
        
        return response_protocol


@app.get(
    "/protocol/",
    response_model=list[schemas.ProtocolBase],
    tags=["Protocols"],
    summary=["Get a list of all tracked protocols"],
)
def read_protocols(
    skip: int = 0,
    limit: int = 1000,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("read_protocols"):
        logger.info("Fetching all protocols")
        protocols = crud.get_protocols(db, skip=skip, limit=limit)
        
        # Convert binary logo data to base64 for response
        result = []
        for protocol in protocols:
            protocol_dict = {
                "id": protocol.id,
                "name": protocol.name,
                "chain_id": protocol.chain_id,
                "explorer": protocol.explorer,
                "public_rpc": protocol.public_rpc,
                "proto_family": protocol.proto_family,
                "bpm": protocol.bpm,
                "network": protocol.network,
                "snapshot_prefix": protocol.snapshot_prefix,
                "logo": base64.b64encode(protocol.logo).decode("utf-8") if protocol.logo else None
            }
            result.append(protocol_dict)
        
        return result


@app.get(
    "/protocol/name/{protocol_name}",
    response_model=list[schemas.ProtocolBase],
    tags=["Protocols"],
    summary=["Get protocols by name"],
)
def read_protocol_by_name(
    protocol_name: str,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("read_protocol_by_name"):
        logger.info(f"Fetching protocol for {protocol_name}")
        db_protocols = crud.get_protocol_by_name(db, protocol_name=protocol_name)
        if db_protocols is None:
            logger.warning(f"Protocol not found for {protocol_name}")
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Convert binary logo data to base64 for response
        result = []
        for protocol in db_protocols:
            protocol_dict = {
                "id": protocol.id,
                "name": protocol.name,
                "chain_id": protocol.chain_id,
                "explorer": protocol.explorer,
                "public_rpc": protocol.public_rpc,
                "proto_family": protocol.proto_family,
                "bpm": protocol.bpm,
                "network": protocol.network,
                "snapshot_prefix": protocol.snapshot_prefix,
                "logo": base64.b64encode(protocol.logo).decode("utf-8") if protocol.logo else None
            }
            result.append(protocol_dict)
        
        return result


@app.get(
    "/protocol/{protocol_id}",
    response_model=schemas.Protocol,
    tags=["Protocols"],
    summary=["Get protocols by ID"],
)
def read_protocol(
    protocol_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("read_protocol"):
        logger.info(f"Fetching protocol for {protocol_id}")
        db_protocol = crud.get_protocol(db, protocol_id=protocol_id)
        if db_protocol is None:
            logger.warning(f"Protocol not found for {protocol_id}")
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Create response with base64-encoded logo
        response_protocol = schemas.Protocol(
            id=db_protocol.id,
            name=db_protocol.name,
            chain_id=db_protocol.chain_id,
            explorer=db_protocol.explorer,
            public_rpc=db_protocol.public_rpc,
            proto_family=db_protocol.proto_family,
            bpm=db_protocol.bpm,
            network=db_protocol.network,
            snapshot_prefix=db_protocol.snapshot_prefix,
            logo=base64.b64encode(db_protocol.logo).decode("utf-8") if db_protocol.logo else None
        )
        return response_protocol


@app.delete(
    "/protocol/{protocol_id}",
    response_model=schemas.ProtocolDelete,
    tags=["Protocols"],
    summary=["Delete protocols from being tracked"],
)
def delete_protocol(
    protocol_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("delete_protocol"):
        logger.info(f"Deleting protocol for {protocol_id}")
        db_protocol = crud.delete_protocol(db, protocol_id=protocol_id)
        if db_protocol is None:
            logger.warning(f"Protocol not removed for {protocol_id}")
            raise HTTPException(status_code=404, detail="Protocol not removed")
        return {"message": "Protocol Deleted Successfully"}


@app.patch(
    "/protocol/{protocol_id}",
    response_model=schemas.Protocol,
    tags=["Protocols"],
    summary=["Update information about tracked protocols"],
)
async def update_protocol(
    protocol_id: int,
    protocol: schemas.ProtocolUpdate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("update_protocol"):
        logger.info(f"Updating protocol for {protocol_id}")
        db_protocol = (
            db.query(models.Protocol).filter(models.Protocol.id == protocol_id).first()
        )
        if not db_protocol:
            logger.warning(f"Protocol not found for {protocol_id}")
            raise HTTPException(status_code=404, detail="Protocol not found")

        update_data = protocol.dict(exclude_unset=True)
        
        # Handle snapshot_prefixes separately
        snapshot_prefixes = update_data.pop('snapshot_prefixes', None)
        
        if "logo" in update_data:
            try:
                if update_data["logo"]:
                    # Decode base64 logo data
                    logo_data = base64.b64decode(update_data["logo"])
                    # Process and validate image
                    processed_logo = process_logo_image(logo_data)
                    db_protocol.logo = processed_logo
                else:
                    # If logo is explicitly set to None, remove the logo
                    db_protocol.logo = None
            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid logo data: {str(e)}"
                )

            # Remove logo from update_data since we've handled it separately
            del update_data["logo"]

        # Update remaining fields
        for field, value in update_data.items():
            setattr(db_protocol, field, value)

        try:
            db.commit()
            db.refresh(db_protocol)
            
            # Handle snapshot prefixes update if provided
            if snapshot_prefixes is not None:
                # Delete existing prefixes
                existing_prefixes = crud.get_protocol_snapshot_prefixes(db, protocol_id)
                for existing_prefix in existing_prefixes:
                    crud.delete_protocol_snapshot_prefix(db, existing_prefix.id)
                
                # Create new prefixes
                for prefix in snapshot_prefixes:
                    if prefix.strip():  # Only create non-empty prefixes
                        prefix_data = schemas.ProtocolSnapshotPrefixCreate(
                            protocol_id=protocol_id,
                            prefix=prefix.strip(),
                            is_active=True
                        )
                        crud.create_protocol_snapshot_prefix(db, prefix_data)
                
                db.commit()

            # Create response object
            response_protocol = schemas.Protocol(
                id=db_protocol.id,
                name=db_protocol.name,
                chain_id=db_protocol.chain_id,
                explorer=db_protocol.explorer,
                public_rpc=db_protocol.public_rpc,
                proto_family=db_protocol.proto_family,
                bpm=db_protocol.bpm,
                network=db_protocol.network,
                snapshot_prefix=db_protocol.snapshot_prefix,
                logo=base64.b64encode(db_protocol.logo).decode("utf-8")
                if db_protocol.logo
                else None,
            )
            return response_protocol
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Error updating protocol: {str(e)}"
            )


@app.get(
    "/protocol/logo/{protocol_name}",
    tags=["Protocols"],
    summary=["Get logo of the protocol by name"],
)
async def get_protocol_logo(
    protocol_name: str,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("get_protocol_logo"):
        logger.info(f"Fetching logo for {protocol_name}")
        try:
            # Case-insensitive search for protocol
            db_protocol = (
                db.query(models.Protocol)
                .filter(models.Protocol.name.ilike(protocol_name))
                .first()
            )

            if not db_protocol:
                logger.warning(f"Protocol not found for {protocol_name}")
                raise HTTPException(
                    status_code=404, detail=f"Protocol not found: {protocol_name}"
                )

            if not db_protocol.logo:
                logger.warning(f"No logo found for {protocol_name}")
                raise HTTPException(
                    status_code=404,
                    detail=f"No logo found for protocol: {protocol_name}",
                )

            # Return raw base64 string without data URI prefix
            try:
                logo_base64 = base64.b64encode(db_protocol.logo)
                return {"logo": logo_base64.decode("utf-8")}
            except Exception as e:
                logger.error(f"Error encoding logo for {protocol_name}: {str(e)}")
                raise HTTPException(
                    status_code=500, detail=f"Error processing logo: {str(e)}"
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting logo for {protocol_name}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


## ---- Client
@app.post(
    "/client/",
    response_model=schemas.Client,
    tags=["Clients"],
    summary=["Create a new client to be tracked"],
)
def create_client(
    client: schemas.ClientCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("create_client"):
        logger.info(f"Creating client for {client.id}")
        db_client = crud.get_client_by_id(db, id=client.id)
        if db_client:
            logger.warning(f"Duplicate client attempted for {client.id}")
            raise HTTPException(status_code=400, detail="Client already registered")
        return crud.create_client(db=db, client=client)


@app.get(
    "/client/",
    response_model=list[schemas.Client],
    tags=["Clients"],
    summary=["Get a list of all tracked clients"],
)
def read_clients(
    skip: int = 0,
    limit: int = 1000,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("read_clients"):
        logger.info("Fetching all clients")
        clients = crud.get_clients(db, skip=skip, limit=limit)
        
        # Convert binary logo data to base64 for response
        result = []
        for client in clients:
            client_dict = {
                "id": client.id,
                "name": client.name,
                "client": client.client,
                "github_url": client.github_url,
                "repo_type": client.repo_type,
                "protocols": []
            }
            
            # Convert protocol logos to base64 if they exist
            if hasattr(client, 'protocols') and client.protocols:
                for protocol in client.protocols:
                    protocol_dict = {
                        "id": protocol.id,
                        "name": protocol.name,
                        "chain_id": protocol.chain_id,
                        "explorer": protocol.explorer,
                        "public_rpc": protocol.public_rpc,
                        "proto_family": protocol.proto_family,
                        "bpm": protocol.bpm,
                        "network": protocol.network,
                        "snapshot_prefix": protocol.snapshot_prefix,
                        "logo": base64.b64encode(protocol.logo).decode("utf-8") if protocol.logo else None
                    }
                    client_dict["protocols"].append(protocol_dict)
            
            result.append(client_dict)
        
        return result


@app.get(
    "/client/{client_name}",
    response_model=list[schemas.ClientBase],
    tags=["Clients"],
    summary=["Get a list of clients by name"],
)
def read_client_by_name(
    client_name: str,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("read_client_by_name"):
        logger.info(f"Fetching client for {client_name}")
        db_client = crud.get_client_by_name(db, client_name=client_name)
        if db_client is None:
            logger.warning(f"Client not found for {client_name}")
            raise HTTPException(status_code=404, detail="Client not found")
        return db_client


@app.get(
    "/client/{client_id}",
    response_model=schemas.Client,
    tags=["Clients"],
    summary=["Get a list of clients by ID"],
)
def read_client(
    client_id: int, api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    with timer("read_client"):
        logger.info(f"Fetching client for {client_id}")
        db_client = crud.get_client(db, client_id=client_id)
        if db_client is None:
            logger.warning(f"Client not found for {client_id}")
            raise HTTPException(status_code=404, detail="Client not found")
        return db_client


@app.delete(
    "/client/{client_id}",
    response_model=schemas.ClientDelete,
    tags=["Clients"],
    summary=["Delete clients by ID"],
)
def delete_client(
    client_id: int, api_key: str = Security(get_api_key), db: Session = Depends(get_db)
):
    with timer("delete_client"):
        logger.info(f"Deleting client for {client_id}")
        db_client = crud.delete_client(db, client_id=client_id)
        if db_client is None:
            logger.warning(f"Client not removed for {client_id}")
            raise HTTPException(status_code=404, detail="Client not removed")
        return {"message": "Client Deleted Successfully"}


@app.patch(
    "/client/{client_id}",
    response_model=schemas.ClientUpdate,
    tags=["Clients"],
    summary=["Update Clients by ID"],
)
def update_client(
    client: schemas.ClientUpdate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("update_client"):
        logger.info(f"Updating client for {client.id}")
        db_client = crud.update_client(db=db, client=client)
        return {"message": "Client Updated Successfully"}


# Protocol-Client Association endpoints
@app.post(
    "/protocols/{protocol_id}/clients",
    tags=["Protocols"],
    summary=["Add a client to a protocol"],
)
def add_client_to_protocol(
    protocol_id: int,
    association: schemas.ProtocolClientAssociationCreate,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("add_client_to_protocol"):
        logger.info(f"Adding client {association.client_id} to protocol {protocol_id}")
        
        # Verify protocol exists
        db_protocol = crud.get_protocol(db, protocol_id)
        if not db_protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Verify client exists
        db_client = crud.get_client(db, association.client_id)
        if not db_client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return crud.add_client_to_protocol(
            db, protocol_id, association.client_id, association.is_primary
        )

@app.delete(
    "/protocols/{protocol_id}/clients/{client_id}",
    tags=["Protocols"],
    summary=["Remove a client from a protocol"],
)
def remove_client_from_protocol(
    protocol_id: int,
    client_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("remove_client_from_protocol"):
        logger.info(f"Removing client {client_id} from protocol {protocol_id}")
        return crud.remove_client_from_protocol(db, protocol_id, client_id)

@app.put(
    "/protocols/{protocol_id}/clients/{client_id}/primary",
    tags=["Protocols"],
    summary=["Set a client as the primary client for a protocol"],
)
def set_primary_client(
    protocol_id: int,
    client_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("set_primary_client"):
        logger.info(f"Setting client {client_id} as primary for protocol {protocol_id}")
        return crud.set_primary_client_for_protocol(db, protocol_id, client_id)

@app.get(
    "/protocols/{protocol_id}/clients",
    response_model=list[schemas.ClientBase],
    tags=["Protocols"],
    summary=["Get all clients associated with a protocol"],
)
def get_protocol_clients(
    protocol_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("get_protocol_clients"):
        logger.info(f"Getting clients for protocol {protocol_id}")
        clients = crud.get_protocol_clients(db, protocol_id)
        return clients

@app.get(
    "/clients/{client_id}/protocols",
    response_model=list[schemas.ProtocolBase],
    tags=["Clients"],
    summary=["Get all protocols associated with a client"],
)
def get_client_protocols(
    client_id: int,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("get_client_protocols"):
        logger.info(f"Getting protocols for client {client_id}")
        protocols = crud.get_client_protocols(db, client_id)
        
        # Convert binary logo data to base64 for response
        result = []
        for protocol in protocols:
            protocol_dict = {
                "id": protocol.id,
                "name": protocol.name,
                "chain_id": protocol.chain_id,
                "explorer": protocol.explorer,
                "public_rpc": protocol.public_rpc,
                "proto_family": protocol.proto_family,
                "bpm": protocol.bpm,
                "network": protocol.network,
                "snapshot_prefix": protocol.snapshot_prefix,
                "logo": base64.b64encode(protocol.logo).decode("utf-8") if protocol.logo else None
            }
            result.append(protocol_dict)
        
        return result

@app.get(
    "/protocol_updates/enriched",
    response_model=list[schemas.ProtocolUpdates],
    tags=["Protocol Updates"],
    summary=["Get protocol updates with client and protocol information"],
)
def get_protocol_updates_enriched(
    skip: int = 0,
    limit: int = 100,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    with timer("get_protocol_updates_enriched"):
        logger.info("Getting enriched protocol updates")
        updates = crud.get_protocol_updates_enriched(db, skip, limit)
        return updates

# Admin System endpoints
# @app.get(
#     "/admin/system-status",
#     tags=["Admin"],
#     summary="Get system status"
# )
# def get_admin_system_status():
#     return Response(status_code=200)

# Admin user management endpoints
@app.get(
    "/admin/users",
    response_model=schemas.AdminUsersResponse,
    tags=["Admin"],
    summary="Get paginated list of users"
)
async def get_admin_users(
    page: int = 1,
    limit: int = 20,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated list of users (admin only)"""
    with timer("get_admin_users"):
        logger.info(f"Admin {admin_user.email} fetching users (page {page})")
        result = crud.get_users_paginated(db, page=page, limit=limit)
        return schemas.AdminUsersResponse(
            users=[schemas.AdminUser.model_validate(user) for user in result["users"]],
            total=result["total"],
            pages=result["pages"]
        )

@app.post(
    "/admin/users",
    response_model=schemas.AdminUser,
    tags=["Admin"],
    summary="Create new user"
)
async def create_admin_user_endpoint(
    user: schemas.AdminUserCreate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    with timer("create_admin_user"):
        logger.info(f"Admin {admin_user.email} creating user {user.email}")
        
        # Check if user already exists
        existing_user = db.query(models.Users).filter(
            (models.Users.email == user.email) | (models.Users.username == user.username)
        ).first()
        
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email or username already exists")
        
        db_user = crud.create_admin_user(db=db, user=user)
        return schemas.AdminUser.model_validate(db_user)

@app.patch(
    "/admin/users/{user_id}",
    response_model=schemas.AdminUser,
    tags=["Admin"],
    summary="Update user"
)
async def update_admin_user_endpoint(
    user_id: int,
    user_update: schemas.AdminUserUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update user (admin only)"""
    with timer("update_admin_user"):
        logger.info(f"Admin {admin_user.email} updating user {user_id}")
        
        # Prevent admins from removing their own admin status
        if user_id == admin_user.id and user_update.is_admin is False:
            raise HTTPException(status_code=400, detail="Cannot remove admin status from yourself")
        
        db_user = crud.update_admin_user(db=db, user_id=user_id, user_update=user_update)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return schemas.AdminUser.model_validate(db_user)

@app.delete(
    "/admin/users/{user_id}",
    tags=["Admin"],
    summary="Delete user"
)
async def delete_admin_user_endpoint(
    user_id: int,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete user (admin only)"""
    with timer("delete_admin_user"):
        logger.info(f"Admin {admin_user.email} deleting user {user_id}")
        
        # Prevent admins from deleting themselves
        if user_id == admin_user.id:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
        db_user = crud.delete_admin_user(db=db, user_id=user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User deleted successfully"}

@app.patch(
    "/admin/users/{user_id}/toggle-status",
    response_model=schemas.AdminUser,
    tags=["Admin"],
    summary="Toggle user active status"
)
async def toggle_user_status_endpoint(
    user_id: int,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Toggle user active status (admin only)"""
    with timer("toggle_user_status"):
        logger.info(f"Admin {admin_user.email} toggling status for user {user_id}")
        
        # Prevent admins from deactivating themselves
        if user_id == admin_user.id:
            raise HTTPException(status_code=400, detail="Cannot change your own status")
        
        db_user = crud.toggle_user_status(db=db, user_id=user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return schemas.AdminUser.model_validate(db_user)


# GitHub API Configuration endpoints
@app.get(
    "/admin/github-config",
    response_model=Union[schemas.GitHubConfig, None],
    tags=["Admin"],
    summary="Get GitHub API configuration"
)
async def get_github_config_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get GitHub API configuration (admin only)"""
    with timer("get_github_config"):
        logger.info(f"Admin {admin_user.email} getting GitHub config")
        config = crud.get_github_config(db=db)
        return config


@app.post(
    "/admin/github-config",
    response_model=schemas.GitHubConfig,
    tags=["Admin"],
    summary="Create or update GitHub API configuration"
)
async def create_github_config_endpoint(
    config: schemas.GitHubConfigCreate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create or update GitHub API configuration (admin only)"""
    with timer("create_github_config"):
        logger.info(f"Admin {admin_user.email} creating/updating GitHub config")
        db_config = crud.create_github_config(db=db, config=config)
        return db_config


@app.patch(
    "/admin/github-config",
    response_model=schemas.GitHubConfig,
    tags=["Admin"],
    summary="Update GitHub API configuration"
)
async def update_github_config_endpoint(
    config: schemas.GitHubConfigUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update GitHub API configuration (admin only)"""
    with timer("update_github_config"):
        logger.info(f"Admin {admin_user.email} updating GitHub config")
        db_config = crud.update_github_config(db=db, config=config)
        return db_config

# Background Poller endpoints
@app.post(
    "/admin/poller/start",
    tags=["Admin"],
    summary="Start the background GitHub poller"
)
async def start_background_poller(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Start the background GitHub polling service (admin only)"""
    from services.background_poller import background_poller
    
    with timer("start_background_poller"):
        logger.info(f"Admin {admin_user.email} starting background poller")
        result = await background_poller.start(db)
        return result

@app.post(
    "/admin/poller/stop", 
    tags=["Admin"],
    summary="Stop the background GitHub poller"
)
async def stop_background_poller(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Stop the background GitHub polling service (admin only)"""
    from services.background_poller import background_poller
    
    with timer("stop_background_poller"):
        logger.info(f"Admin {admin_user.email} stopping background poller")
        result = await background_poller.stop(db)
        return result

@app.get(
    "/admin/poller/status",
    tags=["Admin"], 
    summary="Get background poller status"
)
async def get_background_poller_status(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get the status of the background GitHub polling service (admin only)"""
    from services.background_poller import background_poller
    
    with timer("get_background_poller_status"):
        result = await background_poller.get_status(db)
        return result

@app.post(
    "/admin/poller/poll-now",
    tags=["Admin"],
    summary="Run a manual poll immediately"
)
async def manual_poll_now(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Run a manual GitHub poll immediately (admin only)"""
    from services.background_poller import background_poller
    
    with timer("manual_poll_now"):
        logger.info(f"Admin {admin_user.email} running manual poll")
        result = await background_poller.poll_now(db)
        return result

# System configuration and status endpoints
@app.get(
    "/admin/system-config",
    response_model=Union[schemas.SystemConfig, None],
    tags=["Admin"],
    summary="Get system configuration"
)
def get_system_config_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system configuration"""
    with timer("get_system_config"):
        return crud.get_or_create_system_config(db)

@app.patch(
    "/admin/system-config",
    response_model=schemas.SystemConfig,
    tags=["Admin"], 
    summary="Update system configuration"
)
def update_system_config_endpoint(
    config_update: schemas.SystemConfigUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update system configuration"""
    with timer("update_system_config"):
        # Get existing config or create default
        existing_config = crud.get_or_create_system_config(db)
        
        # Update with new values
        updated_config = crud.update_system_config(db, existing_config.id, config_update)
        if not updated_config:
            raise HTTPException(status_code=404, detail="System configuration not found")
            
        return updated_config

@app.get(
    "/admin/system-status",
    response_model=schemas.SystemStatus,
    tags=["Admin"],
    summary="Get system status"
)
def get_system_status_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system status"""
    with timer("get_system_status"):
        import psutil
        import time
        from datetime import datetime
        from sqlalchemy import text
        
        # Get container/process metrics (more appropriate for Docker)
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            cpu = psutil.cpu_percent(interval=0.1)  # Shorter interval for faster response
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            memory = None
            disk = None
            cpu = 0
        
        # Calculate application uptime (since container started, not system boot)
        try:
            # Get current process (the FastAPI app)
            current_process = psutil.Process()
            app_start_time = current_process.create_time()
            uptime = time.time() - app_start_time
        except Exception:
            # Fallback to a reasonable default
            uptime = 0
        
        # Test database connection with proper SQL
        try:
            result = db.execute(text("SELECT 1")).fetchone()
            db_status = "healthy" if result else "error"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            db_status = "error"
        
        # Get more realistic metrics
        memory_percent = memory.percent if memory else 0
        disk_percent = disk.percent if disk else 0
        
        # Determine overall status with more reasonable thresholds
        if db_status == "error":
            status = "error"
        elif memory_percent > 90 or disk_percent > 95 or cpu > 90:
            status = "error"
        elif memory_percent > 75 or disk_percent > 85 or cpu > 75:
            status = "warning"  
        else:
            status = "healthy"
        
        return schemas.SystemStatus(
            status=status,
            uptime=uptime,
            version="1.0.0",  # Could be made dynamic
            database_status=db_status,
            memory_usage=memory_percent,
            disk_usage=disk_percent,
            cpu_usage=cpu,
            active_connections=1,  # Could be improved with actual connection count
            last_backup=None  # Could be implemented when backup feature is added
        )

# Background scanner endpoints
@app.post(
    "/admin/scanner/start",
    tags=["Admin"],
    summary="Start background snapshot scanner"
)
async def start_background_scanner(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Start background snapshot scanner (admin only)"""
    from services.background_scanner import background_scanner
    
    with timer("start_background_scanner"):
        logger.info(f"Admin {admin_user.email} starting background scanner")
        result = await background_scanner.start(db)
        return result

@app.post(
    "/admin/scanner/stop", 
    tags=["Admin"],
    summary="Stop background snapshot scanner"
)
async def stop_background_scanner(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Stop background snapshot scanner (admin only)"""
    from services.background_scanner import background_scanner
    
    with timer("stop_background_scanner"):
        logger.info(f"Admin {admin_user.email} stopping background scanner")
        result = await background_scanner.stop(db)
        return result

@app.get(
    "/admin/scanner/status",
    tags=["Admin"],
    summary="Get background scanner status"
)
async def get_background_scanner_status(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get background snapshot scanner status (admin only)"""
    from services.background_scanner import background_scanner
    
    with timer("get_background_scanner_status"):
        result = await background_scanner.get_status(db)
        return result

@app.post(
    "/admin/scanner/scan-now",
    tags=["Admin"],
    summary="Run manual snapshot scan"
)
async def manual_scan_now(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Run a manual snapshot scan immediately (admin only)"""
    from services.background_scanner import background_scanner
    
    with timer("manual_scan_now"):
        logger.info(f"Admin {admin_user.email} running manual scan")
        result = await background_scanner.scan_now(db)
        return result

# Notification configuration endpoints
@app.get(
    "/admin/notification-config",
    response_model=Union[schemas.NotificationConfig, None],
    tags=["Admin"],
    summary="Get notification configuration"
)
def get_notification_config_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get notification configuration"""
    with timer("get_notification_config"):
        return crud.get_or_create_notification_config(db)

@app.patch(
    "/admin/notification-config",
    response_model=schemas.NotificationConfig,
    tags=["Admin"],
    summary="Update notification configuration"
)
def update_notification_config_endpoint(
    config_update: schemas.NotificationConfigUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update notification configuration"""
    with timer("update_notification_config"):
        # Get existing config or create default
        existing_config = crud.get_or_create_notification_config(db)
        
        # Update with new values
        updated_config = crud.update_notification_config(db, existing_config.id, config_update)
        if not updated_config:
            raise HTTPException(status_code=404, detail="Notification configuration not found")
            
        return updated_config

# AI Configuration endpoints
@app.get(
    "/admin/ai-config",
    response_model=Union[schemas.AIConfig, None],
    tags=["Admin"],
    summary="Get AI configuration"
)
def get_ai_config_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get AI configuration (admin only)"""
    with timer("get_ai_config"):
        return crud.get_or_create_ai_config(db)

@app.post(
    "/admin/ai-config",
    response_model=schemas.AIConfig,
    tags=["Admin"],
    summary="Create or update AI configuration"
)
def create_ai_config_endpoint(
    config: schemas.AIConfigCreate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create or update AI configuration (admin only)"""
    with timer("create_ai_config"):
        # Check if config already exists
        existing_config = crud.get_ai_config(db)
        if existing_config:
            # Update existing config
            updated_config = crud.update_ai_config(db, existing_config.id, schemas.AIConfigUpdate(**config.model_dump()))
            return updated_config
        else:
            # Create new config
            return crud.create_ai_config(db, config)

@app.patch(
    "/admin/ai-config",
    response_model=schemas.AIConfig,
    tags=["Admin"],
    summary="Update AI configuration"
)
def update_ai_config_endpoint(
    config: schemas.AIConfigUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update AI configuration (admin only)"""
    with timer("update_ai_config"):
        # Get existing config or create default
        existing_config = crud.get_or_create_ai_config(db)
        
        # Update with new values
        updated_config = crud.update_ai_config(db, existing_config.id, config)
        if not updated_config:
            raise HTTPException(status_code=404, detail="AI configuration not found")
            
        return updated_config

@app.post(
    "/admin/ai-config/test",
    tags=["Admin"],
    summary="Test AI configuration"
)
async def test_ai_config_endpoint(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Test AI configuration by running a simple analysis"""
    with timer("test_ai_config"):
        from services.ai_service import AIService, AIProvider
        
        ai_config = crud.get_ai_config(db)
        if not ai_config or not ai_config.ai_enabled:
            raise HTTPException(status_code=400, detail="AI is not enabled")
        
        if not ai_config.api_key:
            raise HTTPException(status_code=400, detail="AI API key not configured")
        
        try:
            # Initialize AI service
            provider = AIProvider(ai_config.provider)
            ai_service = AIService(
                provider=provider,
                api_key=ai_config.api_key,
                model=ai_config.model,
                base_url=ai_config.base_url
            )
            
            # Test with a simple release note
            test_notes = """
            This release includes important bug fixes and performance improvements.
            - Fixed memory leak in transaction processing
            - Improved sync performance by 20%
            - Updated dependencies for security patches
            """
            
            result = await ai_service.analyze_release_notes(
                protocol_name="Test Protocol",
                client_name="Test Client", 
                release_title="Test Release v1.0.0",
                release_notes=test_notes,
                tag_name="v1.0.0"
            )
            
            if result:
                return {
                    "status": "success",
                    "message": "AI analysis test completed successfully",
                    "test_result": {
                        "summary": result.summary[:100] + "..." if result.summary and len(result.summary) > 100 else result.summary,
                        "confidence_score": result.confidence_score,
                        "upgrade_priority": result.upgrade_priority
                    }
                }
            else:
                return {
                    "status": "error",
                    "message": "AI analysis failed - no result returned"
                }
                
        except Exception as e:
            logger.error(f"AI configuration test failed: {e}")
            return {
                "status": "error",
                "message": f"AI configuration test failed: {str(e)}"
            }

# AI Analysis endpoints
@app.post(
    "/ai/analyze-update/{update_id}",
    response_model=schemas.AIAnalysisResult,
    tags=["AI"],
    summary="Analyze protocol update with AI"
)
async def analyze_protocol_update_endpoint(
    update_id: int,
    force_reanalyze: bool = False,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze a protocol update with AI"""
    with timer("analyze_protocol_update"):
        from services.ai_service import AIService, AIProvider
        
        # Get the protocol update
        protocol_update = crud.get_protocol_update(db, update_id)
        if not protocol_update:
            raise HTTPException(status_code=404, detail="Protocol update not found")
        
        # Check if analysis already exists and force_reanalyze is False
        if not force_reanalyze and protocol_update.ai_summary:
            # Return existing analysis
            return schemas.AIAnalysisResult(
                summary=protocol_update.ai_summary,
                key_changes=protocol_update.ai_key_changes or [],
                breaking_changes=protocol_update.ai_breaking_changes or [],
                security_updates=protocol_update.ai_security_updates or [],
                upgrade_priority=protocol_update.ai_upgrade_priority,
                risk_assessment=protocol_update.ai_risk_assessment,
                technical_summary=protocol_update.ai_technical_summary,
                executive_summary=protocol_update.ai_executive_summary,
                estimated_impact=protocol_update.ai_estimated_impact,
                confidence_score=protocol_update.ai_confidence_score,
                is_hard_fork=protocol_update.hard_fork,
                hard_fork_details=protocol_update.ai_hard_fork_details,
                activation_block=protocol_update.activation_block,
                activation_date=protocol_update.activation_date,
                coordination_required=protocol_update.coordination_required,
                analysis_date=protocol_update.ai_analysis_date,
                provider=protocol_update.ai_provider
            )
        
        # Get AI configuration
        ai_config = crud.get_ai_config(db)
        if not ai_config or not ai_config.ai_enabled:
            raise HTTPException(status_code=400, detail="AI analysis is not enabled")
        
        if not ai_config.api_key:
            raise HTTPException(status_code=400, detail="AI API key not configured")
        
        try:
            # Initialize AI service
            provider = AIProvider(ai_config.provider)
            ai_service = AIService(
                provider=provider,
                api_key=ai_config.api_key,
                model=ai_config.model,
                base_url=ai_config.base_url
            )
            
            # Run AI analysis
            result = await ai_service.analyze_release_notes(
                protocol_name=protocol_update.name or "Unknown Protocol",
                client_name=protocol_update.client or "Unknown Client",
                release_title=protocol_update.title or protocol_update.tag or "Unknown Release",
                release_notes=protocol_update.notes or "",
                tag_name=protocol_update.tag or "unknown",
                is_prerelease=protocol_update.is_prerelease or False
            )
            
            if result:
                # Save analysis results to database
                crud.update_protocol_update_ai_analysis(db, update_id, result)
                
                # Return the analysis result
                return schemas.AIAnalysisResult(
                    summary=result.summary,
                    key_changes=result.key_changes,
                    breaking_changes=result.breaking_changes,
                    security_updates=result.security_updates,
                    upgrade_priority=result.upgrade_priority,
                    risk_assessment=result.risk_assessment,
                    technical_summary=result.technical_summary,
                    executive_summary=result.executive_summary,
                    estimated_impact=result.estimated_impact,
                    confidence_score=result.confidence_score,
                    is_hard_fork=result.is_hard_fork,
                    hard_fork_details=result.hard_fork_details,
                    activation_block=result.activation_block,
                    activation_date=result.activation_date,
                    coordination_required=result.coordination_required,
                    analysis_date=datetime.utcnow(),
                    provider=ai_config.provider
                )
            else:
                raise HTTPException(status_code=500, detail="AI analysis failed to produce results")
                
        except Exception as e:
            logger.error(f"AI analysis failed for update {update_id}: {e}")
            raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@app.get(
    "/ai/analysis/{update_id}",
    response_model=Union[schemas.AIAnalysisResult, None],
    tags=["AI"],
    summary="Get AI analysis for protocol update"
)
def get_ai_analysis_endpoint(
    update_id: int,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI analysis for a protocol update"""
    with timer("get_ai_analysis"):
        analysis = crud.get_protocol_update_ai_analysis(db, update_id)
        if not analysis:
            return None
        
        return schemas.AIAnalysisResult(**analysis)

# AI Feedback endpoints
@app.post(
    "/ai/feedback",
    response_model=schemas.AIAnalysisFeedback,
    tags=["AI"],
    summary="Submit feedback for AI analysis"
)
def submit_ai_feedback_endpoint(
    feedback: schemas.AIAnalysisFeedbackCreate,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit feedback for AI analysis"""
    with timer("submit_ai_feedback"):
        return crud.create_ai_analysis_feedback(db, feedback, current_user.id)

@app.get(
    "/ai/feedback/{update_id}",
    response_model=List[schemas.AIAnalysisFeedback],
    tags=["AI"],
    summary="Get feedback for AI analysis"
)
def get_ai_feedback_endpoint(
    update_id: int,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all feedback for an AI analysis"""
    with timer("get_ai_feedback"):
        return crud.get_ai_analysis_feedback(db, update_id)

@app.post(
    "/admin/test-webhook",
    tags=["Admin"],
    summary="Test a webhook configuration"
)
async def test_webhook_endpoint(
    webhook_test: schemas.WebhookTest,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Test a webhook configuration"""
    with timer("test_webhook"):
        from services.notification_service import NotificationService
        
        notification_service = NotificationService()
        success = await notification_service.test_webhook(
            webhook_test.webhook_type,
            webhook_url=webhook_test.webhook_url,
            bot_token=webhook_test.bot_token,
            chat_id=webhook_test.chat_id,
            headers=webhook_test.headers
        )
        
        return {
            "success": success,
            "message": "Webhook test successful" if success else "Webhook test failed"
        }

# Client notification settings endpoints
@app.get(
    "/admin/clients/notification-settings",
    response_model=List[Dict[str, Any]],
    tags=["Admin"],
    summary="Get all clients with their notification settings"
)
def get_all_client_notification_settings(
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all clients with their notification settings"""
    with timer("get_all_client_notification_settings"):
        clients = crud.get_all_clients_with_notification_settings(db)
        result = []
        
        for client in clients:
            settings = crud.get_or_create_client_notification_settings(db, client.id)
            result.append({
                "client_id": client.id,
                "client_name": client.name,
                "client_string": client.client,
                "github_url": client.github_url,
                "notifications_enabled": settings.notifications_enabled
            })
        
        return result

@app.patch(
    "/admin/clients/{client_id}/notification-settings",
    response_model=schemas.ClientNotificationSettings,
    tags=["Admin"],
    summary="Update client notification settings"
)
def update_client_notification_settings_endpoint(
    client_id: int,
    settings_update: schemas.ClientNotificationSettingsUpdate,
    admin_user: models.Users = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update notification settings for a specific client"""
    with timer("update_client_notification_settings"):
        # Verify client exists
        client = crud.get_client(db, client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Update or create notification settings
        updated_settings = crud.update_client_notification_settings(db, client_id, settings_update)
        return updated_settings

# Profile management endpoints
@app.get(
    "/profile",
    response_model=schemas.UserProfile,
    tags=["Profile"],
    summary="Get current user profile"
)
def get_user_profile(
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile information"""
    with timer("get_user_profile"):
        logger.info(f"User {current_user.email} fetching profile")
        profile = crud.get_user_profile(db, current_user.id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return profile

# Profile management endpoints
@app.get(
    "/auth/me",
    response_model=schemas.UserProfile,
    tags=["Auth"],
    summary="Get current user profile"
)
def get_user_profile(
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile information"""
    with timer("get_user_profile"):
        logger.info(f"User {current_user.email} fetching profile")
        profile = crud.get_user_profile(db, current_user.id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return profile

@app.get(
    "/profile/api-keys",
    response_model=list[schemas.ProfileApiKey],
    tags=["Profile"],
    summary="Get user's API keys"
)
def get_user_api_keys(
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's API keys"""
    with timer("get_user_api_keys"):
        logger.info(f"User {current_user.email} fetching API keys")
        return crud.get_user_api_keys(db, current_user.id)

@app.post(
    "/profile/api-keys",
    response_model=schemas.ProfileApiKeyResponse,
    tags=["Profile"],
    summary="Create new API key"
)
def create_user_api_key(
    api_key_data: schemas.ProfileApiKeyCreate,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key for the current user"""
    with timer("create_user_api_key"):
        logger.info(f"User {current_user.email} creating API key: {api_key_data.name}")
        return crud.create_user_api_key(db, current_user.id, api_key_data)

@app.delete(
    "/profile/api-keys/{key_id}",
    tags=["Profile"],
    summary="Delete API key"
)
def delete_user_api_key(
    key_id: int,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key for the current user"""
    with timer("delete_user_api_key"):
        logger.info(f"User {current_user.email} deleting API key: {key_id}")
        success = crud.delete_user_api_key(db, current_user.id, key_id)
        if not success:
            raise HTTPException(status_code=404, detail="API key not found")
        return {"message": "API key deleted successfully"}

@app.get(
    "/profile/api-keys/{key_id}/full",
    response_model=dict,
    tags=["Profile"],
    summary="Get full API key value"
)
def get_full_api_key(
    key_id: int,
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the full API key value for copying to clipboard"""
    with timer("get_full_api_key"):
        logger.info(f"User {current_user.email} accessing full API key: {key_id}")
        result = crud.get_full_api_key(db, current_user.id, key_id)
        if not result:
            raise HTTPException(status_code=404, detail="API key not found or inactive")
        return result

# Authentication Endpoints
@app.post(
    "/auth/google",
    response_model=schemas.LoginResponse,
    tags=["Authentication"],
    summary="Login with Google OAuth"
)
def login_with_google(
    oauth_request: schemas.GoogleOAuthRequest,
    db: Session = Depends(get_db)
):
    """Login with Google OAuth"""
    with timer("google_oauth_login"):
        logger.info("Processing Google OAuth login")
        
        # Verify Google access token
        google_user_info = verify_google_token(oauth_request.access_token)
        logger.info(f"Verified Google user: {google_user_info.get('email')}")
        
        # Create or get user
        user = create_or_get_user_from_google(db, google_user_info)
        
        # Create API key for user
        api_key = create_api_key_for_user(db, user)
        
        # Create user profile response
        user_profile = schemas.UserProfile(
            id=user.id,
            email=user.email,
            username=getattr(user, 'username', None),
            name=f"{user.first_name} {user.last_name}" if user.first_name and user.last_name else (getattr(user, 'username', None) or user.email),
            first_name=user.first_name,
            last_name=user.last_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            picture=user.picture,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
        logger.info(f"User {user.email} logged in successfully")
        
        return schemas.LoginResponse(
            user=user_profile,
            api_key=api_key,
            expires_in=86400  # 24 hours
        )

@app.get(
    "/auth/me",
    response_model=schemas.UserProfile,
    tags=["Authentication"],
    summary="Get current user information"
)
def get_current_user_info(
    current_user: models.Users = Depends(get_current_user)
):
    """Get current authenticated user information"""
    with timer("get_current_user_info"):
        return schemas.UserProfile(
            id=current_user.id,
            email=current_user.email,
            username=getattr(current_user, 'username', None),
            name=f"{current_user.first_name} {current_user.last_name}" if current_user.first_name and current_user.last_name else (getattr(current_user, 'username', None) or current_user.email),
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            is_admin=current_user.is_admin,
            is_active=current_user.is_active,
            picture=current_user.picture,
            created_at=current_user.created_at,
            last_login=current_user.last_login
        )

@app.post(
    "/auth/logout",
    tags=["Authentication"],
    summary="Logout user"
)
def logout_user(
    current_user: models.Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout current user"""
    with timer("logout_user"):
        logger.info(f"User {current_user.email} logging out")
        # Could implement token revocation logic here if needed
        return {"message": "Successfully logged out"}

# Initial setup endpoint (bypasses API key requirement)
@app.post(
    "/setup/initialize",
    tags=["Setup"],
    summary="Initialize system without API key requirement"
)
def initialize_system(
    setup_request: schemas.InitialSetupRequest,
    db: Session = Depends(get_db)
):
    """Initialize system for first-time setup"""
    with timer("initialize_system"):
        if setup_request.action == "get_status":
            # Check if any users exist
            user_count = db.query(models.Users).count()
            api_key_count = db.query(models.ApiKey).count()
            
            return {
                "needs_setup": user_count == 0,
                "has_users": user_count > 0,
                "has_api_keys": api_key_count > 0,
                "user_count": user_count
            }
        
        elif setup_request.action == "create_admin" and setup_request.admin_data:
            # Check if any users exist (only allow if no users)
            user_count = db.query(models.Users).count()
            if user_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="System already initialized"
                )
            
            admin_data = setup_request.admin_data
            
            # Create admin user
            admin_user = models.Users(
                username=admin_data.get("username", admin_data.get("email")),
                email=admin_data["email"],
                first_name=admin_data.get("first_name"),
                last_name=admin_data.get("last_name"),
                is_admin=True,
                is_active=True
            )
            
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            
            # Create API key for admin
            api_key = create_api_key_for_user(db, admin_user)
            
            logger.info(f"System initialized with admin user: {admin_user.email}")
            
            return {
                "message": "System initialized successfully",
                "admin_user": admin_user.email,
                "api_key": api_key
            }
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid setup action"
            )


@app.post("/rpc/proxy")
async def proxy_rpc_request(
    request: Request,
    api_key: str = Security(get_api_key),
):
    """Proxy RPC requests to external servers to bypass CORS restrictions"""
    with timer("proxy_rpc_request"):
        import requests as python_requests
        
        # Get the request body
        body = await request.json()
        
        # Get target RPC URL from request headers
        rpc_url = request.headers.get("X-RPC-URL")
        if not rpc_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing X-RPC-URL header"
            )
        
        try:
            # Forward the request to the external RPC server
            response = python_requests.post(
                rpc_url,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Proto-Tracker-Proxy/1.0"
                },
                timeout=30
            )
            
            # Return the response as JSON
            return response.json()
            
        except python_requests.exceptions.RequestException as e:
            logger.error(f"RPC proxy request failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"RPC request failed: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error in RPC proxy: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

