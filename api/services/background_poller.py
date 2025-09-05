"""
Background poller service that runs on the server
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from main import get_db
import crud
import schemas
from .github_service import GitHubService
from .protocol_service import ProtocolService

logger = logging.getLogger(__name__)

class BackgroundPollerService:
    def __init__(self):
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.github_service: Optional[GitHubService] = None
        self.protocol_service: Optional[ProtocolService] = None
        
    async def start(self, db: Session) -> Dict[str, Any]:
        """Start the background poller"""
        if self.is_running:
            return {"status": "already_running", "message": "Poller is already running"}
            
        # Get GitHub config
        github_config = crud.get_github_config(db)
        if not github_config or not github_config.api_key:
            return {"status": "error", "message": "GitHub API key not configured"}
            
        # Update database to show poller as enabled
        crud.update_github_config(db, schemas.GitHubConfigUpdate(poller_enabled=True))
        
        # Initialize services
        self.github_service = GitHubService(github_config.api_key)
        self.protocol_service = ProtocolService()
        
        # Start the background task
        self.is_running = True
        self.task = asyncio.create_task(self._polling_loop())
        
        logger.info("Background poller started")
        return {"status": "started", "message": "Background poller started successfully"}
        
    async def stop(self, db: Session) -> Dict[str, Any]:
        """Stop the background poller"""
        if not self.is_running:
            return {"status": "already_stopped", "message": "Poller is not running"}
            
        # Update database to show poller as disabled
        crud.update_github_config(db, schemas.GitHubConfigUpdate(poller_enabled=False))
        
        # Stop the background task
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        logger.info("Background poller stopped")
        return {"status": "stopped", "message": "Background poller stopped successfully"}
        
    async def get_status(self, db: Session) -> Dict[str, Any]:
        """Get current poller status"""
        github_config = crud.get_github_config(db)
        
        return {
            "is_running": self.is_running,
            "database_enabled": github_config.poller_enabled if github_config else False,
            "last_poll_time": github_config.last_poll_time.isoformat() if github_config and github_config.last_poll_time else None,
            "polling_interval_minutes": github_config.polling_interval_minutes if github_config else 5,
            "task_alive": self.task is not None and not self.task.done() if self.task else False
        }
        
    async def poll_now(self, db: Session) -> Dict[str, Any]:
        """Run a manual poll immediately"""
        github_config = crud.get_github_config(db)
        if not github_config or not github_config.api_key:
            return {"status": "error", "message": "GitHub API key not configured"}
            
        # Initialize services if needed
        if not self.github_service:
            self.github_service = GitHubService(github_config.api_key)
        if not self.protocol_service:
            self.protocol_service = ProtocolService()
            
        # Set flag to indicate this is a manual poll
        self._is_manual_poll = True
        try:
            # Run the poll
            result = await self._run_single_poll(db)
        finally:
            # Clear the flag
            self._is_manual_poll = False
        
        # Update last poll time
        crud.update_github_config(db, schemas.GitHubConfigUpdate(
            last_poll_time=datetime.utcnow()
        ))
        
        return result
        
    async def _polling_loop(self):
        """Main polling loop that runs in the background"""
        logger.info("Background polling loop started")
        
        while self.is_running:
            db_gen = None
            try:
                # Get a fresh database session using the generator properly
                db_gen = get_db()
                db = next(db_gen)
                
                try:
                    # Check if poller should still be running
                    github_config = crud.get_github_config(db)
                    if not github_config or not github_config.poller_enabled:
                        logger.info("Poller disabled in database, stopping")
                        self.is_running = False
                        break
                        
                    # Run the poll
                    await self._run_single_poll(db)
                    
                    # Update last poll time
                    crud.update_github_config(db, schemas.GitHubConfigUpdate(
                        last_poll_time=datetime.utcnow()
                    ))
                    
                    # Wait for the polling interval
                    interval_seconds = github_config.polling_interval_minutes * 60
                    logger.info(f"Waiting {interval_seconds} seconds until next poll")
                    await asyncio.sleep(interval_seconds)
                
                finally:
                    # Properly close the database session by calling next() to trigger cleanup
                    try:
                        next(db_gen)
                    except StopIteration:
                        pass  # This is expected when the generator completes
                    
            except asyncio.CancelledError:
                logger.info("Polling loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                # Wait a bit before retrying on error
                await asyncio.sleep(60)
                
        logger.info("Background polling loop ended")
        
    def _should_analyze_update(self, protocol_update) -> bool:
        """Determine if an update should be analyzed with AI (only recent updates)"""
        try:
            from datetime import datetime, timedelta, timezone
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            
            # Get the update date
            update_date = protocol_update.date
            if isinstance(update_date, str):
                # Parse string date
                if update_date.endswith('Z'):
                    update_date = datetime.fromisoformat(update_date[:-1]).replace(tzinfo=timezone.utc)
                else:
                    update_date = datetime.fromisoformat(update_date).replace(tzinfo=timezone.utc)
            elif hasattr(update_date, 'tzinfo') and update_date.tzinfo is None:
                # Add UTC timezone if missing
                update_date = update_date.replace(tzinfo=timezone.utc)
            
            # Only analyze if within the last 30 days
            return update_date >= thirty_days_ago
        except Exception as e:
            logger.warning(f"Could not determine update date for AI analysis: {e}")
            # Default to analyzing if we can't determine the date
            return True
        
    async def _run_single_poll(self, db: Session) -> Dict[str, Any]:
        """Run a single polling cycle"""
        logger.info("Starting polling cycle")
        
        # Get all clients with GitHub URLs
        clients = crud.get_clients(db)
        active_clients = [c for c in clients if c.github_url]
        
        logger.info(f"Found {len(active_clients)} clients with GitHub URLs")
        
        total_updates = 0
        ai_analyses_queued = 0
        errors = []
        max_ai_analyses = 10  # Limit AI analyses per poll cycle to prevent overload
        
        for client in active_clients:
            try:
                logger.info(f"Polling client: {client.name}")
                
                # Parse GitHub URL
                repo_info = self.github_service.parse_github_url(client.github_url)
                if not repo_info:
                    errors.append(f"Invalid GitHub URL for {client.name}")
                    continue
                    
                # Determine what to fetch based on repo_type
                should_fetch_releases = not client.repo_type or client.repo_type.lower() == 'releases'
                should_fetch_tags = client.repo_type and client.repo_type.lower() == 'tags'
                
                logger.info(f"Client {client.name} repo_type: {client.repo_type or 'undefined (default: releases)'}")
                logger.info(f"Will fetch - Releases: {should_fetch_releases}, Tags: {should_fetch_tags}")
                
                items_to_process = []
                
                if should_fetch_releases:
                    # Get releases since last poll
                    releases = await self.github_service.get_recent_releases(
                        repo_info['owner'], repo_info['repo']
                    )
                    items_to_process.extend(releases)
                    logger.info(f"Fetched {len(releases)} releases for {client.name}")
                
                if should_fetch_tags:
                    # Get tags since last poll
                    tags = await self.github_service.get_recent_tags(
                        repo_info['owner'], repo_info['repo']
                    )
                    # Convert tags to release-like format for processing
                    tag_items = []
                    for tag in tags:
                        # Use commit date if available, otherwise fallback to current time
                        tag_date = tag.get('commit_date') if isinstance(tag, dict) else getattr(tag, 'commit_date', None)
                        if not tag_date:
                            tag_date = datetime.utcnow().isoformat() + 'Z'
                            
                        tag_item = {
                            'tag_name': tag.get('name') if isinstance(tag, dict) else tag.name,
                            'name': tag.get('name') if isinstance(tag, dict) else tag.name,
                            'published_at': tag_date,  # Use actual commit date or fallback to current time
                            'html_url': f"https://github.com/{repo_info['owner']}/{repo_info['repo']}/releases/tag/{tag.get('name') if isinstance(tag, dict) else tag.name}",
                            'body': '',  # Tags don't have bodies
                            'draft': False,
                            'prerelease': False
                        }
                        tag_items.append(tag_item)
                    items_to_process.extend(tag_items)
                    logger.info(f"Fetched {len(tags)} tags for {client.name}")
                
                logger.info(f"Processing {len(items_to_process)} items for {client.name}")
                
                # Process all items and create protocol updates
                for item in items_to_process:
                    # Handle both dict and object formats
                    tag_name = item.get('tag_name') if isinstance(item, dict) else item.tag_name
                    name = item.get('name') if isinstance(item, dict) else getattr(item, 'name', None)
                    published_at = item.get('published_at') if isinstance(item, dict) else getattr(item, 'published_at', None)
                    html_url = item.get('html_url') if isinstance(item, dict) else getattr(item, 'html_url', None)
                    body = item.get('body') if isinstance(item, dict) else getattr(item, 'body', None)
                    draft = item.get('draft') if isinstance(item, dict) else getattr(item, 'draft', False)
                    prerelease = item.get('prerelease') if isinstance(item, dict) else getattr(item, 'prerelease', False)
                    
                    if not tag_name:
                        continue
                        
                    # Check if we already have this release (with proper error handling)
                    client_string = client.client or client.name or 'Unknown'
                    try:
                        existing = crud.get_protocol_update_by_tag(db, client_string, tag_name)
                        if existing:
                            continue
                    except Exception as e:
                        logger.error(f"Error checking existing protocol update for {client_string}:{tag_name}: {e}")
                        # Rollback the transaction and skip this client
                        db.rollback()
                        raise e
                        
                    # Create protocol update
                    update_data = schemas.ProtocolUpdatesCreate(
                        name=client.name or 'Unknown',
                        title=name or tag_name,
                        client=client.client or client.name or 'Unknown',
                        tag=tag_name,
                        date=published_at,
                        url=html_url,
                        notes=body or '',
                        github_url=html_url,
                        is_draft=draft,
                        is_prerelease=prerelease,
                        is_closed=True
                    )
                    
                    # Create the protocol update
                    new_update = crud.create_protocol_updates(db, update_data)
                    total_updates += 1
                    logger.info(f"Created update for {client.name}: {tag_name}")
                    
                    # Run AI analysis on the new update if enabled
                    # Only analyze recent updates (last 30 days) and limit per poll cycle
                    should_analyze = self._should_analyze_update(new_update) and ai_analyses_queued < max_ai_analyses
                    if should_analyze:
                        ai_analyses_queued += 1
                        # For manual polls, schedule AI analysis as background task to avoid blocking
                        if hasattr(self, '_is_manual_poll') and self._is_manual_poll:
                            # Don't await - let it run in background with its own db session
                            asyncio.create_task(self._analyze_update_with_ai_background(new_update.id, is_manual_poll=True))
                        else:
                            # Regular background polling can await the analysis
                            await self._analyze_update_with_ai(db, new_update, is_manual_poll=False)
                    else:
                        if ai_analyses_queued >= max_ai_analyses:
                            logger.debug(f"Skipping AI analysis for {client.name}: {tag_name} (AI analysis limit reached)")
                        else:
                            logger.debug(f"Skipping AI analysis for {client.name}: {tag_name} (older than 30 days)")
                    
                    # Send notifications for this new update
                    await self._send_update_notification(db, client, new_update)
                    
            except Exception as e:
                error_msg = f"Error polling {client.name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                
        db.commit()
        
        result = {
            "status": "completed",
            "clients_polled": len(active_clients),
            "updates_created": total_updates,
            "ai_analyses_queued": ai_analyses_queued,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Polling cycle completed: {total_updates} updates, {ai_analyses_queued} AI analyses queued, {len(errors)} errors")
        return result
    
    async def _analyze_update_with_ai_background(self, protocol_update_id: int, is_manual_poll: bool = False):
        """Run AI analysis on a protocol update with its own database session (for background tasks)"""
        db_gen = None
        try:
            # Get a fresh database session
            db_gen = get_db()
            db = next(db_gen)
            
            # Get the protocol update
            protocol_update = crud.get_protocol_update(db, protocol_update_id)
            if not protocol_update:
                logger.error(f"Protocol update {protocol_update_id} not found for AI analysis")
                return
                
            await self._analyze_update_with_ai(db, protocol_update, is_manual_poll)
            
        except Exception as e:
            logger.error(f"Background AI analysis error for update {protocol_update_id}: {e}")
        finally:
            # Properly close the database session
            if db_gen:
                try:
                    next(db_gen)
                except StopIteration:
                    pass  # This is expected when the generator completes

    async def _analyze_update_with_ai(self, db: Session, protocol_update, is_manual_poll: bool = False):
        """Run AI analysis on a new protocol update if AI is enabled"""
        try:
            # Get AI configuration
            ai_config = crud.get_ai_config(db)
            if not ai_config or not ai_config.ai_enabled or not ai_config.auto_analyze_enabled:
                logger.debug(f"AI analysis skipped for update {protocol_update.id}: AI not enabled or auto-analyze disabled")
                return
            
            if not ai_config.api_key:
                logger.warning(f"AI analysis skipped for update {protocol_update.id}: No API key configured")
                return
            
            # Skip if no release notes to analyze
            if not protocol_update.notes or len(protocol_update.notes.strip()) < 10:
                logger.debug(f"AI analysis skipped for update {protocol_update.id}: Release notes too short or empty")
                return
            
            # Skip if AI analysis already exists for this update
            if protocol_update.ai_summary:
                logger.debug(f"AI analysis skipped for update {protocol_update.id}: Analysis already exists")
                return
            
            # For manual polls, skip AI analysis for very long release notes to prevent timeout
            if is_manual_poll and len(protocol_update.notes) > 5000:
                logger.info(f"AI analysis skipped for update {protocol_update.id}: Manual poll with long release notes (len={len(protocol_update.notes)})")
                return
            
            logger.info(f"Running AI analysis for update {protocol_update.id}: {protocol_update.tag}")
            
            from .ai_service import AIService, AIProvider
            
            # Initialize AI service
            provider = AIProvider(ai_config.provider)
            ai_service = AIService(
                provider=provider,
                api_key=ai_config.api_key,
                model=ai_config.model,
                base_url=ai_config.base_url
            )
            
            # Run AI analysis with appropriate timeout
            timeout = 30 if is_manual_poll else 60  # Shorter timeout for manual polls since they run in background
            result = await ai_service.analyze_release_notes(
                protocol_name=protocol_update.name or "Unknown Protocol",
                client_name=protocol_update.client or "Unknown Client",
                release_title=protocol_update.title or protocol_update.tag or "Unknown Release",
                release_notes=protocol_update.notes or "",
                tag_name=protocol_update.tag or "unknown",
                is_prerelease=protocol_update.is_prerelease or False,
                timeout_seconds=timeout
            )
            
            if result:
                # Save analysis results to database
                crud.update_protocol_update_ai_analysis(db, protocol_update.id, result)
                logger.info(f"AI analysis completed for update {protocol_update.id}: Priority {result.upgrade_priority}, Hard fork: {result.is_hard_fork}")
                
                # If it's a hard fork, add special notification
                if result.is_hard_fork:
                    logger.warning(f"Hard fork detected in update {protocol_update.id}: {protocol_update.name} {protocol_update.tag}")
            else:
                logger.warning(f"AI analysis failed for update {protocol_update.id}: No result returned")
                
        except Exception as e:
            logger.error(f"AI analysis error for update {protocol_update.id}: {e}")
            # Don't raise the exception to avoid breaking the polling cycle
    
    async def _send_update_notification(self, db: Session, client, protocol_update):
        """Send notification for a new protocol update"""
        try:
            # Check if release is within the last 7 days to avoid spam when adding new clients
            from datetime import datetime, timedelta, timezone
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            
            # Convert release date to UTC timezone-aware datetime if needed
            release_date = protocol_update.date
            if release_date.tzinfo is None:
                # Assume UTC if no timezone info
                release_date = release_date.replace(tzinfo=timezone.utc)
            
            if release_date < seven_days_ago:
                logger.debug(f"Skipping notification for {client.name} release {protocol_update.tag} - older than 7 days ({release_date})")
                return
            
            # Get notification configuration
            notification_config = crud.get_notification_config(db)
            if not notification_config or not notification_config.notifications_enabled:
                logger.debug("Notifications are disabled globally")
                return
            
            # Get client-specific notification settings
            client_settings = crud.get_client_notification_settings(db, client.id)
            if client_settings and not client_settings.notifications_enabled:
                logger.debug(f"Notifications disabled for client {client.name}")
                return
            
            # Import notification service
            from .notification_service import NotificationService
            notification_service = NotificationService()
            
            # Prepare notification data
            client_name = client.name or client.client or 'Unknown'
            tag = protocol_update.tag
            title = protocol_update.title or f"New release {tag}"
            url = protocol_update.url or protocol_update.github_url
            notes = protocol_update.notes
            is_prerelease = protocol_update.is_prerelease or False
            
            # Prepare webhook configurations (support both new multiple URLs and legacy single URLs)
            discord_urls = []
            slack_urls = []
            telegram_config = None
            generic_configs = []
            
            # Discord URLs
            if notification_config.discord_enabled:
                if notification_config.discord_webhook_urls:
                    discord_urls.extend(notification_config.discord_webhook_urls)
                elif notification_config.discord_webhook_url:  # Fallback to legacy
                    discord_urls.append(notification_config.discord_webhook_url)
            
            # Slack URLs
            if notification_config.slack_enabled:
                if notification_config.slack_webhook_urls:
                    slack_urls.extend(notification_config.slack_webhook_urls)
                elif notification_config.slack_webhook_url:  # Fallback to legacy
                    slack_urls.append(notification_config.slack_webhook_url)
            
            # Telegram configuration
            if (notification_config.telegram_enabled and 
                notification_config.telegram_bot_token and 
                notification_config.telegram_chat_ids):
                telegram_config = {
                    'bot_token': notification_config.telegram_bot_token,
                    'chat_ids': notification_config.telegram_chat_ids
                }
            
            # Generic webhook configurations
            if notification_config.generic_enabled:
                if notification_config.generic_webhook_urls:
                    generic_configs.extend(notification_config.generic_webhook_urls)
                elif notification_config.generic_webhook_url:  # Fallback to legacy
                    generic_configs.append({
                        'url': notification_config.generic_webhook_url,
                        'headers': notification_config.generic_headers or {}
                    })
            
            # Send notifications
            results = await notification_service.send_protocol_update_notifications(
                client_name=client_name,
                tag=tag,
                title=title,
                url=url,
                notes=notes,
                is_prerelease=is_prerelease,
                # New multiple URL support
                discord_webhook_urls=discord_urls if discord_urls else None,
                slack_webhook_urls=slack_urls if slack_urls else None,
                telegram_bot_token=telegram_config['bot_token'] if telegram_config else None,
                telegram_chat_ids=telegram_config['chat_ids'] if telegram_config else None,
                generic_webhook_configs=generic_configs if generic_configs else None
            )
            
            # Log results
            successful_notifications = [k for k, v in results.items() if v]
            if successful_notifications:
                logger.info(f"Successfully sent notifications for {client_name} {tag}: {', '.join(successful_notifications)}")
            
            failed_notifications = [k for k, v in results.items() if not v]
            if failed_notifications:
                logger.warning(f"Failed to send notifications for {client_name} {tag}: {', '.join(failed_notifications)}")
                
        except Exception as e:
            logger.error(f"Error sending notification for {client.name} {protocol_update.tag}: {e}")


# Global instance
background_poller = BackgroundPollerService()