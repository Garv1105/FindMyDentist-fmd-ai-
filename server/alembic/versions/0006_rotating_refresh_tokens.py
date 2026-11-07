from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("prev_token_hash", sa.String(64), nullable=True))
    op.add_column("sessions", sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_sessions_prev_token_hash", "sessions", ["prev_token_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_sessions_prev_token_hash", "sessions", type_="unique")
    op.drop_column("sessions", "rotated_at")
    op.drop_column("sessions", "prev_token_hash")
