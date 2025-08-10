from __future__ import annotations
from typing import Union, Optional, Dict, Any

from pydantic import BaseModel
from datetime import datetime


class ProtocolUpdatesBase(BaseModel):
    id: Union[int, None] = None
    name: Union[str, None] = None
    is_draft: Union[bool, None] = False
    is_prerelease: Union[bool, None] = False
    title: Optional[str] = None
    client: Optional[str] = None
    tag: Optional[str] = None
    release_name: Optional[str] = None
    date: Optional[datetime] = None
    url: Optional[str] = None
    tarball: Optional[str] = None
    notes: Optional[str] = None
    ticket: Union[str, None] = None
    is_closed: Union[bool, None] = False
    hard_fork: Union[bool, None] = False
    fork_date: Union[datetime, None] = None
    github_url: Optional[str] = None 

    class Config:
        from_attributes = True


class ProtocolUpdatesCreate(ProtocolUpdatesBase):
    pass


class ProtocolUpdates(ProtocolUpdatesBase):
    id: Union[int, None] = None
    name: Union[str, None] = None


class ProtocolBase(BaseModel):
    id: Union[int, None] = None
    name: Optional[str] = None
    chain_id: Optional[str] = None 
    explorer: Optional[str] = None 
    public_rpc: Optional[str] = None 
    proto_family: Optional[str] = None 
    bpm: Optional[float] = None 
    network: Optional[str] = None 
    snapshot_prefix: Optional[str] = None
    logo: Optional[str] = None  # Base64 encoded PNG image

    class Config:
        from_attributes = True

class ClientBase(BaseModel):
    id: Union[int, None] = None
    name: Optional[str] = None
    client: Optional[str] = None 
    github_url: Optional[str] = None 
    repo_type: Optional[str] = None 

    class Config:
        from_attributes = True


class ProtocolCreate(ProtocolBase):
    logo: Optional[str] = None  # Base64 encoded PNG image


class ProtocolUpdate(ProtocolBase):
    id: Union[int, None] = None
    logo: Optional[str] = None  # Base64 encoded PNG image


class Protocol(ProtocolBase):
    id: int
    logo: Optional[str] = None  # Base64 encoded PNG image
    clients: Optional[list['ClientBase']] = None  # Associated clients


class ProtocolDelete(BaseModel):
    id: Union[int, None] = None


class ClientCreate(ClientBase):
    pass


class Client(ClientBase):
    id: Union[int, None] = None
    protocols: Optional[list['ProtocolBase']] = None  # Associated protocols


class ClientDelete(BaseModel):
    id: Union[int, None] = None

class ClientUpdate(ClientBase):
    pass

class ProtocolClientAssociation(BaseModel):
    protocol_id: int
    client_id: int
    is_primary: Optional[bool] = False
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProtocolClientAssociationCreate(BaseModel):
    client_id: int
    is_primary: Optional[bool] = False

class ProtocolWithClients(Protocol):
    """Extended Protocol schema that includes client relationships"""
    clients: Optional[list[ClientBase]] = None

class ClientWithProtocols(Client):
    """Extended Client schema that includes protocol relationships"""  
    protocols: Optional[list[ProtocolBase]] = None

class User(BaseModel):
    id: Union[int, None] = None
    username: str
    email: Union[str, None] = None
    full_name: Union[str, None] = None
    disabled: Union[bool, None] = None
    first_name: Union[str, None] = None
    last_name: Union[str, None] = None
    picture: Union[str, None] = None
    oauth_github: Union[str, None] = None
    oauth_google: Union[str, None] = None
    is_admin: bool = False
    is_active: bool = True

    class Config:
        from_attributes = True

# Admin user schemas
class AdminUserBase(BaseModel):
    username: str
    email: str
    first_name: Union[str, None] = None
    last_name: Union[str, None] = None
    is_admin: bool = False
    is_active: bool = True

class AdminUserCreate(AdminUserBase):
    password: Union[str, None] = None

class AdminUserUpdate(BaseModel):
    username: Union[str, None] = None
    email: Union[str, None] = None
    first_name: Union[str, None] = None
    last_name: Union[str, None] = None
    is_admin: Union[bool, None] = None
    is_active: Union[bool, None] = None

class AdminUser(AdminUserBase):
    id: int
    picture: Union[str, None] = None
    oauth_github: Union[str, None] = None
    oauth_google: Union[str, None] = None

    class Config:
        from_attributes = True

class AdminUsersResponse(BaseModel):
    users: list[AdminUser]
    total: int
    pages: int

# Profile schemas
class UserProfile(BaseModel):
    id: int
    email: str
    name: str
    picture: Union[str, None] = None
    is_admin: bool = False
    is_active: bool = True
    created_at: datetime
    last_login: Union[datetime, None] = None

    class Config:
        from_attributes = True

# API Key schemas
class ProfileApiKey(BaseModel):
    id: int
    name: str
    description: Union[str, None] = None
    key_preview: str
    created_at: datetime
    last_used: Union[datetime, None] = None
    expires_at: Union[datetime, None] = None
    is_active: bool

    class Config:
        from_attributes = True

class ProfileApiKeyCreate(BaseModel):
    name: str
    description: Union[str, None] = None
    expires_at: Union[datetime, None] = None

class ProfileApiKeyResponse(BaseModel):
    id: int
    name: str
    description: Union[str, None] = None
    key: str  # Full key shown only once
    created_at: datetime
    expires_at: Union[datetime, None] = None

    class Config:
        from_attributes = True

# S3-Compatible Storage Configuration schemas
class S3ConfigBase(BaseModel):
    bucket_name: str
    endpoint_url: str
    region: str = 'us-west-004'

class S3ConfigCreate(S3ConfigBase):
    access_key_id: str
    secret_access_key: str

class S3ConfigUpdate(S3ConfigBase):
    bucket_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None

class S3Config(S3ConfigBase):
    id: int

    class Config:
        from_attributes = True

class S3ConnectionTest(BaseModel):
    status: str
    message: str

# Snapshot Index schemas
class SnapshotIndexBase(BaseModel):
    protocol_id: int
    snapshot_id: str
    index_file_path: str
    file_count: int
    total_size: int
    created_at: datetime
    snapshot_metadata: Optional[Dict[str, Any]] = None

class SnapshotIndexCreate(SnapshotIndexBase):
    pass

class SnapshotIndex(SnapshotIndexBase):
    id: int
    indexed_at: datetime

    class Config:
        from_attributes = True

class SnapshotIndexSummary(BaseModel):
    """Lightweight version of SnapshotIndex for listing, excludes large paths array"""
    id: int
    protocol_id: int
    snapshot_id: str
    index_file_path: str
    file_count: int
    total_size: int
    created_at: datetime
    indexed_at: datetime
    # Metadata without the large 'paths' field
    metadata_summary: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# GitHub API Configuration schemas
class GitHubConfigBase(BaseModel):
    api_key: str
    polling_interval_minutes: int = 5
    poller_enabled: bool = False
    last_poll_time: Optional[datetime] = None

class GitHubConfigCreate(GitHubConfigBase):
    pass

class GitHubConfigUpdate(GitHubConfigBase):
    api_key: Optional[str] = None
    polling_interval_minutes: Optional[int] = None
    poller_enabled: Optional[bool] = None
    last_poll_time: Optional[datetime] = None

class GitHubConfig(GitHubConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True