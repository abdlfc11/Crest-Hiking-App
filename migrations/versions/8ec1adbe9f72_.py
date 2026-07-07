"""empty message

Revision ID: 8ec1adbe9f72
Revises: 1add7732b9ce
Create Date: 2026-07-07 02:16:09.080577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8ec1adbe9f72'
down_revision: Union[str, Sequence[str], None] = '1add7732b9ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('action_log', sa.Column('info', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('action_log', 'info')
    # ### end Alembic commands ###
