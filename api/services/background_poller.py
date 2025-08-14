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
            
        # Run the poll
        result = await self._run_single_poll(db)
        
        # Update last poll time
        crud.update_github_config(db, schemas.GitHubConfigUpdate(
            last_poll_time=datetime.utcnow()
        ))
        
        return result
        
    async def _polling_loop(self):
        """Main polling loop that runs in the background"""
        logger.info("Background polling loop started")
        
        while self.is_running:
            try:
                # Get a fresh database session
                db = next(get_db())
                
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
                
            except asyncio.CancelledError:
                logger.info("Polling loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                # Wait a bit before retrying on error
                await asyncio.sleep(60)
                
        logger.info("Background polling loop ended")
        
    async def _run_single_poll(self, db: Session) -> Dict[str, Any]:
        """Run a single polling cycle"""
        logger.info("Starting polling cycle")
        
        # Get all clients with GitHub URLs
        clients = crud.get_clients(db)
        active_clients = [c for c in clients if c.github_url]
        
        logger.info(f"Found {len(active_clients)} clients with GitHub URLs")
        
        total_updates = 0
        errors = []
        
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
                
                # Process all items (releases and/or tags) and create protocol updates
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
                        
                    # Check if we already have this release
                    client_string = client.client or client.name or 'Unknown'
                    existing = crud.get_protocol_update_by_tag(db, client_string, tag_name)
                    if existing:
                        continue
                        
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
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Polling cycle completed: {total_updates} updates, {len(errors)} errors")
        return result
    
    async def _send_update_notification(self, db: Session, client, protocol_update):
        """Send notification for a new protocol update"""
        try:
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
            
            # Collect webhook URLs
            discord_url = notification_config.discord_webhook_url if notification_config.discord_enabled else None
            slack_url = notification_config.slack_webhook_url if notification_config.slack_enabled else None
            generic_url = notification_config.generic_webhook_url if notification_config.generic_enabled else None
            generic_headers = notification_config.generic_headers
            
            # Send notifications
            results = await notification_service.send_protocol_update_notifications(
                client_name=client_name,
                tag=tag,
                title=title,
                url=url,
                notes=notes,
                is_prerelease=is_prerelease,
                discord_webhook_url=discord_url,
                slack_webhook_url=slack_url,
                generic_webhook_url=generic_url,
                generic_headers=generic_headers
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