import uuid

from fastapi import APIRouter, Request, status

from app.api.deps import CurrentAuth, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.auth import (
    EmailAddRequest,
    EmailRemoveRequest,
    EmailVerifyRequest,
    MfaDisableRequest,
    MfaEnableRequest,
    SessionRead,
)
from app.services import audit
from app.services.auth_service import AuthService
from app.services.session_service import SessionService

router = APIRouter(prefix="/me", tags=["account"])


@router.post("/email", status_code=status.HTTP_204_NO_CONTENT)
async def add_email(
    data: EmailAddRequest, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    await AuthService(db, request).add_email(user, data)


@router.post("/email/verify", status_code=status.HTTP_204_NO_CONTENT)
async def verify_email(
    data: EmailVerifyRequest, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    await AuthService(db, request).verify_email(user, data.code)


@router.delete("/email", status_code=status.HTTP_204_NO_CONTENT)
async def remove_email(
    data: EmailRemoveRequest, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    await AuthService(db, request).remove_email(user, data)


@router.post("/mfa/start", status_code=status.HTTP_204_NO_CONTENT)
async def start_mfa(auth: CurrentAuth, request: Request, db: DbSession) -> None:
    _, user = auth
    await AuthService(db, request).start_mfa_enrollment(user)


@router.post("/mfa", status_code=status.HTTP_204_NO_CONTENT)
async def enable_mfa(
    data: MfaEnableRequest, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    await AuthService(db, request).enable_mfa(user, data.code)


@router.delete("/mfa", status_code=status.HTTP_204_NO_CONTENT)
async def disable_mfa(
    data: MfaDisableRequest, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    await AuthService(db, request).disable_mfa(user, data)


@router.get("/sessions", response_model=list[SessionRead])
async def list_sessions(auth: CurrentAuth, db: DbSession) -> list[SessionRead]:
    current_id, user = auth
    sessions = await SessionService(db).list_active(user.id)
    return [
        SessionRead.model_validate(s).model_copy(update={"current": s.id == current_id})
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID, auth: CurrentAuth, request: Request, db: DbSession
) -> None:
    _, user = auth
    if not await SessionService(db).revoke_by_id(user.id, session_id, "revoked_by_user"):
        raise NotFoundError("Session not found")
    await audit.record(db, "session.revoked", "ok", request=request, user_id=user.id,
                       session_id=str(session_id))
