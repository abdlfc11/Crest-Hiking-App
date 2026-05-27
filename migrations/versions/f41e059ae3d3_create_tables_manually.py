"""create tables manually"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'xxxx'   # Alembic will fill this
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # USER TABLE
    op.create_table('user',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=25), nullable=False),
        sa.Column('preferred_name', sa.String(length=30), nullable=True),
        sa.Column('password_hashed', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )
    op.create_index(op.f('ix_user_username'), 'user', ['username'], unique=True)

    # ROUTE TABLE
    op.create_table('route',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('coordinates', sa.Text(), nullable=False),
        sa.Column('format', sa.String(length=25), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('ETA', sa.String(length=100), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('elevation_change', sa.String(length=20), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # POINT TABLE
    op.create_table('point',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('coordinates', sa.String(length=1000), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # SETTINGS TABLE
    op.create_table('settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('settings')
    op.drop_table('point')
    op.drop_table('route')
    op.drop_table('user')