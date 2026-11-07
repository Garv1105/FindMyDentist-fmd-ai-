import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_token, new_token
from app.models.security import UserSession
from app.models.user import User
from app.services import audit
from app.services.audit import client_ip, user_agent


class SessionService:
    """A session is one signed-in device. Its refresh token rotates on every use; access JWTs
    reference it by id and every request checks the session row, so revocation is immediate."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def create(
        self, user: User, method: str, request: Request, *, mfa_verified: bool = False
    ) -> tuple[str, UserSession]:
        now = datetime.now(UTC)
        token, token_hash = new_token()
        session = UserSession(
            user_id=user.id,
            token_hash=token_hash,
            last_seen_at=now,
            idle_expires_at=now + timedelta(days=self.settings.session_idle_days),
            expires_at=now + timedelta(days=self.settings.session_absolute_days),
            auth_method=method,
            mfa_verified_at=now if mfa_verified else None,
            ip=client_ip(request),
            user_agent=user_agent(request),
        )
        self.db.add(session)
        await self.db.flush()
        return token, session

    async def refresh(
        self, token: str, request: Request
    ) -> tuple[str | None, UserSession, User] | None:
        """Returns (new refresh token or None, session, user), or None if the token is dead.

        A token used again shortly after rotation (two tabs refreshing at once) gets a new access
        token but no new refresh token. Used again later, it was stolen: the session is revoked.
        """
        now = datetime.now(UTC)
        token_hash = hash_token(token)
        row = (
            await self.db.execute(
                select(UserSession, User)
                .join(User, User.id == UserSession.user_id)
                .where(or_(UserSession.token_hash == token_hash,
                           UserSession.prev_token_hash == token_hash))
                .with_for_update(of=UserSession)
            )
        ).one_or_none()
        if row is None:
            return None
        session, user = row
        if not (self._alive(session, now) and user.is_active):
            return None

        if session.token_hash != token_hash:
            grace = timedelta(seconds=self.settings.refresh_reuse_grace_seconds)
            if session.rotated_at and now - session.rotated_at <= grace:
                return None, session, user
            await self.revoke(session, "refresh_reuse")
            await audit.record(self.db, "session.refresh_reuse", "blocked", request=request,
                               user_id=user.id, session_id=str(session.id))
            return None

        new, new_hash = new_token()
        session.prev_token_hash, session.token_hash = session.token_hash, new_hash
        session.rotated_at = session.last_seen_at = now
        session.idle_expires_at = min(
            now + timedelta(days=self.settings.session_idle_days), session.expires_at
        )
        await self.db.flush()
        return new, session, user

    async def active_user(self, user_id: uuid.UUID, session_id: uuid.UUID) -> User | None:
        now = datetime.now(UTC)
        return await self.db.scalar(
            select(User)
            .join(UserSession, UserSession.user_id == User.id)
            .where(
                UserSession.id == session_id,
                User.id == user_id,
                User.is_active.is_(True),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
                UserSession.idle_expires_at > now,
            )
        )

    async def find_by_refresh(self, token: str) -> UserSession | None:
        return await self.db.scalar(
            select(UserSession).where(
                UserSession.token_hash == hash_token(token), UserSession.revoked_at.is_(None)
            )
        )

    async def list_active(self, user_id: uuid.UUID) -> list[UserSession]:
        now = datetime.now(UTC)
        result = await self.db.scalars(
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
                UserSession.idle_expires_at > now,
            )
            .order_by(UserSession.last_seen_at.desc())
        )
        return list(result)

    async def revoke(self, session: UserSession, reason: str) -> None:
        session.revoked_at = datetime.now(UTC)
        session.revoke_reason = reason
        await self.db.flush()

    async def revoke_by_id(self, user_id: uuid.UUID, session_id: uuid.UUID, reason: str) -> bool:
        result = await self.db.execute(
            update(UserSession)
            .where(
                UserSession.id == session_id,
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC), revoke_reason=reason)
            .returning(UserSession.id)
        )
        return result.scalar_one_or_none() is not None

    async def revoke_all(
        self, user_id: uuid.UUID, reason: str, *, except_id: uuid.UUID | None = None
    ) -> int:
        stmt = (
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC), revoke_reason=reason)
            .returning(UserSession.id)
        )
        if except_id is not None:
            stmt = stmt.where(UserSession.id != except_id)
        return len((await self.db.execute(stmt)).scalars().all())

    @staticmethod
    def _alive(session: UserSession, now: datetime) -> bool:
        return (
            session.revoked_at is None
            and session.expires_at > now
            and session.idle_expires_at > now
        )
