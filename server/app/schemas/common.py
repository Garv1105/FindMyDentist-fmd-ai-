import re
from typing import Annotated, Literal

from pydantic import AfterValidator, EmailStr

E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")


def normalise_phone(value: str) -> str:
    digits = re.sub(r"[\s\-().]", "", value)
    if re.fullmatch(r"[6-9][0-9]{9}", digits):
        digits = "+91" + digits
    elif re.fullmatch(r"0[6-9][0-9]{9}", digits):
        digits = "+91" + digits[1:]
    elif digits.startswith("00"):
        digits = "+" + digits[2:]
    if not E164.fullmatch(digits):
        raise ValueError("Enter a valid mobile number, e.g. 98765 43210 or +91 98765 43210")
    return digits


def _blank_to_none(value: str | None) -> str | None:
    return value.strip() or None if value is not None else None


Email = Annotated[EmailStr, AfterValidator(str.lower)]
Phone = Annotated[str, AfterValidator(normalise_phone)]
OptionalText = Annotated[str | None, AfterValidator(_blank_to_none)]
Role = Literal["owner", "dentist", "receptionist"]
