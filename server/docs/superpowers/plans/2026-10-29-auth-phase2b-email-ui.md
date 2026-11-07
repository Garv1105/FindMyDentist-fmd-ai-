# Auth Phase 2b — Email identity UI (onboarding, settings, email login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Phase-2a email backend a user interface — add/verify/remove email in account settings, a skippable "add email" onboarding step right after signup, and an email arm for OTP login and forgot-password — mobile-first, shared across FMD Main and Clinic OS.

**Architecture:** One new shared client component `EmailSettings` (modelled on the existing `SessionsList`: server-fetched props, `apiClient` calls, `router.refresh()`) drives `POST /me/email`, `POST /me/email/verify`, `DELETE /me/email`, reusing `OtpStep` for the code entry. It mounts in the FMD Main `/account` page and the Clinic OS settings page, and again inside a thin `Onboarding` wrapper shown by `SignupForm` after the account is created. `LoginForm` (OTP mode) and `ForgotPasswordForm` gain a "mobile or email" identifier input and post `identifier` (the backend already accepts both `identifier` and `phone`). No backend changes.

**Tech Stack:** Next.js 16.4.2 (**read `node_modules/next/dist/docs/` before writing — this Next has breaking changes vs. training data, per each app's `AGENTS.md`**), React 19, TypeScript, Tailwind, axios via `@fmd/shared/api-client`. Workspaces: `shared`, `main`, `clinic-os`. No client unit-test runner exists.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-email-mfa-design.md` (§5.5 onboarding, §5.6 settings email section, §5.3 email login/forgot arms; the UI half of Phase 2 in §9). Backend delivered in `2026-10-29-auth-phase2a-email-identity.md`.

## Global Constraints

- **No client test harness.** The per-task gate is: `npm run typecheck` **and** `npm run lint` clean (from `client/`), **plus** a live browser drive of the task's flow via the `run` skill with a screenshot that is actually looked at. This replaces the TDD gate; note it in the ledger per task.
- **Mobile-first.** Everything works at phone width; reuse `inputClass`, `labelClass`, `primaryButtonClass`, `secondaryButtonClass`, `cardClass`, `linkClass`, `errorMessage` from `@fmd/shared/ui` and the existing field components — no new styling system.
- **Shared, not duplicated.** New reusable UI lives in `client/shared/src/components/`; both apps import it. Per-app pages only mount it.
- **No code comments** — project convention. Match the surrounding component style (function components, `"use client"` where interactive, `apiClient` + `errorMessage`, `router.refresh()` after a mutation).
- **The app is never blocked by email.** Email is optional everywhere; onboarding is skippable; a failed email call shows an inline error and leaves the user able to continue.
- **Backend contract (from 2a), do not re-implement:** `POST /me/email {email, password?}` (password required only when a verified email already exists → 401 without it), `POST /me/email/verify {code}` (→ 409 if the address is verified elsewhere), `DELETE /me/email {password}` (401 without). `GET /auth/me` returns `email` and `email_verified`. OTP/login/forgot accept `{identifier}` (email or phone).

## Review Focus

- **Verified vs. added-but-unverified is visibly distinct.** An email that exists with `email_verified=false` shows a "Verify" call-to-action, never a "✓ verified" state. Drive in Task 2 (add → see unverified → verify → see verified).
- **Skip never traps the user.** Onboarding "Do this later" and any error path always land the user in the app; email failure does not block signup completion. Drive in Task 3.
- **Re-auth failures surface, not swallow.** Change/remove without the password shows the server's 401 message inline; the UI does not pretend success or clear the field silently. Drive in Task 2.
- **Stale state after mutation.** After verify/change/remove, the displayed email + verified badge reflect fresh server state (via `router.refresh()` or refetch), not the pre-mutation value. Drive in Task 2.
- **Malformed email is rejected client-side** before an OTP/forgot call, and a valid email routes the code to email (not silently to a phone). Drive in Task 4.

---

### Task 1: `email_verified` on the shared types + an `emailProblem` validator

**Files:**
- Modify: `client/shared/src/types/user.ts` (`User.email_verified: boolean`)
- Modify: `client/shared/src/components/PhoneField.tsx` or new `client/shared/src/components/identity.ts` — add `emailProblem(value: string): string | null` and `isEmail(value: string): boolean` helpers (colocate with the existing `phoneProblem`/`toPhone`; a new small `identity.ts` is fine if you prefer not to widen `PhoneField.tsx`).

**Interfaces:**
- Produces: `User.email_verified` (so `Me` inherits it); `isEmail(v) = v.includes("@")`; `emailProblem(v)` returns `null` for a syntactically valid email (a simple `/^\S+@\S+\.\S+$/` is enough — the server's `EmailStr` is the real validator) else a short message like `"Enter a valid email address."`.
- Consumes: nothing.

- [ ] **Step 1: Add `email_verified: boolean`** to the `User` type (place it right after `email`).

- [ ] **Step 2: Add `isEmail` + `emailProblem`** exported helpers.

- [ ] **Step 3: Gate — typecheck + lint**

Run (from `client/`): `npm run typecheck && npm run lint`
Expected: clean. (A consumer using `user.email_verified` doesn't exist yet; this task just widens the type and adds helpers.)

- [ ] **Step 4: Commit**

```bash
git add client/shared/src/types/user.ts client/shared/src/components/identity.ts
git commit -m "feat(client): add email_verified type field and email validator"
```

---

### Task 2: `EmailSettings` shared component, mounted in both apps' settings

**Files:**
- Create: `client/shared/src/components/EmailSettings.tsx`
- Modify: `client/main/src/app/(app)/account/page.tsx` (fetch `email`/`email_verified`, render `<EmailSettings …/>` in a card)
- Modify: `client/clinic-os/src/app/(os)/[clinicId]/settings/page.tsx` (render the same card)

**Interfaces:**
- Consumes: `apiClient` (`@fmd/shared/api-client`), `OtpStep`, `PasswordField`, `errorMessage`/button classes, `isEmail`/`emailProblem` (Task 1), `useRouter().refresh` for post-mutation refresh.
- Produces: `EmailSettings({ email, verified }: { email: string | null; verified: boolean })` — a `"use client"` component with these states:
  - **none** (`email == null`): an email input + "Add email" → `POST /me/email {email}` → on success go to **verify**.
  - **unverified** (`email != null && !verified`): show the address with an "Unverified — verify now" CTA (→ **verify**) and a "Remove" affordance.
  - **verify**: render `OtpStep` (title "Verify your email", `sentTo={email}`) → `POST /me/email/verify {code}` → on success `router.refresh()`.
  - **verified** (`email != null && verified`): show "✓ {email}" with "Change" (→ a form asking the new email **and** current password, `POST /me/email {email, password}`) and "Remove" (asks current password, `DELETE /me/email {password}`). Both `router.refresh()` on success.
  All server errors shown inline via `errorMessage`.

- [ ] **Step 1: Generalise `OtpStep` for a non-phone destination**

`OtpStep` currently hard-codes the word "mobile number" and a `phone` prop. Add an optional `sentTo?: string` (defaults to `phone`) used only for the "We've sent a code to **{sentTo}**" line, and soften the default title text so it reads for email too (e.g. keep `title` required-with-default as now; the only change is the destination label). Keep `phone` working for all existing callers (SignupForm, LoginForm, ForgotPasswordForm) unchanged.

- [ ] **Step 2: Write `EmailSettings.tsx`** per the Produces block. Model structure on `SessionsList` (client component, `run()` helper wrapping `setError`/busy, `apiClient`, `router.refresh()`).

- [ ] **Step 3: Mount in FMD Main `/account`**

In `account/page.tsx`, the server component already has `user`; add a card (`cardClass`) titled "Email" rendering `<EmailSettings email={user.email} verified={user.email_verified} />`. Place it between "Your details" and "Devices & sessions". (Optionally drop the static Email row from "Your details" since the card now owns it — executor's call.)

- [ ] **Step 4: Mount in Clinic OS settings**

In the Clinic OS settings page, add a personal "Login & security" card with the same `<EmailSettings …/>`. The page currently fetches a clinic, not the user — fetch the user via `getCurrentUser()` (already used elsewhere) or `apiGet<Me>("/auth/me")` inside the existing `<Suspense>` and pass `email`/`email_verified`. (Clinic email ≠ user email; this is the signed-in user's login email.)

- [ ] **Step 5: Gate — typecheck + lint + browser**

Run (from `client/`): `npm run typecheck && npm run lint` → clean.
Browser (via `run` skill, server + both Next apps up, OTP read from the API log): on `/account` — add an email, confirm it shows **Unverified**, verify with the logged code, confirm **✓ verified**; then **Change** without a password → see the 401 message; change with the password → new unverified email; **Remove** with password → back to "Add email". Screenshot each key state and look at it.

- [ ] **Step 6: Commit**

```bash
git add client/shared/src/components/EmailSettings.tsx client/shared/src/components/OtpStep.tsx \
        "client/main/src/app/(app)/account/page.tsx" \
        "client/clinic-os/src/app/(os)/[clinicId]/settings/page.tsx"
git commit -m "feat(client): email settings (add/verify/change/remove) in both apps"
```

---

### Task 3: Skippable "add email" onboarding step after signup

**Files:**
- Create: `client/shared/src/components/Onboarding.tsx`
- Modify: `client/shared/src/components/SignupForm.tsx` (after `createAccount`, show `Onboarding` instead of navigating immediately)

**Interfaces:**
- Consumes: `EmailSettings` (Task 2) in its "none/verify" states; `primaryButtonClass`/`linkClass`.
- Produces: `Onboarding({ onDone }: { onDone: () => void })` — a "Complete your profile" card with the add-email affordance (reuse `EmailSettings` with `email={null} verified={false}`) plus a prominent **"Do this later"** / after-verify **"Continue"** button that calls `onDone()`. Profile fields (year of birth, gender, city) are **out of scope for 2b** — email only (noted in design §10 as the one that matters); leave a single sentence of copy inviting it later.

- [ ] **Step 1: Add an `onboarding` state to `SignupForm`**

`createAccount` currently `go(next ?? home)` after `POST /auth/register` (which sets the session cookie). Change it to set a local `done` state; when `done`, render `<Onboarding onDone={() => go(next ?? home)} />` (the session is live, so `EmailSettings`' calls are authenticated). The OTP step and details form are unchanged.

- [ ] **Step 2: Write `Onboarding.tsx`** per the Produces block.

- [ ] **Step 3: Gate — typecheck + lint + browser**

Run: `npm run typecheck && npm run lint` → clean.
Browser: complete a fresh signup (new throwaway phone, OTP from the log); confirm the onboarding card appears; click **Do this later** → lands in the app authenticated. Repeat, this time add + verify an email in onboarding → **Continue** → lands in the app with the email verified (check `/account`). Screenshot both paths.

- [ ] **Step 4: Commit**

```bash
git add client/shared/src/components/Onboarding.tsx client/shared/src/components/SignupForm.tsx
git commit -m "feat(client): skippable add-email onboarding after signup"
```

---

### Task 4: Email arm for OTP login and forgot-password

**Files:**
- Modify: `client/shared/src/components/LoginForm.tsx` (OTP mode: "mobile or email" input; post `identifier`)
- Modify: `client/shared/src/components/ForgotPasswordForm.tsx` ("mobile or email"; post `identifier`)

**Interfaces:**
- Consumes: `isEmail`/`emailProblem`/`phoneProblem`/`toPhone` (Task 1 + existing), `apiClient`, `OtpStep` (with `sentTo`).
- Produces: a tiny shared resolver (inline or in `identity.ts`) `resolveIdentifier(raw): { identifier: string; problem: string | null; display: string }` — if `isEmail(raw)` → validate with `emailProblem`, `identifier = raw.trim().toLowerCase()`, `display = that email`; else validate with `phoneProblem`, `identifier = toPhone(raw)`, `display = identifier`. Both forms call it, send `{ identifier, … }` to `/auth/otp`, `/auth/login/otp`, `/auth/otp/verify`, `/auth/password/reset`, and pass `display` to `OtpStep`'s `sentTo`.

- [ ] **Step 1: LoginForm OTP mode** — replace the OTP-mode `PhoneField` with a generic "Mobile number or email" text input; on submit run `resolveIdentifier`, show `problem` if any, else `POST /auth/otp {identifier, purpose:"login"}` and go to `OtpStep` with `sentTo=display`; verify via `POST /auth/login/otp {identifier, code}`. Password mode is already email-capable (`login` field) — leave it.

- [ ] **Step 2: ForgotPasswordForm** — same identifier input on the first step; `POST /auth/otp {identifier, purpose:"reset_password"}`, `POST /auth/otp/verify {identifier, purpose, code}`, `POST /auth/password/reset {identifier, proof_token, new_password}`.

- [ ] **Step 3: Gate — typecheck + lint + browser**

Run: `npm run typecheck && npm run lint` → clean.
Browser: with a user who has a verified email, log in via **OTP by email** (code from the log) → authenticated; and run **forgot-password by email** end-to-end → new password works. Also confirm phone still works in both. Confirm a malformed email shows the client-side problem before any request. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add client/shared/src/components/LoginForm.tsx client/shared/src/components/ForgotPasswordForm.tsx
git commit -m "feat(client): accept email for OTP login and forgot-password"
```

---

## Notes for the executor

- **`next dev` rewrites each app's `AGENTS.md`** with the "This is NOT the Next.js you know" block. Read `node_modules/next/dist/docs/` before writing components, and commit that block with your work if it appears in the diff (per the file's own note) rather than fighting it.
- **This plan has no unit tests** (no client runner). The gate is typecheck + lint + a looked-at browser screenshot per task. If you find yourself wanting a regression test, that's a signal to add a client test runner — out of scope here; raise it.
- **Backend is frozen for 2b.** If a flow needs a backend change, stop — that belongs in a backend plan, not here.
- **Profile fields** (year of birth, gender, city) in onboarding/settings are deliberately deferred — email is the only identity that matters for this project (design §10). A later task can add them to `EmailSettings`' page or a `ProfileForm`.
- **Clinic OS mount (Task 2 step 4)** fetches the signed-in user's email, which is distinct from the clinic's contact email shown elsewhere on that page — don't conflate them.
- Run order matters only for Task 1 (types/helpers) before 2–4; Tasks 2, 3, 4 are otherwise independent and could be reviewed separately.
