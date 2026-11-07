import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.clinic import Clinic, ClinicMembership
from app.models.user import User
from app.repositories.clinic_repository import ClinicRepository
from app.schemas.clinic import ClinicCreate, ClinicUpdate, MemberUpdate

REQUIRED_CLINIC_FIELDS = {"name", "city", "phone"}


class ClinicService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.clinics = ClinicRepository(db)

    async def register_clinic(self, user: User, data: ClinicCreate) -> Clinic:
        if not user.email_verified:
            raise ForbiddenError("Verify your email before registering a clinic on Clinic OS.")
        clinic = Clinic(**data.model_dump())
        try:
            await self.clinics.add(clinic)
        except IntegrityError:
            raise ConflictError("This GSTIN is already registered to another clinic") from None
        await self.clinics.add(ClinicMembership(clinic_id=clinic.id, user_id=user.id, role="owner"))
        await self.db.refresh(clinic)
        return clinic

    async def get(self, clinic_id: uuid.UUID) -> Clinic:
        clinic = await self.clinics.get(clinic_id)
        if clinic is None:
            raise NotFoundError("Clinic not found")
        return clinic

    async def update(self, clinic_id: uuid.UUID, data: ClinicUpdate) -> Clinic:
        clinic = await self.get(clinic_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is None and field in REQUIRED_CLINIC_FIELDS:
                continue
            setattr(clinic, field, value)
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictError("This GSTIN is already registered to another clinic") from None
        await self.db.refresh(clinic)
        return clinic

    async def members(self, clinic_id: uuid.UUID) -> list[ClinicMembership]:
        return await self.clinics.list_members(clinic_id)

    async def update_member(
        self, clinic_id: uuid.UUID, user_id: uuid.UUID, data: MemberUpdate
    ) -> ClinicMembership:
        membership = await self.clinics.get_membership(clinic_id, user_id)
        if membership is None:
            raise NotFoundError("Member not found")
        for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(membership, field, value)
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictError("A clinic must keep at least one active owner") from None
        await self.db.refresh(membership, ["user", "role", "status", "created_at"])
        return membership
