from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mfa_methods",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("secret_enc", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_mfa_methods"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_mfa_methods_user"),
        sa.CheckConstraint("kind in ('sms', 'totp')", name="ck_mfa_methods_kind"),
        sa.UniqueConstraint("user_id", "kind", name="uq_mfa_methods_user_kind"),
    )
    op.create_index("ix_mfa_methods_user_id", "mfa_methods", ["user_id"])
    op.create_index("uq_mfa_methods_default", "mfa_methods", ["user_id"], unique=True,
                    postgresql_where=sa.text("is_default"))
    op.execute(
        "insert into mfa_methods (id, user_id, kind, is_default, confirmed_at, created_at) "
        "select gen_random_uuid(), id, 'sms', true, now(), now() "
        "from users where mfa_enabled = true"
    )
    op.drop_constraint("ck_users_mfa_method", "users", type_="check")
    op.drop_column("users", "mfa_method")


def downgrade() -> None:
    op.add_column("users", sa.Column("mfa_method", sa.String(20), nullable=True))
    op.create_check_constraint("ck_users_mfa_method", "users", "mfa_method in ('sms')")
    op.execute("update users set mfa_method = 'sms' where mfa_enabled = true")
    op.drop_index("uq_mfa_methods_default", table_name="mfa_methods")
    op.drop_index("ix_mfa_methods_user_id", table_name="mfa_methods")
    op.drop_table("mfa_methods")
