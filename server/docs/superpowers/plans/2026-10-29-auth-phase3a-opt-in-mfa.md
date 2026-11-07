# Auth Phase 3a — Opt-in SMS MFA (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user switch on a required second factor for their own account. Once on, password login no longer issues a session by itself — it returns a short-lived MFA challenge, and only verifying an SMS code to the user's phone completes the login. OTP login is unaffected. SMS is the only factor, but behind an `MfaMethod` seam so TOTP/email slot in later with no login-flow change.

**Architecture:** One migration adds `users.mfa_enabled` and `users.mfa_method`. A new `MfaMethod` protocol with `SmsMfaMethod` (reusing the Phase-1 OTP subsystem over `Destination.sms`, purpose `mfa`) is selected by a tiny registry, exactly like `OtpChannel`. An `MfaService` mints an opaque **challenge token** (hashed in Redis → `user_id`, short TTL) the way `issue_proof`/`use_proof` mint proof tokens. The password-login endpoint, on a correct password for an MFA user, starts the factor + returns `{mfa_required, challenge_token}` instead of a session; a new `POST /auth/mfa/verify` exchanges `(challenge_token, code)` for a session marked `mfa_verified_at`. Enable/disable live under `/me/mfa`, with disable gated by the Phase-2a re-auth check.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, Alembic, Postgres, Redis (`redis.asyncio`), pytest with `fakeredis` + local Postgres `fmd_test`. Package manager: `uv`.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-email-mfa-design.md` (§5.4 opt-in MFA, §5.7 seams, the MFA half of §6/§7; Phase 3 of §9, backend only — settings toggle + second-factor UI are Phase 3b). Builds on Phase 1 (`otp_channel`), Phase 2a (`_reauth`, `Destination`).

## Global Constraints

- **Opt-in and per-user.** `mfa_enabled` defaults false; nothing changes for anyone until they turn it on. Phone-only and email users are unaffected.
- **Password alone is never enough for an MFA user** (the whole point, anti-goal "MFA that can be silently skipped"): no session row is created at the password step; a stolen password without the phone cannot get in.
- **OTP login is already a factor** — it must NOT be double-gated by MFA (design §5.4). Same for the reset-password proof flow.
- **The login path talks only to `MfaMethod`**, never to a specific factor (anti-goal: no `if method == "sms"` in the login flow). Adding TOTP later is a new class + one registry line.
- **Challenge token** has the proof-token properties: opaque, hashed at rest, short TTL, bound to the user, single-use on success.
- **No explanatory code comments.** Reuse existing primitives: `OtpService`, `Destination.sms`, `new_token`/`hash_token`, `cache.redis`, `AuthService._reauth`, `audit`.
- **Recovery gap (v1):** SMS MFA relies on the user's verified phone; losing it is a support path. Backup codes are the first follow-up — the `MfaMethod.verify` signature already leaves room for a recovery code. Documented, not shipped.

## Review Focus

- **No session at the password step for an MFA user.** After a correct password, zero session rows exist for that user until `/auth/mfa/verify` succeeds; the response carries no auth cookies. Pinned in Task 3 (`test_password_login_with_mfa_returns_challenge_not_session`).
- **OTP login bypasses MFA.** A user with `mfa_enabled` logging in via OTP gets a session directly, no second prompt. Pinned in Task 3 (`test_otp_login_is_not_gated_by_mfa`).
- **Challenge token is single-use, short-TTL, user-bound.** A used or expired or unknown token → 401; a token for user A cannot mint a session for user B; a wrong code does not consume the challenge (OTP tries-cap governs retries), a right code does. Pinned in Task 2 (`test_challenge_roundtrip_and_single_use`) and Task 3 (`test_mfa_verify_rejects_bad_or_reused_challenge`).
- **Disable requires re-auth; enable requires proving the factor once.** `DELETE /me/mfa` without the current password → 401 and MFA stays on; enabling only flips `mfa_enabled` after a correct factor code. A hijacked live session can neither silently disable MFA nor enable it without the phone. Pinned in Task 4.
- **MFA code attempts are tries-capped and lockout still precedes MFA.** The `mfa`-purpose OTP uses the same `otp_max_attempts`; account lockout still triggers on wrong passwords at the step before any challenge is issued. Pinned in Task 3 (`test_mfa_code_attempts_are_capped`).

---

### Task 1: Migration + model — `mfa_enabled` / `mfa_method`

**Files:**
- Create: `alembic/versions/0008_user_mfa.py`
- Modify: `app/models/user.py`
- Modify: `app/schemas/user.py` (`UserRead.mfa_enabled: bool`, `mfa_method: str | None`)
- Test: `__tests__/test_mfa.py` (new)

**Interfaces:**
- Produces: `User.mfa_enabled: Mapped[bool]` (server_default false), `User.mfa_method: Mapped[str | None]` (String(20), check `in ('sms')`); DB columns + check constraint `ck_users_mfa_method`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** in `__tests__/test_mfa.py`

```python
from .helpers import signed_in

async def test_me_exposes_mfa_defaults_off():
    async with signed_in() as c:
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["mfa_enabled"] is False and me["mfa_method"] is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest __tests__/test_mfa.py -v`
Expected: FAIL (`mfa_enabled` column / field absent).

- [ ] **Step 3: Write migration `0008_user_mfa.py`** (revision `"0008"`, down_revision `"0007"`)

`upgrade()`: `add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))`; `add_column("users", sa.Column("mfa_method", sa.String(20), nullable=True))`; `create_check_constraint("ck_users_mfa_method", "users", "mfa_method in ('sms')")`.
`downgrade()`: drop constraint, drop both columns.

- [ ] **Step 4: Update `app/models/user.py`** — add the two mapped columns; add `"sms"` check to `__table_args__` (`CheckConstraint("mfa_method in ('sms')", name="ck_users_mfa_method")`).

- [ ] **Step 5: Surface on `UserRead`** in `app/schemas/user.py` — add `mfa_enabled: bool` and `mfa_method: str | None`.

- [ ] **Step 6: Run to verify it passes**

Run: `uv run pytest __tests__/test_mfa.py -v` → PASS.

- [ ] **Step 7: Commit**

```bash
git add alembic/versions/0008_user_mfa.py app/models/user.py app/schemas/user.py __tests__/test_mfa.py
git commit -m "feat(auth): add mfa_enabled/mfa_method columns and expose on /me"
```

---

### Task 2: `MfaMethod` seam + `MfaService` (challenge tokens)

**Files:**
- Create: `app/services/mfa/__init__.py` (or `app/services/mfa.py` — single module is fine; prefer a package only if it grows)
- Modify: `app/core/config.py` (`mfa_challenge_ttl_minutes: int = 5`)
- Test: `__tests__/test_mfa.py` (extend, service-level with `fake_redis`)

**Interfaces:**
- Consumes: `OtpService`, `Destination` (Phase 1), `new_token`/`hash_token` from `app.core.security`, `cache.redis`, `get_settings`.
- Produces:
  - `MfaMethodKind = Literal["sms"]`
  - `class MfaMethod(Protocol): async def start(self, user: User) -> None; async def verify(self, user: User, code: str) -> None` — `start` dispatches the factor's challenge; `verify` raises `UnauthorizedError` on a bad code.
  - `SmsMfaMethod` — `start` = `OtpService().send(Destination.sms(user.phone), "mfa")`; `verify` = `OtpService().verify(Destination.sms(user.phone), "mfa", code)`.
  - `get_mfa_method(kind: MfaMethodKind) -> MfaMethod` (registry; `sms` → `SmsMfaMethod`).
  - `class MfaService:` with
    - `async def challenge(self, user: User) -> str` — calls `get_mfa_method(user.mfa_method).start(user)`, mints `token, hash = new_token()`, `redis.set(f"mfa:challenge:{hash}", str(user.id), ex=ttl)`, returns `token`.
    - `async def resolve(self, token: str) -> uuid.UUID | None` — `redis.get(f"mfa:challenge:{hash_token(token)}")` → UUID or None (GET, not GETDEL — a wrong code must not burn the challenge).
    - `async def complete(self, user: User, token: str, code: str) -> None` — `get_mfa_method(user.mfa_method).verify(user, code)`, then `redis.delete(f"mfa:challenge:{hash_token(token)}")` (consume only on success).

- [ ] **Step 1: Write failing service tests** in `__tests__/test_mfa.py`

```python
import pytest
import uuid
from app.core.exceptions import UnauthorizedError
from app.services.mfa import MfaService, get_mfa_method, SmsMfaMethod

def test_registry_selects_sms():
    assert isinstance(get_mfa_method("sms"), SmsMfaMethod)

async def test_challenge_roundtrip_and_single_use(fake_redis, monkeypatch):
    sent = {}
    async def fake_send(dest, purpose, request=None):
        sent["dest"] = dest; return "sms"
    async def fake_verify(dest, purpose, code):
        if code != "123456": raise UnauthorizedError("bad")
    monkeypatch.setattr("app.services.mfa.OtpService.send", staticmethod(fake_send))
    monkeypatch.setattr("app.services.mfa.OtpService.verify", staticmethod(fake_verify))

    class U: id = uuid.uuid7(); phone = "+919000000001"; mfa_method = "sms"
    svc = MfaService()
    token = await svc.challenge(U)
    assert await svc.resolve(token) == U.id
    with pytest.raises(UnauthorizedError):
        await svc.complete(U, token, "000000")   # wrong code
    assert await svc.resolve(token) == U.id       # challenge survives a wrong code
    await svc.complete(U, token, "123456")        # right code
    assert await svc.resolve(token) is None        # consumed on success
```

(The exact monkeypatch shape is the implementer's to adjust to the real `OtpService` method signatures; the assertions — challenge survives a wrong code, dies after a right one, `resolve` returns the bound user id — are what must hold.)

- [ ] **Step 2: Run to verify it fails** — `uv run pytest __tests__/test_mfa.py -v` → FAIL (module absent).

- [ ] **Step 3: Add `mfa_challenge_ttl_minutes`** to `Settings`.

- [ ] **Step 4: Implement the `mfa` module** per the Produces block.

- [ ] **Step 5: Run to verify it passes** — PASS.

- [ ] **Step 6: Commit**

```bash
git add app/services/mfa* app/core/config.py __tests__/test_mfa.py
git commit -m "feat(auth): MfaMethod seam, SmsMfaMethod, and MfaService challenge tokens"
```

---

### Task 3: Gate password login behind the challenge; `POST /auth/mfa/verify`

**Files:**
- Modify: `app/schemas/auth.py` (`MfaChallengeResponse`, `MfaVerifyRequest`)
- Modify: `app/services/auth_service.py` (`verify_mfa`; a helper to start a challenge)
- Modify: `app/api/v1/endpoints/auth.py` (branch in `login_with_password`; new `verify_mfa` endpoint; `_start_session` gains `mfa_verified`)
- Modify: `app/services/session_service.py` (`create` accepts `mfa_verified: bool = False`)
- Test: `__tests__/test_mfa.py` (extend, HTTP-level)

**Interfaces:**
- Consumes: `MfaService` (Task 2), `AuthService._reauth` (Phase 2a).
- Produces:
  - `MfaChallengeResponse(BaseModel): mfa_required: bool = True; challenge_token: str`
  - `MfaVerifyRequest(BaseModel): challenge_token: str = Field(min_length=20, max_length=100); code: str = OtpCode`
  - `AuthService.verify_mfa(self, data: MfaVerifyRequest) -> User` — `user_id = MfaService.resolve(token)`; 401 if None; load user; 401 if not active or not `mfa_enabled`; `MfaService.complete(user, token, code)`; audit `login.mfa` ok; return user.
  - `SessionService.create(..., mfa_verified: bool = False)` — sets `session.mfa_verified_at = now` when true.
  - `_start_session(..., mfa_verified: bool = False)` threads it to `create`.
  - `login_with_password` endpoint: after `AuthService.login_with_password` returns the user, if `user.mfa_enabled` → `token = await MfaService(...).challenge(user)`, audit `login.mfa.challenge`, and `return JSONResponse(MfaChallengeResponse(challenge_token=token).model_dump())` (no cookies); else `_start_session(..., "password")` as today.
  - new `POST /auth/mfa/verify` → `verify_mfa` → `_start_session(..., "mfa", mfa_verified=True)`.

- [ ] **Step 1: Write failing HTTP tests** in `__tests__/test_mfa.py`

```python
from .helpers import OTP, anon, signed_in
# helper to turn MFA on for a signed-in client is added in Task 4; until then, set it in-db:
from app.db.session import engine
from sqlalchemy import text

async def _enable_mfa(phone):
    async with engine.begin() as conn:
        await conn.execute(text("update users set mfa_enabled=true, mfa_method='sms' "
                                "where phone=:p"), {"p": phone})

async def test_password_login_with_mfa_returns_challenge_not_session():
    async with signed_in() as web:
        await _enable_mfa(web.phone)
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": web.phone, "password": "Correct-horse1"})
        assert r.status_code == 200 and r.json()["mfa_required"] is True
        assert "fmd_access" not in r.cookies and "fmd_refresh" not in r.cookies
        assert (await c.get("/api/v1/auth/me")).status_code == 401   # no session yet
        token = r.json()["challenge_token"]
        r2 = await c.post("/api/v1/auth/mfa/verify",
                          json={"challenge_token": token, "code": OTP})
        assert r2.status_code == 200
        assert (await c.get("/api/v1/auth/me")).json()["phone"] == web.phone

async def test_otp_login_is_not_gated_by_mfa():
    async with signed_in() as web:
        await _enable_mfa(web.phone)
    async with anon() as c:
        await c.post("/api/v1/auth/otp", json={"identifier": web.phone, "purpose": "login"})
        r = await c.post("/api/v1/auth/login/otp", json={"identifier": web.phone, "code": OTP})
        assert r.status_code == 200 and (await c.get("/api/v1/auth/me")).status_code == 200

async def test_mfa_verify_rejects_bad_or_reused_challenge():
    async with signed_in() as web:
        await _enable_mfa(web.phone)
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": web.phone, "password": "Correct-horse1"})
        token = r.json()["challenge_token"]
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": "x"*40, "code": OTP})).status_code == 401
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": token, "code": OTP})).status_code == 200
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": token, "code": OTP})).status_code == 401  # reused
```

(Note: `signed_in` yields an authenticated client; capture `web.phone` before the `async with` closes, as the existing tests do.)

- [ ] **Step 2: Run to verify they fail** — endpoints/fields absent.

- [ ] **Step 3:** Add `mfa_verified` to `SessionService.create` and `_start_session`.

- [ ] **Step 4:** Add the schemas; implement `AuthService.verify_mfa`.

- [ ] **Step 5:** Branch `login_with_password`; add the `verify_mfa` endpoint. The `mfa` purpose is already in `OtpService.Purpose`. Add a `test_mfa_code_attempts_are_capped` test asserting `otp_max_attempts` wrong codes against a live challenge then a 401 lock (mirror `test_account_locks...`/the OTP tries test).

- [ ] **Step 6: Run the MFA tests, then the full suite**

Run: `uv run pytest __tests__/test_mfa.py -v` → PASS.
Run: `uv run pytest -q` → PASS (password/OTP/reset flows for non-MFA users unchanged).

- [ ] **Step 7: Lint & commit**

```bash
uv run ruff check . && git add app/ __tests__/test_mfa.py
git commit -m "feat(auth): gate password login behind SMS MFA challenge"
```

---

### Task 4: Enable / disable MFA in account settings

**Files:**
- Modify: `app/schemas/auth.py` (`MfaDisableRequest`)
- Modify: `app/services/auth_service.py` (`start_mfa_enrollment`, `enable_mfa`, `disable_mfa`)
- Modify: `app/api/v1/endpoints/account.py` (`POST /me/mfa/start`, `POST /me/mfa`, `DELETE /me/mfa`)
- Test: `__tests__/test_mfa.py` (extend)

**Interfaces:**
- Consumes: `OtpService` (`Destination.sms(user.phone)`, purpose `mfa`), `AuthService._reauth` (Phase 2a), `audit`.
- Produces (on a signed-in `user`):
  - `start_mfa_enrollment(self, user) -> None` — send the factor code (`OtpService.send(Destination.sms(user.phone), "mfa")`); 400 if the user has no verified phone (all users do today — guard anyway).
  - `enable_mfa(self, user, code: str) -> None` — `OtpService.verify(Destination.sms(user.phone), "mfa", code)`; set `mfa_enabled=True`, `mfa_method="sms"`; audit `mfa.enabled`; `_alert`-style out-of-band notice is **deferred** (same ruling as Phase 2a email alerts — audit only).
  - `disable_mfa(self, user, data: MfaDisableRequest) -> None` — `_reauth(user, data.password)`; set `mfa_enabled=False`, `mfa_method=None`; audit `mfa.disabled`.
  - `MfaDisableRequest(BaseModel): password: str | None = Field(default=None, max_length=128)`.
- Endpoints: `POST /me/mfa/start` (204), `POST /me/mfa` body `{code}` (204, reuse `EmailVerifyRequest`-shaped `{code}` or a tiny `MfaEnableRequest`), `DELETE /me/mfa` (204).

- [ ] **Step 1: Write failing HTTP tests** in `__tests__/test_mfa.py`

```python
async def test_enable_requires_factor_code_then_me_shows_on():
    async with signed_in() as c:
        assert (await c.post("/api/v1/me/mfa/start")).status_code == 204
        assert (await c.post("/api/v1/me/mfa", json={"code": "000000"})).status_code == 401
        assert (await c.post("/api/v1/me/mfa", json={"code": OTP})).status_code == 204
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["mfa_enabled"] is True and me["mfa_method"] == "sms"

async def test_disable_requires_password():
    async with signed_in() as c:
        await c.post("/api/v1/me/mfa/start")
        await c.post("/api/v1/me/mfa", json={"code": OTP})
        assert (await c.request("DELETE", "/api/v1/me/mfa", json={})).status_code == 401
        assert (await c.request("DELETE", "/api/v1/me/mfa",
                json={"password": "Correct-horse1"})).status_code == 204
        assert (await c.get("/api/v1/auth/me")).json()["mfa_enabled"] is False
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3:** Add `MfaDisableRequest` (+ `MfaEnableRequest {code}` or reuse a `{code}` schema); implement the three `AuthService` methods.

- [ ] **Step 4:** Add the three endpoints to the `account` router (`CurrentAuth` + `Request` + `DbSession`).

- [ ] **Step 5: Run MFA tests, then full suite, then lint**

Run: `uv run pytest __tests__/test_mfa.py -v` → PASS.
Run: `uv run pytest -q` → PASS.
Run: `uv run ruff check .` → clean.

- [ ] **Step 6: Commit**

```bash
git add app/ __tests__/test_mfa.py
git commit -m "feat(auth): enable/disable opt-in SMS MFA in account settings"
```

---

## Notes for the executor

- **The `mfa` purpose and the `mfa_verified_at`/`reauth_at` session columns already exist** (OtpService.Purpose; the sessions table). Task 3 only needs to set `mfa_verified_at` on the MFA-completed session — no migration for that.
- **Enable needs a start+confirm pair** (`/me/mfa/start` then `/me/mfa`) because turning MFA on must prove the user controls the factor. §7 of the design lists only `POST /me/mfa`; the extra `start` endpoint is the "one-time factor verification" that line refers to — note it, it's not scope creep.
- **Out-of-band alerts** on enable/disable are deferred to the same template-provisioning work as the Phase-2a email alerts (design §10). Audit events are recorded now.
- **Backup codes / TOTP / step-up** stay out (design §9 follow-ups). The `MfaMethod` seam and the `mfa_method` check constraint are the only places a second factor is named — extending to TOTP is a new class, one registry line, and widening the check constraint.
- **Phase 3b (UI)** adds the settings toggle (enable walks the start→code→on flow; disable asks for the password) and the login **second-factor step** (when `login/password` returns `{mfa_required, challenge_token}`, show a code entry that posts to `/auth/mfa/verify`). It mirrors Phase 2b's gates: typecheck + lint + a looked-at browser drive, no client unit tests.
- Run the full suite where `fmd_test` Postgres exists; Task 1's migration needs the DB. If the dev **RDS** DB is used by a running server, apply `alembic upgrade head` there too before manual testing (as Phase 2 required for 0007).
