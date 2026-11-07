import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dentist_profile import DentistProfile
from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, user_id: uuid.UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def get_dentist_profile(self, user_id: uuid.UUID) -> DentistProfile | None:
        return await self.db.get(DentistProfile, user_id)

    async def get_by_phone(self, phone: str) -> User | None:
        return await self.db.scalar(select(User).where(User.phone == phone))

    async def get_by_verified_email(self, email: str) -> User | None:
        return await self.db.scalar(
            select(User).where(User.email == email, User.email_verified_at.is_not(None))
        )

    async def add(self, user: User) -> User:
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user
