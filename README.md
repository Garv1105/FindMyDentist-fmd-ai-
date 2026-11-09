# FindMyDentist (FMD)

A dentistry-only platform that connects patients, dentists, clinics, dental students and dental companies: AI-guided discovery, booking, records, content, clinic operations and care coordination. The product definition is the Master PDR ([`docs/FMD_Master_PDR.pdf`](docs/FMD_Master_PDR.pdf)).

> **Status: pre-release.** Most screens run on clearly labelled demo data while the backend is built. Nothing is sent, booked or charged for real. See [What is not live](#what-is-not-live).

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Motion · three.js / React Three Fiber · Lucide.

## What's in it

| Product | Where | What you can do |
|---|---|---|
| **Landing page** | `/` | The FMD story, FMD AI, walkthrough, trust and safety, products, waitlist |
| **FMD Main** | `/login`, `/register`, `/dentists`, `/explore`, `/jobs`, `/records`, … | Sign up, find and book dentists, records and sharing, FMD AI, Explore feed, jobs, FMD Edge (concierge), membership, notifications, help, privacy |
| **FMD Clinic** | `/clinic/smile-studio` | Home briefing, calendar, patients, billing, tasks, reports, AI manager, team, settings |

### FMD Clinic

- **Home:** the AI briefing with approval cards, the day's numbers, next appointments and follow-ups.
- **Calendar and patients:** an agenda by morning, afternoon and evening, the "by dentist" view, booking with clash checks, a waitlist, patient records with charts and notes.
- **Billing:** bills paid in full, today's collection by payment mode, discounts with a reason, voiding with a reason (no refunds).
- **Reports:** Clinic Pulse, daily operations and collection, utilisation, no-shows, patient base, new patients by source, recall, case acceptance, pending treatment, procedure mix, revenue summary, GST register. Every figure has one definition ([`docs/reports/metric-dictionary.md`](docs/reports/metric-dictionary.md)).
- **AI manager:** an approval queue, a chat that answers from the clinic's own figures, scheduled jobs, content drafts and history. It only drafts: staff approve anything that leaves the clinic, and it never gives clinical advice.
- **Tasks, team and settings:** checklists and shift handover; roles and invites; clinic details, GST mapping and AI permissions; each dentist edits their own profile.

**Themes:** Dark (default) and Light (white and royal blue) for the apps, switched from the top bar. The landing page is designed for the dark look and always shows it.

## Quick start

Requires **Node 22+** (uses `node:sqlite` and native TypeScript type stripping for tests).

```bash
cd web
npm install
cp .env.example .env.local   # optional; everything has a sensible default
npm run dev                  # http://localhost:3000
```

Open **`/demo`** and pick a role to explore without an account:

| Demo account | Sees |
|---|---|
| Clinic owner | All of FMD Clinic, including money, team and settings |
| Clinic staff (front desk) | Daily work and reports without revenue analysis |
| Dentist | Their own schedule, patients and tasks, and their profile in Settings |
| Patient, student, dental company | FMD Main for that role |

## Commands

Run from `web/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (`node --test`, `src/**/*.test.ts`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (run `npx next typegen` first on a fresh checkout) |
| `node scripts/upload-models.mjs` | Upload the 3D models to Cloudinary (needs `CLOUDINARY_*` in `web/.env`) |

## Project layout

```
docs/                     Product and engineering documents (see below)
web/
  src/app/                Routes: landing page, (main) FMD Main, clinic/[clinicId] FMD Clinic, demo, api
  src/components/         UI: app/ (shared kit), main/, clinic/, hero/, sections/, nav/
  src/sample/             Typed sample data shaped like the future API, with tests (*.test.ts)
  src/server/             Development API (node:sqlite) and its tests
  src/lib/                Shared helpers: themes, demo sign-in, device and model loading
  public/                 Images, 3D models (models/rig, rig-mobile, loops, stills), video
```

## Documents

| File | What |
|---|---|
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) | Phases, status and how to pick up the next one |
| [`docs/FMD_MAIN_PLAN.md`](docs/FMD_MAIN_PLAN.md) | FMD Main build plan and progress |
| [`docs/PRD_CHANGES.md`](docs/PRD_CHANGES.md) | Where the product deliberately differs from the PDR |
| [`docs/PRD_TRACEABILITY.md`](docs/PRD_TRACEABILITY.md) | PDR requirements mapped to screens |
| [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) | Decisions still to be made |
| [`docs/reports/metric-dictionary.md`](docs/reports/metric-dictionary.md) | Every FMD Clinic report metric: formula, numerator, denominator, exclusions |
| [`docs/FMD_Master_PDR.pdf`](docs/FMD_Master_PDR.pdf) | The product definition |

## What is not live

- **Demo data:** FMD Clinic and most of FMD Main read from `web/src/sample/`. Changes live in memory and reset on reload.
- **Outside services:** messages (SMS, WhatsApp, email), payments, AI models and storage are development stand-ins. Every action that would leave the app says so.
- **Verification:** "Verified" badges show only after real checks, which aren't running yet.
- **Figures:** reports are operational, not audited. The GST mapping must be confirmed by the clinic's CA; FMD doesn't give tax advice.
- **No AI diagnosis:** FMD AI explains and guides; clinical decisions stay with a registered dentist.
