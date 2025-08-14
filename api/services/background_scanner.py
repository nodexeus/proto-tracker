"""
Background snapshot scanner service that runs on the server
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from main import get_db, get_s3_client
import crud
import schemas
import models

logger = logging.getLogger(__name__)

class BackgroundScannerService:
    def __init__(self):
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        
    async def start(self, db: Session) -> Dict[str, Any]:
        """Start the background scanner"""
        if self.is_running:
            return {"status": "already_running", "message": "Scanner is already running"}
            
        # Get system config to check if auto scanning is enabled
        system_config = crud.get_system_config(db)
        if not system_config or not system_config.auto_scan_enabled:
            return {"status": "error", "message": "Auto scanning is not enabled in system settings"}
            
        # Check if S3 is configured
        s3_config = crud.get_s3_config(db)
        if not s3_config or not s3_config.bucket_name:
            return {"status": "error", "message": "S3 configuration not found"}
            
        # Start the background task
        self.is_running = True
        self.task = asyncio.create_task(self._scanning_loop())
        
        logger.info("Background snapshot scanner started")
        return {"status": "started", "message": "Background snapshot scanner started successfully"}
        
    async def stop(self, db: Session) -> Dict[str, Any]:
        """Stop the background scanner"""
        if not self.is_running:
            return {"status": "already_stopped", "message": "Scanner is not running"}
            
        # Stop the background task
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        logger.info("Background snapshot scanner stopped")
        return {"status": "stopped", "message": "Background snapshot scanner stopped successfully"}
        
    async def get_status(self, db: Session) -> Dict[str, Any]:
        """Get current scanner status"""
        system_config = crud.get_system_config(db)
        
        return {
            "is_running": self.is_running,
            "auto_scan_enabled": system_config.auto_scan_enabled if system_config else False,
            "auto_scan_interval_hours": system_config.auto_scan_interval_hours if system_config else 6,
            "task_alive": self.task is not None and not self.task.done() if self.task else False
        }
        
    async def scan_now(self, db: Session) -> Dict[str, Any]:
        """Run a manual scan immediately"""
        system_config = crud.get_system_config(db)
        if not system_config:
            return {"status": "error", "message": "System configuration not found"}
            
        # Check if S3 is configured
        s3_config = crud.get_s3_config(db)
        if not s3_config or not s3_config.bucket_name:
            return {"status": "error", "message": "S3 configuration not found"}
            
        # Run the scan
        result = await self._run_single_scan(db)
        
        return result
        
    async def _scanning_loop(self):
        """Main scanning loop that runs in the background"""
        logger.info("Background scanning loop started")
        
        while self.is_running:
            try:
                # Get a fresh database session
                db = next(get_db())
                
                # Check if scanner should still be running
                system_config = crud.get_system_config(db)
                if not system_config or not system_config.auto_scan_enabled:
                    logger.info("Auto scanning disabled in system settings, stopping")
                    self.is_running = False
                    break
                    
                # Run the scan
                await self._run_single_scan(db)
                
                # Wait for the scanning interval
                interval_seconds = system_config.auto_scan_interval_hours * 3600
                logger.info(f"Waiting {interval_seconds} seconds until next scan")
                await asyncio.sleep(interval_seconds)
                
            except asyncio.CancelledError:
                logger.info("Scanning loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in scanning loop: {e}")
                # Wait a bit before retrying on error
                await asyncio.sleep(300)  # 5 minutes
                
        logger.info("Background scanning loop ended")
        
    async def _run_single_scan(self, db: Session) -> Dict[str, Any]:
        """Run a single scanning cycle"""
        logger.info("Starting snapshot scanning cycle")
        
        # Get all protocols
        protocols = crud.get_protocols(db)
        if not protocols:
            logger.info("No protocols found to scan")
            return {
                "status": "completed",
                "protocols_scanned": 0,
                "new_snapshots": 0,
                "errors": [],
                "timestamp": datetime.utcnow().isoformat()
            }
        
        logger.info(f"Found {len(protocols)} protocols to scan")
        
        total_new_snapshots = 0
        errors = []
        
        for protocol in protocols:
            try:
                logger.info(f"Scanning protocol: {protocol.name}")
                
                # Call the existing snapshot scanning logic
                result = await self._scan_protocol_snapshots(db, protocol)
                
                if result["status"] == "success":
                    total_new_snapshots += result.get("new_snapshots", 0)
                    logger.info(f"Protocol {protocol.name}: {result.get('new_snapshots', 0)} new snapshots")
                else:
                    errors.append(f"Error scanning {protocol.name}: {result.get('message', 'Unknown error')}")
                    
            except Exception as e:
                error_msg = f"Error scanning protocol {protocol.name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                
        result = {
            "status": "completed",
            "protocols_scanned": len(protocols),
            "new_snapshots": total_new_snapshots,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Scanning cycle completed: {len(protocols)} protocols scanned, {total_new_snapshots} new snapshots, {len(errors)} errors")
        return result
    
    async def _scan_protocol_snapshots(self, db: Session, protocol) -> Dict[str, Any]:
        """Scan snapshots for a specific protocol (simplified version of the main endpoint)"""
        try:
            client = get_s3_client(db)
            config = crud.get_s3_config(db)

            # Use protocol name to match against snapshot paths
            protocol_name = protocol.name.lower()
            
            # Track snapshots by their full path and stats
            new_snapshots = []
            total_directories = 0
            total_manifests_checked = 0

            # List all top-level directories that start with the protocol name
            paginator = client.get_paginator("list_objects_v2")
            prefix = f"{protocol_name}-"

            logger.debug(f"Looking for snapshots with prefix: {prefix}")
            
            # Get all directories that start with our protocol name
            for page in paginator.paginate(
                Bucket=config.bucket_name, Prefix=prefix, Delimiter="/"
            ):
                if "CommonPrefixes" not in page:
                    continue

                # For each protocol directory, list its version subdirectories
                for prefix_obj in page["CommonPrefixes"]:
                    protocol_dir = prefix_obj.get("Prefix", "")
                    if not protocol_dir:
                        continue

                    total_directories += 1
                    
                    # List all version subdirectories
                    try:
                        for version_page in paginator.paginate(
                            Bucket=config.bucket_name,
                            Prefix=protocol_dir,
                            Delimiter="/"
                        ):
                            if "CommonPrefixes" not in version_page:
                                continue

                            # Check each version directory for manifest
                            for version_prefix in version_page["CommonPrefixes"]:
                                version_dir = version_prefix.get("Prefix", "")
                                if not version_dir:
                                    continue

                                manifest_path = f"{version_dir}manifest-body.json"
                                total_manifests_checked += 1

                                try:
                                    # Try to get the manifest file
                                    response = client.get_object(
                                        Bucket=config.bucket_name, Key=manifest_path
                                    )
                                    
                                    # Parse manifest data
                                    manifest_data = response["Body"].read()
                                    import json
                                    manifest_json = json.loads(manifest_data)
                                    
                                    # Extract snapshot information
                                    snapshot_path = version_dir.rstrip('/')
                                    snapshot_name = snapshot_path.split('/')[-1]
                                    
                                    # Check if this snapshot already exists in the database
                                    existing_snapshot = db.query(models.SnapshotIndex).filter(
                                        models.SnapshotIndex.protocol_id == protocol.id,
                                        models.SnapshotIndex.snapshot_id == snapshot_name
                                    ).first()
                                    
                                    if existing_snapshot:
                                        logger.debug(f"Snapshot {snapshot_name} already exists, skipping")
                                        continue
                                    
                                    # Create new snapshot index record
                                    snapshot_data = schemas.SnapshotIndexCreate(
                                        protocol_id=protocol.id,
                                        snapshot_id=snapshot_name,
                                        index_file_path=manifest_path,
                                        file_count=len(manifest_json.get('files', [])) if 'files' in manifest_json else 0,
                                        total_size=len(manifest_data),
                                        created_at=datetime.utcnow(),
                                        snapshot_metadata=manifest_json
                                    )
                                    
                                    new_snapshot = crud.create_snapshot_index(db, snapshot_data)
                                    new_snapshots.append(new_snapshot)
                                    logger.info(f"Created new snapshot index: {snapshot_name} for protocol {protocol.name}")
                                    
                                except client.exceptions.NoSuchKey:
                                    # Manifest doesn't exist, skip this directory
                                    logger.debug(f"No manifest found at {manifest_path}")
                                    continue
                                except Exception as e:
                                    logger.error(f"Error processing manifest {manifest_path}: {e}")
                                    continue
                                    
                    except Exception as e:
                        logger.error(f"Error scanning version directories in {protocol_dir}: {e}")
                        continue

            db.commit()
            
            return {
                "status": "success",
                "new_snapshots": len(new_snapshots),
                "directories_scanned": total_directories,
                "manifests_checked": total_manifests_checked
            }
            
        except Exception as e:
            logger.error(f"Error scanning protocol {protocol.name}: {e}")
            return {
                "status": "error",
                "message": str(e)
            }


# Global instance
background_scanner = BackgroundScannerService()