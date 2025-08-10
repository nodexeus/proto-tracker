"""add poller state to github config

Revision ID: add_poller_state
Revises: 028dfd4ebae4
Create Date: 2025-08-10 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_poller_state'
down_revision: Union[str, None] = '028dfd4ebae4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add poller state columns to github_config table
    op.add_column('github_config', sa.Column('poller_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('github_config', sa.Column('last_poll_time', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove poller state columns from github_config table
    op.drop_column('github_config', 'last_poll_time')
    op.drop_column('github_config', 'poller_enabled')