import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.security import Consent


class ConsentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def grant(self, user_id: uuid.UUID, purposes: list[str]) -> None:
        version = get_settings().notice_version
        self.db.add_all(
            Consent(user_id=user_id, purpose=p, notice_version=version) for p in purposes
        )
        await self.db.flush()

    async def withdraw(self, user_id: uuid.UUID, purpose: str) -> None:
        await self.db.execute(
            update(Consent)
            .where(
                Consent.user_id == user_id,
                Consent.purpose == purpose,
                Consent.withdrawn_at.is_(None),
            )
            .values(withdrawn_at=datetime.now(UTC))
        )

    async def active(self, user_id: uuid.UUID) -> list[Consent]:
        result = await self.db.scalars(
            select(Consent)
            .where(Consent.user_id == user_id, Consent.withdrawn_at.is_(None))
            .order_by(Consent.granted_at)
        )
        return list(result)
