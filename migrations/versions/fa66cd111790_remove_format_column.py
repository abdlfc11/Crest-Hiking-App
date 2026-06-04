"""remove format column

Revision ID: fa66cd111790
Revises: 2eca438cf54f
Create Date: 2026-06-04 11:21:32.136786

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fa66cd111790'
down_revision: Union[str, Sequence[str], None] = '2eca438cf54f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drops ONLY the format column from the route table
    op.drop_column('route', 'format')


def downgrade() -> None:
    # Restores the format column with its exact original type if rolled back
    op.add_column('route', sa.Column('format', sa.VARCHAR(length=25), nullable=False))
