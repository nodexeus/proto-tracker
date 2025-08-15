"""Add AI analysis features and tables

Revision ID: add_ai_analysis_features
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add AI analysis fields to protocol_tracking table
    op.add_column('protocol_tracking', sa.Column('ai_summary', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_key_changes', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_breaking_changes', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_security_updates', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_upgrade_priority', sa.String(length=20), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_risk_assessment', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_technical_summary', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_executive_summary', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_estimated_impact', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_confidence_score', sa.Float(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_analysis_date', sa.DateTime(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_provider', sa.String(length=50), nullable=True))
    op.add_column('protocol_tracking', sa.Column('ai_hard_fork_details', sa.Text(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('activation_block', sa.BigInteger(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('activation_date', sa.DateTime(), nullable=True))
    op.add_column('protocol_tracking', sa.Column('coordination_required', sa.Boolean(), nullable=True))

    # Create AI configuration table
    op.create_table('ai_config',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ai_enabled', sa.Boolean(), nullable=False, default=False),
    sa.Column('provider', sa.String(length=50), nullable=False, default='openai'),
    sa.Column('api_key', sa.String(length=500), nullable=True),
    sa.Column('model', sa.String(length=100), nullable=True),
    sa.Column('base_url', sa.String(length=200), nullable=True),
    sa.Column('auto_analyze_enabled', sa.Boolean(), nullable=False, default=True),
    sa.Column('analysis_timeout_seconds', sa.Integer(), nullable=False, default=60),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_config_id'), 'ai_config', ['id'], unique=False)

    # Create AI analysis feedback table
    op.create_table('ai_analysis_feedback',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('protocol_update_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('feedback_text', sa.Text(), nullable=True),
    sa.Column('helpful_aspects', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('improvement_suggestions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    sa.ForeignKeyConstraint(['protocol_update_id'], ['protocol_tracking.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['Users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.CheckConstraint('rating >= 1 AND rating <= 5', name='rating_check')
    )
    op.create_index(op.f('ix_ai_analysis_feedback_id'), 'ai_analysis_feedback', ['id'], unique=False)
    op.create_index('idx_ai_analysis_feedback_protocol_update', 'ai_analysis_feedback', ['protocol_update_id'], unique=False)
    op.create_index('idx_ai_analysis_feedback_user', 'ai_analysis_feedback', ['user_id'], unique=False)

    # Create indexes for performance
    op.create_index('idx_protocol_tracking_ai_analysis_date', 'protocol_tracking', ['ai_analysis_date'], unique=False)
    op.create_index('idx_protocol_tracking_upgrade_priority', 'protocol_tracking', ['ai_upgrade_priority'], unique=False)
    op.create_index('idx_protocol_tracking_hard_fork', 'protocol_tracking', ['hard_fork'], unique=False)
    op.create_index('idx_protocol_tracking_activation_date', 'protocol_tracking', ['activation_date'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_protocol_tracking_activation_date', table_name='protocol_tracking')
    op.drop_index('idx_protocol_tracking_hard_fork', table_name='protocol_tracking')
    op.drop_index('idx_protocol_tracking_upgrade_priority', table_name='protocol_tracking')
    op.drop_index('idx_protocol_tracking_ai_analysis_date', table_name='protocol_tracking')
    
    # Drop tables
    op.drop_index('idx_ai_analysis_feedback_user', table_name='ai_analysis_feedback')
    op.drop_index('idx_ai_analysis_feedback_protocol_update', table_name='ai_analysis_feedback')
    op.drop_index(op.f('ix_ai_analysis_feedback_id'), table_name='ai_analysis_feedback')
    op.drop_table('ai_analysis_feedback')
    
    op.drop_index(op.f('ix_ai_config_id'), table_name='ai_config')
    op.drop_table('ai_config')
    
    # Remove AI analysis columns from protocol_tracking
    op.drop_column('protocol_tracking', 'coordination_required')
    op.drop_column('protocol_tracking', 'activation_date')
    op.drop_column('protocol_tracking', 'activation_block')
    op.drop_column('protocol_tracking', 'ai_hard_fork_details')
    op.drop_column('protocol_tracking', 'ai_provider')
    op.drop_column('protocol_tracking', 'ai_analysis_date')
    op.drop_column('protocol_tracking', 'ai_confidence_score')
    op.drop_column('protocol_tracking', 'ai_estimated_impact')
    op.drop_column('protocol_tracking', 'ai_executive_summary')
    op.drop_column('protocol_tracking', 'ai_technical_summary')
    op.drop_column('protocol_tracking', 'ai_risk_assessment')
    op.drop_column('protocol_tracking', 'ai_upgrade_priority')
    op.drop_column('protocol_tracking', 'ai_security_updates')
    op.drop_column('protocol_tracking', 'ai_breaking_changes')
    op.drop_column('protocol_tracking', 'ai_key_changes')
    op.drop_column('protocol_tracking', 'ai_summary')