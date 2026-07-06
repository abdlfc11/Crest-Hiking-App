"""add action_log table

Revision ID: 1add7732b9ce
Revises: 415862c52be3
Create Date: 2026-07-06 23:26:38.370370
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

# revision identifiers, used by Alembic.
revision: str = '1add7732b9ce'
down_revision: str = '415862c52be3'
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('action_log',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('outcome', sa.Boolean(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('error_code', sa.String(length=50), nullable=True),
        sa.Column('created_at', TIMESTAMP(timezone=True), 
                  server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('action_log_pkey'))
    )
    
    op.create_index(
        op.f('idx_action_log_action_created'), 
        'action_log', 
        ['action', 'created_at'], 
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('idx_action_log_action_created'), table_name='action_log')
    op.drop_table('action_log')