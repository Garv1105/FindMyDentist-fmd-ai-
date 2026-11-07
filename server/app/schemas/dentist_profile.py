from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import OptionalText


class DentistProfileWrite(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    council: str = Field(min_length=2, max_length=100)
    registration_no: str = Field(min_length=1, max_length=50)
    qualifications: OptionalText = Field(default=None, max_length=200)
    specialisation: OptionalText = Field(default=None, max_length=100)


class DentistProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    council: str
    registration_no: str
    qualifications: str | None
    specialisation: str | None
    verification_status: str
