import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.common import Email, Phone

OtpCode = Field(pattern=r"^[0-9]{6}$")

Identifier = Annotated[
    str, Field(validation_alias=AliasChoices("identifier", "phone"), min_length=1, max_length=320)
]

_PW_CLASSES = (
    (r"[a-z]", "a lowercase letter"),
    (r"[A-Z]", "an uppercase letter"),
    (r"[0-9]", "a number"),
    (r"[^A-Za-z0-9]", "a special character"),
)


def _strong_password(value: str) -> str:
    missing = [label for pattern, label in _PW_CLASSES if not re.search(pattern, value)]
    if missing:
        raise ValueError("Password must include " + ", ".join(missing) + ".")
    return value


Password = Annotated[str, Field(min_length=8, max_length=128), AfterValidator(_strong_password)]


class OtpRequest(BaseModel):
    identifier: Identifier
    purpose: Literal["signup", "login", "reset_password"] = "signup"


class OtpVerifyRequest(BaseModel):
    identifier: Identifier
    purpose: Literal["reset_password"]
    code: str = OtpCode


class ProofResponse(BaseModel):
    proof_token: str


class MfaChallengeResponse(BaseModel):
    mfa_required: bool = True
    challenge_token: str


class MfaVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=100)
    code: str = OtpCode


class MfaEnableRequest(BaseModel):
    code: str = OtpCode


class MfaDisableRequest(BaseModel):
    password: str | None = Field(default=None, max_length=128)


class PasswordCheckRequest(BaseModel):
    password: Password


class EmailAddRequest(BaseModel):
    email: Email
    password: str | None = Field(default=None, max_length=128)


class EmailVerifyRequest(BaseModel):
    code: str = OtpCode


class EmailRemoveRequest(BaseModel):
    password: str | None = Field(default=None, max_length=128)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=200)
    phone: Phone
    password: Password
    otp: str = OtpCode
    marketing_opt_in: bool = False
    accept_terms: Literal[True]
    age_confirmed: Literal[True]


class PasswordLoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=320)
    password: str = Field(max_length=128)


class OtpLoginRequest(BaseModel):
    identifier: Identifier
    code: str = OtpCode


class PasswordResetRequest(BaseModel):
    identifier: Identifier
    proof_token: str = Field(min_length=20, max_length=100)
    new_password: Password


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    auth_method: str
    ip: str | None
    user_agent: str | None
    current: bool = False
