from typing import Union, Optional, Dict, Any, List

from pydantic import BaseModel
from datetime import datetime
import psutil


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
    
    # AI Analysis fields
    ai_summary: Optional[str] = None
    ai_key_changes: Optional[List[str]] = None
    ai_breaking_changes: Optional[List[str]] = None
    ai_security_updates: Optional[List[str]] = None
    ai_upgrade_priority: Optional[str] = None
    ai_risk_assessment: Optional[str] = None
    ai_technical_summary: Optional[str] = None
    ai_executive_summary: Optional[str] = None
    ai_estimated_impact: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    ai_analysis_date: Optional[datetime] = None
    ai_provider: Optional[str] = None
    
    # Enhanced hard fork fields
    ai_hard_fork_details: Optional[str] = None
    activation_block: Optional[int] = None
    activation_date: Optional[datetime] = None
    coordination_required: Optional[bool] = None

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
    username: Union[str, None] = None
    name: str
    first_name: Union[str, None] = None
    last_name: Union[str, None] = None
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

# OAuth and Authentication schemas
class GoogleOAuthRequest(BaseModel):
    id_token: str
    access_token: str

class LoginResponse(BaseModel):
    user: UserProfile
    api_key: str
    expires_in: Optional[int] = None

class InitialSetupRequest(BaseModel):
    """Request to initialize the system without requiring API key authentication"""
    action: str  # e.g., "create_admin", "get_status"
    admin_data: Optional[Dict[str, Any]] = None

# System Configuration schemas
class SystemConfigBase(BaseModel):
    app_name: str = "Protocol Tracker"
    app_description: Optional[str] = "Track blockchain protocols and updates"
    max_file_size_mb: int = 100
    session_timeout_hours: int = 24
    auto_scan_enabled: bool = True
    auto_scan_interval_hours: int = 6
    notification_email: Optional[str] = None
    admin_email: Optional[str] = None
    backup_enabled: bool = False
    backup_retention_days: int = 30

class SystemConfigCreate(SystemConfigBase):
    pass

class SystemConfigUpdate(BaseModel):
    app_name: Optional[str] = None
    app_description: Optional[str] = None
    max_file_size_mb: Optional[int] = None
    session_timeout_hours: Optional[int] = None
    auto_scan_enabled: Optional[bool] = None
    auto_scan_interval_hours: Optional[int] = None
    notification_email: Optional[str] = None
    admin_email: Optional[str] = None
    backup_enabled: Optional[bool] = None
    backup_retention_days: Optional[int] = None

class SystemConfig(SystemConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# System Status schemas
class SystemStatus(BaseModel):
    status: str  # 'healthy', 'warning', 'error'
    uptime: float  # in seconds
    version: str
    database_status: str
    memory_usage: float  # percentage
    disk_usage: float  # percentage
    cpu_usage: float  # percentage
    active_connections: int
    last_backup: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Notification Configuration schemas
class NotificationConfigBase(BaseModel):
    notifications_enabled: bool = False
    # Discord webhooks (support multiple URLs)
    discord_enabled: bool = False
    discord_webhook_url: Optional[str] = None  # Keep for backward compatibility
    discord_webhook_urls: Optional[List[str]] = None  # Array of webhook URLs
    # Slack webhooks (support multiple URLs)
    slack_enabled: bool = False
    slack_webhook_url: Optional[str] = None  # Keep for backward compatibility
    slack_webhook_urls: Optional[List[str]] = None  # Array of webhook URLs
    # Telegram webhooks (new)
    telegram_enabled: bool = False
    telegram_bot_token: Optional[str] = None
    telegram_chat_ids: Optional[List[str]] = None  # Array of chat IDs
    # Generic JSON webhooks (support multiple URLs)
    generic_enabled: bool = False
    generic_webhook_url: Optional[str] = None  # Keep for backward compatibility
    generic_webhook_urls: Optional[List[Dict[str, Any]]] = None  # Array of {url: string, headers: object}
    generic_headers: Optional[Dict[str, str]] = None  # Keep for backward compatibility

class NotificationConfigCreate(NotificationConfigBase):
    pass

class NotificationConfigUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    # Discord webhooks (support multiple URLs)
    discord_enabled: Optional[bool] = None
    discord_webhook_url: Optional[str] = None  # Keep for backward compatibility
    discord_webhook_urls: Optional[List[str]] = None  # Array of webhook URLs
    # Slack webhooks (support multiple URLs)
    slack_enabled: Optional[bool] = None
    slack_webhook_url: Optional[str] = None  # Keep for backward compatibility
    slack_webhook_urls: Optional[List[str]] = None  # Array of webhook URLs
    # Telegram webhooks (new)
    telegram_enabled: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_ids: Optional[List[str]] = None  # Array of chat IDs
    # Generic JSON webhooks (support multiple URLs)
    generic_enabled: Optional[bool] = None
    generic_webhook_url: Optional[str] = None  # Keep for backward compatibility
    generic_webhook_urls: Optional[List[Dict[str, Any]]] = None  # Array of {url: string, headers: object}
    generic_headers: Optional[Dict[str, str]] = None  # Keep for backward compatibility

class NotificationConfig(NotificationConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Client Notification Settings schemas
class ClientNotificationSettingsBase(BaseModel):
    notifications_enabled: bool = True

class ClientNotificationSettingsCreate(ClientNotificationSettingsBase):
    client_id: int

class ClientNotificationSettingsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None

class ClientNotificationSettings(ClientNotificationSettingsBase):
    id: int
    client_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Webhook test schemas
class WebhookTest(BaseModel):
    webhook_type: str  # 'discord', 'slack', 'telegram', 'generic'
    webhook_url: Optional[str] = None  # For Discord, Slack, Generic
    bot_token: Optional[str] = None  # For Telegram
    chat_id: Optional[str] = None  # For Telegram
    headers: Optional[Dict[str, str]] = None  # For Generic webhooks

# AI Configuration schemas
class AIConfigBase(BaseModel):
    ai_enabled: bool = False
    provider: str = "openai"  # openai, anthropic, local
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    auto_analyze_enabled: bool = True
    analysis_timeout_seconds: int = 60

class AIConfigCreate(AIConfigBase):
    pass

class AIConfigUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    auto_analyze_enabled: Optional[bool] = None
    analysis_timeout_seconds: Optional[int] = None

class AIConfig(AIConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# AI Analysis schemas
class AIAnalysisResult(BaseModel):
    summary: Optional[str] = None
    key_changes: Optional[List[str]] = None
    breaking_changes: Optional[List[str]] = None
    security_updates: Optional[List[str]] = None
    upgrade_priority: Optional[str] = None  # critical, high, medium, low
    risk_assessment: Optional[str] = None
    technical_summary: Optional[str] = None
    executive_summary: Optional[str] = None
    estimated_impact: Optional[str] = None
    confidence_score: Optional[float] = None
    is_hard_fork: Optional[bool] = None
    hard_fork_details: Optional[str] = None
    activation_block: Optional[int] = None
    activation_date: Optional[datetime] = None
    coordination_required: Optional[bool] = None
    analysis_date: Optional[datetime] = None
    provider: Optional[str] = None

class AIAnalysisRequest(BaseModel):
    protocol_update_id: int
    force_reanalyze: bool = False

# AI Feedback schemas
class AIAnalysisFeedbackBase(BaseModel):
    rating: int  # 1-5 stars
    feedback_text: Optional[str] = None
    helpful_aspects: Optional[List[str]] = None
    improvement_suggestions: Optional[List[str]] = None

class AIAnalysisFeedbackCreate(AIAnalysisFeedbackBase):
    protocol_update_id: int

class AIAnalysisFeedback(AIAnalysisFeedbackBase):
    id: int
    protocol_update_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True