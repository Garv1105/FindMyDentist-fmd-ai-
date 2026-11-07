"""Clinic roles finance and assistant, for the FMD app's clinic workspace.

Finance handles billing; assistant gives chairside support.

The app maps owner, dentist, receptionist, finance and assistant onto its clinic permissions.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW = "role in ('owner', 'dentist', 'receptionist', 'finance', 'assistant')"
OLD = "role in ('owner', 'dentist', 'receptionist')"


def _set(check: str) -> None:
    for table in ("clinic_memberships", "invitations"):
        op.drop_constraint(f"ck_{table}_role", table, type_="check")
        op.create_check_constraint(f"ck_{table}_role", table, check)


def upgrade() -> None:
    _set(NEW)


def downgrade() -> None:
    op.execute(
        "update invitations set status = 'revoked'"
        " where role in ('finance', 'assistant') and status = 'pending'"
    )
    op.execute("delete from clinic_memberships where role in ('finance', 'assistant')")
    _set(OLD)
