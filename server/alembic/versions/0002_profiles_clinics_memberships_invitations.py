from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE_CHECK = "role in ('owner', 'dentist', 'receptionist')"


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
    ]


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(200), nullable=True))
    op.execute("update users set full_name = concat_ws(' ', first_name, last_name)")
    op.alter_column("users", "full_name", nullable=False)
    op.drop_column("users", "first_name")
    op.drop_column("users", "last_name")
    op.add_column("users", sa.Column("phone", sa.String(20), nullable=False))
    op.add_column("users", sa.Column("year_of_birth", sa.SmallInteger(), nullable=False))
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(100), nullable=False))
    op.create_check_constraint("ck_users_phone_e164", "users", r"phone ~ '^\+[1-9][0-9]{7,14}$'")
    op.create_check_constraint(
        "ck_users_year_of_birth", "users", "year_of_birth between 1900 and 2100"
    )
    op.create_check_constraint(
        "ck_users_gender", "users", "gender in ('female', 'male', 'other', 'undisclosed')"
    )

    op.create_table(
        "dentist_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("council", sa.String(100), nullable=False),
        sa.Column("registration_no", sa.String(50), nullable=False),
        sa.Column("qualifications", sa.String(200), nullable=True),
        sa.Column("specialisation", sa.String(100), nullable=True),
        sa.Column("verification_status", sa.String(20), server_default="unverified",
                  nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("user_id", name="pk_dentist_profiles"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],
                                name="fk_dentist_profiles_user_id_users"),
        sa.UniqueConstraint("council", "registration_no", name="uq_dentist_profiles_council"),
        sa.CheckConstraint(
            "verification_status in ('unverified', 'pending', 'verified', 'rejected')",
            name="ck_dentist_profiles_verification_status",
        ),
    )

    op.create_table(
        "clinics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("timezone", sa.String(64), server_default="Asia/Kolkata", nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_clinics"),
        sa.UniqueConstraint("gstin", name="uq_clinics_gstin"),
        sa.CheckConstraint("gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'", name="ck_clinics_gstin_format"),
        sa.CheckConstraint("status in ('active', 'suspended', 'closed')",
                           name="ck_clinics_status"),
    )

    op.create_table(
        "clinic_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("clinic_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_clinic_memberships"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"],
                                name="fk_clinic_memberships_clinic_id_clinics"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],
                                name="fk_clinic_memberships_user_id_users"),
        sa.UniqueConstraint("clinic_id", "user_id", name="uq_clinic_memberships_clinic_id"),
        sa.CheckConstraint(ROLE_CHECK, name="ck_clinic_memberships_role"),
        sa.CheckConstraint("status in ('active', 'deactivated')",
                           name="ck_clinic_memberships_status"),
    )
    op.create_index("ix_clinic_memberships_user_id", "clinic_memberships", ["user_id"])
    op.execute("""
        create function fmd_keep_owner() returns trigger language plpgsql as $$
        begin
          if not exists (
            select 1 from clinic_memberships
            where clinic_id = old.clinic_id and role = 'owner' and status = 'active'
          ) then
            raise exception 'clinic % must keep at least one active owner', old.clinic_id
              using errcode = 'check_violation';
          end if;
          return null;
        end $$
    """)
    op.execute("""
        create trigger keep_owner after update or delete on clinic_memberships for each row
          when (old.role = 'owner' and old.status = 'active') execute function fmd_keep_owner()
    """)

    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("clinic_id", sa.Uuid(), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=False),
        sa.Column("accepted_by", sa.Uuid(), nullable=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_invitations"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"],
                                name="fk_invitations_clinic_id_clinics"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"],
                                name="fk_invitations_invited_by_users"),
        sa.ForeignKeyConstraint(["accepted_by"], ["users.id"],
                                name="fk_invitations_accepted_by_users"),
        sa.UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
        sa.CheckConstraint(ROLE_CHECK, name="ck_invitations_role"),
        sa.CheckConstraint("status in ('pending', 'accepted', 'revoked', 'expired')",
                           name="ck_invitations_status"),
        sa.CheckConstraint("(status = 'accepted') = (accepted_by is not null)",
                           name="ck_invitations_accepted"),
    )
    op.create_index(
        "uq_invitations_pending_email", "invitations",
        ["clinic_id", sa.text("lower(email)")], unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_table("invitations")
    op.execute("drop trigger keep_owner on clinic_memberships")
    op.execute("drop function fmd_keep_owner()")
    op.drop_table("clinic_memberships")
    op.drop_table("clinics")
    op.drop_table("dentist_profiles")
    for name in ("gender", "year_of_birth", "phone_e164"):
        op.drop_constraint(f"ck_users_{name}", "users", type_="check")
    for column in ("city", "gender", "year_of_birth", "phone"):
        op.drop_column("users", column)
    op.add_column("users", sa.Column("first_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(100), nullable=True))
    op.execute("update users set first_name = full_name")
    op.alter_column("users", "first_name", nullable=False)
    op.drop_column("users", "full_name")
