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
    logo: Optional[str] = None  # Base64 encoded PNG image

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

class ClientBase(BaseModel):
    id: Union[int, None] = None
    name: Optional[str] = None
    client: Optional[str] = None 
    github_url: Optional[str] = None 
    repo_type: Optional[str] = None 

    class Config:
        from_attributes = True


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
    pass

class ClientWithProtocols(Client):
    """Extended Client schema that includes protocol relationships"""
    pass

class User(BaseModel):
    id: Union[int, None] = None
    username: str
    email: Union[str, None] = None
    full_name: Union[str, None] = None
    disabled: Union[bool, None] = None

    class Config:
        from_attributes = True

# B2 Bucket Configuration schemas
class B2BucketConfigBase(BaseModel):
    bucket_name: str
    endpoint_url: str
    region: str = 'us-west-004'

class B2BucketConfigCreate(B2BucketConfigBase):
    access_key_id: str
    secret_access_key: str

class B2BucketConfigUpdate(B2BucketConfigBase):
    bucket_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None

class B2BucketConfig(B2BucketConfigBase):
    id: int

    class Config:
        orm_mode = True

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
        orm_mode = True