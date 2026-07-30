"""add session_table, drop betacode, align schema

Revision ID: 273e30ebb1a9
Revises: b6b92be4d26b
Create Date: 2026-07-28 15:23:49.521211
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '273e30ebb1a9'
down_revision: Union[str, Sequence[str], None] = 'b6b92be4d26b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New sessions table (with CASCADE)
    op.create_table(
        'session_table',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),          # fixed: no sqlmodel
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_table_session_id'), 'session_table', ['session_id'], unique=True)

    # 2. Drop deprecated betacode
    op.drop_index(op.f('ix_betacode_code'), table_name='betacode')
    op.drop_table('betacode')

    # 3. Align created_at columns
    op.alter_column(
        'user', 'created_at',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        nullable=False,
    )
    op.alter_column(
        'point', 'created_at',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        nullable=False,
    )
    op.alter_column(
        'route', 'created_at',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        nullable=False,
    )

    # NOTE: We deliberately do NOT touch the existing foreign keys on
    # point / route / settings, so their ON DELETE CASCADE stays intact.
    # We also do NOT drop the unique constraint on user.username.


def downgrade() -> None:
    # Reverse created_at changes
    op.alter_column(
        'route', 'created_at',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        nullable=True,
    )
    op.alter_column(
        'point', 'created_at',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        nullable=True,
    )
    op.alter_column(
        'user', 'created_at',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        nullable=True,
    )

    # Recreate betacode
    op.create_table(
        'betacode',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('code', sa.VARCHAR(), nullable=False),
        sa.Column('used', sa.BOOLEAN(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('betacode_pkey')),
        sa.UniqueConstraint('code', name=op.f('betacode_code_key')),
    )
    op.create_index(op.f('ix_betacode_code'), 'betacode', ['code'], unique=True)

    # Drop session table
    op.drop_index(op.f('ix_session_table_session_id'), table_name='session_table')
    op.drop_table('session_table')