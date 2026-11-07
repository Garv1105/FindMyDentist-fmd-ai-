# Auth Phase 1 — Multi-channel OTP seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the OTP subsystem's delivery target from "a phone" to a `Destination(kind, address)` carried over a pluggable `OtpChannel`, with SMS and email implementations, changing no user-visible behavior.

**Architecture:** A new `otp_channel` module defines a `Destination` value and an `OtpChannel` protocol with `SmsOtpChannel` (wraps the existing `Sender`) and `EmailOtpChannel` (wraps the existing `Mailer`), selected by a tiny registry. `OtpService` threads a `Destination` through `send`/`verify`/`issue_proof`/`use_proof` instead of a bare `phone`; Redis keys gain the channel kind. All existing phone callers pass `Destination.sms(phone)` and behave identically.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, Redis (`redis.asyncio`), pytest with `fakeredis`. Package manager: `uv` (run everything via `uv run`).

**Spec:** `docs/superpowers/specs/2026-10-29-auth-email-mfa-design.md` (this plan implements §5.2 "Channel refactor", Phase 1 of §9).

## Global Constraints

- **Behavior-preserving.** No change to any user-facing flow, endpoint, response, or error message. The only observable changes are Redis key *shapes* (ephemeral; no migration) and internal signatures.
- **No explanatory code comments** — project convention; explain in commit messages, not inline. Match the surrounding code's style, naming, and async idioms exactly.
- **DRY / YAGNI / minimal diff.** No speculative abstraction beyond the `OtpChannel`/`Destination` seam the spec calls for. SMS and email are the only two kinds.
- **Redis is ephemeral.** Key-shape changes need no migration; in-flight codes from before a deploy expire within `OTP_TTL_MINUTES` (10m) — acceptable.
- **Tests:** unit/service tests use the `fake_redis` fixture and need no database. The full HTTP regression suite needs a local Postgres `fmd_test` (see `README.md`); run it where that exists.

## Review Focus

- **SMS country allowlist must apply to SMS only.** The `+91`-only guard in `send` is phone-specific; an email `Destination` must bypass it. Pinned in Task 2 (`test_email_destination_skips_country_allowlist`).
- **Proof tokens are bound to their kind+address.** A proof issued for `(sms, phone)` must not validate for a different kind/address. Pinned in Task 2 (`test_proof_is_bound_to_destination`).
- **Single-use consume still races safely across the new key shape.** Two concurrent correct-code verifies: exactly one wins. Pinned in Task 2 (regression: existing `verify` single-use test passes under the new keys).
- **Audit channel meta accepts `email`.** `otp.sent` records the returned `Channel`; extending the literal must not break `audit.record`. Covered by the service-level email send test in Task 2 returning `"email"`.
- **Existing phone OTP behavior is unchanged** (rate limits, resend cooldown, tries cap, lockout, keyed-hash storage). The full suite in Task 2 is the regression gate; only the one key-shape assertion is updated.

---

### Task 1: `OtpChannel` abstraction + `Destination`

**Files:**
- Create: `app/services/messaging/otp_channel.py`
- Modify: `app/services/messaging/base.py` (extend the `Channel` literal with `"email"`)
- Test: `__tests__/test_otp_channel.py`

**Interfaces:**
- Produces:
  - `DestinationKind = Literal["sms", "email"]`
  - `@dataclass(frozen=True) class Destination: kind: DestinationKind; address: str` with classmethods `Destination.sms(phone: str) -> Destination` and `Destination.email(email: str) -> Destination`
  - `class OtpChannel(Protocol): async def deliver(self, address: str, code: str, purpose: str) -> Channel`
  - `SmsOtpChannel` — `deliver` delegates to `get_sender().send_otp(address, code, purpose)` and returns its `Channel`
  - `EmailOtpChannel` — `deliver` calls `get_mailer().send(address, OTP_EMAIL_SUBJECT, <body containing the code>)` and returns `"email"`; module const `OTP_EMAIL_SUBJECT: str`
  - `get_otp_channel(kind: DestinationKind) -> OtpChannel` (lru_cached registry; `email` → `EmailOtpChannel`, else `SmsOtpChannel`)
- Consumes: `Channel`, `Sender`, `get_sender` from `app.services.messaging`; `Mailer`, `get_mailer` from `app.services.email`.

- [ ] **Step 1: Write the failing tests** in `__tests__/test_otp_channel.py`

```python
import pytest
from app.services.messaging.otp_channel import (
    Destination, SmsOtpChannel, EmailOtpChannel, get_otp_channel, OTP_EMAIL_SUBJECT,
)

def test_destination_constructors():
    assert Destination.sms("+919000000001") == Destination("sms", "+919000000001")
    assert Destination.email("a@b.com") == Destination("email", "a@b.com")

def test_registry_selects_by_kind():
    assert isinstance(get_otp_channel("sms"), SmsOtpChannel)
    assert isinstance(get_otp_channel("email"), EmailOtpChannel)

async def test_sms_channel_delegates_to_sender(monkeypatch):
    sent = {}
    class FakeSender:
        async def send_otp(self, phone, code, purpose):
            sent.update(phone=phone, code=code, purpose=purpose); return "sms"
    monkeypatch.setattr("app.services.messaging.otp_channel.get_sender", lambda: FakeSender())
    ch = SmsOtpChannel()
    assert await ch.deliver("+919000000001", "123456", "signup") == "sms"
    assert sent == {"phone": "+919000000001", "code": "123456", "purpose": "signup"}

async def test_email_channel_sends_code_and_returns_email(monkeypatch):
    sent = {}
    class FakeMailer:
        async def send(self, to, subject, text):
            sent.update(to=to, subject=subject, text=text)
    monkeypatch.setattr("app.services.messaging.otp_channel.get_mailer", lambda: FakeMailer())
    ch = EmailOtpChannel()
    assert await ch.deliver("a@b.com", "654321", "login") == "email"
    assert sent["to"] == "a@b.com" and sent["subject"] == OTP_EMAIL_SUBJECT
    assert "654321" in sent["text"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest __tests__/test_otp_channel.py -v`
Expected: FAIL (module `otp_channel` does not exist).

- [ ] **Step 3: Extend the `Channel` literal** in `app/services/messaging/base.py`

Change `Channel = Literal["sms", "whatsapp", "log"]` to `Channel = Literal["sms", "whatsapp", "log", "email"]`.

- [ ] **Step 4: Implement `app/services/messaging/otp_channel.py`**

Define the interfaces listed above. `SmsOtpChannel.__init__` holds `get_sender()`; `EmailOtpChannel.__init__` holds `get_mailer()`. `get_otp_channel` is `@lru_cache`d. `OTP_EMAIL_SUBJECT = "Your FMD verification code"`; the email body states the code and that it expires in `OTP_TTL_MINUTES` minutes (read from settings, or a plain "10 minutes" string — implementer's choice, the test only asserts the code is present).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest __tests__/test_otp_channel.py -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/services/messaging/otp_channel.py app/services/messaging/base.py __tests__/test_otp_channel.py
git commit -m "feat(otp): add OtpChannel abstraction and Destination (sms/email)"
```

---

### Task 2: Thread `Destination` through `OtpService` and its callers

**Files:**
- Modify: `app/services/otp_service.py` (all public methods + `_keys` + `_code_hmac` + `generate_code` unchanged)
- Modify: `app/services/auth_service.py` (the five `self.otp.*` call sites)
- Test: `__tests__/test_otp_channel_service.py` (new, service-level, `fake_redis`)
- Modify tests: `__tests__/test_auth_security.py` (the `otp:code:...` key-shape assertion)

**Interfaces:**
- Consumes: `Destination`, `get_otp_channel` from `app.services.messaging.otp_channel` (Task 1).
- Produces (new `OtpService` signatures — every caller passes a `Destination`):
  - `async def send(self, dest: Destination, purpose: Purpose, request: Request | None = None) -> Channel`
  - `async def verify(self, dest: Destination, purpose: Purpose, code: str) -> None`
  - `async def issue_proof(self, dest: Destination, purpose: Purpose) -> str`
  - `async def use_proof(self, dest: Destination, purpose: Purpose, proof_token: str) -> None`
  - Internals: `_keys(dest, purpose)` keyed on `base = f"{purpose}:{dest.kind}:{dest.address}"`; `_code_hmac(dest, purpose, code)` over `f"otp:{purpose}:{dest.kind}:{dest.address}:{code}"`; proof owner string `f"{purpose}:{dest.kind}:{dest.address}"`.

- [ ] **Step 1: Write the failing service-level tests** in `__tests__/test_otp_channel_service.py`

```python
import pytest
from app.services.otp_service import OtpService
from app.services.messaging.otp_channel import Destination

async def test_send_and_verify_over_email(fake_redis, monkeypatch):
    delivered = {}
    async def fake_deliver(address, code, purpose):
        delivered.update(address=address, code=code, purpose=purpose); return "email"
    class FakeChannel:
        deliver = staticmethod(fake_deliver)
    monkeypatch.setattr("app.services.otp_service.get_otp_channel", lambda kind: FakeChannel())
    svc = OtpService()
    dest = Destination.email("user@example.com")
    assert await svc.send(dest, "login") == "email"
    await svc.verify(dest, "login", delivered["code"])  # correct code consumes, no raise
    with pytest.raises(Exception):
        await svc.verify(dest, "login", delivered["code"])  # single-use: second time fails

async def test_email_destination_skips_country_allowlist(fake_redis, monkeypatch):
    monkeypatch.setattr("app.services.otp_service.get_otp_channel",
                        lambda kind: type("C", (), {"deliver": staticmethod(lambda a,c,p: _ok())})())
    # email address does not start with +91; must not raise the country error
    svc = OtpService()
    await svc.send(Destination.email("user@example.com"), "login")

async def test_proof_is_bound_to_destination(fake_redis):
    svc = OtpService()
    token = await svc.issue_proof(Destination.sms("+919000000001"), "reset_password")
    with pytest.raises(Exception):
        await svc.use_proof(Destination.email("user@example.com"), "reset_password", token)
    await svc.use_proof(Destination.sms("+919000000001"), "reset_password", token)  # correct binding
```

Note: the implementer provides the trivial `_ok()` async helper (returns `"email"`) or inlines an async lambda equivalent; the assertion that matters is "no country error for an email destination".

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest __tests__/test_otp_channel_service.py -v`
Expected: FAIL (`OtpService.send` still takes `phone: str`; `get_otp_channel` not imported in `otp_service`).

- [ ] **Step 3: Refactor `app/services/otp_service.py`**

- Import `Destination, get_otp_channel` from `app.services.messaging.otp_channel`; drop the direct `get_sender` import.
- `_keys(dest, purpose)` and `_code_hmac(dest, purpose, code)` use `dest.kind` + `dest.address` as above.
- `send(dest, purpose, request=None)`: replace the `phone.startswith(...)` country check with `if dest.kind == "sms" and not any(dest.address.startswith(c) for c in s.otp_allowed_country_codes): raise AppError(...)`; rate-limit keys become `f"otp:{dest.kind}:h:{dest.address}"`, `f"otp:{dest.kind}:d:{dest.address}"` (IP key unchanged); deliver via `await get_otp_channel(dest.kind).deliver(dest.address, code, purpose)`.
- `verify` / `issue_proof` / `use_proof`: same logic, keyed through `dest` (proof owner string includes `dest.kind`).

- [ ] **Step 4: Update the five call sites in `app/services/auth_service.py`**

Import `Destination`. Wrap each phone argument: `send(Destination.sms(data.phone), …)`, `verify(Destination.sms(data.phone), …)` (in `verify_otp`, `register`, `login_with_otp`), `issue_proof(Destination.sms(data.phone), …)`, `use_proof(Destination.sms(data.phone), …)`. No other logic changes.

- [ ] **Step 5: Update the key-shape assertion** in `__tests__/test_auth_security.py`

In `test_otp_codes_are_stored_as_keyed_hashes`, change the key from `f"otp:code:signup:{phone}"` to `f"otp:code:signup:sms:{phone}"`, and the negative-control hash input from `f"signup:{phone}:{OTP}"` to match the new `_code_hmac` input `f"otp:signup:sms:{phone}:{OTP}"` (the assertion is still "stored value is a 64-char hash that is not the plain sha256 and does not contain the OTP").

- [ ] **Step 6: Run the new service tests, then the full suite**

Run: `uv run pytest __tests__/test_otp_channel_service.py __tests__/test_otp_channel.py -v`
Expected: PASS (service tests + Task 1 tests; need no DB).

Run (where local Postgres `fmd_test` exists): `uv run pytest -q`
Expected: PASS — entire existing suite green, proving phone behavior is unchanged.

- [ ] **Step 7: Lint**

Run: `uv run ruff check .`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add app/services/otp_service.py app/services/auth_service.py __tests__/test_otp_channel_service.py __tests__/test_auth_security.py
git commit -m "refactor(otp): route OTP through Destination/OtpChannel; phone flows unchanged"
```

---

## Notes for the executor

- This phase adds `EmailOtpChannel` but **no caller sends an email OTP yet** — that arrives in Phase 2 (email identity). The email path is exercised only by the service-level test here. That is intentional: Phase 1 is the seam.
- If `uv run pytest -q` cannot reach Postgres in your environment (`ConnectionRefused`), the full regression gate cannot run locally; the channel + service tests (`fake_redis`, no DB) still must pass, and the full suite must be run wherever `fmd_test` is available before this phase is considered done.
