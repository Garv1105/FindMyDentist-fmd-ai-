from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("users", "email", nullable=True)
    op.alter_column("users", "year_of_birth", nullable=True)
    op.alter_column("users", "city", nullable=True)
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.add_column("users", sa.Column("marketing_opt_in", sa.Boolean(), server_default=sa.false(),
                                     nullable=False))
    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(timezone=True),
                                     server_default=sa.func.now(), nullable=False))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True),
                                     nullable=True))

    op.create_table(
        "phone_otps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_phone_otps"),
        sa.CheckConstraint("purpose in ('signup')", name="ck_phone_otps_purpose"),
    )
    op.create_index("ix_phone_otps_phone_created_at", "phone_otps", ["phone", "created_at"])

    op.drop_index("uq_invitations_pending_email", table_name="invitations")
    op.alter_column("invitations", "email", nullable=True)
    op.add_column("invitations", sa.Column("phone", sa.String(20), nullable=True))
    op.create_check_constraint(
        "ck_invitations_contact", "invitations", "email is not null or phone is not null"
    )
    op.create_index(
        "uq_invitations_pending_phone", "invitations", ["clinic_id", "phone"], unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_invitations_pending_phone", table_name="invitations")
    op.drop_constraint("ck_invitations_contact", "invitations", type_="check")
    op.execute("delete from invitations where email is null")
    op.drop_column("invitations", "phone")
    op.alter_column("invitations", "email", nullable=False)
    op.create_index(
        "uq_invitations_pending_email", "invitations", ["clinic_id", sa.text("lower(email)")],
        unique=True, postgresql_where=sa.text("status = 'pending'"),
    )

    op.drop_index("ix_phone_otps_phone_created_at", table_name="phone_otps")
    op.drop_table("phone_otps")

    for column in ("phone_verified_at", "terms_accepted_at", "marketing_opt_in"):
        op.drop_column("users", column)
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.execute(
        "update users set city = coalesce(city, ''), year_of_birth = coalesce(year_of_birth, 1900)"
    )
    op.alter_column("users", "city", nullable=False)
    op.alter_column("users", "year_of_birth", nullable=False)
    op.execute("update users set email = coalesce(email, id::text || '@no-email.invalid')")
    op.alter_column("users", "email", nullable=False)
