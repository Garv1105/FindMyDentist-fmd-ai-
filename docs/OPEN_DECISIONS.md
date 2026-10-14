# FMD — Open Decisions & Decision Log

Annex L requires a decision log with owner, date and impact. The PRD (§21, Annex N) leaves these decisions open. Where a decision blocks code, the build uses a **provisional safe default**: configurable, labelled, and never presented to users as a commitment. A provisional default is not a decision. FMD must confirm or replace each one.

| ID | Decision | PRD source | Owner (proposed) | Provisional default in code | Blocks |
|---|---|---|---|---|---|
| OD-01 | Release sequencing / first-release scope | §20, N | Founders | Milestone order in `IMPLEMENTATION_ROADMAP.md` (sequence only, no scope removed) | Scope sign-off |
| OD-02 | Professional ₹550/yr per dentist or per clinic; Main clinic profile ↔ Clinic OS tenant link | §14 | Product | Per dentist; Clinic OS owns clinic profile | Membership, CLN-01 |
| OD-03 | FMD Edge fees, service areas, response expectations, hours, cancellation, liability | §5, §21 | Ops + legal | Service area and response text come from config; UI says "a coordinator will contact you", with **no time promise and no 24/7 claim** | CON-01, CON-10 |
| OD-04 | Booking fees, payment collection, merchant of record, settlement, refunds | §4.5, §6.5, §21 | Founders + legal | No online payment; booking is a **request the clinic confirms**; fee shown as "clinic's indicative fee" | MAIN-28, PLT-10, CLN-27 |
| OD-05 | Scholar quotas, reset period, ₹350 upgrade period and benefit, grace, professional access | §8.1, §21 | Product | Quotas as config values shown in a usage meter; upgrade shown as "pending"; no professional access | SCH-02…05 |
| OD-06 | Clinic AI fair-use limits and default autonomy matrix | §7.4, §21 | Product + clinical advisor | PRD §7.4 matrix with **every external or financial action set to "requires approval"** | CAI-19, CAI-29 |
| OD-07 | Clinic OS platform (web desktop-first vs also mobile) | §11.1 | Product | Web, responsive | — |
| OD-08 | Verification documents and renewal/grace for dentist, student, company, clinic | §21 | Ops + legal | Checklist is config; a badge shows only after a reviewer approves | MAIN-24, ADM-02 |
| OD-09 | Public reviews at launch; verification method; moderation owner | G, N | Founders | Private feedback on; public reviews behind a disabled feature flag | ANX-G-02 |
| OD-10 | Supported content-import platforms and modes | C, §21 | Product + legal | Uploads and manual links only | ANX-C-01 |
| OD-11 | Meaning of doctor "wellbeing check-ins" | §7.2, §21 | Product | Opt-in schedule/break prompts only | CAI-16 |
| OD-12 | Referral/loyalty: legally approved benefit types, funding, accounting | I | Legal | Feature flag **off**; ledger code paths inert | ANX-I-* |
| OD-13 | Accounting platform (TallyPrime/Zoho/other), sync direction, filing portals, DSC/CA roles | §9.2, §21 | Finance + CA | CSV export adapter only | ACC-12, ACC-16 |
| OD-14 | Vendors: LLM, speech, SMS/WhatsApp/email, maps, object storage, payments, analytics; DPAs | §11.5, §13 | Tech + legal | Adapter interfaces with clearly labelled **dev adapters** (console OTP, local private storage, rule-based assistant). Nothing claims a real vendor integration | Many |
| OD-15 | Native mobile apps (PRD suggests Flutter) | §11.1 | Product | Responsive web only in this repo | — |
| OD-16 | Odontogram in agreed scope | §6.3 | Product + clinical | Planned as append-only chart entries | CLN-13 |
| OD-17 | Warranty programme: eligible treatments, template authorship, dispute handling | A, N | Clinical + legal | Clinic-authored templates; FMD verifies authenticity only | ANX-A-* |
| OD-18 | Personalisation signals, opt-outs, sponsored ranking rules, retention | D, N | Product + legal | Explicit preferences only; behavioural signals off | ANX-D-* |
| OD-19 | Support hours, channels, severity levels, response targets | H, N | Ops | No published targets | ANX-H-04 |
| OD-20 | Production database and hosting | §11.1 | Tech | **Dev:** Node built-in `node:sqlite` file DB (no Postgres or Docker on this machine). **Target:** PostgreSQL. All SQL lives in one data module, written to be portable | ARC-08, SEC-01, SEC-06 |
| OD-21 | Mascot name ("Denti" in the earlier plan) and use beyond the hero | Brand | Brand | Unnamed in UI | — |
| OD-22 | India legal, privacy, tax, clinical-content review before launch | §13, L | Founders | Implementation is not a compliance certification | Launch |
| OD-H1 | High-resolution transparent mascot master (PNG/WebP ≥1200px, ideally turnaround frames or a 3D model) | Brief §3 | Brand | Cutout from the 1280×720 reference JPEG; 2D perspective turn | Hero polish |

## Decision log (made during implementation)

| Date | Decision | Why | Revisit when |
|---|---|---|---|
| 11 Oct 2026 | Use the installed `motion` library for the scroll timeline, not GSAP | Already a dependency; the brief forbids competing animation libraries | — |
| 11 Oct 2026 | Earth is the photo band from the supplied reference, not WebGL | Matches the reference exactly at about 33 KB; no 3D dependency | A licensed high-res Earth asset is supplied |
| 11 Oct 2026 | Hero AI stage hands questions to the existing assistant panel; attachment control omitted | Document analysis isn't connected; the brief forbids non-functional controls | OD-14 vision/document vendor chosen |
| 11 Oct 2026 | Backend is a modular monolith inside the Next.js app (route handlers plus a server-only data module) | One deployable, typed end to end; PRD §11.1 allows a modular monolith | Scale or team boundaries justify splitting out services |
| 12 Oct 2026 | Clinic workspaces start in "setup"; FMD staff activate them with recorded evidence (verification + subscription reference). Setup mode is fully usable except publishing online booking | Clinic OS billing/subscription terms (₹2,000/month, fair use) not yet operational (OD-04/OD-06) | Gateway + subscription billing ready |
| 12 Oct 2026 | Clinic AI uses a labelled rule-based planner with fixed playbooks; approval policy is hard-coded (read/internal automatic; patient messages and publishing need approval; money, clinical records and appointment changes not available to the AI) | No model vendor chosen (OD-14); OD-06 matrix not yet approved | OD-06 approved; model vendor contracted |
| 12 Oct 2026 | Scheduled AI tasks run on request ("run due now" / page load) rather than a background worker | No queue infrastructure in dev (OD-20) | Production hosting with a job queue |
| 12 Oct 2026 | Clinic roles: owner, dentist, front desk, finance, assistant with a fixed permission matrix (finance never sees clinical data) | PRD §3 least privilege | Clinic feedback on custom roles |
