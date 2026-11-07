import secrets
from typing import Literal

from fastapi import Request

from app.core import cache
from app.core.config import get_settings
from app.core.exceptions import AppError, TooManyRequestsError, UnauthorizedError
from app.core.security import hash_token, keyed_hash, new_token
from app.services import rate_limiter
from app.services.audit import client_ip
from app.services.messaging import Channel
from app.services.messaging.otp_channel import Destination, get_otp_channel

Purpose = Literal[
    "signup", "login", "reset_password", "verify_email", "change_phone", "step_up", "mfa"
]
INVALID_OTP = "That OTP is wrong or has expired. Request a new one."
INVALID_PROOF = "Your mobile verification expired. Please verify your number again."


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _code_hmac(dest: Destination, purpose: str, code: str) -> str:
    return keyed_hash(f"otp:{purpose}:{dest.kind}:{dest.address}:{code}")


def _keys(dest: Destination, purpose: str) -> tuple[str, str, str]:
    base = f"{purpose}:{dest.kind}:{dest.address}"
    return f"otp:code:{base}", f"otp:tries:{base}", f"otp:cooldown:{base}"


class OtpService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def send(
        self, dest: Destination, purpose: Purpose, request: Request | None = None
    ) -> Channel:
        s = self.settings
        if dest.kind == "sms" and not any(
            dest.address.startswith(code) for code in s.otp_allowed_country_codes
        ):
            raise AppError("We can only send OTPs to Indian mobile numbers for now.")

        code_key, tries_key, cooldown_key = _keys(dest, purpose)
        if not await cache.redis.set(cooldown_key, 1, nx=True, ex=s.otp_resend_seconds):
            raise TooManyRequestsError("Please wait a few seconds before requesting another OTP")
        too_many = "Too many OTP requests. Please try again later."
        await rate_limiter.hit(
            f"otp:{dest.kind}:h:{dest.address}", s.otp_hourly_limit, 3600, too_many
        )
        await rate_limiter.hit(
            f"otp:{dest.kind}:d:{dest.address}", s.otp_daily_limit, 86400, too_many
        )
        if ip := client_ip(request):
            await rate_limiter.hit(f"otp:ip:h:{ip}", s.otp_ip_hourly_limit, 3600, too_many)

        code = generate_code()
        channel = await get_otp_channel(dest.kind).deliver(dest.address, code, purpose)
        async with cache.redis.pipeline(transaction=True) as pipe:
            await (
                pipe.set(code_key, _code_hmac(dest, purpose, code), ex=s.otp_ttl_minutes * 60)
                .delete(tries_key)
                .execute()
            )
        if s.app_env != "production":
            await cache.redis.set("otp:dev:last", code, ex=s.otp_ttl_minutes * 60)
        return channel

    async def verify(self, dest: Destination, purpose: Purpose, code: str) -> None:
        code_key, tries_key, _ = _keys(dest, purpose)
        stored = await cache.redis.get(code_key)
        if stored is None:
            raise UnauthorizedError(INVALID_OTP)
        async with cache.redis.pipeline(transaction=True) as pipe:
            tries, _ = await (
                pipe.incr(tries_key)
                .expire(tries_key, self.settings.otp_ttl_minutes * 60, nx=True)
                .execute()
            )
        if tries > self.settings.otp_max_attempts or not secrets.compare_digest(
            stored, _code_hmac(dest, purpose, code)
        ):
            raise UnauthorizedError(INVALID_OTP)
        if not await cache.redis.delete(code_key):
            raise UnauthorizedError(INVALID_OTP)
        await cache.redis.delete(tries_key)

    async def issue_proof(self, dest: Destination, purpose: Purpose) -> str:
        token, token_hash = new_token()
        await cache.redis.set(
            f"otp:proof:{token_hash}",
            f"{purpose}:{dest.kind}:{dest.address}",
            ex=self.settings.proof_ttl_minutes * 60,
        )
        return token

    async def use_proof(self, dest: Destination, purpose: Purpose, proof_token: str) -> None:
        owner = await cache.redis.getdel(f"otp:proof:{hash_token(proof_token)}")
        if owner != f"{purpose}:{dest.kind}:{dest.address}":
            raise UnauthorizedError(INVALID_PROOF)
