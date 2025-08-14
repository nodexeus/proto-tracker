"""
Protocol service for server-side operations
"""

import logging
from sqlalchemy.orm import Session
import crud
import schemas

logger = logging.getLogger(__name__)

class ProtocolService:
    def __init__(self):
        pass
        
    def create_protocol_update(self, db: Session, update_data: schemas.ProtocolUpdatesCreate) -> bool:
        """Create a new protocol update"""
        try:
            crud.create_protocol_updates(db, update_data)
            logger.info(f"Created protocol update: {update_data.tag}")
            return True
        except Exception as e:
            logger.error(f"Failed to create protocol update {update_data.tag}: {e}")
            return False