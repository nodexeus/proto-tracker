"""add github config table

Revision ID: 57bf83b11bfb
Revises: e6b8b28b0b86
Create Date: 2025-08-09 13:53:03.315811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '57bf83b11bfb'
down_revision: Union[str, None] = 'e6b8b28b0b86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create github_config table
    op.create_table('github_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('api_key', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_config_id', 'github_config', ['id'], unique=False)


def downgrade() -> None:
    # Drop github_config table
    op.drop_index('ix_github_config_id', table_name='github_config')
    op.drop_table('github_config')
