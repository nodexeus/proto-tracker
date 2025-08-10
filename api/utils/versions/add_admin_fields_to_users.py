"""add_admin_fields_to_users

Revision ID: add_admin_fields_to_users
Revises: ff17be643d4b
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_admin_fields_to_users'
down_revision = '3d73e28bfa58'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_admin column with default False
    op.add_column('Users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    
    # Add is_active column with default True
    op.add_column('Users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade():
    # Remove the admin fields
    op.drop_column('Users', 'is_active')
    op.drop_column('Users', 'is_admin')