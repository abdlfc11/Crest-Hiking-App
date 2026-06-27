"""Store ETA as integer seconds

Revision ID: 415862c52be3
Revises: fa66cd111790
Create Date: 2026-06-27 19:15:40.620292

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "415862c52be3"
down_revision: Union[str, Sequence[str], None] = "fa66cd111790"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "route",
        "ETA",
        new_column_name="eta_seconds",
        existing_type=sa.String(length=100),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using='"ETA"::integer',
    )


def downgrade() -> None:
    op.alter_column(
        "route",
        "eta_seconds",
        new_column_name="ETA",
        existing_type=sa.Integer(),
        type_=sa.String(length=100),
        existing_nullable=False,
        postgresql_using='"eta_seconds"::text',
    )