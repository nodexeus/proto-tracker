from typing import Union, Annotated

from fastapi import Depends, FastAPI, HTTPException, status, Security, File, UploadFile
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

import crud, models, schemas
from database import SessionLocal, engine

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


# Create tables at startup if they don't exist
logger.info("Creating database tables...")
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
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
        raise HTTPException(status_code=404, detail="S3 storage configuration not found")
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

    # Use protocol name to match against snapshot paths
    protocol_name = protocol.name.lower()
    logger.info(f"Scanning snapshots for protocol {protocol.name}")

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

        # List all top-level directories that start with the protocol name
        paginator = client.get_paginator("list_objects_v2")
        prefix = f"{protocol_name}-"

        logger.info(f"Looking for snapshots with prefix: {prefix}")
        
        try:
            # Get all directories that start with our protocol name
            for page in paginator.paginate(
                Bucket=config.bucket_name, Prefix=prefix, Delimiter="/"
            ):
                if "CommonPrefixes" not in page:
                    logger.info("No matching protocol directories found")
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

                                        new_snapshot = models.SnapshotIndex(
                                            protocol_id=protocol_id,
                                            snapshot_id=snapshot_key,
                                            index_file_path=manifest_path,
                                            file_count=len(paths),
                                            total_size=0,  # We'll need to calculate this from the manifest
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
            logger.error(f"Error scanning snapshots: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Error scanning snapshots: {str(e)}"
            )

        # Create or update snapshot entries
        new_snapshots = []
        logger.info(f"Found {len(snapshot_info)} total snapshots to process")

        for snapshot_key, info in snapshot_info.items():
            # Check if this snapshot is already indexed
            existing = crud.get_snapshot_by_id(db, snapshot_key, protocol_id)
            if existing:
                logger.debug(f"Snapshot already exists: {snapshot_key}")
                continue

            logger.info(f"Creating new snapshot index for {snapshot_key}")
            # Create new snapshot index
            snapshot = schemas.SnapshotIndexCreate(
                protocol_id=protocol_id,
                snapshot_id=info["prefix"],  # Use the full prefix as the snapshot ID
                index_file_path=info["manifest_path"],
                file_count=len(info["paths"]),
                total_size=0,  # We could sum up sizes if needed
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


@app.get(
    "/protocols/{protocol_id}/snapshots", 
    response_model=list[schemas.SnapshotIndexSummary],
   tags=["Snapshots"]
)
def list_protocol_snapshots(
    protocol_id: int,
    skip: int = 0,
    limit: int = 100,
    api_key: str = Security(get_api_key),
    db: Session = Depends(get_db),
):
    """List all snapshots for a protocol (lightweight version without file paths)."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    return crud.get_protocol_snapshots_summary(db, protocol_id, skip, limit)


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

        # Create new protocol
        db_protocol = models.Protocol(**protocol.dict())

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
        return db_protocol


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
        return clients


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