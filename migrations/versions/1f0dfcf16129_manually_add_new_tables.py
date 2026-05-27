"""recreate tables with beta code"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from datetime import datetime

# revision identifiers
revision = 'xxxxxxx'  # Alembic will fill this automatically
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # USER TABLE
    op.create_table('user',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(25), nullable=False),
        sa.Column('preferred_name', sa.String(30), nullable=True),
        sa.Column('password_hashed', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )
    op.create_index(op.f('ix_user_username'), 'user', ['username'], unique=True)

    # ROUTE TABLE
    op.create_table('route',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('coordinates', sa.Text(), nullable=False),
        sa.Column('format', sa.String(25), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('ETA', sa.String(100), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('elevation_change', sa.String(30), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # POINT TABLE
    op.create_table('point',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('coordinates', sa.String(1000), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # SETTINGS TABLE
    op.create_table('settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # BETA CODE TABLE
    op.create_table('betacode',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_betacode_code'), 'betacode', ['code'], unique=True)


def downgrade():
    op.drop_table('betacode')
    op.drop_table('settings')
    op.drop_table('point')
    op.drop_table('route')
    op.drop_table('user')