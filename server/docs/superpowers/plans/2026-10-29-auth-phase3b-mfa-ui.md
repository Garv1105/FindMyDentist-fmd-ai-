# Auth Phase 3b — Opt-in MFA UI (settings toggle + login second factor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Checkbox steps.

**Goal:** Expose the Phase-3a MFA backend in both apps — a settings card to turn MFA on (verify the SMS factor once) and off (password re-auth), and a second-factor step in the login flow so a password login that returns an MFA challenge can be completed.

**Architecture:** A new shared client component `MfaSettings` (modelled on `EmailSettings`/`SessionsList`: server-fetched props, `apiClient`, `router.refresh()`, reuses `OtpStep` + `PasswordField`) mounts beside `EmailSettings` in FMD Main `/account` and Clinic OS settings. `LoginForm`'s password submit learns to detect `{ mfa_required, challenge_token }` and render an `OtpStep` that posts `/auth/mfa/verify`.

**Tech Stack:** Next.js 16.4.2 (read `node_modules/next/dist/docs/` — breaking changes per `AGENTS.md`), React 19, TS, Tailwind, `@fmd/shared`. No client unit-test runner.

**Spec:** design §5.4/§5.6; backend in `2026-10-29-auth-phase3a-opt-in-mfa.md`.

## Global Constraints

- **Gate per task:** `npm run typecheck` + `npm run lint` clean (from `client/`), plus a looked-at browser drive. No client unit tests.
- Mobile-first; reuse `@fmd/shared/ui` classes + `OtpStep`/`PasswordField`. No new styling.
- Shared components in `client/shared/src/components/`; pages only mount them.
- No code comments. Match surrounding style (`apiClient`, `errorMessage`, `router.refresh()`).
- MFA is optional; nothing blocks a user who leaves it off.
- Backend frozen. Contract: `GET /auth/me` → `mfa_enabled`, `mfa_method`; `POST /me/mfa/start` (204, sends SMS code), `POST /me/mfa {code}` (204 → on; 401 bad code), `DELETE /me/mfa {password}` (204; 401 without); `POST /auth/login/password` returns `UserRead` **or** `{ mfa_required: true, challenge_token }`; `POST /auth/mfa/verify {challenge_token, code}` → session.

## Review Focus

- **Login second factor is mandatory, not skippable in the UI.** When the password response is an MFA challenge, the only way forward is entering the code; there is no path that lands authenticated without `/auth/mfa/verify`. Drive in Task 3.
- **Enable proves the factor; disable needs the password.** Enabling walks start→code→on (a wrong code shows an error, stays off); disabling asks for the password and surfaces the 401. Drive in Task 2.
- **Status reflects server truth after mutation** (`router.refresh()`), and MFA off/on is visibly distinct. Drive in Task 2.
- **Phone-login (no MFA) still works unchanged** — the challenge branch only triggers on `mfa_required`. Drive in Task 3.

---

### Task 1: `mfa_enabled` / `mfa_method` on the shared `User` type

**Files:** Modify `client/shared/src/types/user.ts`.

- [ ] **Step 1** Add `mfa_enabled: boolean;` and `mfa_method: "sms" | null;` to `User` (after `email_verified`).
- [ ] **Step 2** Gate: `npm run typecheck && npm run lint` → clean.
- [ ] **Step 3** Commit (`feat(client): add mfa fields to User type`).

---

### Task 2: `MfaSettings` component, mounted in both apps

**Files:** Create `client/shared/src/components/MfaSettings.tsx`; modify `main/.../account/page.tsx` and `clinic-os/.../[clinicId]/settings/page.tsx`.

**Interfaces:**
- `MfaSettings({ enabled }: { enabled: boolean })` — `"use client"`, states:
  - **off** (`!enabled`): explanatory line + "Turn on two-factor" → `POST /me/mfa/start` → **verify** state.
  - **verify**: `OtpStep` (title "Verify your phone", `sentTo` = "your mobile") → `POST /me/mfa {code}` → `router.refresh()`.
  - **on** (`enabled`): "On · SMS to your mobile" badge + "Turn off" → a password form → `DELETE /me/mfa {password}` → `router.refresh()`.
  - Errors inline via `errorMessage`.

- [ ] **Step 1** Write `MfaSettings.tsx` (model on `EmailSettings`; `OtpStep` for the code, `PasswordField` for disable).
- [ ] **Step 2** Mount in FMD Main `/account`: a `cardClass` section titled "Two-factor authentication" rendering `<MfaSettings enabled={user.mfa_enabled} />`, after the Email card.
- [ ] **Step 3** Mount in Clinic OS settings inside the existing "Login & security" card (below `EmailSettings`), using the already-fetched `user`.
- [ ] **Step 4** Gate: typecheck + lint clean; browser — on `/account`, turn MFA on (code from the API log), see **On**; turn off with the password, see **Off**; a wrong enable code shows an error. Screenshot each.
- [ ] **Step 5** Commit (`feat(client): MFA on/off settings in both apps`).

---

### Task 3: Second-factor step in `LoginForm`

**Files:** Modify `client/shared/src/components/LoginForm.tsx`.

**Interfaces:** the password submit (`onPassword`) posts `/auth/login/password`; if the response body has `mfa_required`, store `challenge_token` in state and render an `OtpStep` (title "Enter your code", `sentTo` = "your mobile") whose `onVerify` posts `/auth/mfa/verify { challenge_token, code }` then navigates `go(next ?? home)`. A normal `UserRead` response navigates as today.

- [ ] **Step 1** In `onPassword`, read the response: `const { data } = await apiClient.post("/auth/login/password", ...)`; if `data.mfa_required`, `setMfa({ token: data.challenge_token })` instead of navigating; else `go(...)`.
- [ ] **Step 2** Add an `mfa` state branch rendering `OtpStep` with `onVerify` posting `/auth/mfa/verify`, `onResend` re-posting `/auth/login/password` with the same credentials is **not** possible (password not retained) — instead `onResend` is a no-op note or re-submits via a stored handler; simplest: keep the password in state only for the lifetime of the challenge, or omit resend (the code TTL is short; "Change" returns to the form). Keep it minimal: `onChangeNumber` returns to the login form; `onResend` re-requests by resubmitting the stored credentials if retained, else returns to the form.
- [ ] **Step 3** Gate: typecheck + lint clean; browser — with the MFA-on user, password login shows the code step; entering the SMS code (from the log) lands authenticated; a non-MFA user's password login is unchanged; phone OTP login unchanged. Screenshot.
- [ ] **Step 4** Commit (`feat(client): second-factor step in password login`).

---

## Notes for the executor

- `next dev` rewrites each app's `AGENTS.md`; read `node_modules/next/dist/docs/` before writing and commit that block with your work.
- No client unit tests — gate is typecheck + lint + a looked-at screenshot.
- **Resend on the login second factor:** the password isn't retained after the first post, so a true "resend" would need re-entering the password. Keep it simple — offer "Start over" (back to the login form) rather than a resend that can't fire. Ruling for the executor; record it.
- Apply `alembic upgrade head` to the dev **RDS** DB (migration 0008) before manual browser testing, as Phase 2/3a required for earlier revisions.
