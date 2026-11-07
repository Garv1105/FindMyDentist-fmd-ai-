import uuid
from functools import lru_cache
from typing import Literal, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache
from app.core.config import get_settings
from app.core.exceptions import AppError, UnauthorizedError
from app.core.security import hash_token, new_token
from app.models.security import UserMfaMethod
from app.models.user import User
from app.repositories.mfa_repository import MfaRepository
from app.services.messaging.otp_channel import Destination
from app.services.otp_service import OtpService

MfaKind = Literal["sms", "totp"]
INVALID_MFA = "That code is wrong or has expired. Please try logging in again."


class MfaFactor(Protocol):
    async def send_challenge(self, user: User, method: UserMfaMethod | None) -> None: ...
    async def verify(self, user: User, method: UserMfaMethod | None, code: str) -> None: ...


class SmsFactor:
    def __init__(self) -> None:
        self.otp = OtpService()

    async def send_challenge(self, user: User, method: UserMfaMethod | None) -> None:
        await self.otp.send(Destination.sms(user.phone), "mfa")

    async def verify(self, user: User, method: UserMfaMethod | None, code: str) -> None:
        await self.otp.verify(Destination.sms(user.phone), "mfa", code)


@lru_cache
def get_factor(kind: str) -> MfaFactor:
    return SmsFactor()


class MfaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = MfaRepository(db)
        self.settings = get_settings()

    async def challenge(self, user: User) -> str:
        method = await self.repo.default_method(user.id)
        if method is None:
            raise AppError("No second factor is set up for this account.")
        await get_factor(method.kind).send_challenge(user, method)
        token, token_hash = new_token()
        await cache.redis.set(
            f"mfa:challenge:{token_hash}", f"{user.id}:{method.kind}",
            ex=self.settings.mfa_challenge_ttl_minutes * 60,
        )
        return token

    async def resolve(self, token: str) -> tuple[uuid.UUID, str] | None:
        owner = await cache.redis.get(f"mfa:challenge:{hash_token(token)}")
        if not owner:
            return None
        user_id, _, kind = owner.partition(":")
        return uuid.UUID(user_id), kind

    async def complete(self, user: User, kind: str, token: str, code: str) -> None:
        method = await self.repo.get(user.id, kind)
        if method is None or method.confirmed_at is None:
            raise UnauthorizedError(INVALID_MFA)
        await get_factor(kind).verify(user, method, code)
        await cache.redis.delete(f"mfa:challenge:{hash_token(token)}")
