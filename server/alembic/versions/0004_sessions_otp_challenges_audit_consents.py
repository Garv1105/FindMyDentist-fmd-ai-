from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OTP_PURPOSES = "('signup', 'login', 'reset_password', 'change_phone', 'step_up', 'mfa')"


def _ts(name: str, nullable: bool = False, default: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable,
                     server_default=sa.func.now() if default else None)


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        _ts("created_at", default=True),
        _ts("last_seen_at"),
        _ts("idle_expires_at"),
        _ts("expires_at"),
        _ts("mfa_verified_at", nullable=True),
        _ts("reauth_at", nullable=True),
        sa.Column("auth_method", sa.String(20), nullable=False),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        _ts("revoked_at", nullable=True),
        sa.Column("revoke_reason", sa.String(40), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sessions_user_id_users"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "auth_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("event", sa.String(40), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("meta", postgresql.JSONB(), server_default="{}", nullable=False),
        _ts("created_at", default=True),
        sa.PrimaryKeyConstraint("id", name="pk_auth_events"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_auth_events_user_id_users"),
    )
    op.create_index("ix_auth_events_user_id_created_at", "auth_events", ["user_id", "created_at"])
    op.execute("""
        create function fmd_deny() returns trigger language plpgsql as $$
        begin
          raise exception '% on % is not allowed', tg_op, tg_table_name
            using errcode = 'insufficient_privilege';
        end $$
    """)
    op.execute("""
        create trigger auth_events_append_only before update or delete on auth_events
          for each row execute function fmd_deny()
    """)

    op.create_table(
        "consents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("notice_version", sa.String(20), nullable=False),
        _ts("granted_at", default=True),
        _ts("withdrawn_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_consents"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_consents_user_id_users"),
        sa.CheckConstraint("purpose in ('terms', 'privacy_notice', 'marketing')",
                           name="ck_consents_purpose"),
    )
    op.create_index("ix_consents_user_id_purpose", "consents", ["user_id", "purpose"])
    op.execute("""
        insert into consents (id, user_id, purpose, notice_version, granted_at)
        select gen_random_uuid(), id, p.purpose, 'pre-2026-10-22', terms_accepted_at
        from users cross join (values ('terms'), ('privacy_notice')) as p(purpose)
        union all
        select gen_random_uuid(), id, 'marketing', 'pre-2026-10-22', terms_accepted_at
        from users where marketing_opt_in
    """)
    op.drop_column("users", "marketing_opt_in")
    op.drop_column("users", "terms_accepted_at")
    op.add_column("users", _ts("age_confirmed_at", nullable=True))
    op.add_column("users", _ts("password_changed_at", nullable=True))
    op.add_column("users", sa.Column("failed_login_count", sa.SmallInteger(), server_default="0",
                                     nullable=False))
    op.add_column("users", _ts("locked_until", nullable=True))

    op.create_table(
        "rate_limit_buckets",
        sa.Column("key", sa.String(120), nullable=False),
        _ts("window_start"),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", "window_start", name="pk_rate_limit_buckets"),
    )

    op.drop_index("ix_phone_otps_phone_created_at", table_name="phone_otps")
    op.drop_table("phone_otps")
    op.create_table(
        "otp_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(10), nullable=False),
        sa.Column("code_hmac", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        _ts("expires_at"),
        _ts("consumed_at", nullable=True),
        sa.Column("proof_hash", sa.String(64), nullable=True),
        _ts("proof_expires_at", nullable=True),
        _ts("proof_used_at", nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        _ts("created_at", default=True),
        sa.PrimaryKeyConstraint("id", name="pk_otp_challenges"),
        sa.UniqueConstraint("proof_hash", name="uq_otp_challenges_proof_hash"),
        sa.CheckConstraint(f"purpose in {OTP_PURPOSES}", name="ck_otp_challenges_purpose"),
        sa.CheckConstraint("channel in ('sms', 'whatsapp', 'log')",
                           name="ck_otp_challenges_channel"),
    )
    op.create_index("ix_otp_challenges_phone_created_at", "otp_challenges",
                    ["phone", "created_at"])
    op.create_index("ix_otp_challenges_ip_created_at", "otp_challenges", ["ip", "created_at"])


def downgrade() -> None:
    op.drop_table("otp_challenges")
    op.create_table(
        "phone_otps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        _ts("expires_at"),
        _ts("consumed_at", nullable=True),
        _ts("created_at", default=True),
        sa.PrimaryKeyConstraint("id", name="pk_phone_otps"),
        sa.CheckConstraint("purpose in ('signup')", name="ck_phone_otps_purpose"),
    )
    op.create_index("ix_phone_otps_phone_created_at", "phone_otps", ["phone", "created_at"])
    op.drop_table("rate_limit_buckets")

    for column in ("locked_until", "failed_login_count", "password_changed_at",
                   "age_confirmed_at"):
        op.drop_column("users", column)
    op.add_column("users", sa.Column("marketing_opt_in", sa.Boolean(),
                                     server_default=sa.false(), nullable=False))
    op.add_column("users", _ts("terms_accepted_at", default=True))
    op.execute("""
        update users u set marketing_opt_in = exists (
          select 1 from consents c
          where c.user_id = u.id and c.purpose = 'marketing' and c.withdrawn_at is null)
    """)
    op.drop_table("consents")

    op.execute("drop trigger auth_events_append_only on auth_events")
    op.execute("drop function fmd_deny()")
    op.drop_table("auth_events")
    op.drop_table("sessions")
