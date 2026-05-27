"""merging multiple heads

Revision ID: 922dbd8d8579
Revises: 218f0e5347e3, xxxx
Create Date: 2026-05-27 19:10:18.733705

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '922dbd8d8579'
down_revision: Union[str, Sequence[str], None] = ('218f0e5347e3', 'xxxx')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
