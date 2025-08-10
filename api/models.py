from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, TIMESTAMP, Float, LargeBinary, JSON, BigInteger, Table
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from typing import Union
from database import Base
from datetime import datetime
from sqlalchemy.schema import UniqueConstraint

# Association table for Protocol-Client many-to-many relationship
protocol_clients = Table(
    'protocol_clients',
    Base.metadata,
    Column('protocol_id', Integer, ForeignKey('protocols.id', ondelete='CASCADE'), primary_key=True),
    Column('client_id', Integer, ForeignKey('clients.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime, nullable=False, default=datetime.utcnow),
    Column('is_primary', Boolean, nullable=False, default=False)  # Flag for primary client
)


class ProtocolUpdates(Base):
    __tablename__ = "protocol_tracking"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    is_draft = Column(Boolean)
    is_prerelease = Column(Boolean)
    title = Column(String)
    client = Column(String)  # Keep for backward compatibility
    client_id = Column(Integer, ForeignKey('clients.id', ondelete='SET NULL'), nullable=True)  # New FK relationship
    tag = Column(String)
    release_name = Column(String)
    date = Column(DateTime(timezone=False), nullable=False)
    url = Column(String)
    tarball = Column(String)
    notes = Column(String)
    ticket = Column(String)
    is_closed = Column(Boolean)
    hard_fork = Column(Boolean)
    fork_date = Column(DateTime(timezone=False), nullable=True)
    github_url = Column(String)
    
    # Relationships
    client_entity = relationship('Client', back_populates='updates', lazy='select')


class Protocol(Base):
    __tablename__ = "protocols"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    chain_id = Column(String, nullable=True)
    explorer = Column(String, nullable=True)
    public_rpc = Column(String, nullable=True)
    proto_family = Column(String, nullable=True)
    bpm = Column(Float, nullable=True, default=30)
    network = Column(String, nullable=True)
    logo = Column(LargeBinary, nullable=True)
    snapshot_prefix = Column(String, nullable=True)  # e.g. "axelar-axelard-mainnet-full-v1"
    
    # Relationships
    snapshots = relationship('SnapshotIndex', back_populates='protocol', cascade='all, delete-orphan')
    clients = relationship('Client', secondary=protocol_clients, back_populates='protocols', lazy='select')


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    client = Column(String, nullable=True)
    repo_type = Column(String, nullable=True)
    
    # Relationships
    protocols = relationship('Protocol', secondary=protocol_clients, back_populates='clients', lazy='select')
    updates = relationship('ProtocolUpdates', back_populates='client_entity', lazy='select')


class Users(Base):
    __tablename__ = 'Users'

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True)
    email = Column(String(64), unique=True)
    password = Column(LargeBinary)
    oauth_github = Column(String(100), nullable=True)
    oauth_google = Column(String(100), nullable=True)
    first_name = Column(String(64), nullable=True)
    last_name = Column(String(64), nullable=True)
    picture = Column(String(2048), nullable=True)  # Increased from 1024 to 2048 to accommodate longer URLs
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Add relationship to API keys
    api_keys = relationship('ApiKey', back_populates="user", lazy=True,
                          cascade='all, delete-orphan', overlaps="owner")


class ApiKey(Base):
    """API Key model for user authentication"""
    __tablename__ = 'ApiKeys'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    key = Column(String(64), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationship with User model
    user = relationship('Users', back_populates="api_keys", overlaps="api_keys,owner")


class OAuth(Base):
    __tablename__ = 'oauth'
    
    id = Column(Integer, primary_key=True)
    provider = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    token = Column(JSON, nullable=False)
    provider_user_id = Column(String(256), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="cascade"), nullable=False)
    user = relationship(Users)

    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='provider_user_constraint'),
    )


class S3Config(Base):
    __tablename__ = "s3_config"

    id = Column(Integer, primary_key=True, index=True)
    bucket_name = Column(String, nullable=False)
    endpoint_url = Column(String, nullable=False)
    access_key_id = Column(String, nullable=False)
    secret_access_key = Column(String, nullable=False)
    region = Column(String, default='us-west-004')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SnapshotIndex(Base):
    __tablename__ = "snapshot_indices"

    id = Column(Integer, primary_key=True, index=True)
    protocol_id = Column(Integer, ForeignKey('protocols.id', ondelete='CASCADE'), nullable=False)
    snapshot_id = Column(String, nullable=False)  # Unique identifier for the snapshot
    index_file_path = Column(String, nullable=False)  # Path to the JSON index file in bucket
    file_count = Column(Integer, nullable=False, default=0)
    total_size = Column(BigInteger, nullable=False, default=0)  # Total size in bytes
    created_at = Column(DateTime, nullable=False)  # When the snapshot was created
    indexed_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # When we indexed it
    snapshot_metadata = Column(JSON, nullable=True)  # Additional snapshot metadata

    # Relationship with Protocol model
    protocol = relationship('Protocol', back_populates='snapshots')

    __table_args__ = (
        UniqueConstraint('protocol_id', 'snapshot_id', name='uix_protocol_snapshot'),
    )


class GitHubConfig(Base):
    __tablename__ = "github_config"

    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
