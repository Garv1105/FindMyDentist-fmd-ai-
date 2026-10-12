# FindMyDentist (FMD)

A dentistry-only platform connecting patients, dentists, clinics, dental students and dental companies through AI-guided discovery, booking, records, content, clinic operations and care coordination. The product definition is the **Master PDR** (`FMD_Master_PDR_Expanded_Revised.pdf`, sections 1–21 plus annex A–N).

> **Status: pre-release.** Milestones 0–3 are built and tested (Main, Concierge, Clinic OS, Clinic AI manager). Scholar, the Admin/Accountant portals and the annex features are not built yet. Everything runs on **demo data and clearly labelled development stand-ins** for outside services (SMS, AI models, payments, storage). Nothing here is a compliance certification; see [What is not live](#what-is-not-live).

Stack: Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Lucide · Node's built-in SQLite for development.

## Quick start

Requires **Node 22+** (uses `node:sqlite` and native TypeScript type-stripping for tests).

```bash
cd web
npm install
cp .env.example .env.local      # optional; see Staff access below
npm run dev                     # http://localhost:3000  (any port: next dev -p 3123)
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server. Seeds a labelled demo directory and demo clinic on first use |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (React Compiler rules included) |
| `npm test` | 66 service-level tests (`node:test`), no framework or database server needed |
| `npx tsc --noEmit` | Type check |
| `npx next typegen` | Regenerate route types after adding routes |

> **OneDrive tip:** if edits don't show up in dev, restart `npm run dev`. The file watcher can miss atomic-rename saves.

### Sign-in and demo accounts

There are no passwords. Sign in with an email or Indian mobile number; a 6-digit code is sent. With no SMS/email provider configured, **the code is shown on screen in development** (and never in production).

| Want to see | Do this |
|---|---|
| Patient experience | Sign up with any email/number at `/signin` |
| Clinic OS | Sign in as **`owner@demo-clinic.test`**, open **For Clinics → Demo Dental Studio** |
| Staff queues (`/admin/*`) | Put your email in `FMD_OPS_EMAILS` in `web/.env.local`, restart, sign up with it |
| Dentist features | Sign up choosing **Dentist**, claim a demo profile at `/dentists/[id]`, approve it at `/admin/verification` |

Internal roles (`fmd_ops`, `super_admin`, `accountant`) can only come from environment variables, never from the sign-up form.

## What is built

### Homepage: cinematic hero (Milestone 1)
Pinned, scroll-scrubbed sequence driven by one timeline (`components/hero/phases.ts`): headline → light spreading along the Earth's rim → the meditating mascot rising from behind the horizon with a 3D turn → the FMD AI conversation as its own stage → mascot descends and the page continues. Fully reversible; simplified on mobile; a still composition under `prefers-reduced-motion`. `npm test` asserts the timeline invariants (mascot starts at 75–80% illumination; AI stage and mascot never overlap).

Assets: `public/img/hero/earth.webp` and `mascot.webp` were cut from `Refrenece Image Mascot and Hero.jpeg`. A higher-resolution mascot master would improve edge quality (OD-H1).

### FMD Main (Milestone 2)

| Area | Routes | Notes |
|---|---|---|
| Accounts | `/signin`, `/account` | Purpose-separated consents, device/session management, deletion request |
| Concierge | Homepage section, `/admin/concierge` | Human-coordinated enquiries; 9-status state machine; no promised fees, areas or response times |
| Discovery | Homepage, `/dentists/[id]` | Server-side filters; verified vs sponsored kept visually and algorithmically separate; no invented ratings |
| Booking | `/dentists/[id]#book`, `/appointments` | Explicit confirmation, idempotent, DB-enforced no double-booking, reschedule/cancel, status history |
| Records | `/records` | Content-sniffed uploads, signed expiring links bound to the viewer, per-dentist time-limited sharing, access history, export, delete |
| FMD AI | Hero stage and assistant panel | Navigation-only actions; urgent-symptom escalation; output guard (no dosing/diagnosis); history saved only with consent |
| Membership | `/account` | PDR prices, GST note, usage meter; checkout honestly unavailable |
| Content & jobs | `/explore`, `/jobs` | Verified authors, pre-publication review, case posts need consent + de-identification, explainable feed, reports and moderation |
| Support | `/help`, `/admin/support` | Searchable help, tickets with attachments, staff triage, reopen window |
| Staff | `/admin/verification`, `/admin/moderation`, `/admin/clinics` | Claim verification records *what was checked*; clinic activation needs evidence |

### FMD Clinic OS and Clinic AI manager (Milestone 3)
Routes under `/clinic/[clinicId]/…`: dashboard, calendar, patients (+ record), billing, inventory, tasks & handover, AI manager, reports, team, settings.

- **Roles** (owner, dentist, front desk, finance, assistant) with a fixed permission matrix in `server/clinic/workspace.ts`; non-members get 404 (tenant isolation).
- **Clinical safety:** notes are drafts until signed; signed notes can only be amended as new versions with a reason; AI drafts need explicit acceptance; the tooth chart is append-only.
- **Billing:** integer paise, sequential numbering, idempotent payments, refunds/voids restricted and audited. Clinic ledgers are never FMD revenue.
- **AI manager:** works only through typed, permission-checked tools. Read-only and internal drafts run automatically; patient messages and publishing stop at a preview for approval; money, signed records, appointment changes and clinical decisions are not available to it. Results are verified, and "not sent" is reported honestly when no messaging provider exists.

## Architecture

One Next.js app with a modular-monolith backend (PDR §11 allows this). **Authorisation lives in the services, not the UI or routes.**

```
web/src/
  app/                    pages and route handlers (thin)
    api/…                 JSON endpoints; Clinic OS uses one catch-all router
    clinic/ admin/ …      product surfaces
  components/             UI (hero, sections, booking, content, clinic shell, support)
  lib/                    client helpers (me.ts), reference lists (catalog.ts), help articles
  server/                 ← all business rules
    db.ts migrations.ts   SQLite access; 12 ordered, append-only migrations
    auth.ts               OTP, sessions, roles, consents, audit hooks
    http.ts               error shape, CSRF guard (JSON-only mutations), validators
    booking.ts providers.ts records.ts assistant.ts content.ts jobs.ts support.ts membership.ts concierge.ts
    clinic/               workspace, calendar, patients, billing, operations, router, seed
    clinic/ai/            tools (registry), planner, engine (task lifecycle), routes
    adapters/             otp, storage, ai, messaging — the vendor seams
    seed.ts               labelled DEMO directory and posts
```

Principles enforced in code and tests: server-side authorisation on every call; an append-only `audit_events` log for sensitive actions; idempotency keys on bookings and payments; no secrets in the browser; health data in separate tables; every external dependency behind an adapter that reports `configured: false` and never fakes success.

### Themes
All colour is CSS variables on `[data-theme]` in `globals.css`; components only read tokens. Default **Obsidian Silver**; others: Amber, Royal, Gold, Pearl Light, Silver Light, White + Royal Blue. The choice persists in `localStorage` (`fmd-theme`); preview without persisting via `/?theme=obsidian-amber`. To add one: a `[data-theme="…"]` block plus an entry in `lib/themes.ts` (and an `--earth-filter` for the hero).

## Configuration

`web/.env.example` documents every variable.

| Variable | Purpose |
|---|---|
| `FMD_OPS_EMAILS`, `FMD_ADMIN_EMAILS`, `FMD_ACCOUNTANT_EMAILS` | Comma-separated emails granted internal roles on first sign-up |
| `FMD_DB` | SQLite file (default `web/.data/fmd.db`); tests use `:memory:` |
| `FMD_SIGNING_SECRET` | Signs record/attachment links (dev generates one under `.data/`) |
| `FMD_SEED_DEMO=0` | Skip demo seeding in development |
| `FMD_CONCIERGE_AREAS`, `FMD_CONCIERGE_FIRST_CONTACT_HOURS` | Concierge service areas and the internal follow-up target |
| `FMD_RECORDS_QUOTA_MB`, `FMD_MEMBERSHIP_GRACE_DAYS` | Storage quota and membership grace period (provisional) |

Never commit `.env*` or `web/.data/` (both are git-ignored).

## What is not live

| Needs | Current stand-in | Decision |
|---|---|---|
| SMS / WhatsApp / email provider | Sign-in code shown in dev; patient messages reported "not sent" | OD-14 |
| AI model, speech, vision | Rule-based assistant and planner, labelled in the UI | OD-14, OD-06 |
| Payment gateway | Checkout unavailable; staff can record verified offline memberships | OD-04 |
| Production hosting, PostgreSQL, encrypted object storage | Local SQLite and files | OD-20 |
| Legal, clinical and tax review | Draft privacy notice and terms; clinical wording unreviewed | OD-22 |
| Reels/short video | Text posts and polls only | media pipeline |

All demo dentists, clinics, patients and posts are fictitious and flagged `demo` in the UI. See `docs/OPEN_DECISIONS.md` for all 23+ decisions and provisional defaults.

## Roadmap

| Milestone | Status |
|---|---|
| M0 Audit & traceability | Done |
| M1 Cinematic hero | Done |
| M2 FMD Main | Done |
| M3 Clinic OS + Clinic AI | Done |
| M4 FMD Scholar | Not started |
| M5 Admin & Accountant portals | Not started (staff queues exist) |
| M6 Annex features (warranty, treatment journey, content import, onboarding/migration, reviews, referral/loyalty, BI, accessibility pass) | Not started |
| M7 End-to-end QA & handover | Not started |

Known gaps in built milestones: week/month calendar, multiple branches, MFA for privileged roles, moderation appeals, a background worker for scheduled AI tasks.

## Documentation

| File | Contents |
|---|---|
| `docs/PRD_TRACEABILITY.md` | Every PDR requirement → ID, status, evidence and tests. Status changes only with evidence |
| `docs/OPEN_DECISIONS.md` | Decisions only FMD can make, the provisional defaults used, and the decision log |
| `docs/IMPLEMENTATION_ROADMAP.md` | Milestones, architecture, external dependencies |
| `fmd-end-to-end-build-plan.md` | Earlier planning document (superseded where `PRD_TRACEABILITY.md` says so) |

## Conventions

- Add a feature as a vertical slice: migration → service with authorisation → route → UI states (loading, empty, error, success) → tests → update the traceability row.
- Services take the authenticated `Auth` and call `requireAuth` / `requireClinic` / `requireRole` first.
- New external dependency: add an adapter that reports `configured` and never claims success it didn't verify.
- Next.js 16 differs from older versions; read `web/node_modules/next/dist/docs/` before changing framework-level code.
