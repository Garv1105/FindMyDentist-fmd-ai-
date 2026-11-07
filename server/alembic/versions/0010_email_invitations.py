from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("update invitations set status = 'revoked' where status = 'pending'")
    op.drop_index("uq_invitations_pending_phone", table_name="invitations")
    op.create_index(
        "uq_invitations_pending_email", "invitations", ["clinic_id", "email"], unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_invitations_pending_email", table_name="invitations")
    op.create_index(
        "uq_invitations_pending_phone", "invitations", ["clinic_id", "phone"], unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
