import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.clinic import ClinicMembership
from app.models.user import User
from app.repositories.clinic_repository import ClinicRepository
from app.schemas.common import Role
from app.services.session_service import SessionService

DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]


def _access_token(request: Request) -> str | None:
    scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() == "bearer" and credentials:
        return credentials
    return request.cookies.get(get_settings().access_cookie_name)


def access_claims(request: Request) -> tuple[uuid.UUID, uuid.UUID] | None:
    token = _access_token(request)
    if not token:
        return None
    try:
        claims = decode_access_token(token)
        return uuid.UUID(claims["sub"]), uuid.UUID(claims["sid"])
    except (jwt.InvalidTokenError, ValueError):
        return None


async def get_current_auth(request: Request, db: DbSession) -> tuple[uuid.UUID, User]:
    claims = access_claims(request)
    if claims is None:
        raise UnauthorizedError("Not authenticated")
    user_id, session_id = claims
    user = await SessionService(db).active_user(user_id, session_id)
    if user is None:
        raise UnauthorizedError("Not authenticated")
    return session_id, user


CurrentAuth = Annotated[tuple[uuid.UUID, User], Depends(get_current_auth)]


async def get_current_user(auth: CurrentAuth) -> User:
    return auth[1]


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_member(*roles: Role) -> Callable[..., Awaitable[ClinicMembership]]:
    async def dependency(
        clinic_id: uuid.UUID, user: CurrentUser, db: DbSession
    ) -> ClinicMembership:
        membership = await ClinicRepository(db).get_membership(clinic_id, user.id)
        if membership is None or membership.status != "active":
            raise NotFoundError("Clinic not found")
        if roles and membership.role not in roles:
            raise ForbiddenError("Your role in this clinic doesn't allow this")
        return membership

    return dependency


ClinicMember = Annotated[ClinicMembership, Depends(require_member())]
ClinicOwner = Annotated[ClinicMembership, Depends(require_member("owner"))]
