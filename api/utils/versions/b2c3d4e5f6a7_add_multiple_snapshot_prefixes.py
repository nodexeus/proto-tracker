"""Add multiple snapshot prefixes support

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-09-01 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create protocol_snapshot_prefixes table
    op.create_table(
        'protocol_snapshot_prefixes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('protocol_id', sa.Integer(), nullable=False),
        sa.Column('prefix', sa.String(), nullable=False),
        sa.Column('client_name', sa.String(), nullable=True),
        sa.Column('network', sa.String(), nullable=True),
        sa.Column('node_type', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['protocol_id'], ['protocols.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('protocol_id', 'prefix', name='unique_protocol_prefix')
    )
    op.create_index('ix_protocol_snapshot_prefixes_protocol_id', 'protocol_snapshot_prefixes', ['protocol_id'])
    op.create_index('ix_protocol_snapshot_prefixes_is_active', 'protocol_snapshot_prefixes', ['is_active'])

    # Add prefix_id column to snapshot_indices table
    op.add_column('snapshot_indices', sa.Column('prefix_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_snapshot_indices_prefix_id', 'snapshot_indices', 'protocol_snapshot_prefixes', ['prefix_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_snapshot_indices_prefix_id', 'snapshot_indices', ['prefix_id'])


def downgrade() -> None:
    # Remove the new foreign key and column from snapshot_indices
    op.drop_index('ix_snapshot_indices_prefix_id', table_name='snapshot_indices')
    op.drop_constraint('fk_snapshot_indices_prefix_id', 'snapshot_indices', type_='foreignkey')
    op.drop_column('snapshot_indices', 'prefix_id')

    # Drop the protocol_snapshot_prefixes table
    op.drop_index('ix_protocol_snapshot_prefixes_is_active', table_name='protocol_snapshot_prefixes')
    op.drop_index('ix_protocol_snapshot_prefixes_protocol_id', table_name='protocol_snapshot_prefixes')
    op.drop_table('protocol_snapshot_prefixes')