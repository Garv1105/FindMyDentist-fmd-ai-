from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OTP_PURPOSES = "('signup', 'login', 'reset_password', 'change_phone', 'step_up', 'mfa')"


def _ts(name: str, nullable: bool = False, default: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable,
                     server_default=sa.func.now() if default else None)


def upgrade() -> None:
    op.drop_table("otp_challenges")
    op.drop_table("rate_limit_buckets")


def downgrade() -> None:
    op.create_table(
        "rate_limit_buckets",
        sa.Column("key", sa.String(120), nullable=False),
        _ts("window_start"),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", "window_start", name="pk_rate_limit_buckets"),
    )
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
