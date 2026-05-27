"""merge heads for beta code

Revision ID: 32654f53f2fa
Revises: xxxxxxx, 9e41d5dd69c0
Create Date: 2026-05-27 19:15:16.970029

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32654f53f2fa'
down_revision: Union[str, Sequence[str], None] = ('xxxxxxx', '9e41d5dd69c0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
