from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from fastapi import HTTPException
from datetime import datetime

import models, schemas
from pprint import pprint


def get_protocol_updates(db: Session):
    return (db.query(models.ProtocolUpdates).all())


def get_protocol_updates_by_name(db: Session, protocol_name: str):
    return db.query(models.ProtocolUpdates).filter(models.ProtocolUpdates.name == protocol_name).all()



def get_protocol_updates_by_url(db: Session, url: str, name: str, client: str):
    return (
        db.query(models.ProtocolUpdates)
        .filter(models.ProtocolUpdates.url == url)
        .filter(models.ProtocolUpdates.name == name)
        .filter(models.ProtocolUpdates.client == client)
        .first()
    )


def get_protocol_update(db: Session, update_id: id):
    return db.query(models.ProtocolUpdates).filter(models.ProtocolUpdates.id == update_id).first()



def get_protocol_update_by_tag(db: Session, client_string: str, tag: str):
    """Check if a protocol update already exists for a given client and tag"""
    return db.query(models.ProtocolUpdates).filter(
        models.ProtocolUpdates.client == client_string,
        models.ProtocolUpdates.tag == tag
    ).first()

# System Configuration CRUD operations
def get_system_config(db: Session):
    """Get system configuration (should only be one record)"""
    return db.query(models.SystemConfig).first()

def create_system_config(db: Session, config: schemas.SystemConfigCreate):
    """Create system configuration"""
    db_config = models.SystemConfig(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_system_config(db: Session, config_id: int, config: schemas.SystemConfigUpdate):
    """Update system configuration"""
    db_config = db.query(models.SystemConfig).filter(models.SystemConfig.id == config_id).first()
    if db_config:
        update_data = config.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_config, field, value)
        db.commit()
        db.refresh(db_config)
    return db_config

def get_or_create_system_config(db: Session):
    """Get system config or create default one if none exists"""
    config = get_system_config(db)
    if not config:
        config = create_system_config(db, schemas.SystemConfigCreate())
    return config

# Notification Configuration CRUD operations
def get_notification_config(db: Session):
    """Get notification configuration (should only be one record)"""
    return db.query(models.NotificationConfig).first()

def create_notification_config(db: Session, config: schemas.NotificationConfigCreate):
    """Create notification configuration"""
    db_config = models.NotificationConfig(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_notification_config(db: Session, config_id: int, config: schemas.NotificationConfigUpdate):
    """Update notification configuration"""
    db_config = db.query(models.NotificationConfig).filter(models.NotificationConfig.id == config_id).first()
    if db_config:
        update_data = config.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_config, field, value)
        db.commit()
        db.refresh(db_config)
    return db_config

def get_or_create_notification_config(db: Session):
    """Get notification config or create default one if none exists"""
    config = get_notification_config(db)
    if not config:
        config = create_notification_config(db, schemas.NotificationConfigCreate())
    return config

# Client Notification Settings CRUD operations
def get_client_notification_settings(db: Session, client_id: int):
    """Get notification settings for a specific client"""
    return db.query(models.ClientNotificationSettings).filter(
        models.ClientNotificationSettings.client_id == client_id
    ).first()

def create_client_notification_settings(db: Session, settings: schemas.ClientNotificationSettingsCreate):
    """Create notification settings for a client"""
    db_settings = models.ClientNotificationSettings(**settings.model_dump())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def update_client_notification_settings(db: Session, client_id: int, settings: schemas.ClientNotificationSettingsUpdate):
    """Update notification settings for a client"""
    db_settings = db.query(models.ClientNotificationSettings).filter(
        models.ClientNotificationSettings.client_id == client_id
    ).first()
    
    if not db_settings:
        # Create new settings if they don't exist
        create_data = schemas.ClientNotificationSettingsCreate(
            client_id=client_id,
            notifications_enabled=settings.notifications_enabled if settings.notifications_enabled is not None else True
        )
        return create_client_notification_settings(db, create_data)
    
    # Update existing settings
    update_data = settings.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_settings, field, value)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def get_or_create_client_notification_settings(db: Session, client_id: int):
    """Get client notification settings or create default ones if they don't exist"""
    settings = get_client_notification_settings(db, client_id)
    if not settings:
        create_data = schemas.ClientNotificationSettingsCreate(
            client_id=client_id,
            notifications_enabled=True
        )
        settings = create_client_notification_settings(db, create_data)
    return settings

def get_all_clients_with_notification_settings(db: Session):
    """Get all clients with their notification settings"""
    return db.query(models.Client).outerjoin(
        models.ClientNotificationSettings
    ).all()

def create_protocol_updates(
    db: Session, protocol_update: schemas.ProtocolUpdatesCreate
):
    db_protocol_update = models.ProtocolUpdates(**protocol_update.model_dump())
    db.add(db_protocol_update)
    db.commit()
    db.refresh(db_protocol_update)
    return db_protocol_update

def patch_protocol_updates(db: Session, protocol: schemas.ProtocolUpdates):
    protocol_update = db.query(models.ProtocolUpdates).filter(models.ProtocolUpdates.id == int(protocol.id)).first()
    
    if not protocol_update:
        raise HTTPException(status_code=404, detail="Protocol update not found")
    
    # Only update the editable fields - DO NOT update 'name' (protocol name)
    if hasattr(protocol, 'title') and protocol.title is not None:
        protocol_update.title = protocol.title
    if hasattr(protocol, 'is_draft') and protocol.is_draft is not None:
        protocol_update.is_draft = protocol.is_draft
    if hasattr(protocol, 'is_prerelease') and protocol.is_prerelease is not None:
        protocol_update.is_prerelease = protocol.is_prerelease
    if hasattr(protocol, 'hard_fork') and protocol.hard_fork is not None:
        protocol_update.hard_fork = protocol.hard_fork
    if hasattr(protocol, 'notes') and protocol.notes is not None:
        protocol_update.notes = protocol.notes
    
    # Legacy fields - still preserve them if explicitly set
    if hasattr(protocol, 'ticket') and protocol.ticket is not None:
        protocol_update.ticket = protocol.ticket
    if hasattr(protocol, 'fork_date') and protocol.fork_date is not None:
        protocol_update.fork_date = protocol.fork_date
    if hasattr(protocol, 'is_closed') and protocol.is_closed is not None:
        protocol_update.is_closed = protocol.is_closed
    if hasattr(protocol, 'github_url') and protocol.github_url is not None:
        protocol_update.github_url = protocol.github_url
    
    print(f"Updated protocol update {protocol_update.id} - preserving protocol name: {protocol_update.name}")
    db.add(protocol_update)
    db.commit()
    db.refresh(protocol_update)
    
    return protocol_update

## ---


def get_protocol(db: Session, protocol_id: int):
    return db.query(models.Protocol).filter(models.Protocol.id == protocol_id).first()


def get_protocol_by_id(db: Session, id: id):
    return db.query(models.Protocol).filter(models.Protocol.id == id).first()

def get_protocol_by_name(db: Session, protocol_name: str):
    return db.query(models.Protocol).filter(models.Protocol.name == protocol_name).all()


def get_protocols(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Protocol).offset(skip).limit(limit).all()


def create_protocol(db: Session, protocol: schemas.ProtocolCreate):
    db_protocol = models.Protocol(**protocol.model_dump())
    db.add(db_protocol)
    db.commit()
    db.refresh(db_protocol)
    return db_protocol

def delete_protocol(db: Session, protocol_id: int):
    db_protocol = db.query(models.Protocol).filter(models.Protocol.id == protocol_id).delete()
    # db.delete(db_protocol)
    db.commit()
    # db.refresh()
    return {'message': 'Protocol Deleted Successfully'}


def update_protocol(db: Session, protocol: schemas.ProtocolUpdate):
    db_protocol = db.query(models.Protocol).filter(models.Protocol.id == int(protocol.id)).first()
    db_protocol.name = protocol.name
    db_protocol.explorer = protocol.explorer
    db_protocol.chain_id = protocol.chain_id
    db_protocol.public_rpc = protocol.public_rpc
    db_protocol.network = protocol.network
    db_protocol.proto_family = protocol.proto_family
    db.add(db_protocol)
    db.commit()
    db.refresh(db_protocol)
    return {'message': 'Protocol Updated Successfully'}


## --

def get_client(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id == client_id).first()


def get_client_by_id(db: Session, id: id):
    return db.query(models.Client).filter(models.Client.id == id).first()

def get_client_by_name(db: Session, client_name: str):
    return db.query(models.Client).filter(models.Client.name == client_name)


def get_clients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()


def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Client(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

def delete_client(db: Session, client_id: int):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).delete()
    # db.delete(db_client)
    db.commit()
    # db.refresh()
    return {'message': 'Client Deleted Successfully'}


def update_client(db: Session, client: schemas.ClientUpdate):
    db_client = db.query(models.Client).filter(models.Client.id == int(client.id)).first()
    db_client.name = client.name
    db_client.client = client.client
    db_client.github_url = client.github_url
    db_client.repo_type = client.repo_type
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return {'message': 'Client Updated Successfully'}

# S3-Compatible Storage Configuration operations
def get_s3_config(db: Session):
    return db.query(models.S3Config).first()

def create_s3_config(db: Session, config: schemas.S3ConfigCreate):
    # First delete any existing config since we only want one
    db.query(models.S3Config).delete()
    db.commit()
    
    db_config = models.S3Config(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_s3_config(db: Session, config: schemas.S3ConfigUpdate):
    db_config = db.query(models.S3Config).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="S3 storage configuration not found")
    
    update_data = config.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

# Snapshot Index operations
def create_snapshot_index(db: Session, snapshot: schemas.SnapshotIndexCreate):
    db_snapshot = models.SnapshotIndex(**snapshot.model_dump())
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)
    return db_snapshot

def get_protocol_snapshots(db: Session, protocol_id: int, skip: int = 0, limit: int = 100):
    # Get the protocol to check if it exists
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return []
    
    query = db.query(models.SnapshotIndex).filter(models.SnapshotIndex.protocol_id == protocol_id)
    
    # If protocol has a snapshot prefix, filter by it
    if protocol.snapshot_prefix:
        # Convert any dashes in prefix to underscores for consistency
        prefix = protocol.snapshot_prefix.replace('-', '_')
        query = query.filter(models.SnapshotIndex.snapshot_id.startswith(prefix + '_'))
    
    return (query
            .order_by(models.SnapshotIndex.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all())

def get_protocol_snapshots_summary(db: Session, protocol_id: int, skip: int = 0, limit: int = 100):
    """Get protocol snapshots with lightweight metadata (no paths array)"""
    snapshots = get_protocol_snapshots(db, protocol_id, skip, limit)
    
    # Convert to summary format, excluding large paths array
    summary_snapshots = []
    for snapshot in snapshots:
        metadata_summary = None
        if snapshot.snapshot_metadata:
            # Copy metadata but exclude large fields like 'paths' and 'file_tree'
            metadata_summary = {k: v for k, v in snapshot.snapshot_metadata.items() 
                              if k not in ['paths', 'file_tree']}
        
        summary_snapshots.append({
            'id': snapshot.id,
            'protocol_id': snapshot.protocol_id,
            'snapshot_id': snapshot.snapshot_id,
            'index_file_path': snapshot.index_file_path,
            'file_count': snapshot.file_count,
            'total_size': snapshot.total_size,
            'created_at': snapshot.created_at,
            'indexed_at': snapshot.indexed_at,
            'metadata_summary': metadata_summary
        })
    
    return summary_snapshots

def get_snapshot_by_id(db: Session, snapshot_id: str, protocol_id: int):
    return (db.query(models.SnapshotIndex)
            .filter(models.SnapshotIndex.snapshot_id == snapshot_id,
                   models.SnapshotIndex.protocol_id == protocol_id)
            .first())

def delete_snapshot_index(db: Session, snapshot_id: str, protocol_id: int):
    db_snapshot = get_snapshot_by_id(db, snapshot_id, protocol_id)
    if not db_snapshot:
        raise HTTPException(status_code=404, detail="Snapshot index not found")
    
    db.delete(db_snapshot)
    db.commit()
    return {"message": "Snapshot index deleted successfully"}


# Protocol-Client Association CRUD operations

def add_client_to_protocol(db: Session, protocol_id: int, client_id: int, is_primary: bool = False):
    """Add a client to a protocol"""
    # Check if association already exists
    existing = (db.query(models.protocol_clients)
                .filter(models.protocol_clients.c.protocol_id == protocol_id,
                       models.protocol_clients.c.client_id == client_id)
                .first())
    
    if existing:
        return {"message": "Client is already associated with this protocol"}
    
    # If this is being set as primary, unset other primary clients for this protocol
    if is_primary:
        db.execute(
            models.protocol_clients.update()
            .where(models.protocol_clients.c.protocol_id == protocol_id)
            .values(is_primary=False)
        )
    
    # Insert new association
    db.execute(
        models.protocol_clients.insert().values(
            protocol_id=protocol_id,
            client_id=client_id,
            is_primary=is_primary
        )
    )
    db.commit()
    
    return {"message": "Client added to protocol successfully"}

def remove_client_from_protocol(db: Session, protocol_id: int, client_id: int):
    """Remove a client from a protocol"""
    result = db.execute(
        models.protocol_clients.delete()
        .where(models.protocol_clients.c.protocol_id == protocol_id)
        .where(models.protocol_clients.c.client_id == client_id)
    )
    
    if result.rowcount == 0:
        return {"message": "Client was not associated with this protocol"}
    
    db.commit()
    return {"message": "Client removed from protocol successfully"}

def set_primary_client_for_protocol(db: Session, protocol_id: int, client_id: int):
    """Set a client as the primary client for a protocol"""
    # First, unset all primary flags for this protocol
    db.execute(
        models.protocol_clients.update()
        .where(models.protocol_clients.c.protocol_id == protocol_id)
        .values(is_primary=False)
    )
    
    # Set the specified client as primary
    result = db.execute(
        models.protocol_clients.update()
        .where(models.protocol_clients.c.protocol_id == protocol_id)
        .where(models.protocol_clients.c.client_id == client_id)
        .values(is_primary=True)
    )
    
    if result.rowcount == 0:
        return {"message": "Client is not associated with this protocol"}
    
    db.commit()
    return {"message": "Primary client set successfully"}

def get_protocol_clients(db: Session, protocol_id: int):
    """Get all clients associated with a protocol"""
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return []
    
    return (db.query(models.Client)
            .join(models.protocol_clients, models.Client.id == models.protocol_clients.c.client_id)
            .filter(models.protocol_clients.c.protocol_id == protocol_id)
            .all())

def get_client_protocols(db: Session, client_id: int):
    """Get all protocols associated with a client"""
    client = get_client(db, client_id)
    if not client:
        return []
    
    return (db.query(models.Protocol)
            .join(models.protocol_clients, models.Protocol.id == models.protocol_clients.c.protocol_id)
            .filter(models.protocol_clients.c.client_id == client_id)
            .all())

def get_protocol_updates_by_client_and_protocol(db: Session, client_id: int, protocol_ids: list = None):
    """Get protocol updates for a specific client, optionally filtered by protocols"""
    query = db.query(models.ProtocolUpdates).filter(models.ProtocolUpdates.client_id == client_id)
    
    if protocol_ids:
        # Join with protocol_clients to filter by associated protocols
        query = (query.join(models.Client, models.ProtocolUpdates.client_id == models.Client.id)
                     .join(models.protocol_clients, models.Client.id == models.protocol_clients.c.client_id)
                     .filter(models.protocol_clients.c.protocol_id.in_(protocol_ids)))
    
    return query.order_by(models.ProtocolUpdates.date.desc()).all()

def get_protocol_updates_enriched(db: Session, skip: int = 0, limit: int = 100):
    """Get protocol updates with client and protocol information"""
    return (db.query(models.ProtocolUpdates)
            .join(models.Client, models.ProtocolUpdates.client_id == models.Client.id, isouter=True)
            .options(
                joinedload(models.ProtocolUpdates.client_entity)
            )
            .order_by(models.ProtocolUpdates.date.desc())
            .offset(skip)
            .limit(limit)
            .all())

# Admin user management functions
def get_users_paginated(db: Session, page: int = 1, limit: int = 20):
    """Get paginated list of users"""
    offset = (page - 1) * limit
    total = db.query(models.Users).count()
    users = db.query(models.Users).offset(offset).limit(limit).all()
    pages = (total + limit - 1) // limit
    
    return {
        "users": users,
        "total": total,
        "pages": pages
    }

def create_admin_user(db: Session, user: schemas.AdminUserCreate):
    """Create a new user (admin function)"""
    db_user = models.Users(
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
        is_active=user.is_active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_admin_user(db: Session, user_id: int, user_update: schemas.AdminUserUpdate):
    """Update user (admin function)"""
    db_user = db.query(models.Users).filter(models.Users.id == user_id).first()
    if db_user:
        update_data = user_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_admin_user(db: Session, user_id: int):
    """Delete user (admin function)"""
    db_user = db.query(models.Users).filter(models.Users.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

def toggle_user_status(db: Session, user_id: int):
    """Toggle user active status"""
    db_user = db.query(models.Users).filter(models.Users.id == user_id).first()
    if db_user:
        db_user.is_active = not db_user.is_active
        db.commit()
        db.refresh(db_user)
    return db_user

# GitHub Configuration operations
def get_github_config(db: Session):
    """Get GitHub configuration"""
    return db.query(models.GitHubConfig).first()

def create_github_config(db: Session, config: schemas.GitHubConfigCreate):
    """Create GitHub configuration"""
    # First delete any existing config since we only want one
    db.query(models.GitHubConfig).delete()
    db.commit()
    
    db_config = models.GitHubConfig(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_github_config(db: Session, config: schemas.GitHubConfigUpdate):
    """Update GitHub configuration"""
    db_config = db.query(models.GitHubConfig).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="GitHub configuration not found")
    
    update_data = config.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

# Profile and API Key management functions
def get_user_profile(db: Session, user_id: int):
    """Get user profile information"""
    user = db.query(models.Users).filter(models.Users.id == user_id).first()
    if not user:
        return None
    
    # Transform to profile format
    profile = schemas.UserProfile(
        id=user.id,
        email=user.email,
        username=getattr(user, 'username', None),
        name=f"{user.first_name} {user.last_name}" if user.first_name and user.last_name else (getattr(user, 'username', None) or user.email),
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
        is_active=user.is_active,
        picture=user.picture,
        created_at=user.created_at if hasattr(user, 'created_at') else datetime.utcnow(),
        last_login=user.last_login if hasattr(user, 'last_login') else None
    )
    return profile

def get_user_api_keys(db: Session, user_id: int):
    """Get all API keys for a user"""
    api_keys = db.query(models.ApiKey).filter(models.ApiKey.user_id == user_id).all()
    
    result = []
    for key in api_keys:
        # Create preview of the key (first 8 and last 4 characters)
        key_preview = f"{key.key[:8]}...{key.key[-4:]}" if len(key.key) >= 12 else key.key
        
        profile_key = schemas.ProfileApiKey(
            id=key.id,
            name=key.name,
            description=key.description,
            key_preview=key_preview,
            created_at=key.created_at,
            last_used=key.last_used_at,
            expires_at=key.expires_at,
            is_active=key.is_active
        )
        result.append(profile_key)
    
    return result

def create_user_api_key(db: Session, user_id: int, api_key_data: schemas.ProfileApiKeyCreate):
    """Create a new API key for a user"""
    import secrets
    import string
    
    # Generate a secure random API key
    alphabet = string.ascii_letters + string.digits
    api_key = ''.join(secrets.choice(alphabet) for _ in range(64))
    
    db_api_key = models.ApiKey(
        user_id=user_id,
        key=api_key,
        name=api_key_data.name,
        description=api_key_data.description,
        expires_at=api_key_data.expires_at,
        created_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    # Return the full key response (key is only shown once)
    return schemas.ProfileApiKeyResponse(
        id=db_api_key.id,
        name=db_api_key.name,
        description=db_api_key.description,
        key=db_api_key.key,
        created_at=db_api_key.created_at,
        expires_at=db_api_key.expires_at
    )

def delete_user_api_key(db: Session, user_id: int, key_id: int):
    """Delete an API key for a user"""
    api_key = db.query(models.ApiKey).filter(
        models.ApiKey.id == key_id,
        models.ApiKey.user_id == user_id
    ).first()
    
    if not api_key:
        return False
    
    db.delete(api_key)
    db.commit()
    return True

def get_full_api_key(db: Session, user_id: int, key_id: int):
    """Get the full API key value (for copying to clipboard)"""
    api_key = db.query(models.ApiKey).filter(
        models.ApiKey.id == key_id,
        models.ApiKey.user_id == user_id,
        models.ApiKey.is_active == True
    ).first()
    
    if not api_key:
        return None
    
    return {"key": api_key.key}

def get_user_by_api_key(db: Session, api_key: str):
    """Get user by API key"""
    key_obj = db.query(models.ApiKey).filter(models.ApiKey.key == api_key).first()
    if not key_obj:
        return None
    
    return db.query(models.Users).filter(models.Users.id == key_obj.user_id).first()