import logging
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    AppError,
    ConflictError,
    NotFoundError,
    TooManyRequestsError,
    UnauthorizedError,
)
from app.core.security import DUMMY_HASH, hash_password, password_needs_rehash, verify_password
from app.models.user import User
from app.repositories.mfa_repository import MfaRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    EmailAddRequest,
    EmailRemoveRequest,
    MfaDisableRequest,
    MfaVerifyRequest,
    OtpLoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    PasswordLoginRequest,
    PasswordResetRequest,
    RegisterRequest,
)
from app.schemas.common import normalise_phone
from app.services import audit, rate_limiter
from app.services.consent_service import ConsentService
from app.services.email import get_mailer
from app.services.messaging import get_sender
from app.services.messaging.otp_channel import Destination
from app.services.mfa import INVALID_MFA, MfaService
from app.services.otp_service import OtpService
from app.services.password_policy import ensure_not_breached
from app.services.session_service import SessionService

PHONE_TAKEN = "An account with this mobile number already exists. Sign in instead."
NO_ACCOUNT = "No FMD account uses this mobile number. Register instead."
BAD_LOGIN = "Incorrect mobile number, email or password"
EMAIL_TAKEN = "This email is already in use by another account."
SECURITY_EMAILS = {
    "password_changed": (
        "Your FMD password was changed",
        "Hi {name},\n\nYour FMD password was just changed and you were signed out on all "
        "devices. If this wasn't you, reset your password now and contact support.",
    ),
    "account_locked": (
        "Your FMD account was temporarily locked",
        "Hi {name},\n\nWe locked your FMD account for a few minutes after repeated wrong "
        "passwords. You can still log in with an OTP. If this wasn't you, change your password.",
    ),
}

logger = logging.getLogger("app.auth")


class AuthService:
    """Local mobile-first auth: OTP-verified signup, password/OTP login, lockout, reset."""

    def __init__(self, db: AsyncSession, request: Request) -> None:
        self.db = db
        self.request = request
        self.settings = get_settings()
        self.users = UserRepository(db)
        self.otp = OtpService()

    async def send_otp(self, data: OtpRequest) -> None:
        if data.purpose == "signup":
            phone = self._phone_or_400(data.identifier)
            if await self.users.get_by_phone(phone):
                raise ConflictError(PHONE_TAKEN)
            dest = Destination.sms(phone)
        else:
            user, dest = await self._destination(data.identifier)
            if user is None:
                raise NotFoundError(NO_ACCOUNT)
        channel = await self.otp.send(dest, data.purpose, self.request)
        await audit.record(self.db, "otp.sent", "ok", request=self.request, purpose=data.purpose,
                           channel=channel)

    async def verify_otp(self, data: OtpVerifyRequest) -> str:
        _, dest = await self._destination(data.identifier)
        await self.otp.verify(dest, data.purpose, data.code)
        return await self.otp.issue_proof(dest, data.purpose)

    async def register(self, data: RegisterRequest) -> User:
        if await self.users.get_by_phone(data.phone):
            raise ConflictError(PHONE_TAKEN)
        await ensure_not_breached(data.password)
        await self.otp.verify(Destination.sms(data.phone), "signup", data.otp)
        now = datetime.now(UTC)
        user = User(
            full_name=data.full_name,
            phone=data.phone,
            password_hash=hash_password(data.password),
            phone_verified_at=now,
            age_confirmed_at=now,
            password_changed_at=now,
        )
        try:
            user = await self.users.add(user)
        except IntegrityError:  # concurrent registration with the same mobile number
            raise ConflictError(PHONE_TAKEN) from None
        purposes = ["terms", "privacy_notice"] + (["marketing"] if data.marketing_opt_in else [])
        await ConsentService(self.db).grant(user.id, purposes)
        await audit.record(self.db, "signup", "ok", request=self.request, user_id=user.id)
        return user

    async def login_with_password(self, data: PasswordLoginRequest) -> User:
        if ip := audit.client_ip(self.request):
            await rate_limiter.hit(
                f"login:ip:h:{ip}", self.settings.login_ip_hourly_limit, 3600,
                "Too many login attempts from this network. Please try again later.",
            )
        user = await self._find(data.login)
        now = datetime.now(UTC)
        if user and user.locked_until and user.locked_until > now:
            minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
            await audit.record(self.db, "login.password", "locked", request=self.request,
                               user_id=user.id)
            await self.db.commit()
            raise TooManyRequestsError(
                f"Too many failed attempts. Try again in {minutes} min, or log in with OTP."
            )

        stored_hash = user.password_hash if user and user.password_hash else DUMMY_HASH
        if not (verify_password(stored_hash, data.password) and user and user.is_active):
            if user:
                await self._record_failure(user, now)
            await audit.record(self.db, "login.password", "failed", request=self.request,
                               user_id=user.id if user else None)
            await self.db.commit()
            raise UnauthorizedError(BAD_LOGIN)

        if password_needs_rehash(stored_hash):
            user.password_hash = hash_password(data.password)
        self._clear_failures(user)
        await audit.record(self.db, "login.password", "ok", request=self.request, user_id=user.id)
        return user

    async def verify_mfa(self, data: MfaVerifyRequest) -> User:
        mfa = MfaService(self.db)
        resolved = await mfa.resolve(data.challenge_token)
        user = await self.users.get(resolved[0]) if resolved else None
        if user is None or not user.is_active or not user.mfa_enabled:
            raise UnauthorizedError(INVALID_MFA)
        await mfa.complete(user, resolved[1], data.challenge_token, data.code)
        self._clear_failures(user)
        await audit.record(self.db, "login.mfa", "ok", request=self.request, user_id=user.id)
        return user

    async def login_with_otp(self, data: OtpLoginRequest) -> User:
        user, dest = await self._destination(data.identifier)
        if user is None or not user.is_active:
            raise UnauthorizedError("That OTP is wrong or has expired. Request a new one.")
        await self.otp.verify(dest, "login", data.code)
        self._clear_failures(user)
        await audit.record(self.db, "login.otp", "ok", request=self.request, user_id=user.id)
        return user

    async def reset_password(self, data: PasswordResetRequest) -> User:
        await ensure_not_breached(data.new_password)
        user, dest = await self._destination(data.identifier)
        await self.otp.use_proof(dest, "reset_password", data.proof_token)
        if user is None:
            raise NotFoundError(NO_ACCOUNT)
        user.password_hash = hash_password(data.new_password)
        user.password_changed_at = datetime.now(UTC)
        self._clear_failures(user)
        await SessionService(self.db).revoke_all(user.id, "password_reset")
        await audit.record(self.db, "password.reset", "ok", request=self.request, user_id=user.id)
        await self._alert(user, "password_changed")
        return user

    async def add_email(self, user: User, data: EmailAddRequest) -> None:
        replacing = user.email_verified
        if replacing:
            await self._reauth(user, data.password)
        await self.otp.send(Destination.email(data.email), "verify_email", self.request)
        user.email = data.email
        user.email_verified_at = None
        await audit.record(self.db, "email.changed" if replacing else "email.added", "ok",
                           request=self.request, user_id=user.id)

    async def verify_email(self, user: User, code: str) -> None:
        if not user.email:
            raise NotFoundError("Add an email address first.")
        other = await self.users.get_by_verified_email(user.email)
        if other and other.id != user.id:
            raise ConflictError(EMAIL_TAKEN)
        await self.otp.verify(Destination.email(user.email), "verify_email", code)
        user.email_verified_at = datetime.now(UTC)
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictError(EMAIL_TAKEN) from None
        await audit.record(self.db, "email.verified", "ok", request=self.request, user_id=user.id)

    async def remove_email(self, user: User, data: EmailRemoveRequest) -> None:
        await self._reauth(user, data.password)
        user.email = None
        user.email_verified_at = None
        await audit.record(self.db, "email.removed", "ok", request=self.request, user_id=user.id)

    async def start_mfa_enrollment(self, user: User) -> None:
        await self.otp.send(Destination.sms(user.phone), "mfa", self.request)

    async def enable_mfa(self, user: User, code: str) -> None:
        await self.otp.verify(Destination.sms(user.phone), "mfa", code)
        await MfaRepository(self.db).enroll_confirmed(user.id, "sms")
        user.mfa_enabled = True
        await audit.record(self.db, "mfa.enabled", "ok", request=self.request, user_id=user.id)

    async def disable_mfa(self, user: User, data: MfaDisableRequest) -> None:
        await self._reauth(user, data.password)
        await MfaRepository(self.db).delete_all(user.id)
        user.mfa_enabled = False
        await audit.record(self.db, "mfa.disabled", "ok", request=self.request, user_id=user.id)

    async def _reauth(self, user: User, password: str | None) -> None:
        if not (password and user.password_hash and verify_password(user.password_hash, password)):
            raise UnauthorizedError("Enter your current password to continue.")

    async def _record_failure(self, user: User, now: datetime) -> None:
        user.failed_login_count += 1
        if user.failed_login_count >= self.settings.login_max_failures:
            user.locked_until = now + timedelta(minutes=self.settings.login_lockout_minutes)
            user.failed_login_count = 0
            await audit.record(self.db, "account.locked", "ok", request=self.request,
                               user_id=user.id)
            await self._alert(user, "account_locked")

    @staticmethod
    async def _alert(user: User, template: str) -> None:
        await get_sender().notify(user.phone, template, {"name": user.full_name})
        if user.email:
            subject, body = SECURITY_EMAILS[template]
            try:
                await get_mailer().send(user.email, subject, body.format(name=user.full_name))
            except Exception:
                logger.exception("Security email %s failed", template)

    @staticmethod
    def _clear_failures(user: User) -> None:
        user.failed_login_count = 0
        user.locked_until = None

    async def _find(self, login: str) -> User | None:
        login = login.strip()
        if "@" in login:
            return await self.users.get_by_verified_email(login.lower())
        try:
            return await self.users.get_by_phone(normalise_phone(login))
        except ValueError:
            return None

    async def _destination(self, identifier: str) -> tuple[User | None, Destination]:
        identifier = identifier.strip()
        if "@" in identifier:
            email = identifier.lower()
            return await self.users.get_by_verified_email(email), Destination.email(email)
        try:
            phone = normalise_phone(identifier)
        except ValueError:
            return None, Destination.sms(identifier)
        return await self.users.get_by_phone(phone), Destination.sms(phone)

    @staticmethod
    def _phone_or_400(value: str) -> str:
        try:
            return normalise_phone(value)
        except ValueError as e:
            raise AppError(str(e)) from None
