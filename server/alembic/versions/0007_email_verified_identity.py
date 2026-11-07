from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True),
                                     nullable=True))
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.create_index(
        "uq_users_email_verified", "users", [sa.text("lower(email)")], unique=True,
        postgresql_where=sa.text("email_verified_at is not null"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_email_verified", table_name="users")
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.drop_column("users", "email_verified_at")
