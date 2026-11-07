# Auth Phase 2a — Email as a verified secondary identity (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user add, verify, and remove an email, make a *verified* email a usable login identifier for every path phone already has (email+password, email login-OTP, email forgot-password), and keep an unverified email completely inert — all server-side, no UI.

**Architecture:** One migration adds `users.email_verified_at` and replaces the column-level unique on `email` with a **partial unique index on `lower(email) WHERE email_verified_at IS NOT NULL`** (verified-only uniqueness, first-to-verify-wins). New `/me/email`, `/me/email/verify`, `DELETE /me/email` endpoints drive add/verify/remove through `AuthService`, delivering the verification code over the Phase-1 `EmailOtpChannel` (`Destination.email`, purpose `verify_email`). `_find` is tightened to resolve an email identifier only when it is verified, so password login, login-OTP, and forgot-password all gain an email arm without a single `if email` branch in the flow. Sensitive mutations (change / remove email) require fresh password re-auth.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, Alembic, Postgres, Redis (`redis.asyncio`), pytest with `fakeredis` + local Postgres `fmd_test`. Package manager: `uv` (run everything via `uv run`).

**Spec:** `docs/superpowers/specs/2026-10-29-auth-email-mfa-design.md` (implements §5.1, §5.3, §5.5 email-verification, §5.6 email section, and the email half of §7; Phase 2 of §9, backend only — onboarding + settings UI are Phase 2b).

## Global Constraints

- **Phone stays primary and untouched.** Every existing phone-only flow keeps working byte-for-byte. Email is purely additive.
- **An unverified email is inert** (anti-goal #1): never a login identifier, never an OTP/forgot destination. Only `email_verified_at IS NOT NULL` makes it real.
- **Verified-email uniqueness, first-to-verify-wins** (§5.1): several rows may hold the same address unverified; at most one may hold it verified; the DB index is the arbiter of the race.
- **Re-auth for sensitive mutations** (§5.6): changing an existing verified email and removing an email each require the current password in the same request. (Fresh-OTP re-auth is deferred to a follow-up; password alone closes the live-session-hijack threat — see Notes.)
- **No explanatory code comments** — project convention; match surrounding style, naming, async idioms exactly. Reuse existing primitives (`otp_service`, `audit`, `_alert`, `Email`/`Phone` validators, `UserRepository`).
- **Store email lowercased** (the `Email` validator already lowercases; `_find` already lowercases).
- **Ops prerequisite (prod only, not a code task):** production SES must be out of the sandbox with a verified DKIM domain and quota before real users get email codes. Tests use the `log` mailer; this plan does not touch provider config.

## Review Focus

- **Unverified email is inert for login.** A user who has added but not verified an email must not be able to log in with that email (password or OTP), nor receive a reset/login code to it. Pinned in Task 2 (`test_unverified_email_is_not_a_login_identifier`) and Task 3 (`test_login_otp_to_email_requires_verified`).
- **First-to-verify-wins is atomic.** Two accounts both hold address X unverified; both verify. Exactly one gets `email_verified_at`; the other gets a conflict, not a second verified row. Pinned in Task 1 (DB index: `test_only_one_verified_email_allowed`) and Task 2 (`test_verify_email_already_verified_elsewhere_conflicts`).
- **Freeing a verified email.** Removing or replacing a verified email clears `email_verified_at`, so the address becomes verifiable by another account (uniqueness is on verified rows only). Pinned in Task 2 (`test_removing_email_frees_it_for_others`).
- **Re-auth gates the hijack path.** Change-email and remove-email with a live session but a wrong/absent password are rejected; adding a first email and verifying do not require re-auth. Pinned in Task 2 (`test_change_and_remove_email_require_password`).
- **Email OTP send is rate-limited per address and per IP**, exactly like phone (the Phase-1 `send()` already keys per `dest.kind`+address and per IP). Pinned in Task 3 (`test_email_otp_is_rate_limited`).

---

### Task 1: Migration + model — `email_verified_at` and verified-only uniqueness

**Files:**
- Create: `alembic/versions/0007_email_verified_identity.py`
- Modify: `app/models/user.py` (add `email_verified_at`; drop `unique=True` on `email`; add `email_verified` property)
- Test: `__tests__/test_email_identity.py` (new)

**Interfaces:**
- Produces:
  - `User.email_verified_at: Mapped[datetime | None]`
  - `User.email_verified` (read-only Python property → `email_verified_at is not None`)
  - DB: column-unique `uq_users_email` dropped; partial unique index `uq_users_email_verified` on `lower(email)` where `email_verified_at is not null`.
- Consumes: nothing (first task).

- [ ] **Step 1: Write the failing DB test** in `__tests__/test_email_identity.py`

```python
import uuid
from datetime import UTC, datetime
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.session import engine

_seq = iter(range(9100000001, 9100009999))

async def _mk(conn, email, verified):
    await conn.execute(
        text("insert into users (id, phone, email, full_name, email_verified_at) "
             "values (:id, :phone, :email, 'T', :v)"),
        {"id": uuid.uuid7(), "phone": f"+91{next(_seq)}", "email": email,
         "v": datetime.now(UTC) if verified else None},
    )

async def test_two_unverified_with_same_email_allowed():
    async with engine.begin() as conn:
        await _mk(conn, "dup@x.com", False)
        await _mk(conn, "dup@x.com", False)  # no raise

async def test_only_one_verified_email_allowed():
    async with engine.begin() as conn:
        await _mk(conn, "v@x.com", True)
    with pytest.raises(IntegrityError):
        async with engine.begin() as conn:
            await _mk(conn, "v@x.com", True)
```

(The two assertions are what matter — duplicate *unverified* inserts succeed, a second *verified* insert of the same address raises `IntegrityError`.)

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: FAIL — either the migration/column doesn't exist, or (before the migration) the old column-unique rejects the two unverified duplicates too.

- [ ] **Step 3: Write migration `0007_email_verified_identity.py`** (revision `"0007"`, down_revision `"0006"`)

`upgrade()`:
- `op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))`
- `op.drop_constraint("uq_users_email", "users", type_="unique")`
- `op.create_index("uq_users_email_verified", "users", [sa.text("lower(email)")], unique=True, postgresql_where=sa.text("email_verified_at is not null"))`

`downgrade()` reverses in order: drop the index, recreate `uq_users_email` unique constraint on `["email"]`, drop the column.

- [ ] **Step 4: Update `app/models/user.py`**

- Add `email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))`.
- Change `email` column to drop `unique=True` (keep `String(320)`, nullable): `email: Mapped[str | None] = mapped_column(String(320))`.
- Add a property `email_verified(self) -> bool: return self.email_verified_at is not None`.

- [ ] **Step 5: Run to verify it passes**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add alembic/versions/0007_email_verified_identity.py app/models/user.py __tests__/test_email_identity.py
git commit -m "feat(auth): add email_verified_at and verified-only email uniqueness"
```

---

### Task 2: Email management (add / verify / remove) + verified-only login gating

**Files:**
- Modify: `app/repositories/user_repository.py` (add `get_by_verified_email`)
- Modify: `app/services/auth_service.py` (`add_email`, `verify_email`, `remove_email`, `_reauth`; tighten `_find`)
- Modify: `app/services/otp_service.py` (add `"verify_email"` to the `Purpose` literal)
- Modify: `app/api/v1/endpoints/account.py` (the three `/me/email` endpoints)
- Modify: `app/schemas/auth.py` (`EmailAddRequest`, `EmailVerifyRequest`, `EmailRemoveRequest`)
- Modify: `app/schemas/user.py` (`UserRead.email_verified: bool`)
- Test: `__tests__/test_email_identity.py` (extend)

**Interfaces:**
- Consumes: `Destination.email`, `get_otp_channel` via `OtpService` (Phase 1); `Email` from `app.schemas.common`; `verify_password` from `app.core.security`; `audit`, `_alert`.
- Produces (new `AuthService` methods, each on a signed-in `user: User`):
  - `async def add_email(self, user: User, data: EmailAddRequest) -> None` — if the user already has a **verified** email, require `_reauth`; store `data.email` on the row with `email_verified_at = None`; send a code via `OtpService.send(Destination.email(data.email), "verify_email")`; audit `email.added` (or `email.changed` when replacing a verified one).
  - `async def verify_email(self, user: User, code: str) -> None` — require `user.email` set; `OtpService.verify(Destination.email(user.email), "verify_email", code)`; set `email_verified_at = now`; `flush`; on `IntegrityError` → `ConflictError("This email is already in use by another account.")`; audit `email.verified`; `_alert`.
  - `async def remove_email(self, user: User, data: EmailRemoveRequest) -> None` — require `_reauth`; set `email = None`, `email_verified_at = None`; audit `email.removed`; `_alert`.
  - `async def _reauth(self, user: User, password: str | None) -> None` — raise `UnauthorizedError` unless `password` and `verify_password(user.password_hash, password)`.
  - `_find` now resolves an `@` identifier via `get_by_verified_email` (verified-only).
- `UserRepository.get_by_verified_email(self, email: str) -> User | None` — `email == lower` AND `email_verified_at is not None`.

- [ ] **Step 1: Write failing tests** in `__tests__/test_email_identity.py` (HTTP-level, using `helpers.signed_in` / `anon`)

```python
from .helpers import OTP, anon, new_phone, signed_in

async def add_email(c, email, password=None):
    body = {"email": email} | ({"password": password} if password else {})
    return await c.post("/api/v1/me/email", json=body)

async def test_add_and_verify_email_then_it_shows_on_me():
    async with signed_in() as c:
        assert (await add_email(c, "me@x.com")).status_code == 204
        assert (await c.post("/api/v1/me/email/verify", json={"code": OTP})).status_code == 204
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["email"] == "me@x.com" and me["email_verified"] is True

async def test_unverified_email_is_not_a_login_identifier():
    async with signed_in() as c:
        await add_email(c, "unv@x.com")  # added, NOT verified
    async with anon() as b:
        # password login by the unverified email must look like unknown account
        r = await b.post("/api/v1/auth/login/password",
                         json={"login": "unv@x.com", "password": "Correct-horse1"})
        assert r.status_code == 401

async def test_verify_email_already_verified_elsewhere_conflicts():
    async with signed_in() as a:
        await add_email(a, "shared@x.com")
        assert (await a.post("/api/v1/me/email/verify", json={"code": OTP})).status_code == 204
    async with signed_in() as b:
        await add_email(b, "shared@x.com")
        r = await b.post("/api/v1/me/email/verify", json={"code": OTP})
        assert r.status_code == 409

async def test_removing_email_frees_it_for_others():
    async with signed_in() as a:
        await add_email(a, "free@x.com")
        await a.post("/api/v1/me/email/verify", json={"code": OTP})
        assert (await a.request("DELETE", "/api/v1/me/email",
                                json={"password": "Correct-horse1"})).status_code == 204
    async with signed_in() as b:
        await add_email(b, "free@x.com")
        assert (await b.post("/api/v1/me/email/verify", json={"code": OTP})).status_code == 204

async def test_change_and_remove_email_require_password():
    async with signed_in() as c:
        await add_email(c, "first@x.com")
        await c.post("/api/v1/me/email/verify", json={"code": OTP})
        # change without password → 401; with correct password → 204
        assert (await add_email(c, "second@x.com")).status_code == 401
        assert (await add_email(c, "second@x.com", password="Correct-horse1")).status_code == 204
        assert (await c.request("DELETE", "/api/v1/me/email", json={})).status_code == 401
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: FAIL (endpoints 404 / methods missing).

- [ ] **Step 3: Add `"verify_email"` to `Purpose`** in `app/services/otp_service.py`

Extend the `Purpose` literal to include `"verify_email"`.

- [ ] **Step 4: Add `get_by_verified_email`** in `app/repositories/user_repository.py`

`select(User).where(User.email == email, User.email_verified_at.is_not(None))`.

- [ ] **Step 5: Implement the three service methods + `_reauth` in `app/services/auth_service.py`, and tighten `_find`**

Follow the Produces block. `_find`: replace `get_by_email(login.lower())` with `get_by_verified_email(login.lower())`. On `add_email`, lowercasing is done by the `Email` schema type; set `user.email = data.email`, `user.email_verified_at = None` (this also re-arms a previously verified address when changing). `verify_email` wraps the `email_verified_at` write + `flush` in try/except `IntegrityError` → `ConflictError`.

- [ ] **Step 6: Add schemas** in `app/schemas/auth.py`

```python
class EmailAddRequest(BaseModel):
    email: Email
    password: str | None = Field(default=None, max_length=128)

class EmailVerifyRequest(BaseModel):
    code: str = OtpCode

class EmailRemoveRequest(BaseModel):
    password: str | None = Field(default=None, max_length=128)
```

(Import `Email` from `app.schemas.common`.)

- [ ] **Step 7: Add the endpoints** in `app/api/v1/endpoints/account.py`

`POST /me/email` (204), `POST /me/email/verify` (204), `DELETE /me/email` (204), each `CurrentAuth` + `DbSession` + `Request`, delegating to `AuthService(db, request)`. Reuse the `account` router.

- [ ] **Step 8: Surface `email_verified`** in `app/schemas/user.py`

Add `email_verified: bool` to `UserRead` (populated from the model property via `from_attributes`).

- [ ] **Step 9: Run the email tests, then the full suite**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: PASS.
Run: `uv run pytest -q`
Expected: PASS — full regression green (phone flows unchanged; `UserRead` gains a field).

- [ ] **Step 10: Lint & commit**

```bash
uv run ruff check .
git add app/ __tests__/test_email_identity.py
git commit -m "feat(auth): add/verify/remove email with verified-only login and re-auth"
```

---

### Task 3: Email as a destination for login-OTP and forgot-password

**Files:**
- Modify: `app/schemas/auth.py` (`OtpRequest`, `OtpVerifyRequest`, `OtpLoginRequest`, `PasswordResetRequest` accept an email identifier)
- Modify: `app/services/auth_service.py` (`send_otp`, `verify_otp`, `login_with_otp`, `reset_password` resolve phone **or** verified email → `Destination`)
- Test: `__tests__/test_email_identity.py` (extend)

**Interfaces:**
- Consumes: `get_by_verified_email` (Task 2); `Destination.email` / `Destination.sms`; existing `OtpService`.
- Produces: a single `_destination(identifier) -> tuple[User | None, Destination]` helper on `AuthService` that maps an `@` identifier to `(verified-email-user, Destination.email(...))` and anything else to `(phone-user, Destination.sms(...))`; the four flows call it instead of hard-coding `Destination.sms(data.phone)`. Request bodies take an `identifier: str` (phone or email) in place of the bare `phone` for these flows, keeping `phone` acceptable (a 10-digit/Indian number normalises as today).

- [ ] **Step 1: Write failing tests** in `__tests__/test_email_identity.py`

```python
async def _verified_email(c, email):
    await c.post("/api/v1/me/email", json={"email": email})
    await c.post("/api/v1/me/email/verify", json={"code": OTP})

async def test_login_otp_to_email_requires_verified():
    async with signed_in() as c:
        await c.post("/api/v1/me/email", json={"email": "lo@x.com"})  # unverified
    async with anon() as b:
        assert (await b.post("/api/v1/auth/otp",
                             json={"identifier": "lo@x.com", "purpose": "login"})).status_code == 404

async def test_login_with_otp_by_verified_email():
    async with signed_in() as c:
        await _verified_email(c, "lo2@x.com")
    async with anon() as b:
        assert (await b.post("/api/v1/auth/otp",
                             json={"identifier": "lo2@x.com", "purpose": "login"})).status_code == 204
        r = await b.post("/api/v1/auth/login/otp", json={"identifier": "lo2@x.com", "code": OTP})
        assert r.status_code == 200 and (await b.get("/api/v1/auth/me")).json()["email"] == "lo2@x.com"

async def test_forgot_password_by_verified_email():
    async with signed_in() as c:
        await _verified_email(c, "fp@x.com")
    async with anon() as b:
        await b.post("/api/v1/auth/otp", json={"identifier": "fp@x.com", "purpose": "reset_password"})
        proof = (await b.post("/api/v1/auth/otp/verify",
                 json={"identifier": "fp@x.com", "purpose": "reset_password", "code": OTP})).json()["proof_token"]
        assert (await b.post("/api/v1/auth/password/reset",
                json={"identifier": "fp@x.com", "proof_token": proof, "new_password": "New-horse-123"})).status_code == 204

async def test_email_otp_is_rate_limited(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "otp_hourly_limit", 1)
    async with signed_in() as c:
        await _verified_email(c, "rl@x.com")
    async with anon() as b:
        assert (await b.post("/api/v1/auth/otp",
                             json={"identifier": "rl@x.com", "purpose": "login"})).status_code == 204
        assert (await b.post("/api/v1/auth/otp",
                             json={"identifier": "rl@x.com", "purpose": "login"})).status_code == 429
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: FAIL (`identifier` not accepted / email arm absent).

- [ ] **Step 3: Update the four schemas** in `app/schemas/auth.py`

Replace `phone: Phone` with `identifier: str = Field(min_length=1, max_length=320)` in `OtpRequest`, `OtpVerifyRequest`, `OtpLoginRequest`, `PasswordResetRequest`. Keep `purpose`, `code`, `proof_token`, `new_password` as-is. (The `@`-vs-phone decision moves into the service; a bare phone identifier still normalises there.)

- [ ] **Step 4: Add `_destination` and rewire the four flows** in `app/services/auth_service.py`

`_destination(identifier)`: if `"@" in identifier` → `(await self.users.get_by_verified_email(identifier.strip().lower()), Destination.email(identifier.strip().lower()))`; else normalise the phone (reuse `normalise_phone`, catch `ValueError` → treat as unknown) → `(await self.users.get_by_phone(phone), Destination.sms(phone))`. Each flow uses the resolved `user` for its existence/`signup`-conflict checks (unknown verified-email → the same `NO_ACCOUNT` 404 as an unknown phone) and the `Destination` for the OTP call. `signup` purpose stays phone-only (reject an email identifier for signup with the existing allowlist/validation path — signup still creates the phone identity).

- [ ] **Step 5: Run the email tests, then the full suite**

Run: `uv run pytest __tests__/test_email_identity.py -v`
Expected: PASS.
Run: `uv run pytest -q`
Expected: PASS — the renamed request field (`phone` → `identifier`) is reflected in the existing phone tests; update any phone-keyed OTP/login/reset request bodies in `__tests__/test_auth_security.py` and `__tests__/helpers.py` to send `identifier` (a one-field rename per call — this is a ruling point if a caller is missed).

- [ ] **Step 6: Lint & commit**

```bash
uv run ruff check .
git add app/ __tests__/
git commit -m "feat(auth): accept verified email as login/forgot identifier"
```

---

## Notes for the executor

- **The `phone` → `identifier` rename (Task 3) touches existing tests and the two front-end apps.** This plan updates the server tests; the client (`LoginForm`, `ForgotPasswordForm`, `OtpStep`, `SignupForm`) still posts `phone`/`mobile`. **Signup is unchanged** (still `phone`). For login-OTP and forgot-password, the client currently sends `{ phone }`; after this plan the server expects `{ identifier }`. **Phase 2b (UI) carries the client-side rename and the add-email/settings/onboarding screens.** Until 2b ships, the email login arm is reachable via the API only — acceptable, this phase is the backend seam. If you prefer zero client breakage before 2b, keep `phone` as an accepted alias in the four schemas (a `model_validator` mapping `phone`→`identifier`); omitted here to avoid carrying a dead alias — **ruling left to the executor**, record it if taken.
- **Re-auth is password-only for v1.** The design allows "password *or* a fresh OTP"; a fresh-OTP re-auth path is deferred (it needs a step-up OTP issue+verify round-trip and UI). Password re-auth closes the stated threat (a hijacked *live session* rarely carries the password). Flagged, not silently dropped.
- **SES sandbox** is the only thing between this passing locally and working for real users in prod (design §9 Phase-2 prerequisite). Tests run on the `log` mailer, so they are green without it.
- Email enumeration via OTP/forgot follows the **same existence-revealing stance as phone** (unknown identifier → 404 `NO_ACCOUNT`), matching the current product behaviour. Making email generic is a one-line product call noted in the design §8, not done here.
- If `uv run pytest -q` cannot reach Postgres locally (`ConnectionRefused`), run it where `fmd_test` exists (a local `postgres:16-alpine` container on `127.0.0.1:5432` with `POSTGRES_DB=fmd_test` works); the migration test in Task 1 needs the DB.
