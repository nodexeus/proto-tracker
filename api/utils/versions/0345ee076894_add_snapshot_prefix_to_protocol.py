"""add_snapshot_prefix_to_protocol

Revision ID: 0345ee076894
Revises: ff17be643d4b
Create Date: 2025-01-30 16:19:27.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0345ee076894'
down_revision = 'ff17be643d4b'
branch_labels = None
depends_on = None


def upgrade():
    # Add snapshot_prefix column to protocols table
    op.add_column('protocols', sa.Column('snapshot_prefix', sa.String(), nullable=True))
    
    # Update existing ethereum protocol with its snapshot prefix
    op.execute("""
        UPDATE protocols 
        SET snapshot_prefix = 'ethereum-geth-mainnet-full-v1' 
        WHERE name = 'ethereum'
    """)


def downgrade():
    # Remove snapshot_prefix column from protocols table
    op.drop_column('protocols', 'snapshot_prefix')
