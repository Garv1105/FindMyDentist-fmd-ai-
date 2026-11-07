import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security import UserMfaMethod


class MfaRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def default_method(self, user_id: uuid.UUID) -> UserMfaMethod | None:
        return await self.db.scalar(
            select(UserMfaMethod).where(
                UserMfaMethod.user_id == user_id,
                UserMfaMethod.is_default.is_(True),
                UserMfaMethod.confirmed_at.is_not(None),
            )
        )

    async def get(self, user_id: uuid.UUID, kind: str) -> UserMfaMethod | None:
        return await self.db.scalar(
            select(UserMfaMethod).where(
                UserMfaMethod.user_id == user_id, UserMfaMethod.kind == kind
            )
        )

    async def confirmed(self, user_id: uuid.UUID) -> list[UserMfaMethod]:
        result = await self.db.scalars(
            select(UserMfaMethod).where(
                UserMfaMethod.user_id == user_id, UserMfaMethod.confirmed_at.is_not(None)
            )
        )
        return list(result)

    async def enroll_confirmed(
        self, user_id: uuid.UUID, kind: str, *, secret: str | None = None
    ) -> UserMfaMethod:
        existing = await self.confirmed(user_id)
        method = await self.get(user_id, kind)
        if method is None:
            method = UserMfaMethod(user_id=user_id, kind=kind, secret_enc=secret)
            self.db.add(method)
        method.confirmed_at = datetime.now(UTC)
        method.is_default = len(existing) == 0
        await self.db.flush()
        return method

    async def delete_all(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            delete(UserMfaMethod).where(UserMfaMethod.user_id == user_id)
        )
        return result.rowcount
