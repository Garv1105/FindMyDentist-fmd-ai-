# FMD — PRD Traceability Matrix

**Sources:** `FMD_Master_PDR_Expanded_Revised.pdf` — Master PDR §1–21 (baseline 2 Oct 2026) + Expanded Product & Technical Annex A–N (4 Oct 2026).
**Last audited:** 11 Oct 2026 against the `web/` Next.js 16 prototype.
**Rule:** a status changes only with evidence (file path + test). A visible UI alone is never "Implemented and tested".

## Status legend

| Code | Meaning |
|---|---|
| NS | Not started |
| IP | In progress (partial UI, or demo data with no backend) |
| IU | Implemented, unverified (works end to end, no automated test) |
| IT | Implemented and tested |
| BX | Blocked by an external dependency (vendor, credentials, legal) |
| PD | Pending a product decision (see `OPEN_DECISIONS.md`) |

## Current reality (audit summary)

- The `web/` app is a **front-end-only prototype**: one route (`/`), no backend, no database, no auth, no API routes, no tests. All dentists, clinics, slots and figures come from `web/src/data/demo.ts` and are labelled as demo data in the UI.
- So **no requirement is IT**. A few presentation-layer requirements are IU, and several FMD Main features are IP (demo UI with no authoritative backend).
- Products not started: Clinic OS, Clinic AI, Scholar, Admin, Accountant Portal, and annex A, C, E, F, G, H, I, J.

## Reconciliation with `fmd-end-to-end-build-plan.md` (previous analysis)

The earlier plan is broadly faithful to the PRD. These items conflict with the PRD or this brief and are **superseded**:

| # | Earlier plan said | Correct per PRD / brief | Action |
|---|---|---|---|
| R1 | Hero = realistic glass/porcelain molar; "Denti" visor mascot inside product | Hero uses the supplied **meditating tooth mascot** (lab coat, blue scrubs, mudra); the realistic molar is removed from the hero | Implemented in M1 (asset pending, see OD-H1) |
| R2 | Default accent royal blue | Default theme is **Obsidian Silver**; royal blue is one of 7 themes | Kept Obsidian Silver as default |
| R3 | Referral/loyalty, public reviews, content import "not in any phase until approved" | They must stay traceable and be built as **configurable, safely disabled** capabilities (Annex I, G, C) | Rows ANX-I/G/C kept, status PD with a safe-disable plan |
| R4 | Concierge "free in beta, Bengaluru only, response within 1 business day" | PRD §5, §21: commercial terms, areas and response commitments are **undecided and must stay configurable** | Recorded as provisional only (OD-03); no promises in UI copy |
| R5 | Phased V1→V6 plan presented as the delivery plan | PRD §20 Scope management: sequencing must be **explicitly agreed by FMD**; the PRD has no V1 split | Roadmap marks sequence as proposed, not a scope reduction |
| R6 | Concierge statuses listed without Cancelled in some places | PRD §5 includes **Cancelled** plus reassignment and overdue escalation | CON-09 includes Cancelled |
| R7 | Warranty "FMD verifies" | Annex A2: the **clinic is issuer**; FMD only verifies certificate authenticity, never interprets coverage | ANX-A-06 wording fixed |
| R8 | Flutter mobile apps assumed in delivery | PRD §11.1 *suggests* Flutter; this repo is web-only | Logged as OD-15; web-first is responsive |

Nothing in the earlier plan was found to **omit** a PRD section. Its annex coverage was thinner than the PDF (Annex L governance, M scenarios and N decisions were only partly carried). Those are added below.

---

## 1. Principles and boundaries (§1–2)

| ID | Requirement | Src | Role / product | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| PRN-01 | Dentistry-only focus | §1 | All | All copy and IA | — | Content review | IU | — |
| PRN-02 | AI is model-agnostic | §1, §7.5 | Platform | AI gateway | `ai/providers/*` adapter interface | Swap provider in config, tests pass | NS | OD-14 |
| PRN-03 | Distinguish education, AI drafts, recommendations and verified decisions | §1 | All | Labels in AI, Clinic and Scholar UI | `origin` field on generated artifacts | UI label snapshot tests | IP | — |
| PRN-04 | AI never presented as a substitute for a dentist | §1, §13 | Main | Assistant, hero chat stage | Safety copy component | Copy test on every AI surface | IP | — |
| PRN-05 | Subscriptions, limits and sponsorship are transparent | §1, §14 | All | Membership, badges | Entitlement service | Purchase screen shows price/tax/renewal/limits | IP | — |
| ECO-01 | Separate products: Main, Clinic OS, Scholar, Admin, Accountant | §2 | — | Route groups `/`, `/clinic`, `/scholar`, `/admin`, `/accounts` | Per-app roles | Route/role access tests | NS | — |
| ECO-02 | **No FMD Campus; no standalone Concierge app** | §2 | — | Nav, IA | — | Grep/nav test: no "Campus" | IU | — |
| ECO-03 | Shared identity, app-specific roles and entitlements | §2, §10 | All | Auth module | `users`, `memberships`, `roles`, `entitlements` | Role matrix tests | NS | — |
| ECO-04 | Student membership grants Scholar access | §2, §8.1 | Student | Scholar gate | `entitlements(scholar.base)` | Expired membership → no access | NS | OD-05 |
| ECO-05 | Professional membership and Clinic OS are separate products and charges | §2, §14 | Dentist/Clinic | Plans, receipts | Separate `plans` rows | Receipt shows distinct line items | NS | — |
| ECO-06 | Multi-staff clinic orgs with role access | §2, §6.1 | Clinic | Clinic team admin | `org_members`, `role_grants` | Staff denied out-of-role actions | NS | — |
| ECO-07 | Account linking, recovery, consent, deletion request | §2, §4.1 | All | Account settings | `consents`, `deletion_requests` | E2E recovery/deletion | NS | — |

## 2. Roles and permissions (§3)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| ROL-01 | Patient: own data only; explicit record sharing | §3 | Patient | Records | Server-side ownership check | Denied cross-user read | NS | — |
| ROL-02 | Dentist: verification plus org-level permissions | §3 | Dentist | Profile, clinic | `verifications` | Unverified cannot show badge | NS | OD-08 |
| ROL-03 | Student: eligibility checks | §3 | Student | Membership | `verifications(kind=student)` | — | NS | OD-08 |
| ROL-04 | Corporate: company verification and content/ad rules | §3 | Company | Company page | `verifications(kind=company)` | — | NS | OD-08 |
| ROL-05 | Clinic owner/admin: strong auth for sensitive actions | §3 | Clinic | Clinic settings | Step-up MFA | Sensitive action without MFA → 403 | NS | — |
| ROL-06 | Clinic staff: least privilege; restrict clinical and finance | §3 | Clinic | Clinic OS | Permission strings | Front desk cannot view finance | NS | — |
| ROL-07 | Clinic AI: tool scopes, consent, approvals, logs, rate limits | §3, §7 | Clinic AI | AI manager | Tool registry + policy | Tool call denied outside scope | NS | — |
| ROL-08 | Ops/support: scoped, logged access | §3 | FMD ops | Admin | `audit_events` | Access writes audit | NS | — |
| ROL-09 | Moderator: no clinical-record access | §3 | Moderator | Admin | Deny `records.*` | Moderator 403 on records | NS | — |
| ROL-10 | Super admin: privileged actions logged and protected | §3 | Super admin | Admin | Audit + MFA | — | NS | — |
| ROL-11 | Accountant: finance only, no clinical or unrelated user data | §3, §9.3 | Accountant | Accountant portal | Deny non-finance scopes | Accountant 403 on patients | NS | — |
| ROL-12 | Scope by org, clinic, record, action and sensitivity, not role label alone | §3 | All | API middleware | ABAC policy | Policy unit tests | NS | — |

## 3. FMD Main (§4)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| MAIN-01 | Registration with phone/email verification | §4.1 | All | `/signup` | `POST /auth/otp` | OTP happy path, expiry, lockout | NS | OD-14 (SMS vendor) |
| MAIN-02 | Account type selection (patient/dentist/student/company) | §4.1 | All | Onboarding | `users.account_type` | — | NS | — |
| MAIN-03 | Minimal profile data, sensitive-use explanation | §4.1 | All | Onboarding | — | Copy review | NS | — |
| MAIN-04 | Terms, privacy, consent, comms prefs, recovery, deletion request | §4.1 | All | Settings | `consents` | E2E | NS | — |
| MAIN-05 | Membership screen: status, benefits, renewal, usage, limits | §4.1 | All | `/account/membership` | `entitlements`, `usage_counters` | — | NS | OD-05 |
| MAIN-06 | Profile editing and account linking without cross-user exposure | §4.1 | All | Settings | — | Isolation test | NS | — |
| MAIN-07 | Prominent AI entry with text, voice and image/doc input | §4.2 | All | Hero AI stage, assistant panel | `POST /ai/conversations` | Hero AI stage renders composer + controls | IP | Voice: browser STT only (OD-14) |
| MAIN-08 | One assistant that adapts to role | §4.2 | All | Assistant | Role in system context | — | NS | — |
| MAIN-09 | EN, TE, KN, TA, HI plus more; switching and mixed language | §4.2 | All | Assistant, i18n | i18n catalog | Per-language eval | IP (label only) | OD-14 |
| MAIN-10 | Plain-language education and next steps | §4.2 | Patient | Assistant | Reviewed KB | Eval set | IP (canned) | Clinical review |
| MAIN-11 | Uncertainty wording, no diagnosis or prescription | §4.2, §13 | Patient | Assistant | Output checker | Red-team set | IP (canned copy) | — |
| MAIN-12 | Escalation guidance for concerning symptoms (reviewed content) | §4.2 | Patient | Assistant | Escalation templates | Eval: urgent-symptom prompts | IP | Clinical review |
| MAIN-13 | Revisit conversations with privacy/retention controls | §4.2 | All | Assistant history | `ai_conversations` | — | NS | — |
| MAIN-14 | AI presents choices; user completes actions; **no autonomous booking or contact** | §4.2, §4.10 | Patient | Assistant actions = navigation only | No write tools exposed to public AI | Test: public AI has zero write tools | IU (UI) | — |
| MAIN-15 | Organise appointments, plans and reminders | §4.3 | Patient | Companion tools | `reminders` (user-owned) | — | NS | — |
| MAIN-16 | Treatment budget worksheet with estimates and exclusions labelled | §4.3 | Patient | Worksheet | `budget_worksheets` | — | NS | — |
| MAIN-17 | Insurance document help, no coverage guarantee | §4.3 | Patient | Assistant | — | Copy test | NS | — |
| MAIN-18 | Summarise uploaded reports with limitations | §4.3 | Patient | Assistant + Records | Vision adapter | — | NS | OD-14 |
| MAIN-19 | Organise dental history and preferences with consent | §4.3 | Patient | Profile | `consents(purpose=history)` | — | NS | — |
| MAIN-20 | User-controlled checklists and reminders; no implied monitoring | §4.3 | Patient | Reminders | — | — | NS | — |
| MAIN-21 | Search by location, specialty, service, availability, language | §4.4 | Patient | Hero search + `#dentists` | `GET /providers` | Filter tests | IP (demo, client-side) | — |
| MAIN-22 | Profiles with qualifications, experience, services, clinic, hours, photos, contact/booking | §4.4 | Patient | ProfileDrawer | `dentist_profiles` | — | IP (demo) | — |
| MAIN-23 | Verified distinct from paid promotion; sponsored labelled | §4.4 | Patient | `VerifiedBadge` / `SponsoredBadge` | `placements.sponsored` | Visual + a11y label test | IU | — |
| MAIN-24 | Claim-profile and verification workflows | §4.4 | Dentist | `/claim` | `verifications` | — | NS | OD-08 |
| MAIN-25 | AI recommends providers, labelled informational | §4.4 | Patient | Assistant action → filtered list | — | — | IP | — |
| MAIN-26 | Live availability only from a reliable source, else "needs confirmation" | §4.4 | Patient | Dentist cards (`nextSlot: null`) | Clinic OS slots | Card shows "confirm availability" when null | IU | Clinic OS |
| MAIN-27 | Browse availability, appointment types, booking info | §4.5 | Patient | Booking flow | `GET /slots` | — | IP (demo slots) | — |
| MAIN-28 | Show provider, time, clinic, fee and cancellation terms before confirm | §4.5 | Patient | Booking review step | — | — | IP | OD-04 |
| MAIN-29 | Explicit confirmation before booking/request | §4.5 | Patient | Booking confirm + checkbox | Idempotency key | Cannot submit without confirm | IP | — |
| MAIN-30 | Booking status, reminders, cancel/reschedule routes, support | §4.5 | Patient | `/appointments` | `appointment_status_events` | — | NS | — |
| MAIN-31 | Handle unavailable slots, duplicates, failed payments, provider changes | §4.5 | Patient | Booking errors | 409 on conflict | Duplicate submit test | NS | — |
| MAIN-32 | Clinic booking rules and buffers | §4.5 | Clinic | Clinic settings | `booking_rules` | — | NS | — |
| MAIN-33 | Patient records: reports, X-rays, photos, plans, prescriptions | §4.6 | Patient | `/records` | `clinical_documents` | — | IP (demo UI) | — |
| MAIN-34 | Organise by date, clinic, provider, episode, type | §4.6 | Patient | Records filters | — | — | IP | — |
| MAIN-35 | Download, export, deletion request, explicit sharing | §4.6 | Patient | Records actions | `sharing_grants` | Revoke denies access | NS | — |
| MAIN-36 | Upload progress, validation, storage limits, access history | §4.6, §10 | Patient | Uploader | `access_events` | Rejects bad type/size | NS | — |
| MAIN-37 | Private storage with expiring links; no raw paths | §4.6 | Platform | Storage adapter | Signed URLs | Expired link 403 | NS | OD-14 |
| MAIN-38 | Feed: reels, posts, education, polls, creators | §4.7 | All | `/explore` | `posts`, `media_assets` | — | IP (static demo) | — |
| MAIN-39 | Personalised feed with consent and controls | §4.7, D | All | Feed prefs | `personalization_prefs` | Reset works | NS | — |
| MAIN-40 | Search-related content shown prominently; general content too | §4.7 | All | Feed ranking | — | — | NS | — |
| MAIN-41 | Profiles, follows, likes, comments, saves, reports, moderation | §4.7 | All | Feed | `reactions`, `follows`, `reports` | — | NS | — |
| MAIN-42 | Sponsored content labelled | §4.7 | All | Feed card | — | — | IU (badge) | — |
| MAIN-43 | Professionals create posts, subject to rules and consent | §4.7 | Dentist | Composer | Consent gate | Case post blocked without consent | NS | — |
| MAIN-44 | No identifiable patient case without documented consent and review | §4.7, §13 | Dentist | Composer | `consent_refs` | — | NS | — |
| MAIN-45 | Dentist profile with portfolio, membership status, edit controls | §4.8 | Dentist | `/dentists/[id]` | — | — | IP | — |
| MAIN-46 | Verification reflects actual checks performed | §4.8 | Dentist | Badge tooltip | `verifications.checks` | — | IU (copy) | — |
| MAIN-47 | Jobs: create, browse, search | §4.9 | Dentist/Company | `/jobs` | `jobs` | — | NS | — |
| MAIN-48 | Posting permissions, details, application route | §4.9 | Company | Job form | — | — | NS | — |
| MAIN-49 | Job report, moderation, expiry, renewal | §4.9 | Admin | Admin queue | — | — | NS | — |
| MAIN-50 | Don't imply employer verification | §4.9 | — | Job card copy | — | — | NS | — |

## 4. Concierge (§5)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| CON-01 | Section shows service description, area, response process, terms | §5 | Patient | `#concierge` | Config-driven copy | — | IP | OD-03 |
| CON-02 | Enquiry: contact pref, area, need, timing, notes | §5 | Patient | Concierge form | `POST /concierge/enquiries` | Validation tests | IP (client only) | — |
| CON-03 | Minimum health data; explain use and who contacts | §5 | Patient | Form copy + consent | `consents(purpose=concierge)` | — | IP | — |
| CON-04 | Show reference; "received", not "confirmed" | §5 | Patient | Success state | Server-issued ref | Copy test | IP (ref generated client-side) | — |
| CON-05 | Human follow-up and coordination | §5 | Ops | Admin queue | — | — | NS | — |
| CON-06 | Any commitment confirmed with patient first | §5 | Ops | Queue action requires patient-confirm record | — | — | NS | — |
| CON-07 | Queue: status, priority, assignee, timestamps, next action | §5 | Ops | `/admin/concierge` | `concierge_enquiries` | — | NS | — |
| CON-08 | Statuses New → Contact Attempted → Contacted → Needs Clarification → Coordinating → Awaiting Patient → Confirmed → Closed, **plus Cancelled** | §5 | Ops | Queue | State machine | Illegal transition rejected | NS | — |
| CON-09 | Secure notes, contact history, consent records, checklist | §5 | Ops | Enquiry detail | `contact_attempts`, `notes` | — | NS | — |
| CON-10 | Overdue escalation and reassignment | §5 | Ops | Queue | SLA timer (configurable) | — | NS | OD-03 |
| CON-11 | Reports: response time, conversion, cancellations, quality | §5 | Admin | BI | — | — | NS | — |
| CON-12 | No 24/7 claim unless configured | §5 | — | Copy | Config flag | Copy test | IU | — |
| CON-13 | Not a separate app; FMD doesn't provide treatment | §5 | — | Copy, IA | — | — | IU | — |
| CON-14 | Theme-aware premium identity (brief §7) | Brief | Patient | Concierge section | Tokens | Visual check in 7 themes | IP | — |

## 5. Clinic OS (§6)

| ID | Requirement | Src | Surface | Data | Status | Deps |
|---|---|---|---|---|---|---|
| CLN-01 | Registration, verification, profile, location, hours, services, rules, billing config | §6.1 | `/clinic/setup` | `clinics`, `branches` | NS | OD-08 |
| CLN-02 | Multiple branches with separated records/reporting | §6.1 | Branch switcher | `branch_id` scoping | NS | — |
| CLN-03 | Invite staff, assign roles, configure access, deactivate | §6.1 | Team | `org_members` | NS | — |
| CLN-04 | Comms channels, templates, language, escalation | §6.1 | Settings | `templates` | NS | OD-14 |
| CLN-05 | AI permissions, tools, approval thresholds, hours | §6.1 | AI settings | `ai_policies` | NS | OD-06 |
| CLN-06 | Dashboard: today/next appointments, check-ins, cancellations, no-shows, pending | §6.2 | `/clinic` | — | NS | — |
| CLN-07 | Follow-up queue, incomplete-docs alerts, tasks | §6.2 | Dashboard | — | NS | — |
| CLN-08 | Collections and outstanding from recorded transactions | §6.2 | Dashboard | — | NS | — |
| CLN-09 | Inventory alerts, staff tasks, summaries; custom widgets; date/branch filters | §6.2 | Dashboard | — | NS | — |
| CLN-10 | Patient registration, demographics, consent, duplicate detection | §6.3 | Patients | `patients` | NS | — |
| CLN-11 | Patient timeline (appointments, docs, plans, comms, billing) | §6.3 | Patient 360 | — | NS | — |
| CLN-12 | Configurable clinical notes and structured fields | §6.3 | Notes | `clinical_notes` | NS | — |
| CLN-13 | Odontogram with tooth/surface notation and non-destructive history | §6.3 | Chart | `chart_entries` (append-only) | PD | OD-16 |
| CLN-14 | Itemised plan and estimate with patient acknowledgement | §6.3 | Plans | `treatment_plans`, `estimates` | NS | — |
| CLN-15 | Attachments with access controls | §6.3 | Patient docs | — | NS | — |
| CLN-16 | Author, timestamps, amendment history; AI drafts need clinician acceptance | §6.3 | Notes | `note_versions` | NS | — |
| CLN-17 | Day/week/month views, provider calendars, chairs, types, durations | §6.4 | Calendar | `appointments`, `resources` | NS | — |
| CLN-18 | Book, reschedule, cancel, block, waitlist, attendance | §6.4 | Calendar | — | NS | — |
| CLN-19 | Status lifecycle with actor attribution | §6.4 | — | `appointment_status_events` | NS | — |
| CLN-20 | Policy-based reminders/confirmations respecting consent and opt-out | §6.4 | — | Notifications | NS | OD-14 |
| CLN-21 | Conflict checks, duplicate prevention, buffers, hours | §6.4 | — | DB exclusion constraint | NS | — |
| CLN-22 | Estimates, invoices, receipts, adjustments, discounts, payments | §6.5 | Billing | `invoices`, `payments` | NS | — |
| CLN-23 | Multiple payment modes, partial payments | §6.5 | Billing | — | NS | — |
| CLN-24 | Outstanding, refunds, voids with permissions and audit | §6.5 | Billing | — | NS | — |
| CLN-25 | Daily collection sheet, date-wise summaries | §6.5 | Reports | — | NS | — |
| CLN-26 | Clinic revenue separate from FMD revenue | §6.5, §14 | — | Separate ledgers | NS | — |
| CLN-27 | Gateway only under an agreed settlement model; show merchant of record | §6.5 | — | — | PD | OD-04 |
| CLN-28 | Catalog, units, stock, reorder, suppliers, purchases | §6.6 | Inventory | `inventory_items` | NS | — |
| CLN-29 | Batch and expiry tracking | §6.6 | Inventory | `stock_batches` | NS | — |
| CLN-30 | Stock movements with reasons; low-stock/expiry alerts | §6.6 | Inventory | `stock_movements` | NS | — |
| CLN-31 | AI drafts PO; sending needs authorization | §6.6 | Inventory | `purchase_orders.status` | NS | — |
| CLN-32 | Staff profiles, duties, tasks, completion | §6.7 | Staff | `tasks` | NS | — |
| CLN-33 | Handovers and checklists | §6.7 | Staff | — | NS | — |
| CLN-34 | Assignment, due dates, priority, escalation | §6.7 | Staff | — | NS | — |
| CLN-35 | AI task suggestions show source and allow review | §6.7 | Staff | — | NS | — |
| CLN-36 | Utilisation, cancel/no-show, recall, return metrics | §6.8 | Reports | — | NS | — |
| CLN-37 | Collections, balances, procedure mix | §6.8 | Reports | — | NS | — |
| CLN-38 | Staff/branch summaries by permission | §6.8 | Reports | — | NS | — |
| CLN-39 | Export with date range and data scope | §6.8 | Reports | — | NS | — |
| CLN-40 | Defined formulas; no estimates shown as audited | §6.8 | Reports | Metric dictionary | NS | — |
| CLN-41 | Core usable when AI is down | §6 | All clinic | AI behind flag/circuit breaker | NS | — |

## 6. Clinic AI manager (§7)

| ID | Requirement | Src | Surface | Data / control | Status | Deps |
|---|---|---|---|---|---|---|
| CAI-01 | Chat with context | §7.1 | `/clinic/ai` | `ai_conversations` | NS | OD-14 |
| CAI-02 | Voice with clear recording controls | §7.1 | AI | Speech adapter | NS | OD-14 |
| CAI-03 | Task cards: request, plan, status, approvals, result, follow-up | §7.1 | Task card | `ai_tasks`, `ai_task_steps` | NS | — |
| CAI-04 | Scheduled and recurring tasks | §7.1 | Schedules | Job queue | NS | — |
| CAI-05 | Manual run, review queue, history | §7.1 | — | — | NS | — |
| CAI-06 | Completed / partial / blocked / failed notifications | §7.1 | — | — | NS | — |
| CAI-07 | Front-desk tasks (unconfirmed appts, drafts, gaps, reschedule options) | §7.2 | Tools | `tool:appointments.*` | NS | — |
| CAI-08 | Recall sheets using configured rules | §7.2 | Tools | `recall_rules` | NS | — |
| CAI-09 | Payment sheets, missing entries; no autonomous money movement | §7.2 | Tools | Read-only finance tools | NS | — |
| CAI-10 | Content strategy and creation drafts; owner/clinical review | §7.2 | Tools | — | NS | — |
| CAI-11 | FMD Main publishing via approval; patient-case consent | §7.2 | Tools | Publish needs approval | NS | — |
| CAI-12 | Patient comms drafts respecting consent/opt-out/templates | §7.2 | Tools | — | NS | — |
| CAI-13 | Reports with source, range, timestamp | §7.2 | Tools | — | NS | — |
| CAI-14 | Inventory review, PO drafts needing approval | §7.2 | Tools | — | NS | — |
| CAI-15 | Staff coordination without restricted-data leakage | §7.2 | Tools | Field-level redaction | NS | — |
| CAI-16 | Doctor assistant and wellbeing (not diagnosis) | §7.2 | Tools | — | PD | OD-11 |
| CAI-17 | Dental knowledge support with sources | §7.2 | Tools | Retrieval | NS | — |
| CAI-18 | Lifecycle Receive→Clarify→Plan→Authorize→Preview→Execute→Verify→Report→Audit | §7.3 | Task engine | State machine | NS | — |
| CAI-19 | Autonomy/approval matrix (9 risk tiers) | §7.4 | Policy engine | `ai_policies` | PD | OD-06 |
| CAI-20 | Orchestration across language, vision, speech, retrieval | §7.5 | Gateway | — | NS | OD-14 |
| CAI-21 | Typed, permission-checked tools; no raw DB access | §7.5 | Tool registry | Zod schemas | NS | — |
| CAI-22 | Validation, timeouts, retries, idempotency | §7.5 | — | — | NS | — |
| CAI-23 | Model reasoning separate from deterministic rules | §7.5 | — | — | NS | — |
| CAI-24 | Retrieval over approved clinic material with access filters | §7.5 | — | — | NS | — |
| CAI-25 | Model fallback, cost/latency controls | §7.5, §7.7 | — | — | NS | — |
| CAI-26 | Prompt-injection defence: external content is data | §7.5, §13 | — | — | NS | — |
| CAI-27 | Queues for long jobs; safe cancellation; no silent partial changes | §7.5 | — | — | NS | — |
| CAI-28 | Separate memories; inspect/delete; tenant isolation; retention | §7.6 | — | — | NS | — |
| CAI-29 | Usage, latency, failures, cost per tenant; quotas and ceilings | §7.7 | — | `model_usage` | NS | OD-06 |

## 7. Scholar (§8)

| ID | Requirement | Src | Status | Deps |
|---|---|---|---|---|
| SCH-01 | Access via ₹400/yr student membership | §8.1 | NS | — |
| SCH-02 | Configurable, disclosed usage limits | §8.1 | PD | OD-05 |
| SCH-03 | Optional upgrade (tentative ₹350) | §8.1 | PD | OD-05 |
| SCH-04 | Eligibility tied to membership; grace and renewal | §8.1 | PD | OD-05 |
| SCH-05 | Professionals' entitlement not assumed | §8.1 | PD | OD-05 |
| SCH-06 | Doubt clarification across subjects | §8.2 | NS | OD-14 |
| SCH-07 | Levels: beginner / UG / PG / specialist | §8.2 | NS | — |
| SCH-08 | Follow-ups, quizzes, flashcards, revision plans, summaries | §8.2 | NS | — |
| SCH-09 | Viva questions, model answers, examiner follow-ups | §8.2 | NS | — |
| SCH-10 | Document-grounded Q&A with page references | §8.2 | NS | — |
| SCH-11 | Flag uncertainty and conflicting evidence | §8.2 | NS | — |
| SCH-12 | Presentation outlines and slide content | §8.3 | NS | — |
| SCH-13 | Seminar, journal club, case, classroom, conference formats | §8.3 | NS | — |
| SCH-14 | Slide count, style, citations, speaker notes | §8.3 | NS | — |
| SCH-15 | Editable PPTX export | §8.3 | BX | File-generation service |
| SCH-16 | Traceable citations; flag unverified | §8.3 | NS | — |
| SCH-17 | User papers with quotation limits | §8.3 | NS | — |
| SCH-18 | Regenerate at slide, section or deck | §8.3 | NS | — |
| SCH-19 | Research questions, objectives, hypotheses, outlines | §8.4 | NS | — |
| SCH-20 | Literature plans, summaries, matrices, evidence extraction | §8.4 | NS | — |
| SCH-21 | Methodology, data dictionary, questionnaires, stats concepts | §8.4 | NS | — |
| SCH-22 | Manuscript, abstract, poster, reviewer responses | §8.4 | NS | — |
| SCH-23 | No fabricated studies, results, ethics or references | §8.4 | NS | — |
| SCH-24 | Reference verification and integrity reminders | §8.4 | NS | — |
| SCH-25 | Projects/workspaces | §8.5 | NS | — |
| SCH-26 | Saved conversations, docs, outputs, revisions | §8.5 | NS | — |
| SCH-27 | Searchable tagged library | §8.5 | NS | — |
| SCH-28 | Export, delete, retention | §8.5 | NS | — |
| SCH-29 | Usage meter with upgrade path | §8.5 | NS | OD-05 |

## 8. Admin and Accountant (§9)

| ID | Requirement | Src | Status | Deps |
|---|---|---|---|---|
| ADM-01 | Platform dashboard (users, clinics, subs, bookings, content, Concierge, ops) | §9.1 | NS | — |
| ADM-02 | Verification queues, account status controls | §9.1 | NS | OD-08 |
| ADM-03 | Moderation queue, sponsored and ad management | §9.1 | NS | — |
| ADM-04 | Plan catalog, entitlements, renewals, payment exceptions, support | §9.1 | NS | — |
| ADM-05 | Concierge oversight and assignment | §9.1 | NS | — |
| ADM-06 | Config, feature flags, service status, audit, alerts | §9.1 | NS | — |
| ADM-07 | Role/access admin with privileged logging | §9.1 | NS | — |
| ACC-01 | Independent routine accounting via self-service | §9.2 | NS | — |
| ACC-02 | Income ledgers: memberships, Clinic OS, ads, Concierge receipts | §9.2 | NS | — |
| ACC-03 | Expenses: vendor, freelancer, cloud, marketing, payroll, reimbursements | §9.2 | NS | — |
| ACC-04 | Bank import, matching, reconciliation, unresolved queue | §9.2 | NS | — |
| ACC-05 | AP/AR with due dates, status, documents | §9.2 | NS | — |
| ACC-06 | Invoices, receipts, credit notes, refunds linked to originals | §9.2 | NS | — |
| ACC-07 | GST data, ITC records, tax-period schedules | §9.2 | NS | Tax review |
| ACC-08 | TDS support records | §9.2 | NS | Tax review |
| ACC-09 | Filing calendar, checklist, status, evidence, reminders | §9.2 | NS | — |
| ACC-10 | TB, P&L, balance sheet, cash flow, management reports | §9.2 | NS | — |
| ACC-11 | Monthly/quarterly/year-end close, exceptions, bundle | §9.2 | NS | — |
| ACC-12 | Tally/Zoho export or sync adapter | §9.2 | PD | OD-13 |
| ACC-13 | Dedicated login, MFA, finance-only role | §9.2 | NS | — |
| ACC-14 | Show source, reference, date, party, tax fields, evidence | §9.2 | NS | — |
| ACC-15 | Exceptions queue (missing invoice, unmatched, unclear, failed, filing dep) | §9.2 | NS | — |
| ACC-16 | Statutory filing via authorized external systems; portal records evidence | §9.2 | NS | OD-13 |
| ACC-17 | Never store bank passwords, OTPs or DSC secrets | §9.2 | NS | — |
| ACC-18 | Maker-checker for high-risk finance actions | §9.2 | NS | — |
| ACC-19 | Immutable audit for edits, approvals, exports, filings | §9.2 | NS | — |
| ACC-20 | No clinical data; clinic finance ≠ FMD revenue; settlement explicit | §9.3 | NS | — |
| ACC-21 | Exports restricted by date, entity, branch, permission | §9.3 | NS | — |

## 9. Shared platform (§10–17)

| ID | Requirement | Src | Status | Deps |
|---|---|---|---|---|
| PLT-01 | Common identity and verification; org invitations | §10 | NS | — |
| PLT-02 | Entitlement service | §10 | NS | — |
| PLT-03 | Session management, device revocation, recovery | §10 | NS | — |
| PLT-04 | Search across providers, clinics, content, jobs with separate relevance | §10 | IP (providers only, demo) | — |
| PLT-05 | Location permission only when needed; manual entry | §10 | IU (manual city select) | — |
| PLT-06 | Filtering, sorting, pagination, no-result suggestions | §10 | IP | — |
| PLT-07 | Secure uploads: type/size validation, malware scan, access control | §10 | NS | OD-14 |
| PLT-08 | Media compression and transcoding | §10 | NS | — |
| PLT-09 | Signed, expiring links; lifecycle and retention | §10 | NS | — |
| PLT-10 | Payment abstraction, verified webhooks, transaction ledger | §10, §11.4 | BX | OD-04 / gateway creds |
| PLT-11 | Plans, recurring billing, renewals, grace, cancellation | §10, §14 | NS | — |
| PLT-12 | Receipts, failed-payment recovery, refunds, reconciliation; idempotent | §10 | NS | — |
| PLT-13 | Content lifecycle draft→review→publish→archive→report | §10 | NS | — |
| PLT-14 | Moderation actions, appeals, audit | §10 | NS | — |
| PLT-15 | Ad disclosure and sponsored controls | §10 | IU (badge only) | — |
| PLT-16 | In-app help, issue reporting, ticket status, contextual help | §10 | NS | — |
| ARC-01 | Modular monolith with typed domain modules (§11.3 list) | §11 | NS | ADR-001 |
| ARC-02 | Versioned, documented APIs with errors and rate limits | §11.4 | NS | — |
| ARC-03 | Webhook signatures and replay protection | §11.4 | NS | — |
| ARC-04 | Idempotency keys for payment, booking, task actions | §11.4 | NS | — |
| ARC-05 | Replaceable vendor adapters | §11.4 | NS | — |
| ARC-06 | Sandbox credentials and test environments | §11.4 | BX | Vendor accounts |
| ARC-07 | No secrets in clients or repos | §11.4 | IU (none exist) | — |
| ARC-08 | Dev/staging/prod, CI/CD, rollback, migrations, secrets outside code | §11.6 | NS | Hosting |
| DAT-01 | ERD and data dictionary for all §12 entities | §12 | NS | — |
| DAT-02 | Health data logically and technically separated | §12 | NS | — |
| DAT-03 | Ownership, retention, deletion, export per entity | §12 | NS | — |
| SEC-01 | TLS and encryption at rest | §13 | BX | Hosting |
| SEC-02 | Password/OTP controls, MFA for privileged roles, revocation, brute-force protection | §13 | NS | — |
| SEC-03 | Server-side org/role authorization on every request | §13 | NS | — |
| SEC-04 | Audit logs (sensitive access, privileged, finance, AI) | §13 | NS | — |
| SEC-05 | Secret management, dependency scanning, incident response | §13 | NS | — |
| SEC-06 | Backups with tested restore; RPO/RTO | §13 | BX | Hosting |
| SEC-07 | Rate limits, validation, output encoding, OWASP | §13 | NS | — |
| PRV-01 | Privacy notices; purpose-specific consent | §13 | NS | Legal |
| PRV-02 | Minimum data; purpose, access, retention, deletion rules | §13 | NS | — |
| PRV-03 | Access/export/deletion requests | §13 | NS | — |
| PRV-04 | Consent records for sharing and case publication | §13 | NS | — |
| PRV-05 | No training on patient records without authorization | §13, D | NS | — |
| PRV-06 | Vendor DPAs, cross-border transfer review | §13 | BX | Legal |
| SAF-01 | Clinical review of guidance and escalation language | §13 | BX | Clinical advisor |
| SAF-02 | Prevent prescriptions, guarantees, fabricated citations | §13 | NS | — |
| SAF-03 | Human review for notes, case publication, high-impact comms | §13 | NS | — |
| SAF-04 | Risk tiers; never imply emergency monitoring | §13 | IP (copy) | — |
| SAF-05 | AI threat controls: untrusted inputs, no permission expansion, confirmation, duplicate detection, override, minimal audit | §13 | NS | — |
| LEG-01 | Indian legal, tax, privacy and regulatory review before launch | §13 | BX | Counsel |
| COM-01 | Price table (Free / ₹550 / ₹400 / ₹2,000 yr / ₹2,000 mo / Scholar ₹350 tentative / Concierge TBD) | §14 | NS | OD-05, OD-03 |
| COM-02 | Show price, tax, renewal, features, limits, refund terms pre-purchase | §14 | NS | — |
| COM-03 | Distinct membership vs Clinic OS in catalog and receipts | §14 | NS | — |
| COM-04 | Admin plans, coupons, grace, renewal notices | §14 | NS | — |
| COM-05 | Payment attempts, gateway refs, settlement, refunds, invoices | §14 | NS | — |
| COM-06 | Webhooks are payment truth; reconcile exceptions | §14 | NS | — |
| COM-07 | Treatment fees not FMD revenue unless contract says so | §14 | NS | OD-04 |
| COM-08 | Scholar usage shown before limits; no surprise stops | §14 | NS | OD-05 |
| NOT-01 | Event matrix (appointment, change, renewal, Concierge, AI task, recall, security) | §15 | NS | OD-14 |
| NOT-02 | Templates, localisation, delivery logs, retries, prefs | §15 | NS | — |
| NOT-03 | No sensitive detail in previews or lock screen | §15 | NS | — |
| ANL-01 | Main metrics (§16) | §16 | NS | — |
| ANL-02 | Clinic metrics including AI task outcomes and cost | §16 | NS | — |
| ANL-03 | Scholar metrics | §16 | NS | — |
| ANL-04 | Admin and finance metrics | §16 | NS | — |
| ANL-05 | Metric formulas, events, owner, retention, privacy, access | §16 | NS | — |
| NFR-01 | Measurable performance targets | §17 | NS | — |
| NFR-02 | SLOs and maintenance comms | §17 | NS | — |
| NFR-03 | Capacity planning | §17 | NS | — |
| NFR-04 | Idempotency, durable queues, DLQ, recovery | §17 | NS | — |
| NFR-05 | Accessibility (see ANX-K) | §17 | IP | — |
| NFR-06 | Externalised strings; Indian date/time/currency | §17 | NS | — |
| NFR-07 | Browser/device matrix | §17 | NS | — |
| NFR-08 | Lint, tests, API docs, ADRs | §17 | IP (lint only) | — |
| NFR-09 | Logs, metrics, tracing, alerts, AI traceability, cost | §17 | NS | — |
| NFR-10 | Portability and exit paths | §17 | NS | — |

## 10. End-to-end journeys and QA (§18–20)

| ID | Journey / criterion | Src | Status |
|---|---|---|---|
| E2E-01 | Patient concern → guidance → discovery → slot → confirm → reminders → records | §18 | IP (demo UI path only) |
| E2E-02 | Concierge request → reference → coordinator → patient confirms → closed | §18 | IP (submit only) |
| E2E-03 | Clinic AI recall → criteria → preview → approve batch → send → outcomes → summary | §18 | NS |
| E2E-04 | Case post → consent check → AI de-identified draft → review → approve → publish → log | §18 | NS |
| E2E-05 | Student pays → Scholar → doubts/viva → sources → deck → verify → export → meter | §18 | NS |
| E2E-06 | Accountant MFA → review → categorise → reconcile → exceptions → schedules → filing evidence → close | §18 | NS |
| QA-01 | Auth, recovery, role, org-scope allowed/denied tests | §19 | NS |
| QA-02 | Happy, validation, cancel, timeout, duplicate, partial-failure tests on critical flows | §19 | NS |
| QA-03 | Payment/booking verified against backend/gateway | §19 | NS |
| QA-04 | AI permission → approval → verify → audit; never claims unverified success | §19 | NS |
| QA-05 | Case publishing blocked without consent and approval | §19 | NS |
| QA-06 | Public AI cannot book or contact | §19 | NS |
| QA-07 | Clinic AI cannot bypass locked records, finance approvals or tool permissions | §19 | NS |
| QA-08 | Scholar references traceable or flagged | §19 | NS |
| QA-09 | Accountant export scope restrictions | §19 | NS |
| QA-10 | A11y, localisation, opt-outs, deletion/export tested | §19 | NS |
| QA-11 | Tenant isolation, access control, upload, secrets, prompt-injection security tests | §19 | NS |
| QA-12 | AI eval set: factuality, calibration, citations, tools, refusals, cost; per-language; red-team | §19 | NS |
| DLV-01 | Handover deliverables (traceability, UX, architecture, ERD, API docs, permission matrix, tool registry, envs, tests, guides, runbooks, vendor list) | §20 | IP (this doc) |
| DLV-02 | Definition of done: AC + tests + permission/privacy/audit/failure + all UI states + telemetry + docs + PO acceptance | §20 | — |

## 11. Annex A–N

| ID | Requirement | Src | Status | Deps |
|---|---|---|---|---|
| ANX-A-01 | Certificate from completed treatment/invoice, or manual issuance | A1 | NS | OD-17 |
| ANX-A-02 | Fields: ID, patient/clinic/provider, procedure, tooth/site, dates, validity, covered, exclusions, conditions, follow-ups, contact | A1 | NS | — |
| ANX-A-03 | Clinic templates and eligibility, versioned; terms snapshot at issue | A1 | NS | — |
| ANX-A-04 | Delivery to records plus secure link/PDF; QR/non-guessable verify view with minimal data | A1 | NS | — |
| ANX-A-05 | States: active, expired, amended, voided, disputed, transferred; immutable history | A1 | NS | — |
| ANX-A-06 | Supporting docs and maintenance visits; consented expiry reminders | A1 | NS | — |
| ANX-A-07 | Clinic owns terms; FMD never invents or interprets coverage; clear exclusions; amendments versioned; dispute routing; audit | A2 | NS | — |
| ANX-B-01 | 8-stage journey (discover → closure) with listed controls | B | IP (static explainer section) | — |
| ANX-B-02 | Chronological timeline, status labels, multiple episodes, staff corrections with attribution, clinic-released visibility | B1 | NS | — |
| ANX-B-03 | Full-journey acceptance test incl. certificate and export | B1 | NS | — |
| ANX-C-01 | Import via official APIs, embeds, uploads, links only; no scraping | C | PD | OD-10 |
| ANX-C-02 | Capture source, rights holder, caption, type, attribution, date, license, moderation | C | NS | — |
| ANX-C-03 | Link/embed fallback; prompt to upload owned content | C | NS | — |
| ANX-C-04 | Draft review, crop, captions, tags, alt text, scheduling | C | NS | — |
| ANX-C-05 | Duplicates, broken links, ownership declarations, takedown, audit | C | NS | — |
| ANX-C-06 | Consent and de-identification for cases, testimonials, before/after | C | NS | — |
| ANX-C-07 | Track rights to store, transform, recommend, monetise | C | NS | — |
| ANX-C-08 | Report categories, queues, appeals, repeat-offender controls | C1 | NS | — |
| ANX-D-01 | Personalisation for patients, dentists, students, clinics with listed controls | D | NS | OD-18 |
| ANX-D-02 | Explicit preferences first; behavioural signals only with notice | D | NS | — |
| ANX-D-03 | Inspect, correct, reset, disable; explain "why" | D | NS | — |
| ANX-D-04 | Paid distinguishable; no sensitive inference for ads; no patient-record ad targeting | D | NS | — |
| ANX-D-05 | Evaluate relevance, diversity, freshness, repetition, fairness | D | NS | — |
| ANX-E-01 | 8 onboarding steps (lead → activation) | E | NS | — |
| ANX-E-02 | Dashboard: owner, status, blockers, missing fields, due dates, evidence | E | NS | — |
| ANX-E-03 | Assisted and self-service; data-processing explanation before real data | E | NS | — |
| ANX-E-04 | Handoff to support/account management; activation metrics | E | NS | — |
| ANX-F-01 | Source inventory; agreed scope, authority, retention, downtime, rollback | F | NS | — |
| ANX-F-02 | CSV/template first; integrations after feasibility | F | NS | — |
| ANX-F-03 | Mapping, normalisation, dedupe with source refs | F | NS | — |
| ANX-F-04 | Validation → sample → error report → review → sign-off → import | F | NS | — |
| ANX-F-05 | Provenance; flag conflicts, never guess | F | NS | — |
| ANX-F-06 | Encrypted, restricted staging; temp-copy deletion; reconciliation counts; rejected rows; attachment checks; rollback | F, F1 | NS | — |
| ANX-G-01 | Feedback invitations with consent and frequency limits | G | NS | — |
| ANX-G-02 | Private feedback vs public review clearly distinguished | G | PD | OD-09 |
| ANX-G-03 | Ratings and structured topics; no clinical-outcome popularity | G | NS | — |
| ANX-G-04 | Clinic response, tagging, trends, serious-complaint escalation | G | NS | — |
| ANX-G-05 | Moderation; disclose verified-visit and incentive rules; no suppression | G | NS | — |
| ANX-G-06 | Report, correction, appeal, takedown with reasons | G | NS | — |
| ANX-H-01 | Help centre, guides, onboarding material, request form, history | H | NS | — |
| ANX-H-02 | Classification: area, severity, impact, clinic/branch, version, repro | H | NS | — |
| ANX-H-03 | Secure attachments with redaction guidance | H | NS | — |
| ANX-H-04 | No unsupported SLAs or 24/7 promise | H | NS | OD-19 |
| ANX-H-05 | Updates, workaround, resolution, closure, reopen; playbooks | H | NS | — |
| ANX-H-06 | Volume, first response, resolution, reopen, CSAT, root causes | H | NS | — |
| ANX-I-01 | Platform invites separate from clinical referrals | I | PD | OD-12 |
| ANX-I-02 | Codes/links, attribution, fraud checks, expiry, eligibility, terms | I | PD | OD-12 |
| ANX-I-03 | Rewards ledger states: issued → disputed; audit | I | PD | OD-12 |
| ANX-I-04 | Block self-referral, duplicates, fabricated appointments, chargeback abuse | I | PD | OD-12 |
| ANX-I-05 | **Configurable and disabled until legal approval** | I | PD | OD-12 |
| ANX-J-01 | Clinic ops, journey, finance, growth, AI-ops, platform-health analytics | J | NS | — |
| ANX-J-02 | Role-based filters; metric dictionary (formula, exclusions, refresh, source) | J | NS | — |
| ANX-J-03 | Permissioned CSV/PDF export with watermark/audit | J | NS | — |
| ANX-J-04 | Aggregated/de-identified platform views; no cross-clinic leakage | J | NS | — |
| ANX-J-05 | Not presented as clinical outcome evidence | J | NS | — |
| ANX-K-01 | Screen readers, keyboard, focus, headings, labels, error announcements | K | IP | — |
| ANX-K-02 | Contrast; never colour-only status; text resize; responsive | K | IP | — |
| ANX-K-03 | Plain language; captions/transcripts; alt text | K | IP | — |
| ANX-K-04 | Touch targets, low bandwidth, varied literacy | K | IP | — |
| ANX-K-05 | Reviewed Indian-language localisation | K | NS | — |
| ANX-K-06 | Non-voice alternatives and human assistance | K | IP (text input everywhere) | — |
| ANX-K-07 | Automated and representative-user testing; WCAG 2.2 AA benchmark | K | NS | — |
| ANX-K-08 | **Reduced-motion alternative for the cinematic hero** (brief §5) | Brief | IU (M1) | — |
| ANX-L-01 | Consistent identity; separate purposes across discovery, records, feedback, content, marketing, loyalty, analytics | L | NS | — |
| ANX-L-02 | Purpose and basis per data flow; appointment consent ≠ marketing | L | NS | — |
| ANX-L-03 | Data-flow inventory (apps, backend, AI, messaging, payments, analytics, support, backups, migration) | L | NS | — |
| ANX-L-04 | Decision log with owner, date, impact | L | IU (`OPEN_DECISIONS.md`) | — |
| ANX-L-05 | Clinical and security/privacy review gates; release gates; incident severity; rollback authority; vendor exit | L | NS | — |
| ANX-M-01..08 | 8 cross-feature scenarios (certificate, changed appointment, onboarding+migration, negative feedback, support incident, referral abuse, BI isolation, a11y core journey) | M | NS | — |
| ANX-N-01 | Decisions to finalise (12 items) | N | Tracked in `OPEN_DECISIONS.md` | — |

## 12. Milestone 1 — Cinematic hero (brief Part II)

| ID | Requirement | Surface | Acceptance test | Status |
|---|---|---|---|---|
| HERO-01 | Earth horizon with surface detail, depth, atmosphere and curvature | `components/hero/Earth.tsx` | Visual check vs reference (desktop + mobile) | see M1 notes in roadmap |
| HERO-02 | Rim light attached to the Earth's edge, silver-white by default | `Earth.tsx` arc paths | Rim follows circle geometry | ″ |
| HERO-03 | Initial state: headline, horizon and focused centre light visible; mascot and chat hidden | `CinematicHero.tsx` | Screenshot at scroll 0 | ″ |
| HERO-04 | Stage A: headline fades out, scene darkens, centre light intensifies and spreads symmetrically along the curve | Timeline phase A | Scrub screenshots | ″ |
| HERO-05 | Stage B: mascot reveal starts at 75–80% illumination, tied to progress | `REVEAL_AT` constant | Unit check on phase table | ″ |
| HERO-06 | Stage C: supplied meditating mascot rises from behind the horizon with 3D rotation to front, settles, rim-lit | `Mascot.tsx` | Visual | ″ (asset pending OD-H1) |
| HERO-07 | Stage D: AI conversation is its own state, **never side by side with the mascot** | AI stage | Opacities never overlap (phase table check) | ″ |
| HERO-08 | AI stage: identity, greeting, composer, voice (where supported), attach, suggested prompts; no diagnosis claims | `HeroAssistantStage` | Controls function | ″ |
| HERO-09 | Stage E: mascot reverses and descends; pin releases into next section without jumps | Timeline | Scroll to end, no layout jump | ″ |
| HERO-10 | Fully reversible scrub; no timers, no per-scroll React state | `useScroll` + `useTransform` | Code review + manual | ″ |
| HERO-11 | Mobile simplified; reduced-motion static narrative | Media queries + `useReducedMotion` | Emulated checks | ″ |
| HERO-12 | No new heavy 3D dependency; old WebGL molar removed from hero | — | `package.json` diff | ″ |
