from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.false(),
                                     nullable=False))
    op.add_column("users", sa.Column("mfa_method", sa.String(20), nullable=True))
    op.create_check_constraint("ck_users_mfa_method", "users", "mfa_method in ('sms')")


def downgrade() -> None:
    op.drop_constraint("ck_users_mfa_method", "users", type_="check")
    op.drop_column("users", "mfa_method")
    op.drop_column("users", "mfa_enabled")
