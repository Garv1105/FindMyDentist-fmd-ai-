# FMD — Implementation Roadmap

This roadmap sets **sequence**, not scope. Every requirement in `PRD_TRACEABILITY.md` stays in scope. Per PRD §20, any reduction must be agreed explicitly by FMD.

## Where things stand (11 Oct 2026, end of M2)

| Milestone | Status | Evidence |
|---|---|---|
| M0 Audit and traceability | **Done** | `PRD_TRACEABILITY.md`, `OPEN_DECISIONS.md`, reconciliation table R1–R8 |
| M1 Cinematic hero | **Done** (asset upgrade pending OD-H1) | HERO-01…13; `npm test`, build, lint, screenshots |
| M2 FMD Main | **Done** (external dependencies listed below) | Slices 2.1–2.8 in `PRD_TRACEABILITY.md` §13; 51 automated tests; production build |
| M3 Clinic OS + Clinic AI | **Done** (dependencies in OPEN_DECISIONS) | Slices 3.1–3.7 in `PRD_TRACEABILITY.md` §13; 66 automated tests; production build |
| M4 Scholar | Planned | — |
| M5 Admin + Accountant | Planned | — |
| M6 Annex completeness | Planned | — |
| M7 E2E QA and handover | Planned | — |

## Architecture (applies from M2)

- **One Next.js app, several products.** Route groups: `/` (Main), `/account`, `/records`, `/appointments`, `/clinic/*` (Clinic OS), `/scholar/*`, `/admin/*`, `/accounts/*` (Accountant). Each product gets its own layout and navigation; nothing administrative is squeezed into the homepage.
- **Server-only domain modules** in `web/src/server/<domain>/`, each with a typed service. Route handlers in `app/api/**` are thin. Authorization runs in the service layer on every call: role, org and record scope, not the UI.
- **Data:** `node:sqlite` in development (OD-20), with migrations as ordered SQL files and portable SQL. Health data lives in separate tables from profile, marketing and analytics data.
- **Adapters** (`server/adapters/*`): OTP delivery, storage, AI, speech, payments, maps, messaging, accounting. Each has a clearly labelled dev implementation and an `isConfigured()` flag the UI can show. A dev adapter never reports external success.
- **Audit:** an append-only `audit_events` table written by services for privileged, sensitive, finance and AI actions.
- **Tests:** `node --test` with type stripping. No new framework. Each slice ships its service-level allowed/denied and failure tests.

## M2 — FMD Main, in vertical slices

Each slice ends with: migrations, a service with authorization, API, UI states (loading, empty, error, success, recovery), tests, and traceability updated with evidence.

| Slice | Contents | Key requirement IDs |
|---|---|---|
| 2.1 Platform foundation | DB and migrations, sessions, email/phone OTP via dev console adapter, account types, consents, audit log, role checks, sign-in UI | MAIN-01…06, PLT-01…03, SEC-02…04, ROL-* |
| 2.2 Concierge end to end | Server enquiry with reference, consent record, coordinator queue with full state machine (incl. Cancelled), notes, contact attempts, overdue flag, reassignment, theme-aware premium section | CON-01…14 |
| 2.3 Discovery and profiles | Providers, clinics and services in the DB (seeded demo, labelled); search and filters server-side; pagination; verified vs sponsored; claim-profile request | MAIN-21…26, PLT-04…06 |
| 2.4 Booking | Slots, booking requests with explicit confirmation, idempotency key, conflict and duplicate handling, status history, cancel/reschedule, "needs clinic confirmation" | MAIN-27…32 |
| 2.5 Records | Private storage adapter, validated uploads, signed expiring links, organisation, sharing grants and revocation, access log, export, deletion request | MAIN-33…37, PLT-07, PLT-09 |
| 2.6 Assistant | Server conversation history, provider-agnostic AI adapter (dev: rule-based, reviewed copy), escalation templates, no write tools, retention controls | MAIN-07…20 |
| 2.7 Membership | Plan catalog (§14 prices), entitlement service, membership screen, usage meter; purchase disabled until OD-04/gateway | MAIN-05, COM-*, PLT-11 |
| 2.8 Content, jobs, support | Posts and polls, reactions, follows, saves, reports, moderation hooks, consent gate for case posts; jobs CRUD and expiry; help and ticket intake | MAIN-38…50, PLT-13…16 |

## M3–M7

Each is broken into slices in the same way when its milestone starts. The traceability IDs are already assigned (CLN, CAI, SCH, ADM, ACC, ANX, QA).

## External dependencies

These need FMD action before "Implemented and tested" is possible: OD-14 vendor accounts (SMS/WhatsApp, LLM, speech, payments, maps, storage), hosting (OD-20), legal/clinical reviews (OD-22, SAF-01), and the accounting platform (OD-13).
