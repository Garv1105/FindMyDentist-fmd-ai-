import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.schemas.common import Email, Phone, Role

Gstin = Annotated[str, Field(pattern=r"^[0-9]{2}[A-Za-z0-9]{13}$"), AfterValidator(str.upper)]


class ClinicCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    phone: Phone
    email: Email | None = None
    gstin: Gstin | None = None


class ClinicUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    phone: Phone | None = None
    email: Email | None = None
    gstin: Gstin | None = None


class ClinicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    city: str
    phone: str
    email: str | None
    gstin: str | None
    timezone: str
    status: str
    created_at: datetime


class MemberUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    phone: str
    email: str | None


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: MemberUser
    role: Role
    status: Literal["active", "deactivated"]
    created_at: datetime


class MemberUpdate(BaseModel):
    role: Role | None = None
    status: Literal["active", "deactivated"] | None = None


class MyMembership(BaseModel):
    clinic: ClinicRead
    role: Role


class InviteCreate(BaseModel):
    email: Email
    role: Role


class InviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    expires_at: datetime
    created_at: datetime


class InviteCreated(InviteRead):
    url: str


class InvitePreview(BaseModel):
    clinic_name: str
    clinic_city: str
    role: Role
    email_hint: str
    expires_at: datetime


class InviteAccepted(BaseModel):
    clinic_id: uuid.UUID
    role: Role
