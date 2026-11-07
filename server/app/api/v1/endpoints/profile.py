from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.models.dentist_profile import DentistProfile
from app.repositories.user_repository import UserRepository
from app.schemas.dentist_profile import DentistProfileRead, DentistProfileWrite
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/me", tags=["profile"])


@router.get("/dentist-profile", response_model=DentistProfileRead)
async def get_dentist_profile(user: CurrentUser, db: DbSession) -> DentistProfile:
    profile = await UserRepository(db).get_dentist_profile(user.id)
    if profile is None:
        raise NotFoundError("No dentist profile yet")
    return profile


@router.put("/dentist-profile", response_model=DentistProfileRead)
async def save_dentist_profile(
    data: DentistProfileWrite, user: CurrentUser, db: DbSession
) -> DentistProfile:
    return await ProfileService(db).save_dentist_profile(user, data)
