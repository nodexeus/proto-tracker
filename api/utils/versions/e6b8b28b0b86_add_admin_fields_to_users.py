"""add admin fields to users

Revision ID: e6b8b28b0b86
Revises: 3d73e28bfa58
Create Date: 2025-08-09 13:51:15.895932

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6b8b28b0b86'
down_revision: Union[str, None] = '3d73e28bfa58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_admin column with default False
    op.add_column('Users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    
    # Add is_active column with default True
    op.add_column('Users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    # Remove the admin fields
    op.drop_column('Users', 'is_active')
    op.drop_column('Users', 'is_admin')
