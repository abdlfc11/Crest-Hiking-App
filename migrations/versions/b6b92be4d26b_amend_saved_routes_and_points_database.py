"""Amend saved routes and points database

Revision ID: b6b92be4d26b
Revises: ca5bbea5443f
Create Date: 2026-07-18 16:18:41.324884

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6b92be4d26b'
down_revision: Union[str, Sequence[str], None] = 'ca5bbea5443f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- ROUTE TABLE CHANGES ---
    # Drop the old standalone unique constraint on the name column
    op.drop_constraint('route_name_key', 'route', type_='unique')
    # Add the new composite unique constraint (user_id + name)
    op.create_unique_constraint('user_route_name', 'route', ['user_id', 'name'])

    # --- POINT TABLE CHANGES ---
    # Drop the old standalone unique constraint on the name column
    op.drop_constraint('point_name_key', 'point', type_='unique')
    # Add the new composite unique constraint (user_id + name)
    op.create_unique_constraint('user_point_name', 'point', ['user_id', 'name'])


def downgrade() -> None:
    """Downgrade schema."""
    # --- Revert POINT CHANGES ---
    op.drop_constraint('user_point_name', 'point', type_='unique')
    op.create_unique_constraint('point_name_key', 'point', ['name'])

    # --- Revert ROUTE CHANGES ---
    op.drop_constraint('user_route_name', 'route', type_='unique')
    op.create_unique_constraint('route_name_key', 'route', ['name'])