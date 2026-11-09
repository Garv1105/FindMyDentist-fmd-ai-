# FMD - Implementation Roadmap

**Last updated:** 9 Nov 2026 · **Repo:** `findmydentist/fmd-website` (primary; the live site deploys from `main`)

This roadmap sets the **order** of work. The PRD (`FMD_Master_PDR_Expanded_Revised.pdf`) stays the product definition. Every place where we deliberately differ from it is listed in [`PRD_CHANGES.md`](PRD_CHANGES.md), and decisions are logged in [`OPEN_DECISIONS.md`](OPEN_DECISIONS.md).

## The approach: frontend first, in phases

The whole website's UI/UX is being built **before** the real backend. This lets founders, the team and investors see and use every screen, and agree on them, before the backend is built.

- **Sample data, not a backend.** Each product's screens read from typed sample modules in `web/src/sample/` (`clinic.ts`, `calendar.ts`, `patients.ts`, `billing.ts`). Their functions are async and shaped like the future API (`getClinicHome`, `bookAppointment`, `recordPayment`…). When the backend exists, **only these modules change**; the screens don't. Changes made in the demo (bookings, approvals, notes, payments) live in memory and reset on reload.
- **Demo sign-in.** `/demo` (and, from C3, a phone-plus-code sign-in that accepts any number, plus a profile menu on the homepage) lets anyone sign in as a role: clinic owner, front desk, patient, dentist, student or company. No real authentication yet.
- **Nothing real is sent, booked, ordered or charged.** Every action that would leave the clinic says "(demo, nothing was sent)" or similar.
- **Mockup first, then build.** Each phase starts with mockups that the owner approves, then the build, then a PR.
- **Look:** the landing page's dark "obsidian-royal" theme. Laptops get frosted-glass panels; phones get solid panels (blur is costly on phone GPUs). Text is sized for readability: 15px body, nothing meaningful below 12.5px. Every screen works at 390px phone width.
- **FMD Main feels like Instagram** (layout and interaction patterns only, in FMD's own design): dentist profiles, feed with stories, an explore grid.

## Phases and status

| Phase | Screens | Status |
|---|---|---|
| Set-up | Sample-data layer, shared components (`components/app/kit.tsx`, `Sheet.tsx`), demo sign-in | **Done**, in [PR #3](https://github.com/findmydentist/fmd-website/pull/3) |
| **C1** | Clinic shell (sidebar, date and branch pickers, notifications, phone menu) + **Home** (AI briefing with approval cards, summary numbers, next appointments, follow-ups) | **Done**, in [PR #3](https://github.com/findmydentist/fmd-website/pull/3) |
| **C2** | **Calendar**: agenda list by Morning/Afternoon/Evening with free-time chips, "By dentist" view, appointment details and status steps, booking with clash checks, waitlist. **Patients**: search, filters, duplicate warning, patient record with timeline, FDI chart, signed notes and amendments, treatment plans, files, bills | **Done**, in [PR #4](https://github.com/findmydentist/fmd-website/pull/4) (stacked on #3) |
| **C3** | **Billing**: bills paid in full, today's collection by mode, record a payment (name, phone, patient ID, amount, mode), owner-only refund/void with a reason. **Inventory removed** from FMD Clinic. **Homepage profile menu**: sign in / create account, role-based navigation, switch role | Billing done; profile menu in progress |
| C4 | Tasks (handover, checklists), Reports | Next |
| C5 | AI manager page: chat, task cards, approval queue, history, scheduled tasks, content drafts | Planned |
| C6 | Team, Settings (incl. AI permissions), clinic sign-up and verification | Planned |
| M1 | FMD Main shell (slim side rail) + full-screen AI Assistant with draft-then-tap action cards | Planned |
| M2 | Find a dentist, Instagram-style dentist profile, Messages | Planned |
| M3 | Feed and Explore, post/reel viewer, dentist post creation | Planned |
| M4 | Appointments and booking flow, Records | Planned |
| M5 | FMD Edge (Concierge), Jobs, Account and membership, sign-up and onboarding, dentist registration, help | Planned |
| Scholar | FMD Scholar | After M5, with its own design round |
| Backend | Real data, auth, AI, messaging, payments | After the UI; see "Later" below |

## Where the code is

| Path | What |
|---|---|
| `web/src/app/clinic/[clinicId]/` | FMD Clinic routes: Home (`page.tsx`), `calendar/`, `patients/`, `patients/[patientId]/`, `billing/` |
| `web/src/components/clinic/` | Clinic screens: `Shell.tsx` (sidebar, pickers, `useClinic()`), `home/`, `calendar/`, `patients/`, `billing/` |
| `web/src/components/app/` | Shared UI: `kit.tsx` (Panel, Tag, Button, Empty, IconButton), `Sheet.tsx` (dialogs drawn on `<body>`, focus-safe) |
| `web/src/sample/` | Sample data + its tests (`*.test.ts`) |
| `web/src/lib/demo.ts`, `useDemoUser.ts`, `app/demo/` | Demo people and sign-in |
| `web/src/app/globals.css` | Theme tokens; app styles at the end (`.app-panel`, `.app-solid`, `.app-glow`) |

## Picking up the next phase

1. Branch from the latest `main` (or the previous phase's branch while its PR is open).
2. Read the PRD section for the phase, plus [`PRD_CHANGES.md`](PRD_CHANGES.md).
3. Make mockups and get them approved.
4. Add or extend a sample module in `web/src/sample/` **with tests first** (`npm test`).
5. Build the screens with `useClinic()`, `kit.tsx` and `Sheet.tsx`. Match the existing pages.
6. Check: `npm test`, `npx tsc --noEmit` (run `npx next typegen` first), `npx eslint` on your files, `npx next build`, then try it on laptop and phone widths.
7. Open a PR to `main`.

Note: `next dev` rewrites `web/AGENTS.md` (it swaps the hyphens for dashes). Leave that change out of commits.

## Later: the backend

When the UI is agreed, the backend replaces the sample modules behind the same function signatures. Planned pieces (from the PRD and earlier work):

- FastAPI service for identity, accounts, dentist profiles and clinics/staff, in `findmydentist/main-websie`.
- Postgres for app data.
- A provider-agnostic AI adapter.
- Messaging (SMS/WhatsApp), object storage and payments, once the vendors are chosen (`OPEN_DECISIONS.md` OD-14).

**FMD Manager billing** (future): after an appointment, the treatment is noted by FMD Manager or staff, and a bill is raised automatically with the patient's name, ID and phone pre-filled. Staff only choose the payment mode. Clinics also get a "Raise bill" action for completed appointments and treatments.

## History

An earlier October 2026 prototype (milestones "M2 FMD Main" and "M3 Clinic OS + Clinic AI", with a Next.js API and SQLite) was built in a separate fork and was **not merged into this repo**. `PRD_TRACEABILITY.md` sections 12–13 describe that work. The current phased plan above replaces its milestone table. Its screens were the starting point for the restyled ones here.
