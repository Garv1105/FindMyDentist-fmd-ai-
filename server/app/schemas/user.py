import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Role
from app.schemas.dentist_profile import DentistProfileRead


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    phone: str
    email: str | None
    email_verified: bool
    mfa_enabled: bool
    year_of_birth: int | None
    gender: str | None
    city: str | None
    created_at: datetime


class WorkspaceSummary(BaseModel):
    clinic_id: uuid.UUID
    clinic_name: str
    role: Role


class MeRead(UserRead):
    mfa_method: str | None
    mfa_methods: list[str]
    dentist_profile: DentistProfileRead | None
    workspaces: list[WorkspaceSummary]
