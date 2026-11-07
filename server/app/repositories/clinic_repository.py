import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clinic import Clinic, ClinicMembership


class ClinicRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, clinic_id: uuid.UUID) -> Clinic | None:
        return await self.db.get(Clinic, clinic_id)

    async def get_membership(
        self, clinic_id: uuid.UUID, user_id: uuid.UUID
    ) -> ClinicMembership | None:
        return await self.db.scalar(
            select(ClinicMembership).where(
                ClinicMembership.clinic_id == clinic_id, ClinicMembership.user_id == user_id
            )
        )

    async def list_members(self, clinic_id: uuid.UUID) -> list[ClinicMembership]:
        result = await self.db.scalars(
            select(ClinicMembership)
            .where(ClinicMembership.clinic_id == clinic_id)
            .options(selectinload(ClinicMembership.user))
            .order_by(ClinicMembership.created_at)
        )
        return list(result)

    async def list_for_user(self, user_id: uuid.UUID) -> list[ClinicMembership]:
        result = await self.db.scalars(
            select(ClinicMembership)
            .where(ClinicMembership.user_id == user_id, ClinicMembership.status == "active")
            .options(selectinload(ClinicMembership.clinic))
            .order_by(ClinicMembership.created_at)
        )
        return list(result)

    async def add(self, obj: Clinic | ClinicMembership) -> None:
        self.db.add(obj)
        await self.db.flush()
