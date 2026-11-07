from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.models.dentist_profile import DentistProfile
from app.models.user import User
from app.repositories.clinic_repository import ClinicRepository
from app.repositories.mfa_repository import MfaRepository
from app.repositories.user_repository import UserRepository
from app.schemas.dentist_profile import DentistProfileRead, DentistProfileWrite
from app.schemas.user import MeRead, UserRead, WorkspaceSummary


class ProfileService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def me(self, user: User) -> MeRead:
        profile = await self.users.get_dentist_profile(user.id)
        memberships = await ClinicRepository(self.db).list_for_user(user.id)
        methods = await MfaRepository(self.db).confirmed(user.id)
        default = next((m.kind for m in methods if m.is_default), None)
        return MeRead(
            **UserRead.model_validate(user).model_dump(),
            mfa_method=default,
            mfa_methods=[m.kind for m in methods],
            dentist_profile=DentistProfileRead.model_validate(profile) if profile else None,
            workspaces=[
                WorkspaceSummary(clinic_id=m.clinic_id, clinic_name=m.clinic.name, role=m.role)
                for m in memberships
            ],
        )

    async def save_dentist_profile(self, user: User, data: DentistProfileWrite) -> DentistProfile:
        profile = await self.users.get_dentist_profile(user.id)
        if profile is None:
            profile = DentistProfile(user_id=user.id)
            self.db.add(profile)
        elif (profile.council, profile.registration_no) != (data.council, data.registration_no):
            profile.verification_status = "unverified"
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictError(
                "This registration number is already linked to another FMD account"
            ) from None
        await self.db.refresh(profile)
        return profile
