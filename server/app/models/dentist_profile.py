import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class DentistProfile(TimestampMixin, Base):
    __tablename__ = "dentist_profiles"
    __table_args__ = (
        UniqueConstraint("council", "registration_no"),
        CheckConstraint(
            "verification_status in ('unverified', 'pending', 'verified', 'rejected')",
            name="verification_status",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), primary_key=True)
    council: Mapped[str] = mapped_column(String(100))
    registration_no: Mapped[str] = mapped_column(String(50))
    qualifications: Mapped[str | None] = mapped_column(String(200))
    specialisation: Mapped[str | None] = mapped_column(String(100))
    verification_status: Mapped[str] = mapped_column(String(20), server_default="unverified")
