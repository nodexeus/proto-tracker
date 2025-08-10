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
                    
                # Get releases since last poll
                # For now, get recent releases (we can add timestamp tracking later)
                releases = await self.github_service.get_recent_releases(
                    repo_info['owner'], repo_info['repo']
                )
                
                # Process releases and create protocol updates
                for release in releases:
                    # Check if we already have this release
                    existing = crud.get_protocol_update_by_tag(db, client.id, release.tag_name)
                    if existing:
                        continue
                        
                    # Create protocol update
                    update_data = schemas.ProtocolUpdatesCreate(
                        name=client.name or 'Unknown',
                        title=release.name or release.tag_name,
                        client=client.client or client.name or 'Unknown',
                        tag=release.tag_name,
                        date=release.published_at,
                        url=release.html_url,
                        notes=release.body or '',
                        github_url=release.html_url,
                        is_draft=release.draft,
                        is_prerelease=release.prerelease,
                        is_closed=True
                    )
                    
                    crud.create_protocol_updates(db, update_data)
                    total_updates += 1
                    logger.info(f"Created update for {client.name}: {release.tag_name}")
                    
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


# Global instance
background_poller = BackgroundPollerService()