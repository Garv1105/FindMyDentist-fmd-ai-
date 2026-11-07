# FMD Auth — Email identity, multi-channel OTP, and opt-in MFA

**Status:** design, awaiting approval. Date: 2026-10-29.
**Builds on:** `docs/auth-architecture.md` (the as-built Phase-A system). This document only
describes what changes and is net-new; everything not mentioned stays as it is today.

---

## 1. Intent & why

FMD's auth today is mobile-first and solid: phone is the identity, OTP + password login,
rotating refresh tokens, lockout, breach checks, audit, consent. Two things the product owner
wants next, framed as "make the whole auth system really good and extensible":

1. **Email as a second way in.** A person registers with their phone as today, then *optionally*
   adds an email. Once they do, they can log in with email too — email + password, a login code
   sent to email, and forgot-password by email — exactly mirroring what phone already does.
2. **Opt-in MFA they control.** Any user can switch on "require a second factor." Once on, every
   **password** login then demands a second factor. SMS code for v1, but built behind an
   interface so TOTP / authenticator apps / email codes are added later without reworking the
   login flow.

The deeper goal is **extensibility**: adding a new OTP channel, a new identity type, or a new
second factor should be an isolated, small change — not surgery on the login path. The driving
value is that the owner wants to keep building on this for years, so the seams matter as much as
the features.

## 2. Goals / non-goals / anti-goals

**Goals**
- Email becomes a verified, optional secondary identity usable for every login path phone has.
- One-time codes can be delivered to **either** phone or email through one generalized subsystem.
- Per-user opt-in MFA that gates password login, with SMS as the first factor method.
- A clean onboarding step after signup where the user can add email and finish their profile.
- Clear extension seams: OTP channels, MFA methods, and login identifiers are each pluggable.

**Non-goals (not now, but the design must not block them)**
- TOTP / authenticator-app MFA, WhatsApp codes, passkeys/WebAuthn, Google OIDC — later phases.
- Step-up re-auth for sensitive actions (columns exist; wiring is a later phase).
- Making email *mandatory*, or email becoming a primary identity. Phone stays primary.
- Recovery/backup codes for MFA — flagged as the first follow-up once SMS MFA ships.
- **Clinic-mandated MFA** (the as-built doc's "mandatory TOTP for Clinic OS staff"). This project
  is per-user opt-in only; a clinic-level *requirement* layers on top later and the per-user
  `mfa_enabled` model doesn't block it.

**Anti-goals (would make this a failure even if it "works")**
- An unverified email ever being accepted as a login identifier (account-takeover-by-typo).
- MFA that can be silently skipped, or that locks a user out with no recovery path at all.
- A login flow riddled with `if channel == "sms" … elif "email"` branches — the thing we're
  explicitly trying to avoid. Channels and factors must be polymorphic.
- Breaking the existing phone-only users: every current flow keeps working untouched.

## 3. Constraints

- **Mobile-first, India-first.** Phone (E.164, `+91`) is still the primary identity and the
  default everywhere. Email is additive.
- **DPDP Act.** Email is personal data: consented capture, in the audit trail, deletable.
- **Small team, vetted primitives.** Reuse the existing Argon2/JWT/HMAC/Redis machinery and the
  `Sender` provider pattern (MSG91 for SMS, SES for email — SES is already wired for alerts).
- **Existing stack unchanged:** FastAPI + SQLAlchemy async + Alembic + Postgres(RDS) + Redis,
  two Next.js apps sharing `@fmd/shared`.
- **Two front-ends, one login.** Whatever we add works identically in FMD Main and Clinic OS.

## 4. Current state (what we're extending)

- `User`: `phone` (unique, primary identity), `email` (unique, **nullable, never populated**,
  no `email_verified_at`), `password_hash`, profile fields (`year_of_birth`, `gender`, `city`),
  `failed_login_count`, `locked_until`. **No MFA fields.**
- `auth_service._find`: already resolves an `@`-containing login as email, else phone — so
  **email + password login already works the moment an email exists and is trusted.**
- `otp_service`: OTP is **phone-keyed only** (`otp:code:{purpose}:{phone}`), HMAC-stored,
  single-use, tries-capped, rate-limited; `send()` goes through `Sender.send_otp(phone, …)`.
  `Purpose` already includes the unused `change_phone`, `step_up`, `mfa`.
- `session`: already has unused `mfa_verified_at`, `reauth_at` columns.
- Messaging: `Sender` protocol with `log` / `msg91`; email via SES `get_mailer()` (alerts only).
- Client: `SignupForm`, `LoginForm`, `ForgotPasswordForm`, `OtpStep`, shared validators
  (`passwordProblem`, `phoneProblem`), and the new `/auth/password/check` pre-check.

## 5. The design

### 5.1 Identity model — phone primary, email verified-secondary

- `phone` unchanged: primary, required, unique, verified at signup.
- `email` becomes a **first-class but optional, verified** identity. Add
  `users.email_verified_at` (nullable). **Rule: an email is only usable as a login identifier
  or OTP destination once `email_verified_at` is set.** An unverified email is stored but inert.
- **Uniqueness is on verified emails only** *(decided — resolves the squatting problem the
  reviewer raised)*. Replace the current column-level `unique` on `users.email` with a **partial
  unique index on `lower(email)` WHERE `email_verified_at IS NOT NULL`**. So several accounts may
  hold the same address *unverified* (no land-grab / DoS), but at most one may have it *verified*.
  **Verify is "first to verify wins":** verifying an email that another account has already
  verified is rejected ("email already in use"); verifying succeeds only if no other row has it
  verified, and that check + the `email_verified_at` write happen under the row lock / unique
  index so a concurrent double-verify can't both win. Store email lowercased (already lowercased
  in `_find`).

### 5.2 One subsystem for all one-time codes — the key refactor

Today's OTP subsystem is phone-shaped. Generalize the *destination* from "phone" to a small
**`Channel` abstraction** so a code can go to phone **or** email through the same code,
HMAC-storage, tries, and rate-limit logic.

- Introduce a `Destination` = `(channel, address)` where `channel ∈ {sms, email}` and `address`
  is the E.164 phone or the email. Redis keys become `otp:code:{purpose}:{channel}:{address}`.
- A `Channel` interface: `send(address, code, purpose)`. `SmsChannel` wraps the existing
  `Sender` (MSG91/log); `EmailChannel` wraps the SES mailer with an OTP template. Selection is a
  dict lookup, **not** an if/elif — adding WhatsApp/push later is a new class + one registry line.
- `otp_service.send/verify/issue_proof/use_proof` take a `Destination` instead of a bare phone.
  Phone callers pass `(sms, phone)`; nothing about their behavior changes. Rate-limit keys stay
  per-address; email sends also get their own per-address + per-IP limits.

This is the seam that makes "login code to phone or email" and later "email MFA" fall out for
free instead of being special-cased.

### 5.3 Login methods (the matrix after this ships)

| Method | Identifier | Factor delivered to | Status |
|---|---|---|---|
| Password | mobile **or** email | — (+ MFA if on) | email arm newly reachable |
| Login OTP | mobile **or** email | that same channel | email arm new |
| Forgot password | mobile **or** email | that same channel | email arm new |

`_find` already maps identifier→user. For OTP/forgot by email, the request carries an email; we
resolve the user, confirm the email is verified, and send the code over `EmailChannel`.

### 5.4 Opt-in MFA — user-owned, SMS-first, pluggable

**Model.** Add to `users`: `mfa_enabled` (bool, default false) and `mfa_method`
(`null | 'sms'`; room for `'totp'`, `'email'` later). The session's `mfa_verified_at` records
that a session cleared MFA.

**Who/when.** Entirely the user's choice — a toggle in account settings. When `mfa_enabled`:
- **Password login requires a second factor.** OTP login does **not** (it's already a one-time
  factor — no double prompt). This matches the owner's "mandatory in some cases if they're trying
  the password thing."

**Flow (mirrors the proven proof-token pattern).** On a correct password for an MFA user, we do
**not** issue a session. Instead:
1. Issue a short-lived **MFA challenge token** (opaque, hashed in Redis → `user_id`, TTL ~5 min),
   and dispatch the factor's challenge (SMS code via the MFA method).
2. Client shows a second-factor step. It submits `(challenge_token, code)` to a new endpoint.
3. On success, the session is created and marked `mfa_verified_at = now`.

**Extensibility.** An `MfaMethod` interface: `start(user) -> challenge`, `verify(user, code)`.
`SmsMfaMethod` reuses the unified OTP subsystem with purpose `mfa` over `SmsChannel`. `TotpMethod`
later implements the same interface with no login-flow change. The login path only ever talks to
`MfaMethod`, never to a specific factor.

**Recovery (v1 stance).** SMS MFA uses the user's verified phone. If MFA is on and the password
path needs a factor, losing the phone is a support path for v1; **backup codes are the first
follow-up** and the `MfaMethod` interface already leaves room (`verify` can accept a recovery
code). We will not ship MFA without at least documenting this gap.

### 5.5 Registration → onboarding → app (the journey)

Registration stays phone-first and unchanged through OTP. We add an **onboarding step** after the
account exists and the user is auto-logged-in:

1. **Details form** → Send OTP (with the pre-checks we already built: phone, password
   composition, match, breach — all before the code is sent).
2. **OTP verify** → account created, consents recorded, auto-login (as today).
3. **Onboarding / "Complete your profile"** (new, **skippable**): optionally add an **email**
   (which triggers email verification — a code to that email), and optionally fill profile
   fields (year of birth, gender, city). "Do this later" lands them in the app immediately; the
   app can nudge later. Nothing here blocks using FMD.
4. **App.**

Email verification (here or later in settings): enter email → code sent via `EmailChannel`
(purpose e.g. `verify_email`) → on verify, set `email_verified_at`. Only then is it a login
identity. Changing email re-verifies; removing it clears the field.

### 5.6 Account settings (new surface)

A small "Login & security" area (FMD Main `/account`, shared with Clinic OS):
- **Email**: add / verify / change / remove, with verified state shown.
- **MFA**: toggle on/off; turning on walks through verifying the SMS factor once; method shown.
- **Devices/sessions**: already exists (list + revoke + logout-all).

**Sensitive mutations require a fresh re-auth** *(decided — closes the gap the reviewer raised
against anti-goal #2)*. **Disabling MFA, changing email, and removing email** each require the
user to re-confirm with their password **or** a fresh OTP in the same request, not merely a live
session. This is a lightweight inline check (verify the supplied password/OTP against the current
user) — **not** the full step-up framework, which stays a non-goal. It stops someone with a
hijacked-but-live session from quietly turning MFA off or hijacking the email. These four actions
also send the out-of-band security alert and audit event. Adding/verifying email and *enabling*
MFA don't need re-auth (they only add protection).

### 5.7 Extensibility seams (the point)

- **`Channel`** (sms, email, …) — where a one-time code is delivered.
- **`MfaMethod`** (sms, totp, …) — what a second factor is.
- **Identifier resolution** (`_find`) — phone or email today; one place to extend.
- **`Purpose`** already enumerates future flows (`change_phone`, `step_up`).
Each is a small interface with a registry; a new implementation is a new class + one line.

## 6. Data model changes (one migration)

- `users.email_verified_at TIMESTAMPTZ NULL`
- **Drop** the column-level `unique` on `users.email`; **add** a partial unique index
  `on lower(email) where email_verified_at is not null` (see §5.1). This is the one non-additive
  change, but it only *loosens* uniqueness — no existing row is affected (today every `email` is
  null), so it is safe and backward-compatible.
- `users.mfa_enabled BOOLEAN NOT NULL DEFAULT false`
- `users.mfa_method VARCHAR(20) NULL` with a check constraint `in ('sms')` (extended later)
- (the `email` column and the session MFA columns already exist)

Backward-compatible with current phone-only users: every new column is nullable or defaulted.

## 7. API surface (net-new / changed)

- `POST /auth/otp` — accept an **email** destination for `login` / `reset_password` (currently
  phone-only), resolving the user and requiring a verified email.
- `POST /auth/login/otp` — accept email identifier.
- `POST /auth/login/password` — when the resolved user has MFA on, respond with an **MFA-required**
  signal + challenge token instead of a session.
- `POST /auth/mfa/verify` *(new)* — `(challenge_token, code)` → issues the session.
- `POST /me/email` *(new)* — start adding email, or **change** email (re-auth required to change);
  sends a verify code to the new address.
- `POST /me/email/verify` *(new)* — confirm the email code → sets `email_verified_at` (first-to-
  verify-wins, §5.1).
- `DELETE /me/email` *(new)* — remove email (**re-auth required**).
- `POST /me/mfa` *(new)* — enable, with one-time factor verification (no re-auth).
- `DELETE /me/mfa` *(new)* — disable (**re-auth required**).
- `GET /me` — surface `email`, `email_verified`, `mfa_enabled`, `mfa_method`.

All new side-effectful endpoints audit (`email.added/verified/removed`, `mfa.enabled/disabled`,
`login.mfa.*`) and are covered by the existing CSRF + rate-limit middleware.

## 8. Security considerations

- **Unverified email is inert** for login and as an OTP destination (anti-goal #1).
- **Email OTP send is rate-limited** per address and per IP, same as phone; email-enumeration
  follows the same deliberate product stance as phone (reset/OTP reveal existence) — revisit if
  the owner wants email to stay generic.
- **MFA challenge token** is single-use, short-TTL, hashed-at-rest, bound to the user — same
  properties as the proof token.
- **Password→MFA gap:** between correct password and MFA verify, no session exists, so a stolen
  password alone can't get in — that's the whole point.
- **Account lockout** still applies to the password step before MFA; MFA code attempts get their
  own tries cap via the OTP subsystem.
- **Changing/removing email** and **toggling MFA** send an out-of-band security alert (reusing
  the existing alert path), and are audited.

## 9. Phasing (so it ships incrementally, each phase useful on its own)

1. **Channel refactor** — generalize OTP to `Destination`/`Channel`, add `EmailChannel`. No user-
   visible change; phone flows identical. (Pure seam; unblocks everything.)
2. **Email identity** — `email_verified_at`, add/verify/remove email endpoints + settings UI,
   onboarding step. Email + password login now reachable; email OTP + email forgot-password.
   **Prerequisite (ops):** production SES must be **out of the sandbox** with a verified sending
   domain (DKIM) and adequate quota — sandbox SES only emails pre-verified addresses, so email
   codes to real users would silently fail. Confirm/provision before this phase ships.
3. **Opt-in MFA (SMS)** — user/session fields, `MfaMethod` + `SmsMfaMethod`, challenge-token
   login flow, settings toggle, second-factor UI.
4. **(Follow-up, not this project)** backup codes; then TOTP; then step-up re-auth.

## 10. What's left to the builder

- Exact Redis key shapes, TTLs, and rate-limit numbers for email channel and MFA challenge
  (mirror phone defaults from `config.py` unless there's reason to differ).
- SES OTP email template content/branding and the MSG91 MFA template id.
- Onboarding screen copy and exact profile fields to show (email is the only one that matters for
  this project; the rest can be a thin start).
- Whether email OTP/forgot stays existence-revealing (match phone) or is made generic — a one-line
  product call noted in §8.
- Test coverage mirroring the existing `__tests__` style (channel polymorphism, verified-email
  gating, MFA challenge happy-path + wrong-code + expiry + lockout interplay).
