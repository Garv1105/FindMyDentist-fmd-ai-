from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol

from app.core.config import get_settings
from app.services.email import get_mailer
from app.services.messaging import Channel, get_sender

DestinationKind = Literal["sms", "email"]

OTP_EMAIL_SUBJECT = "Your FMD verification code"


@dataclass(frozen=True)
class Destination:
    kind: DestinationKind
    address: str

    @classmethod
    def sms(cls, phone: str) -> Destination:
        return cls("sms", phone)

    @classmethod
    def email(cls, email: str) -> Destination:
        return cls("email", email)


class OtpChannel(Protocol):
    async def deliver(self, address: str, code: str, purpose: str) -> Channel: ...


class SmsOtpChannel:
    def __init__(self) -> None:
        self.sender = get_sender()

    async def deliver(self, address: str, code: str, purpose: str) -> Channel:
        return await self.sender.send_otp(address, code, purpose)


class EmailOtpChannel:
    def __init__(self) -> None:
        self.mailer = get_mailer()

    async def deliver(self, address: str, code: str, purpose: str) -> Channel:
        minutes = get_settings().otp_ttl_minutes
        body = (
            f"Your FMD verification code is {code}.\n\n"
            f"It expires in {minutes} minutes. If you didn't request it, ignore this email."
        )
        await self.mailer.send(address, OTP_EMAIL_SUBJECT, body)
        return "email"


@lru_cache
def get_otp_channel(kind: DestinationKind) -> OtpChannel:
    return EmailOtpChannel() if kind == "email" else SmsOtpChannel()
