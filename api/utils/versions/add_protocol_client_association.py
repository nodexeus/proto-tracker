"""Add Protocol-Client association table

Revision ID: protocol_client_assoc
Revises: ff17be643d4b
Create Date: 2025-08-09 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'protocol_client_assoc'
down_revision = 'ff17be643d4b'
branch_labels = None
depends_on = None

def upgrade():
    # Create the protocol_clients association table
    op.create_table(
        'protocol_clients',
        sa.Column('protocol_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('is_primary', sa.Boolean(), nullable=False, default=False),  # Flag for primary client
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['protocol_id'], ['protocols.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('protocol_id', 'client_id')
    )
    
    # Create indexes for better query performance
    op.create_index('ix_protocol_clients_protocol_id', 'protocol_clients', ['protocol_id'])
    op.create_index('ix_protocol_clients_client_id', 'protocol_clients', ['client_id'])
    
    # Add client_id foreign key to protocol_tracking table
    # First, add the column as nullable
    op.add_column('protocol_tracking', sa.Column('client_id', sa.Integer(), nullable=True))
    
    # Create the foreign key constraint
    op.create_foreign_key(
        'fk_protocol_tracking_client_id',
        'protocol_tracking', 'clients',
        ['client_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create index for better query performance
    op.create_index('ix_protocol_tracking_client_id', 'protocol_tracking', ['client_id'])


def downgrade():
    # Drop indexes and constraints
    op.drop_index('ix_protocol_tracking_client_id')
    op.drop_constraint('fk_protocol_tracking_client_id', 'protocol_tracking', type_='foreignkey')
    op.drop_column('protocol_tracking', 'client_id')
    
    # Drop protocol_clients table indexes and table
    op.drop_index('ix_protocol_clients_client_id')
    op.drop_index('ix_protocol_clients_protocol_id')
    op.drop_table('protocol_clients')