# FMD — Authentication & Authorization Architecture

Status as built on `main` (traced from code, not the old plan). Last traced: 2026-10-28.

This is the one source of truth for how auth works today. Where something is planned but
not built, it says so explicitly under [What's built vs. planned](#whats-built-vs-planned).

---

## 1. What this is, and why it's shaped this way

FMD runs **its own auth**, built into the FastAPI server — not Cognito, Keycloak, or a
hosted IdP. The driving constraints:

- **Mobile-first, India-first.** Identity is a mobile number (E.164, `+91` only for now).
  OTP is a first-class login method, not just a recovery path.
- **DPDP Act duties** (in force from 13 May 2027): explicit consent records, an audit trail,
  18+ confirmation, "see and revoke my devices", account deletion (planned).
- **Small team.** Risky primitives come from vetted libraries (Argon2, PyJWT, `cryptography`
  via Argon2, `pyotp` later). Everything auth-related sits behind service modules so a SAML
  broker (Keycloak) can be bolted on later for enterprise hospital SSO without rewrites.

Two front-ends, **one login**:

- `client/main` — FMD Main (patients, visitors, dentists) on :3000
- `client/clinic-os` — FMD Clinic OS (clinic staff) on :3001

They share one account, one session cookie, and the same `@fmd/shared` auth code.

---

## 2. The pieces at a glance

```
Browser (main :3000 / clinic-os :3001)
   │  cookies: fmd_access (JWT, 15m)  +  fmd_refresh (opaque, rotating)
   │
   ▼
Next.js middleware  ── proxy.ts → refreshSession()        [client/shared/auth-proxy.ts]
   │   if access cookie gone but refresh present → POST /auth/refresh, re-attach cookies
   │   (/api/* calls get a 307 replay, because rewrites drop Set-Cookie)
   ▼
FastAPI  ── OriginCheckMiddleware (CSRF)                  [app/core/csrf.py]
   │
   ├── deps.py:  access cookie/Bearer → decode JWT → load session row → User   [app/api/deps.py]
   │                                                   └ require_member() for clinic RBAC
   │
   ├── endpoints/auth.py      register / login / refresh / logout / me
   ├── endpoints/account.py   list + revoke sessions
   │
   ├── services/
   │     auth_service     register, password/OTP login, lockout, reset
   │     session_service  create / refresh (rotate + reuse-detect) / revoke
   │     otp_service      send / verify / proof   ─────────┐
   │     rate_limiter     INCR+EXPIRE counters            ├─► Redis
   │     consent_service  grant / withdraw / list          │
   │     audit            append-only auth_events          │
   │     password_policy  HaveIBeenPwned k-anonymity check ─► pwnedpasswords.com
   │     messaging/       MSG91 (SMS/WA) | log  ───────────► MSG91
   │     email            SES | log         ───────────────► Amazon SES
   │
   └── PostgreSQL (RDS):  users, sessions, auth_events, consents,
                          clinics, clinic_memberships, invitations
```

Two datastores by design: **Postgres** for durable state, **Redis** for ephemeral,
high-churn, self-expiring state (OTP codes, proofs, rate-limit counters).

---

## 3. Identity & credentials

**The identifier is the mobile number.** `users.phone` is unique, E.164, DB-constrained to
`^\+[1-9][0-9]{7,14}$`. Email is optional and unique; it's a secondary login handle, never
required at signup.

- **Phone normalisation** (`schemas/common.py:normalise_phone`): strips spaces/dashes/brackets,
  turns a bare 10-digit `[6-9]…` into `+91…`, handles a leading `0` and `00` international
  prefix, then validates E.164. The same `Phone` annotated type validates every request body.
- **Login resolution** (`auth_service._find`): an `@` in the input → look up by lowercased
  email; otherwise normalise as a phone and look up by phone.

**Passwords** are hashed with **Argon2** (`argon2-cffi`, library defaults) in
`core/security.py`:

- `hash_password` / `verify_password` wrap the hasher; verify swallows the library's
  exceptions and returns `False`.
- `password_needs_rehash` + a transparent re-hash on successful login means parameters can be
  tightened later and old hashes upgrade themselves on next use.
- **Breached-password check** (`password_policy.ensure_not_breached`): on register and reset,
  the password's SHA-1 is split into a 5-char prefix + suffix, the prefix is sent to the
  **HaveIBeenPwned range API** (k-anonymity, with `Add-Padding`), and a match is rejected
  (422 `breached_password`). If the API is slow/down (2s timeout) the check **fails open** and
  logs a warning — availability over strictness here.
- Policy at the edge: 8–128 chars (`schemas/auth.Password`). No composition rules; breach
  check does the real work.

**Timing-safe account non-disclosure**: `security.DUMMY_HASH` is verified when the account is
unknown so a wrong-username and wrong-password request take the same time.

---

## 4. Token & session model

This is the core. **Two cookies, two lifetimes.**

| Cookie | What it is | Lifetime | Purpose |
|--------|-----------|----------|---------|
| `fmd_access` | JWT, HS256 | 15 min (cookie set 60s short of exp) | Stateless per-request auth |
| `fmd_refresh` | opaque random (`secrets.token_urlsafe(32)`) | up to 60 days | Mint new access tokens; one per device |

Both cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (configurable), `path=/`, optional
`COOKIE_DOMAIN` so they're shared across `fmd.in` and `clinic.fmd.in`.

### The access JWT (`core/security.py`)

- Signing key is **not** the raw `SECRET_KEY` — it's `HMAC(secret, "fmd-access-jwt-v1")`, so
  the JWT key is domain-separated from the OTP pepper and refresh-token hashing that use the
  same secret. Rotating the label (`…-v1`) is the migration path to a new key.
- Claims: `sub` (user id), `sid` (**session id**), `iss`, `aud`, `iat`, `exp`. Decoding
  requires `sub`, `sid`, `exp`, `iat` and verifies issuer + audience.
- The `sid` claim is what makes a stateless token instantly revocable (below).

### The session row (`models/security.py:UserSession`, table `sessions`)

One row = **one signed-in device**. Columns worth knowing:

- `token_hash`, `prev_token_hash` — SHA-256 of the current and previous refresh token
  (raw tokens are never stored). Both unique.
- `rotated_at`, `last_seen_at`, `idle_expires_at` (14-day sliding), `expires_at` (60-day
  absolute cap).
- `auth_method` (`signup`/`password`/`otp`), `ip`, `user_agent` — shown on the sessions page.
- `revoked_at`, `revoke_reason` — soft revoke, keeps an audit trail.
- `mfa_verified_at`, `reauth_at` — **columns exist, unused today** (Phase C MFA/step-up).
- PK is `uuid7` (time-ordered).

### How a request is authenticated (`api/deps.py`)

1. `_access_token`: read `Authorization: Bearer …`, else the `fmd_access` cookie.
2. `access_claims`: decode the JWT → `(user_id, session_id)`; any JWT/UUID error → `None`.
3. `get_current_auth`: `SessionService.active_user(user_id, session_id)` — a single query that
   joins user + session and requires the user active, the session **not revoked**, and both
   `expires_at`/`idle_expires_at` still in the future.

So even though the JWT is stateless, **every request hits the session row**. Revoking a
session (logout, reset, reuse detection, admin) takes effect on the very next request, within
the 15-minute access-token window at worst — there is no "valid JWT after logout" gap beyond
what the session check closes immediately.

> **Note on the Redis deny-list:** the old plan mentioned a Redis deny-list for instant
> revoke. As built, instant revoke is achieved by the per-request session lookup instead —
> there is no separate JWT deny-list in the code. Simpler, one fewer moving part. (See
> [gaps](#12-known-gaps--things-to-decide).)

### Refresh with rotation + theft detection (`session_service.refresh`)

The security-critical routine. On `POST /auth/refresh` with the refresh cookie:

1. `SELECT … FOR UPDATE` the session where `token_hash = h` **or** `prev_token_hash = h`
   (row-locked against concurrent refreshes).
2. Dead session or inactive user → `None` (caller 401s and clears cookies).
3. **Token matches `token_hash`** (the current one): rotate — move current to `prev_`, generate
   a new token, bump `rotated_at`/`last_seen_at`, slide `idle_expires_at`. Return the new token.
4. **Token matches `prev_token_hash`** (an already-rotated token being reused):
   - within `refresh_reuse_grace_seconds` (30s) of rotation → treat as a double-submit from two
     tabs: issue a fresh **access** token but **no new refresh token** (`return None, session, user`).
   - after the grace window → treat as **theft**: revoke the whole session (`refresh_reuse`),
     write an audit event, return `None`. The legitimate user and the thief are both logged out;
     the user logs in again, the thief is dead.

This is standard refresh-token rotation with reuse detection, plus a short grace window so
real-world concurrent refreshes don't nuke the session.

### Session lifecycle endpoints (`endpoints/auth.py`)

- `_start_session`: on any successful auth, if the incoming request already carried a refresh
  cookie for a live session, that old session is revoked (`replaced`) before a new one is
  created — re-logging-in on a device doesn't leave orphan sessions.
- `_issue`: sets the access cookie (always) and refresh cookie (only when a new refresh token
  exists — not on grace-window refreshes).
- `POST /auth/refresh`: 204 + new cookies, or 401 + cleared cookies.
- `POST /auth/logout`: revokes the session found by the refresh cookie; if only the access
  cookie is present, revokes by `sid` from the JWT. Clears cookies either way.
- `POST /auth/logout-all`: revokes **all** of the user's sessions.
- `GET /me/sessions` / `DELETE /me/sessions/{id}`: the "your devices" page; the current session
  is flagged by comparing `sid`.

---

## 5. OTP subsystem (Redis-backed)

All in `services/otp_service.py`, state entirely in Redis (TTL'd, nothing persisted).

**Purposes** (`Purpose` literal): `signup`, `login`, `reset_password`, and — defined but not
yet wired to endpoints — `change_phone`, `step_up`, `mfa`.

- **Code**: 6 digits from `secrets.randbelow`. Stored **not in cleartext** —
  `HMAC(secret, "otp:{purpose}:{phone}:{code}")` is stored, keyed by `otp:code:{purpose}:{phone}`,
  TTL `OTP_TTL_MINUTES` (10). So a Redis dump never reveals live codes.
- **Country allowlist**: only `+91` for now (`OTP_ALLOWED_COUNTRY_CODES`), rejected before send.
- **Resend cooldown**: `SET cooldown NX EX 30` — one OTP per 30s per `(purpose, phone)`.
- **Rate limits** stacked per send (all via `rate_limiter.hit` = `INCR` + `EXPIRE NX`):
  phone/hour (5), phone/day (10), IP/hour (30).
- **Verify** (`verify`): atomic `INCR` of a tries counter (max 5), constant-time
  `secrets.compare_digest` against the stored HMAC, then a `DELETE` of the code key that
  **must** return 1 — this makes verify single-use even under a race (two requests can't both
  consume the same code). Tries counter also cleared.
- **Proof tokens** (`issue_proof` / `use_proof`): after an OTP is verified for a flow that then
  needs a second step (password reset), a random proof token is issued; its **hash** maps to
  `"{purpose}:{phone}"` in Redis (TTL 10m). `use_proof` is `GETDEL` — single-use. This is how
  "I verified my phone" is carried from the verify step to the reset step without trusting the
  client.

**Delivery** (`services/messaging/`): a `Sender` Protocol with two implementations —
`log` (prints to server log, dev default) and `msg91` (India DLT Flow API, WhatsApp/SMS,
template-driven). Selected by `SMS_PROVIDER`. Security/notification messages
(`password_changed`, `account_locked`) go through the same sender's `notify`, plus email via
SES when the user has an email. Production config **refuses to boot** with `log` providers
(`config.py` validator).

---

## 6. The flows, end to end

**Signup** (`POST /auth/otp` → `/auth/otp/verify`? no — see below → `/auth/register`)
1. `POST /auth/otp` `{phone, purpose:"signup"}` → rejects if phone already registered, else sends OTP.
2. `POST /auth/register` `{full_name, phone, password, otp, accept_terms:true, age_confirmed:true,
   marketing_opt_in?}` → re-checks phone free, **verifies the OTP inline**, breach-checks the
   password, creates the user (`phone_verified_at`, `age_confirmed_at`, `password_changed_at`
   set now), records consents (`terms`, `privacy_notice`, +`marketing` if opted in), audits
   `signup`, and **starts a session** (auto-login). `accept_terms`/`age_confirmed` are
   `Literal[True]` so the request won't validate without them.

   > Signup verifies the OTP directly in `/register` (no proof token). Only `reset_password`
   > uses the verify→proof two-step.

**Password login** (`POST /auth/login/password`)
IP/hour limit (100) → resolve user by email-or-phone → lockout check (`locked_until`) → verify
Argon2 (dummy hash if unknown user, for constant time) → on failure increment
`failed_login_count`, and at 10 failures set a 15-min `locked_until` + alert the user (SMS +
email) → on success clear failures, transparently re-hash if needed, audit, start session.
Locked accounts can still log in with OTP.

**OTP login** (`POST /auth/otp` `purpose:"login"` → `/auth/login/otp`)
Requires an existing active account (else a generic error). Verifies the OTP, clears failures,
starts a session. This is also the escape hatch from a password lockout.

**Forgot password** (`/auth/otp` `purpose:"reset_password"` → `/auth/otp/verify` →
`/auth/password/reset`)
1. Send OTP (requires the account to exist).
2. `POST /auth/otp/verify` `{phone, purpose:"reset_password", code}` → returns a **proof token**.
3. `POST /auth/password/reset` `{phone, proof_token, new_password}` → consumes the proof
   (single-use), breach-checks, sets the new hash + `password_changed_at`, **revokes all
   sessions** (`password_reset`), audits, and alerts the user. Reset = global logout.

**Token refresh** — see [§4](#refresh-with-rotation--theft-detection). Normally invisible;
driven by the Next.js middleware, not the browser.

**Logout / logout-all** — see [§4](#session-lifecycle-endpoints-endpointsauthpy).

---

## 7. The Next.js ↔ API glue (`client/shared/auth-proxy.ts`)

The browser never calls the refresh endpoint itself. The Next.js **middleware**
(`main/src/proxy.ts`, `clinic-os/src/proxy.ts` → `refreshSession`) does, transparently:

- If the request has an access cookie, or has **no** refresh cookie → do nothing.
- If the access cookie is gone but a refresh cookie remains → `POST /auth/refresh` server-side
  with the refresh cookie, collect the `Set-Cookie` headers.
- **For `/api/*` requests**: Next rewrites drop `Set-Cookie`, so instead the middleware returns
  a **307 redirect to the same URL** carrying the new cookies — the browser stores them and
  replays the call, now authenticated. This 307 trick is the key detail.
- **For page requests**: it mutates the request cookies in place (so the RSC render sees the new
  session) and also appends `Set-Cookie` to the response so the browser updates too.

Server components read the session with `apiGet` / `getCurrentUser` (`shared/session.ts`),
forwarding the access cookie to the API; 401/403/404 collapse to `null`. The browser-side
`apiClient` (`shared/api-client.ts`) is an axios instance with `withCredentials` and an
interceptor that unwraps the API's `{error:{message}}` envelope into `err.message`.

---

## 8. Authorization (RBAC) — clinics

Account auth is global; **authorization is per-clinic**, via membership rows.

- `clinic_memberships` (`models/clinic.py`): `(clinic_id, user_id)` unique, `role ∈
  {owner, dentist, receptionist}`, `status ∈ {active, deactivated}`.
- `api/deps.py:require_member(*roles)` is the gate: it loads the caller's membership for the
  `clinic_id` path param, 404s if there's no active membership (**404, not 403 — doesn't reveal
  the clinic exists**), and 403s if a role is required and not held. `ClinicMember` and
  `ClinicOwner` are the ready-made dependencies.
- **Clinic creation**: anyone can register a clinic in Clinic OS and becomes its `owner`
  (no dentist profile required).
- **Invitations** (`services/invitation_service.py`): an owner invites by mobile number; a
  random token (hash stored) becomes an `/invite/{token}` link into Clinic OS, 7-day expiry,
  one pending invite per `(clinic, phone)` enforced by a partial unique index. Accepting
  **requires the signed-in user's phone to match the invited phone** — invites are not
  transferable. Preview masks the phone (`98****21`).

---

## 9. Abuse, CSRF & defensive posture

- **CSRF**: `OriginCheckMiddleware` (`core/csrf.py`) rejects any unsafe method (not
  GET/HEAD/OPTIONS) whose `Origin` (or `Referer` origin) isn't in `ALLOWED_ORIGINS`. Missing
  origin is allowed only outside production. This pairs with `SameSite=Lax` cookies.
- **Rate limiting**: Redis counters on OTP sends (phone/IP, hour/day), password-login IP/hour,
  OTP resend cooldown. All fail **closed** with a 429 (Redis being down would block, not bypass).
- **Account lockout**: 10 failed passwords → 15-min lock, with OTP as the bypass. Lockout and
  password-change both alert the user out-of-band.
- **Enumeration**: dummy-hash constant time on login; signup/reset deliberately *do* tell you
  whether a phone is registered (product decision for a mobile-first flow), but login stays
  generic (`BAD_LOGIN`).
- **Secrets**: one `SECRET_KEY` (min 32 chars), domain-separated by HMAC label into JWT key,
  OTP pepper, and token hashing. Refresh tokens and invite tokens are random and only their
  SHA-256 is stored.
- **Audit** (`services/audit.py`, table `auth_events`): append-only log of `otp.sent`,
  `signup`, `login.*`, `account.locked`, `password.reset`, `logout*`, `session.*` with
  result, IP, UA, and JSON meta. Indexed by `(user_id, created_at)`.
- **Consent** (`services/consent_service.py`, table `consents`): versioned by
  `NOTICE_VERSION`; grant/withdraw/list, purposes constrained to `terms/privacy_notice/marketing`.

---

## 10. Config surface (`core/config.py`)

Everything is env-driven (`.env`, pydantic-settings). Highlights:

- Tokens: `ACCESS_TOKEN_MINUTES=15`, `SESSION_IDLE_DAYS=14`, `SESSION_ABSOLUTE_DAYS=60`,
  `REFRESH_REUSE_GRACE_SECONDS=30`, cookie names/domain/`COOKIE_SECURE`.
- OTP: TTL 10m, 5 attempts, 30s resend, phone 5/h & 10/day, IP 30/h, `+91` only, proof 10m.
- Login: 10 failures, 15-min lock, IP 100/h, `BREACHED_PASSWORD_CHECK=true`.
- Providers: `SMS_PROVIDER` (`log`|`msg91`), `EMAIL_PROVIDER` (`log`|`ses`), MSG91 key +
  templates, SES region. **Production refuses `log` providers** and requires MSG91 config if
  selected.
- `ALLOWED_ORIGINS` (CSRF), `CORS_ORIGINS` (only added if set), DB SSL (`verify-full` via a CA
  bundle), statement timeout, pool settings.

---

## 11. Where everything lives

| Concern | File |
|---|---|
| Argon2, JWT, token/HMAC hashing | `server/app/core/security.py` |
| Settings / env | `server/app/core/config.py` |
| Origin-check CSRF | `server/app/core/csrf.py` |
| Redis client | `server/app/core/cache.py` |
| Error types → JSON envelope | `server/app/core/exceptions.py` |
| Auth flows | `server/app/services/auth_service.py` |
| Sessions (rotate/revoke) | `server/app/services/session_service.py` |
| OTP | `server/app/services/otp_service.py` |
| Rate limiter | `server/app/services/rate_limiter.py` |
| Breached-password check | `server/app/services/password_policy.py` |
| Audit / consent | `server/app/services/audit.py`, `consent_service.py` |
| Invitations | `server/app/services/invitation_service.py` |
| SMS/WhatsApp / email | `server/app/services/messaging/`, `services/email.py` |
| Request auth + RBAC deps | `server/app/api/deps.py` |
| Auth / account endpoints | `server/app/api/v1/endpoints/auth.py`, `account.py` |
| Models | `server/app/models/user.py`, `security.py`, `clinic.py` |
| Request/response schemas | `server/app/schemas/auth.py`, `common.py` |
| Next.js refresh middleware | `client/shared/src/auth-proxy.ts`, `*/src/proxy.ts` |
| Server-side session read | `client/shared/src/session.ts` |
| Browser API client | `client/shared/src/api-client.ts` |
| Migrations | `server/alembic/versions/0001…0006` |

---

## What's built vs. planned

**Built (Phase A + the Oct 22–23 revisions), live on RDS:**
JWT access + rotating refresh with reuse detection · Redis OTP (HMAC-peppered, proofs, rate
limits) · OTP-verified signup · password + OTP login · lockout · forgot/reset · breached-password
check · Origin CSRF · `auth_events` audit · `consents` + 18+ · sessions page (list/revoke/all) ·
clinic RBAC + invitations · MSG91 + SES senders behind a provider switch.

**Planned, not yet in code:**
- **Google OIDC** (PKCE, no auto-merge by email). No OAuth code, routes, or provider table yet.
- **Cloudflare Turnstile** on OTP/login. No verification call yet.
- **TOTP MFA for Clinic OS staff** (`pyotp`, recovery codes, re-check every 12h). The
  `sessions.mfa_verified_at` / `reauth_at` columns and the `mfa`/`step_up` OTP purposes exist as
  placeholders; nothing enforces them.
- **Step-up re-auth**, **change phone**, **account deletion** — OTP purposes defined
  (`change_phone`, `step_up`), no endpoints.
- **RDS move to ap-south-1** (currently ap-southeast-2 per infra notes).

## 12. Known gaps / things to decide

Flagging these honestly so they're on the radar, not as blockers:

1. **No separate JWT deny-list.** Instant revoke relies on the per-request session-row lookup
   in `active_user`. That's sound and simpler, but it means every authenticated request does a
   DB round-trip (a user+session join). Fine at current scale; revisit with a short-TTL Redis
   cache of "session alive" if read load bites. The old plan's wording about a Redis deny-list
   is now stale — this doc reflects the code.
2. **Breach check fails open.** A HaveIBeenPwned outage silently allows any password. Acceptable
   trade-off, but worth a metric/alert so a long outage is noticed.
3. **Refresh happens in Next.js middleware**, so a non-browser API client (mobile app later)
   must implement rotation itself against `/auth/refresh`. Document this when the mobile app
   starts.
4. **`change_phone` / `step_up` / `mfa` OTP purposes exist but are dead code** until Phase C —
   either wire them or drop them so the surface matches reality.
5. **Logout is best-effort on the access-only path.** If both cookies are somehow absent, logout
   is a no-op (cookies already gone) — expected, just noting.
