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
    
    # AI Analysis fields
    ai_summary = Column(String, nullable=True)
    ai_key_changes = Column(JSON, nullable=True)  # Array of key changes
    ai_breaking_changes = Column(JSON, nullable=True)  # Array of breaking changes
    ai_security_updates = Column(JSON, nullable=True)  # Array of security updates
    ai_upgrade_priority = Column(String, nullable=True)  # critical, high, medium, low
    ai_risk_assessment = Column(String, nullable=True)
    ai_technical_summary = Column(String, nullable=True)
    ai_executive_summary = Column(String, nullable=True)
    ai_estimated_impact = Column(String, nullable=True)
    ai_confidence_score = Column(Float, nullable=True)  # 0.0 to 1.0
    ai_analysis_date = Column(DateTime, nullable=True)
    ai_provider = Column(String, nullable=True)  # openai, anthropic, local
    
    # Enhanced hard fork fields
    ai_hard_fork_details = Column(String, nullable=True)
    activation_block = Column(BigInteger, nullable=True)
    activation_date = Column(DateTime, nullable=True)
    coordination_required = Column(Boolean, nullable=True)
    
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
    snapshot_prefixes = relationship('ProtocolSnapshotPrefix', back_populates='protocol', cascade='all, delete-orphan')


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
    notification_settings = relationship('ClientNotificationSettings', back_populates='client', uselist=False, cascade='all, delete-orphan')


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
    picture = Column(String(2048), nullable=True)
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


class ProtocolSnapshotPrefix(Base):
    __tablename__ = "protocol_snapshot_prefixes"

    id = Column(Integer, primary_key=True, index=True)
    protocol_id = Column(Integer, ForeignKey('protocols.id', ondelete='CASCADE'), nullable=False)
    prefix = Column(String, nullable=False)  # e.g. "ethereum-reth-mainnet-archive-v1"
    client_name = Column(String, nullable=True)  # e.g. "reth"
    network = Column(String, nullable=True)  # e.g. "mainnet", "testnet"
    node_type = Column(String, nullable=True)  # e.g. "archive", "full"
    description = Column(String, nullable=True)  # Optional human-readable description
    is_active = Column(Boolean, nullable=False, default=True)  # Allow disabling prefixes
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with Protocol model
    protocol = relationship('Protocol', back_populates='snapshot_prefixes')

    # Ensure unique prefix per protocol
    __table_args__ = (UniqueConstraint('protocol_id', 'prefix', name='unique_protocol_prefix'),)


class SnapshotIndex(Base):
    __tablename__ = "snapshot_indices"

    id = Column(Integer, primary_key=True, index=True)
    protocol_id = Column(Integer, ForeignKey('protocols.id', ondelete='CASCADE'), nullable=False)
    prefix_id = Column(Integer, ForeignKey('protocol_snapshot_prefixes.id', ondelete='CASCADE'), nullable=True)  # Link to the prefix used
    snapshot_id = Column(String, nullable=False)  # Unique identifier for the snapshot
    index_file_path = Column(String, nullable=False)  # Path to the JSON index file in bucket
    file_count = Column(Integer, nullable=False, default=0)
    total_size = Column(BigInteger, nullable=False, default=0)  # Total size in bytes
    created_at = Column(DateTime, nullable=False)  # When the snapshot was created
    indexed_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # When we indexed it
    snapshot_metadata = Column(JSON, nullable=True)  # Additional snapshot metadata

    # Relationships
    protocol = relationship('Protocol', back_populates='snapshots')
    prefix = relationship('ProtocolSnapshotPrefix', backref='snapshots')

    __table_args__ = (
        UniqueConstraint('protocol_id', 'snapshot_id', name='uix_protocol_snapshot'),
    )


class GitHubConfig(Base):
    __tablename__ = "github_config"

    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, nullable=False)
    polling_interval_minutes = Column(Integer, nullable=False, default=5)
    poller_enabled = Column(Boolean, nullable=False, default=False)
    last_poll_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, index=True)
    app_name = Column(String, nullable=False, default="Protocol Tracker")
    app_description = Column(String, nullable=True)
    max_file_size_mb = Column(Integer, nullable=False, default=100)
    session_timeout_hours = Column(Integer, nullable=False, default=24)
    auto_scan_enabled = Column(Boolean, nullable=False, default=True)
    auto_scan_interval_hours = Column(Integer, nullable=False, default=6)
    notification_email = Column(String, nullable=True)
    admin_email = Column(String, nullable=True)
    backup_enabled = Column(Boolean, nullable=False, default=False)
    backup_retention_days = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationConfig(Base):
    __tablename__ = "notification_config"

    id = Column(Integer, primary_key=True, index=True)
    notifications_enabled = Column(Boolean, nullable=False, default=False)
    
    # Discord webhooks (support multiple URLs)
    discord_enabled = Column(Boolean, nullable=False, default=False)
    discord_webhook_url = Column(String, nullable=True)  # Keep for backward compatibility
    discord_webhook_urls = Column(JSON, nullable=True)  # Array of webhook URLs
    
    # Slack webhooks (support multiple URLs)
    slack_enabled = Column(Boolean, nullable=False, default=False)
    slack_webhook_url = Column(String, nullable=True)  # Keep for backward compatibility
    slack_webhook_urls = Column(JSON, nullable=True)  # Array of webhook URLs
    
    # Telegram webhooks (new)
    telegram_enabled = Column(Boolean, nullable=False, default=False)
    telegram_bot_token = Column(String, nullable=True)
    telegram_chat_ids = Column(JSON, nullable=True)  # Array of chat IDs
    
    # Generic JSON webhooks (support multiple URLs)
    generic_enabled = Column(Boolean, nullable=False, default=False)
    generic_webhook_url = Column(String, nullable=True)  # Keep for backward compatibility
    generic_webhook_urls = Column(JSON, nullable=True)  # Array of {url: string, headers: object} objects
    generic_headers = Column(JSON, nullable=True)  # Keep for backward compatibility
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClientNotificationSettings(Base):
    __tablename__ = "client_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey('clients.id', ondelete='CASCADE'), nullable=False)
    notifications_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    client = relationship('Client', back_populates='notification_settings')
    
    __table_args__ = (
        UniqueConstraint('client_id', name='uix_client_notification'),
    )


class AIConfig(Base):
    __tablename__ = "ai_config"

    id = Column(Integer, primary_key=True, index=True)
    ai_enabled = Column(Boolean, nullable=False, default=False)
    provider = Column(String, nullable=False, default="openai")  # openai, anthropic, local
    api_key = Column(String, nullable=True)
    model = Column(String, nullable=True)  # gpt-5, claude-sonnet-4-20250514, etc.
    base_url = Column(String, nullable=True)  # For local LLMs
    auto_analyze_enabled = Column(Boolean, nullable=False, default=True)
    analysis_timeout_seconds = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIAnalysisFeedback(Base):
    __tablename__ = "ai_analysis_feedback"

    id = Column(Integer, primary_key=True, index=True)
    protocol_update_id = Column(Integer, ForeignKey('protocol_tracking.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('Users.id', ondelete='CASCADE'), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    feedback_text = Column(String, nullable=True)
    helpful_aspects = Column(JSON, nullable=True)  # Array of what was helpful
    improvement_suggestions = Column(JSON, nullable=True)  # Array of suggestions
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    protocol_update = relationship('ProtocolUpdates')
    user = relationship('Users')
