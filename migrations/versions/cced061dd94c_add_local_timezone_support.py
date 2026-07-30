"""add local timezone support

Revision ID: cced061dd94c
Revises: 8b6749758e3c
Create Date: 2026-07-30 23:03:51.671252

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cced061dd94c'
down_revision: Union[str, Sequence[str], None] = '8b6749758e3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# List of tables containing created_at columns needing timezone awareness
TABLES = ["user", "route", "point", "action_log", "issues", "session_table"]


def upgrade() -> None:
    """Upgrade schema."""
    # Convert created_at columns to TIMESTAMPTZ
    for table in TABLES:
        op.alter_column(
            table,
            'created_at',
            type_=sa.DateTime(timezone=True),
            postgresql_using="created_at AT TIME ZONE 'UTC'",
        )
    
    # Handle session_table.expires_at specifically
    op.alter_column(
        'session_table',
        'expires_at',
        type_=sa.DateTime(timezone=True),
        postgresql_using="expires_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revert created_at columns back to naive TIMESTAMP
    for table in TABLES:
        op.alter_column(
            table,
            'created_at',
            type_=sa.DateTime(timezone=False),
        )
        
    # Revert session_table.expires_at
    op.alter_column(
        'session_table',
        'expires_at',
        type_=sa.DateTime(timezone=False),
    )