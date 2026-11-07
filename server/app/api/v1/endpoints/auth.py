from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.deps import CurrentAuth, CurrentUser, DbSession, access_claims
from app.core import cache
from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.security import UserSession
from app.models.user import User
from app.schemas.auth import (
    MfaChallengeResponse,
    MfaVerifyRequest,
    OtpLoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    PasswordCheckRequest,
    PasswordLoginRequest,
    PasswordResetRequest,
    ProofResponse,
    RegisterRequest,
)
from app.schemas.user import MeRead, UserRead
from app.services import audit
from app.services.auth_service import AuthService
from app.services.mfa import MfaService
from app.services.password_policy import ensure_not_breached
from app.services.profile_service import ProfileService
from app.services.session_service import SessionService

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        name, value, max_age=max_age, path="/", domain=settings.cookie_domain,
        secure=settings.cookie_secure, httponly=True, samesite="lax",
    )


def _issue(response: Response, user: User, session: UserSession, refresh: str | None) -> None:
    settings = get_settings()
    _set_cookie(response, settings.access_cookie_name, create_access_token(user.id, session.id),
                settings.access_token_minutes * 60 - 60)
    if refresh is not None:
        _set_cookie(response, settings.refresh_cookie_name, refresh,
                    settings.session_absolute_days * 86400)


def _clear_cookies(response: Response) -> None:
    settings = get_settings()
    for name in (settings.access_cookie_name, settings.refresh_cookie_name):
        response.delete_cookie(name, path="/", domain=settings.cookie_domain,
                               secure=settings.cookie_secure, httponly=True, samesite="lax")


async def _start_session(
    db: DbSession, request: Request, response: Response, user: User, method: str,
    *, mfa_verified: bool = False
) -> User:
    sessions = SessionService(db)
    old = request.cookies.get(get_settings().refresh_cookie_name)
    if old and (previous := await sessions.find_by_refresh(old)):
        await sessions.revoke(previous, "replaced")
    refresh, session = await sessions.create(user, method, request, mfa_verified=mfa_verified)
    _issue(response, user, session, refresh)
    return user


@router.post("/otp", status_code=status.HTTP_204_NO_CONTENT)
async def send_otp(data: OtpRequest, request: Request, db: DbSession) -> None:
    await AuthService(db, request).send_otp(data)


@router.post("/otp/verify", response_model=ProofResponse)
async def verify_otp(data: OtpVerifyRequest, request: Request, db: DbSession) -> ProofResponse:
    return ProofResponse(proof_token=await AuthService(db, request).verify_otp(data))


@router.post("/password/check", status_code=status.HTTP_204_NO_CONTENT)
async def check_password(data: PasswordCheckRequest) -> None:
    await ensure_not_breached(data.password)


@router.get("/otp/dev")
async def dev_otp() -> dict[str, str | None]:
    if get_settings().app_env == "production":
        return {"code": None}
    return {"code": await cache.redis.get("otp:dev:last")}


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, request: Request, response: Response, db: DbSession
) -> User:
    user = await AuthService(db, request).register(data)
    return await _start_session(db, request, response, user, "signup")


@router.post("/login/password", response_model=UserRead)
async def login_with_password(
    data: PasswordLoginRequest, request: Request, response: Response, db: DbSession
):
    user = await AuthService(db, request).login_with_password(data)
    if user.mfa_enabled:
        token = await MfaService(db).challenge(user)
        await audit.record(db, "login.mfa.challenge", "ok", request=request, user_id=user.id)
        return JSONResponse(MfaChallengeResponse(challenge_token=token).model_dump())
    return await _start_session(db, request, response, user, "password")


@router.post("/mfa/verify", response_model=UserRead)
async def verify_mfa(
    data: MfaVerifyRequest, request: Request, response: Response, db: DbSession
) -> User:
    user = await AuthService(db, request).verify_mfa(data)
    return await _start_session(db, request, response, user, "mfa", mfa_verified=True)


@router.post("/login/otp", response_model=UserRead)
async def login_with_otp(
    data: OtpLoginRequest, request: Request, response: Response, db: DbSession
) -> User:
    user = await AuthService(db, request).login_with_otp(data)
    return await _start_session(db, request, response, user, "otp")


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: PasswordResetRequest, request: Request, db: DbSession) -> None:
    await AuthService(db, request).reset_password(data)


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
async def refresh(request: Request, db: DbSession) -> Response:
    token = request.cookies.get(get_settings().refresh_cookie_name)
    result = await SessionService(db).refresh(token, request) if token else None
    if result is None:
        await db.commit()
        response = JSONResponse(
            {"error": {"code": "unauthorized", "message": "Your session has ended. Log in again."}},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
        _clear_cookies(response)
        return response
    new_refresh, session, user = result
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _issue(response, user, session, new_refresh)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: DbSession) -> None:
    sessions = SessionService(db)
    token = request.cookies.get(get_settings().refresh_cookie_name)
    session = await sessions.find_by_refresh(token) if token else None
    if session:
        await sessions.revoke(session, "logout")
        await audit.record(db, "logout", "ok", request=request, user_id=session.user_id)
    elif claims := access_claims(request):
        user_id, session_id = claims
        if await sessions.revoke_by_id(user_id, session_id, "logout"):
            await audit.record(db, "logout", "ok", request=request, user_id=user_id)
    _clear_cookies(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    auth: CurrentAuth, request: Request, response: Response, db: DbSession
) -> None:
    _, user = auth
    count = await SessionService(db).revoke_all(user.id, "logout_all")
    await audit.record(db, "logout.all", "ok", request=request, user_id=user.id, sessions=count)
    _clear_cookies(response)


@router.get("/me", response_model=MeRead)
async def me(user: CurrentUser, db: DbSession) -> MeRead:
    return await ProfileService(db).me(user)
