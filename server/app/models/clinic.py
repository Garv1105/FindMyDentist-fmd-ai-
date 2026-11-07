import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.user import User

ROLE_CHECK = "role in ('owner', 'dentist', 'receptionist', 'finance', 'assistant')"


class Clinic(TimestampMixin, Base):
    __tablename__ = "clinics"
    __table_args__ = (
        CheckConstraint("gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'", name="gstin_format"),
        CheckConstraint("status in ('active', 'suspended', 'closed')", name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid7)
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(320))
    gstin: Mapped[str | None] = mapped_column(String(15), unique=True)
    timezone: Mapped[str] = mapped_column(String(64), server_default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(20), server_default="active")


class ClinicMembership(TimestampMixin, Base):
    __tablename__ = "clinic_memberships"
    __table_args__ = (
        UniqueConstraint("clinic_id", "user_id"),
        CheckConstraint(ROLE_CHECK, name="role"),
        CheckConstraint("status in ('active', 'deactivated')", name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid7)
    clinic_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clinics.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default="active")

    clinic: Mapped[Clinic] = relationship(lazy="raise")
    user: Mapped[User] = relationship(lazy="raise")


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(ROLE_CHECK, name="role"),
        CheckConstraint(
            "status in ('pending', 'accepted', 'revoked', 'expired')", name="status"
        ),
        CheckConstraint("(status = 'accepted') = (accepted_by is not null)", name="accepted"),
        CheckConstraint("email is not null or phone is not null", name="contact"),
        Index(
            "uq_invitations_pending_email",
            "clinic_id",
            "email",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid7)
    clinic_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clinics.id"))
    invited_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(20))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    clinic: Mapped[Clinic] = relationship(lazy="raise")
