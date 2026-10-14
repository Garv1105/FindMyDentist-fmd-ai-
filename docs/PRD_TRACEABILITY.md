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
| R4 | FMD Edge "free in beta, Bengaluru only, response within 1 business day" | PRD §5, §21: commercial terms, areas and response commitments are **undecided and must stay configurable** | Recorded as provisional only (OD-03); no promises in UI copy |
| R5 | Phased V1→V6 plan presented as the delivery plan | PRD §20 Scope management: sequencing must be **explicitly agreed by FMD**; the PRD has no V1 split | Roadmap marks sequence as proposed, not a scope reduction |
| R6 | FMD Edge statuses listed without Cancelled in some places | PRD §5 includes **Cancelled** plus reassignment and overdue escalation | CON-09 includes Cancelled |
| R7 | Warranty "FMD verifies" | Annex A2: the **clinic is issuer**; FMD only verifies certificate authenticity, never interprets coverage | ANX-A-06 wording fixed |
| R8 | Flutter mobile apps assumed in delivery | PRD §11.1 *suggests* Flutter; this repo is web-only | Logged as OD-15; web-first is responsive |

Nothing in the earlier plan was found to **omit** a PRD section. Its annex coverage was thinner than the PDF (Annex L governance, M scenarios and N decisions were only partly carried). Those are added below.

---

## 1. Principles and boundaries (§1–2)

| ID | Requirement | Src | Role / product | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| PRN-01 | Dentistry-only focus | §1 | All | All copy and IA | — | Content review | IU | — |
| PRN-02 | AI is model-agnostic | §1, §7.5 | Platform | AI gateway | `ai/providers/*` adapter interface | Swap provider in config, tests pass | IP (AiProvider interface + dev provider; real vendor BX OD-14) | OD-14 |
| PRN-03 | Distinguish education, AI drafts, recommendations and verified decisions | §1 | All | Labels in AI, Clinic and Scholar UI | `origin` field on generated artifacts | UI label snapshot tests | IP | — |
| PRN-04 | AI never presented as a substitute for a dentist | §1, §13 | Main | Assistant, hero chat stage | Safety copy component | Copy test on every AI surface | IP | — |
| PRN-05 | Subscriptions, limits and sponsorship are transparent | §1, §14 | All | Membership, badges | Entitlement service | Purchase screen shows price/tax/renewal/limits | IP | — |
| ECO-01 | Separate products: Main, Clinic OS, Scholar, Admin, Accountant | §2 | — | Route groups `/`, `/clinic`, `/scholar`, `/admin`, `/accounts` | Per-app roles | Route/role access tests | NS | — |
| ECO-02 | **No FMD Campus; no standalone FMD Edge app** | §2 | — | Nav, IA | — | Grep/nav test: no "Campus" | IT | — |
| ECO-03 | Shared identity, app-specific roles and entitlements | §2, §10 | All | Auth module | `users`, `memberships`, `roles`, `entitlements` | Role matrix tests | IP (shared identity + roles IT; app entitlements NS) | — |
| ECO-04 | Student membership grants Scholar access | §2, §8.1 | Student | Scholar gate | `entitlements(scholar.base)` | Expired membership → no access | IT (Scholar entitlement only via active student membership; expiry ends access) | OD-05 |
| ECO-05 | Professional membership and Clinic OS are separate products and charges | §2, §14 | Dentist/Clinic | Plans, receipts | Separate `plans` rows | Receipt shows distinct line items | IT (Clinic OS listed as separate product) | — |
| ECO-06 | Multi-staff clinic orgs with role access | §2, §6.1 | Clinic | Clinic team admin | `org_members`, `role_grants` | Staff denied out-of-role actions | NS | — |
| ECO-07 | Account linking, recovery, consent, deletion request | §2, §4.1 | All | Account settings | `consents`, `deletion_requests` | E2E recovery/deletion | IP (recovery via OTP, consent, deletion IT; linking NS) | — |

## 2. Roles and permissions (§3)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| ROL-01 | Patient: own data only; explicit record sharing | §3 | Patient | Records | Server-side ownership check | Denied cross-user read | NS | — |
| ROL-02 | Dentist: verification plus org-level permissions | §3 | Dentist | Profile, clinic | `verifications` | Unverified cannot show badge | NS | OD-08 |
| ROL-03 | Student: eligibility checks | §3 | Student | Membership | `verifications(kind=student)` | — | NS | OD-08 |
| ROL-04 | Corporate: company verification and content/ad rules | §3 | Company | Company page | `verifications(kind=company)` | — | NS | OD-08 |
| ROL-05 | Clinic owner/admin: strong auth for sensitive actions | §3 | Clinic | Clinic settings | Step-up MFA | Sensitive action without MFA → 403 | NS (step-up MFA) | — |
| ROL-06 | Clinic staff: least privilege; restrict clinical and finance | §3 | Clinic | Clinic OS | Permission strings | Front desk cannot view finance | IT | — |
| ROL-07 | Clinic AI: tool scopes, consent, approvals, logs, rate limits | §3, §7 | Clinic AI | AI manager | Tool registry + policy | Tool call denied outside scope | IT | — |
| ROL-08 | Ops/support: scoped, logged access | §3 | FMD ops | Admin | `audit_events` | Access writes audit | NS | — |
| ROL-09 | Moderator: no clinical-record access | §3 | Moderator | Admin | Deny `records.*` | Moderator 403 on records | NS | — |
| ROL-10 | Super admin: privileged actions logged and protected | §3 | Super admin | Admin | Audit + MFA | — | NS | — |
| ROL-11 | Accountant: finance only, no clinical or unrelated user data | §3, §9.3 | Accountant | Accountant portal | Deny non-finance scopes | Accountant 403 on patients | NS | — |
| ROL-12 | Scope by org, clinic, record, action and sensitivity, not role label alone | §3 | All | API middleware | ABAC policy | Policy unit tests | IT (clinic permission matrix; 404 for non-members) | — |

## 3. FMD Main (§4)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| MAIN-01 | Registration with phone/email verification | §4.1 | All | `/signup` | `POST /auth/otp` | OTP happy path, expiry, lockout | IT (dev OTP adapter; vendor BX OD-14) | OD-14 (SMS vendor) |
| MAIN-02 | Account type selection (patient/dentist/student/company) | §4.1 | All | Onboarding | `users.account_type` | — | IT | — |
| MAIN-03 | Minimal profile data, sensitive-use explanation | §4.1 | All | Onboarding | — | Copy review | IU | — |
| MAIN-04 | Terms, privacy, consent, comms prefs, recovery, deletion request | §4.1 | All | Settings | `consents` | E2E | IT (terms/privacy/comms consents, deletion request); policy texts BX legal | — |
| MAIN-05 | Membership screen: status, benefits, renewal, usage, limits | §4.1 | All | `/account/membership` | `entitlements`, `usage_counters` | — | IT (status, benefits, renewal, usage meter, limits, pending-decision notes) | OD-05 |
| MAIN-06 | Profile editing and account linking without cross-user exposure | §4.1 | All | Settings | — | Isolation test | IP (profile edit IT; email+phone linking NS) | — |
| MAIN-07 | Prominent AI entry with text, voice and image/doc input | §4.2 | All | Hero AI stage, assistant panel | `POST /ai/conversations` | Hero AI stage renders composer + controls | IP (text IT; browser voice dictation in hero; image/document input BX vision vendor) | Voice: browser STT only (OD-14) |
| MAIN-08 | One assistant that adapts to role | §4.2 | All | Assistant | Role in system context | — | IP (role passed to provider; role-specific answers need real model) | — |
| MAIN-09 | EN, TE, KN, TA, HI plus more; switching and mixed language | §4.2 | All | Assistant, i18n | i18n catalog | Per-language eval | IP (label only) | OD-14 |
| MAIN-10 | Plain-language education and next steps | §4.2 | Patient | Assistant | Reviewed KB | Eval set | IP (dev rule-based answers; clinical review BX SAF-01) | Clinical review |
| MAIN-11 | Uncertainty wording, no diagnosis or prescription | §4.2, §13 | Patient | Assistant | Output checker | Red-team set | IT (output guard: no dosing, no definitive diagnosis, disclaimer) | — |
| MAIN-12 | Escalation guidance for concerning symptoms (reviewed content) | §4.2 | Patient | Assistant | Escalation templates | Eval: urgent-symptom prompts | IT (urgent patterns → emergency template; wording review BX SAF-01) | Clinical review |
| MAIN-13 | Revisit conversations with privacy/retention controls | §4.2 | All | Assistant history | `ai_conversations` | — | IT (stored only with ai_history consent; list/open/delete; withdrawal stops storage) | — |
| MAIN-14 | AI presents choices; user completes actions; **no autonomous booking or contact** | §4.2, §4.10 | Patient | Assistant actions = navigation only | No write tools exposed to public AI | Test: public AI has zero write tools | IT (allow-listed navigate-only actions; injection test creates no booking) | — |
| MAIN-15 | Organise appointments, plans and reminders | §4.3 | Patient | Companion tools | `reminders` (user-owned) | — | NS | — |
| MAIN-16 | Treatment budget worksheet with estimates and exclusions labelled | §4.3 | Patient | Worksheet | `budget_worksheets` | — | NS | — |
| MAIN-17 | Insurance document help, no coverage guarantee | §4.3 | Patient | Assistant | — | Copy test | NS | — |
| MAIN-18 | Summarise uploaded reports with limitations | §4.3 | Patient | Assistant + Records | Vision adapter | — | NS | OD-14 |
| MAIN-19 | Organise dental history and preferences with consent | §4.3 | Patient | Profile | `consents(purpose=history)` | — | NS | — |
| MAIN-20 | User-controlled checklists and reminders; no implied monitoring | §4.3 | Patient | Reminders | — | — | NS | — |
| MAIN-21 | Search by location, specialty, service, availability, language | §4.4 | Patient | Hero search + `#dentists` | `GET /providers` | Filter tests | IT (server-side filters: city, specialty, treatment, language, text) | — |
| MAIN-22 | Profiles with qualifications, experience, services, clinic, hours, photos, contact/booking | §4.4 | Patient | ProfileDrawer | `dentist_profiles` | — | IT (profile API + /dentists/[id]; photos only when provided) | — |
| MAIN-23 | Verified distinct from paid promotion; sponsored labelled | §4.4 | Patient | `VerifiedBadge` / `SponsoredBadge` | `placements.sponsored` | Visual + a11y label test | IT (organic order unaffected by sponsorship — test) | — |
| MAIN-24 | Claim-profile and verification workflows | §4.4 | Dentist | `/claim` | `verifications` | — | IT (claim → ops verification queue) | OD-08 |
| MAIN-25 | AI recommends providers, labelled informational | §4.4 | Patient | Assistant action → filtered list | — | — | IT (assistant suggests specialty filters; informational copy) | — |
| MAIN-26 | Live availability only from a reliable source, else "needs confirmation" | §4.4 | Patient | Dentist cards (`nextSlot: null`) | Clinic OS slots | Card shows "confirm availability" when null | IT (slots only from connected schedule; else 'confirmed by clinic') | Clinic OS |
| MAIN-27 | Browse availability, appointment types, booking info | §4.5 | Patient | Booking flow | `GET /slots` | — | IT | — |
| MAIN-28 | Show provider, time, clinic, fee and cancellation terms before confirm | §4.5 | Patient | Booking review step | — | — | IT (review step shows dentist, clinic, time, fee, cancellation terms; snapshot stored) | OD-04 |
| MAIN-29 | Explicit confirmation before booking/request | §4.5 | Patient | Booking confirm + checkbox | Idempotency key | Cannot submit without confirm | IT (confirmed:true + idempotency key) | — |
| MAIN-30 | Booking status, reminders, cancel/reschedule routes, support | §4.5 | Patient | `/appointments` | `appointment_status_events` | — | IP (patient sees clinic confirm/decline/complete via Clinic OS IT; reminders BX) | — |
| MAIN-31 | Handle unavailable slots, duplicates, failed payments, provider changes | §4.5 | Patient | Booking errors | 409 on conflict | Duplicate submit test | IT (slot taken, duplicate, too-soon, idempotent retry); payment failures N/A until OD-04 | — |
| MAIN-32 | Clinic booking rules and buffers | §4.5 | Clinic | Clinic settings | `booking_rules` | — | IT (clinic hours, buffers, min notice) | — |
| MAIN-33 | Patient records: reports, X-rays, photos, plans, prescriptions | §4.6 | Patient | `/records` | `clinical_documents` | — | IT (reports, X-rays, photos, prescriptions, plans; patient uploads) | — |
| MAIN-34 | Organise by date, clinic, provider, episode, type | §4.6 | Patient | Records filters | — | — | IT (date, clinic, provider, episode, type) | — |
| MAIN-35 | Download, export, deletion request, explicit sharing | §4.6 | Patient | Records actions | `sharing_grants` | Revoke denies access | IT (download, JSON export, delete, per-dentist time-limited sharing + revoke) | — |
| MAIN-36 | Upload progress, validation, storage limits, access history | §4.6, §10 | Patient | Uploader | `access_events` | Rejects bad type/size | IT (XHR progress, magic-byte validation, 15 MB limit, quota meter, access history) | — |
| MAIN-37 | Private storage with expiring links; no raw paths | §4.6 | Platform | Storage adapter | Signed URLs | Expired link 403 | IP (private store + session-bound signed expiring links IT; encryption at rest BX OD-14) | OD-14 |
| MAIN-38 | Feed: reels, posts, education, polls, creators | §4.7 | All | `/explore` | `posts`, `media_assets` | — | IP (education posts and polls IT; reels/short video BX media processing) | — |
| MAIN-39 | Personalised feed with consent and controls | §4.7, D | All | Feed prefs | `personalization_prefs` | Reset works | IT (explicit interests, reset, follows) | — |
| MAIN-40 | Search-related content shown prominently; general content too | §4.7 | All | Feed ranking | — | — | IT (search matches flagged; general education always included) | — |
| MAIN-41 | Profiles, follows, likes, comments, saves, reports, moderation | §4.7 | All | Feed | `reactions`, `follows`, `reports` | — | IT (follows, likes, comments, saves, reports, moderation) | — |
| MAIN-42 | Sponsored content labelled | §4.7 | All | Feed card | — | — | IT (staff-only sponsor label; never boosts ranking) | — |
| MAIN-43 | Professionals create posts, subject to rules and consent | §4.7 | Dentist | Composer | Consent gate | Case post blocked without consent | IT (verified dentists only; review before publish) | — |
| MAIN-44 | No identifiable patient case without documented consent and review | §4.7, §13 | Dentist | Composer | `consent_refs` | — | IT (case posts need consent ref + de-identification + clinical review) | — |
| MAIN-45 | Dentist profile with portfolio, membership status, edit controls | §4.8 | Dentist | `/dentists/[id]` | — | — | IP (public profile IT; portfolio/content NS) | — |
| MAIN-46 | Verification reflects actual checks performed | §4.8 | Dentist | Badge tooltip | `verifications.checks` | — | IT (badge text  | — |
| MAIN-47 | Jobs: create, browse, search | §4.9 | Dentist/Company | `/jobs` | `jobs` | — | IT | — |
| MAIN-48 | Posting permissions, details, application route | §4.9 | Company | Job form | — | — | IT (verified dentists and company accounts; https/email/phone apply routes) | — |
| MAIN-49 | Job report, moderation, expiry, renewal | §4.9 | Admin | Admin queue | — | — | IT (30-day expiry, renew, close, report → moderator removal) | — |
| MAIN-50 | Don't imply employer verification | §4.9 | — | Job card copy | — | — | IT (employer-verified only by staff action; default label 'not verified by FMD') | — |

## 4. FMD Edge (§5)

| ID | Requirement | Src | Role | Surface | API / data / permission | Acceptance test | Status | Deps |
|---|---|---|---|---|---|---|---|---|
| CON-01 | Section shows service description, area, response process, terms | §5 | Patient | `#concierge` | Config-driven copy | — | IT (config-driven areas/terms; values PD OD-03) | OD-03 |
| CON-02 | Enquiry: contact pref, area, need, timing, notes | §5 | Patient | FMD Edge form | `POST /concierge/enquiries` | Validation tests | IT | — |
| CON-03 | Minimum health data; explain use and who contacts | §5 | Patient | Form copy + consent | `consents(purpose=concierge)` | — | IT (minimal fields, per-request contact consent) | — |
| CON-04 | Show reference; "received", not "confirmed" | §5 | Patient | Success state | Server-issued ref | Copy test | IT (server reference; 'not a confirmation' copy) | — |
| CON-05 | Human follow-up and coordination | §5 | Ops | Admin queue | — | — | IT (coordinator queue) | — |
| CON-06 | Any commitment confirmed with patient first | §5 | Ops | Queue action requires patient-confirm record | — | — | IT (Confirmed requires recorded patient agreement) | — |
| CON-07 | Queue: status, priority, assignee, timestamps, next action | §5 | Ops | `/admin/concierge` | `concierge_enquiries` | — | IT | — |
| CON-08 | Statuses New → Contact Attempted → Contacted → Needs Clarification → Coordinating → Awaiting Patient → Confirmed → Closed, **plus Cancelled** | §5 | Ops | Queue | State machine | Illegal transition rejected | IT (all 9 statuses, legal transitions only) | — |
| CON-09 | Secure notes, contact history, consent records, checklist | §5 | Ops | Enquiry detail | `contact_attempts`, `notes` | — | IP (notes, contact attempts, history IT; service checklist NS) | — |
| CON-10 | Overdue escalation and reassignment | §5 | Ops | Queue | SLA timer (configurable) | — | IT (overdue flag + sort, reassignment; internal target via env) | OD-03 |
| CON-11 | Reports: response time, conversion, cancellations, quality | §5 | Admin | BI | — | — | IP (open/overdue/median first contact/by-status; conversion & quality NS) | — |
| CON-12 | No 24/7 claim unless configured | §5 | — | Copy | Config flag | Copy test | IT | — |
| CON-13 | Not a separate app; FMD doesn't provide treatment | §5 | — | Copy, IA | — | — | IT | — |
| CON-14 | Theme-aware premium identity (brief §7) | Brief | Patient | FMD Edge section | Tokens | Visual check in 7 themes | IT (visual, 3 themes) | — |

## 5. Clinic OS (§6)

| ID | Requirement | Src | Surface | Data | Status | Deps |
|---|---|---|---|---|---|---|
| CLN-01 | Registration, verification, profile, location, hours, services, rules, billing config | §6.1 | `/clinic/setup` | `clinics`, `branches` | IP (workspace create/claim, profile, hours, services, rules IT; verification via ops activation IT; billing config NS) | OD-08 |
| CLN-02 | Multiple branches with separated records/reporting | §6.1 | Branch switcher | `branch_id` scoping | NS | — |
| CLN-03 | Invite staff, assign roles, configure access, deactivate | §6.1 | Team | `org_members` | IT (email-bound single-use invites, roles, deactivate, last-owner guard) | — |
| CLN-04 | Comms channels, templates, language, escalation | §6.1 | Settings | `templates` | BX (messaging vendor OD-14) | OD-14 |
| CLN-05 | AI permissions, tools, approval thresholds, hours | §6.1 | AI settings | `ai_policies` | IP (AI on/off, recall rule, fixed approval policy IT; per-tool thresholds PD OD-06) | OD-06 |
| CLN-06 | Dashboard: today/next appointments, check-ins, cancellations, no-shows, pending | §6.2 | `/clinic` | — | IT | — |
| CLN-07 | Follow-up queue, incomplete-docs alerts, tasks | §6.2 | Dashboard | — | IP (recall due, incomplete notes, tasks IT; configurable follow-up queue NS) | — |
| CLN-08 | Collections and outstanding from recorded transactions | §6.2 | Dashboard | — | IT | — |
| CLN-09 | Inventory alerts, staff tasks, summaries; custom widgets; date/branch filters | §6.2 | Dashboard | — | IP (inventory alerts, tasks IT; custom widgets, branch filter NS) | — |
| CLN-10 | Patient registration, demographics, consent, duplicate detection | §6.3 | Patients | `patients` | IT (registration, consent, duplicate detection, merge with history) | — |
| CLN-11 | Patient timeline (appointments, docs, plans, comms, billing) | §6.3 | Patient 360 | — | IT (role-filtered timeline) | — |
| CLN-12 | Configurable clinical notes and structured fields | §6.3 | Notes | `clinical_notes` | IP (SOAP-style fields IT; clinic-configurable fields NS) | — |
| CLN-13 | Odontogram with tooth/surface notation and non-destructive history | §6.3 | Chart | `chart_entries` (append-only) | IT (FDI, append-only history) | OD-16 |
| CLN-14 | Itemised plan and estimate with patient acknowledgement | §6.3 | Plans | `treatment_plans`, `estimates` | IT (itemised, totals, discounts, acknowledgement note) | — |
| CLN-15 | Attachments with access controls | §6.3 | Patient docs | — | IT (patient files with access control + audit) | — |
| CLN-16 | Author, timestamps, amendment history; AI drafts need clinician acceptance | §6.3 | Notes | `note_versions` | IT (author, sign, versioned amendments, AI drafts need acceptance) | — |
| CLN-17 | Day/week/month views, provider calendars, chairs, types, durations | §6.4 | Calendar | `appointments`, `resources` | IP (day view, provider/chair/type IT; week/month views NS) | — |
| CLN-18 | Book, reschedule, cancel, block, waitlist, attendance | §6.4 | Calendar | — | IT (book, move, cancel, block, waitlist, attendance) | — |
| CLN-19 | Status lifecycle with actor attribution | §6.4 | — | `appointment_status_events` | IT (status events with actor) | — |
| CLN-20 | Policy-based reminders/confirmations respecting consent and opt-out | §6.4 | — | Notifications | BX (reminders need messaging vendor OD-14) | OD-14 |
| CLN-21 | Conflict checks, duplicate prevention, buffers, hours | §6.4 | — | DB exclusion constraint | IT (chair/provider/buffer/hours/FMD-hold conflicts) | — |
| CLN-22 | Estimates, invoices, receipts, adjustments, discounts, payments | §6.5 | Billing | `invoices`, `payments` | IT | — |
| CLN-23 | Multiple payment modes, partial payments | §6.5 | Billing | — | IT (cash/UPI/card/bank/other, partial) | — |
| CLN-24 | Outstanding, refunds, voids with permissions and audit | §6.5 | Billing | — | IT (refund/void need billing.refund, reason, audit; void needs refund first) | — |
| CLN-25 | Daily collection sheet, date-wise summaries | §6.5 | Reports | — | IT | — |
| CLN-26 | Clinic revenue separate from FMD revenue | §6.5, §14 | — | Separate ledgers | IT (clinic ledgers separate; never FMD revenue) | — |
| CLN-27 | Gateway only under an agreed settlement model; show merchant of record | §6.5 | — | — | PD | OD-04 |
| CLN-28 | Catalog, units, stock, reorder, suppliers, purchases | §6.6 | Inventory | `inventory_items` | IT | — |
| CLN-29 | Batch and expiry tracking | §6.6 | Inventory | `stock_batches` | IT | — |
| CLN-30 | Stock movements with reasons; low-stock/expiry alerts | §6.6 | Inventory | `stock_movements` | IT | — |
| CLN-31 | AI drafts PO; sending needs authorization | §6.6 | Inventory | `purchase_orders.status` | IT (AI drafts PO; owner approves) | — |
| CLN-32 | Staff profiles, duties, tasks, completion | §6.7 | Staff | `tasks` | IP (tasks, assignment, completion IT; staff profiles/duties NS) | — |
| CLN-33 | Handovers and checklists | §6.7 | Staff | — | IT | — |
| CLN-34 | Assignment, due dates, priority, escalation | §6.7 | Staff | — | IT | — |
| CLN-35 | AI task suggestions show source and allow review | §6.7 | Staff | — | IT (source | — |
| CLN-36 | Utilisation, cancel/no-show, recall, return metrics | §6.8 | Reports | — | IT (utilisation, cancellation, no-show, recall due) | — |
| CLN-37 | Collections, balances, procedure mix | §6.8 | Reports | — | IT | — |
| CLN-38 | Staff/branch summaries by permission | §6.8 | Reports | — | NS (branches NS) | — |
| CLN-39 | Export with date range and data scope | §6.8 | Reports | — | IT (CSV with range, permission, audit) | — |
| CLN-40 | Defined formulas; no estimates shown as audited | §6.8 | Reports | Metric dictionary | IT (definitions returned with every figure) | — |
| CLN-41 | Core usable when AI is down | §6 | All clinic | AI behind flag/circuit breaker | IT (AI off → Clinic OS unaffected; AI disable tested) | — |

## 6. Clinic AI manager (§7)

| ID | Requirement | Src | Surface | Data / control | Status | Deps |
|---|---|---|---|---|---|---|
| CAI-01 | Chat with context | §7.1 | `/clinic/ai` | `ai_conversations` | IP (instruction box + task cards IT; free conversation needs model OD-14) | OD-14 |
| CAI-02 | Voice with clear recording controls | §7.1 | AI | Speech adapter | BX (speech vendor OD-14) | OD-14 |
| CAI-03 | Task cards: request, plan, status, approvals, result, follow-up | §7.1 | Task card | `ai_tasks`, `ai_task_steps` | IT | — |
| CAI-04 | Scheduled and recurring tasks | §7.1 | Schedules | Job queue | IT (daily/weekly; run-due on request — queue worker NS) | — |
| CAI-05 | Manual run, review queue, history | §7.1 | — | — | IT | — |
| CAI-06 | Completed / partial / blocked / failed notifications | §7.1 | — | — | IT (completed/partial/blocked/failed/clarifying) | — |
| CAI-07 | Front-desk tasks (unconfirmed appts, drafts, gaps, reschedule options) | §7.2 | Tools | `tool:appointments.*` | IT (unconfirmed appointments, follow-up tasks, schedule gaps) | — |
| CAI-08 | Recall sheets using configured rules | §7.2 | Tools | `recall_rules` | IT (clinic recall rule) | — |
| CAI-09 | Payment sheets, missing entries; no autonomous money movement | §7.2 | Tools | Read-only finance tools | IT (read-only payment sheet, missing invoices) | — |
| CAI-10 | Content strategy and creation drafts; owner/clinical review | §7.2 | Tools | — | IP (content draft → approval → moderation IT; strategy calendar NS) | — |
| CAI-11 | FMD Main publishing via approval; patient-case consent | §7.2 | Tools | Publish needs approval | IT (publish needs approval; posts go to moderation) | — |
| CAI-12 | Patient comms drafts respecting consent/opt-out/templates | §7.2 | Tools | — | IT (templated drafts; consent re-checked at send) | — |
| CAI-13 | Reports with source, range, timestamp | §7.2 | Tools | — | IP (handover summary IT; weekly reports NS) | — |
| CAI-14 | Inventory review, PO drafts needing approval | §7.2 | Tools | — | IT | — |
| CAI-15 | Staff coordination without restricted-data leakage | §7.2 | Tools | Field-level redaction | IP (tasks without patient detail; redaction policy NS) | — |
| CAI-16 | Doctor assistant and wellbeing (not diagnosis) | §7.2 | Tools | — | PD | OD-11 |
| CAI-17 | Dental knowledge support with sources | §7.2 | Tools | Retrieval | NS | — |
| CAI-18 | Lifecycle Receive→Clarify→Plan→Authorize→Preview→Execute→Verify→Report→Audit | §7.3 | Task engine | State machine | IT (receive, clarify, plan, authorize, preview, execute, verify, report, audit) | — |
| CAI-19 | Autonomy/approval matrix (9 risk tiers) | §7.4 | Policy engine | `ai_policies` | IP (read/internal auto, external/publish approval, financial/clinical/appointment changes not available to AI; per-clinic thresholds PD OD-06) | OD-06 |
| CAI-20 | Orchestration across language, vision, speech, retrieval | §7.5 | Gateway | — | BX (model vendor OD-14) | OD-14 |
| CAI-21 | Typed, permission-checked tools; no raw DB access | §7.5 | Tool registry | Zod schemas | IT (typed tool registry; permission per tool; no raw DB access) | — |
| CAI-22 | Validation, timeouts, retries, idempotency | §7.5 | — | — | IP (validation, step idempotency by state; timeouts/retries NS until async queue) | — |
| CAI-23 | Model reasoning separate from deterministic rules | §7.5 | — | — | IT | — |
| CAI-24 | Retrieval over approved clinic material with access filters | §7.5 | — | — | NS | — |
| CAI-25 | Model fallback, cost/latency controls | §7.5, §7.7 | — | — | BX (model vendor) | — |
| CAI-26 | Prompt-injection defence: external content is data | §7.5, §13 | — | — | IT (instruction can't alter policy; tool output never re-enters planning) | — |
| CAI-27 | Queues for long jobs; safe cancellation; no silent partial changes | §7.5 | — | — | IP (no silent partial changes; failed step stops task; durable queue NS) | — |
| CAI-28 | Separate memories; inspect/delete; tenant isolation; retention | §7.6 | — | — | IP (tenant-scoped tasks; memory controls NS) | — |
| CAI-29 | Usage, latency, failures, cost per tenant; quotas and ceilings | §7.7 | — | `model_usage` | IP (tasks, tool calls, latency per clinic IT; cost tracking 0 until model; quotas PD OD-06) | OD-06 |

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
| ADM-01 | Platform dashboard (users, clinics, subs, bookings, content, FMD Edge, ops) | §9.1 | NS | — |
| ADM-02 | Verification queues, account status controls | §9.1 | IP (claim verification queue IT; student/company verification NS) | OD-08 |
| ADM-03 | Moderation queue, sponsored and ad management | §9.1 | IP (moderation queue IT; ads management NS) | — |
| ADM-04 | Plan catalog, entitlements, renewals, payment exceptions, support | §9.1 | NS | — |
| ADM-05 | FMD Edge oversight and assignment | §9.1 | IP (FMD Edge queue; full admin portal M5) | — |
| ADM-06 | Config, feature flags, service status, audit, alerts | §9.1 | NS | — |
| ADM-07 | Role/access admin with privileged logging | §9.1 | NS | — |
| ACC-01 | Independent routine accounting via self-service | §9.2 | NS | — |
| ACC-02 | Income ledgers: memberships, Clinic OS, ads, FMD Edge receipts | §9.2 | NS | — |
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
| PLT-01 | Common identity and verification; org invitations | §10 | IP (identity IT; org invitations NS) | — |
| PLT-02 | Entitlement service | §10 | IT (server-side entitlementsOf) | — |
| PLT-03 | Session management, device revocation, recovery | §10 | IT | — |
| PLT-04 | Search across providers, clinics, content, jobs with separate relevance | §10 | IP (providers IT; content/jobs search NS) | — |
| PLT-05 | Location permission only when needed; manual entry | §10 | IU (manual city select) | — |
| PLT-06 | Filtering, sorting, pagination, no-result suggestions | §10 | IT (filters, sort, pagination, no-result suggestions) | — |
| PLT-07 | Secure uploads: type/size validation, malware scan, access control | §10 | IP (type sniffing + size IT; malware scanning BX vendor) | OD-14 |
| PLT-08 | Media compression and transcoding | §10 | NS | — |
| PLT-09 | Signed, expiring links; lifecycle and retention | §10 | IP (signed expiring links IT; retention lifecycle NS) | — |
| PLT-10 | Payment abstraction, verified webhooks, transaction ledger | §10, §11.4 | BX | OD-04 / gateway creds |
| PLT-11 | Plans, recurring billing, renewals, grace, cancellation | §10, §14 | IP (catalog + manual activation with evidence; recurring billing BX gateway OD-04) | — |
| PLT-12 | Receipts, failed-payment recovery, refunds, reconciliation; idempotent | §10 | NS | — |
| PLT-13 | Content lifecycle draft→review→publish→archive→report | §10 | IP (draft→review→publish/reject/remove IT; edit/archive NS) | — |
| PLT-14 | Moderation actions, appeals, audit | §10 | IP (moderation actions + reasons + audit IT; appeals NS) | — |
| PLT-15 | Ad disclosure and sponsored controls | §10 | IT | — |
| PLT-16 | In-app help, issue reporting, ticket status, contextual help | §10 | IT (help centre, tickets, status, staff triage, metrics) | — |
| ARC-01 | Modular monolith with typed domain modules (§11.3 list) | §11 | NS | ADR-001 |
| ARC-02 | Versioned, documented APIs with errors and rate limits | §11.4 | IP (JSON errors, CSRF guard; versioning/docs NS) | — |
| ARC-03 | Webhook signatures and replay protection | §11.4 | NS | — |
| ARC-04 | Idempotency keys for payment, booking, task actions | §11.4 | NS | — |
| ARC-05 | Replaceable vendor adapters | §11.4 | NS | — |
| ARC-06 | Sandbox credentials and test environments | §11.4 | BX | Vendor accounts |
| ARC-07 | No secrets in clients or repos | §11.4 | IT | — |
| ARC-08 | Dev/staging/prod, CI/CD, rollback, migrations, secrets outside code | §11.6 | NS | Hosting |
| DAT-01 | ERD and data dictionary for all §12 entities | §12 | NS | — |
| DAT-02 | Health data logically and technically separated | §12 | NS | — |
| DAT-03 | Ownership, retention, deletion, export per entity | §12 | NS | — |
| SEC-01 | TLS and encryption at rest | §13 | BX | Hosting |
| SEC-02 | Password/OTP controls, MFA for privileged roles, revocation, brute-force protection | §13 | IP (OTP limits, attempt lockout, hashed codes/sessions IT; MFA for privileged roles NS) | — |
| SEC-03 | Server-side org/role authorization on every request | §13 | IT | — |
| SEC-04 | Audit logs (sensitive access, privileged, finance, AI) | §13 | IP (audit_events for auth, consent, roles, denials) | — |
| SEC-05 | Secret management, dependency scanning, incident response | §13 | NS | — |
| SEC-06 | Backups with tested restore; RPO/RTO | §13 | BX | Hosting |
| SEC-07 | Rate limits, validation, output encoding, OWASP | §13 | NS | — |
| PRV-01 | Privacy notices; purpose-specific consent | §13 | IP (draft notice in signup; legal text BX) | Legal |
| PRV-02 | Minimum data; purpose, access, retention, deletion rules | §13 | NS | — |
| PRV-03 | Access/export/deletion requests | §13 | IP (deletion request IT; export NS) | — |
| PRV-04 | Consent records for sharing and case publication | §13 | IP (record-sharing grants IT; case-publication consent NS) | — |
| PRV-05 | No training on patient records without authorization | §13, D | NS | — |
| PRV-06 | Vendor DPAs, cross-border transfer review | §13 | BX | Legal |
| SAF-01 | Clinical review of guidance and escalation language | §13 | BX | Clinical advisor |
| SAF-02 | Prevent prescriptions, guarantees, fabricated citations | §13 | IP (dosing/diagnosis guard IT; fabricated citations N/A for Main) | — |
| SAF-03 | Human review for notes, case publication, high-impact comms | §13 | NS | — |
| SAF-04 | Risk tiers; never imply emergency monitoring | §13 | IP (copy) | — |
| SAF-05 | AI threat controls: untrusted inputs, no permission expansion, confirmation, duplicate detection, override, minimal audit | §13 | IP (untrusted history text, no tools, rate limits IT; red-team suite NS) | — |
| LEG-01 | Indian legal, tax, privacy and regulatory review before launch | §13 | BX | Counsel |
| COM-01 | Price table (Free / ₹550 / ₹400 / ₹2,000 yr / ₹2,000 mo / Scholar ₹350 tentative / FMD Edge TBD) | §14 | IT (PRD §14 prices seeded; FMD Edge price not listed — undecided) | OD-05, OD-03 |
| COM-02 | Show price, tax, renewal, features, limits, refund terms pre-purchase | §14 | IP (price, GST note, renewal, features, limits shown; refund terms BX legal) | — |
| COM-03 | Distinct membership vs Clinic OS in catalog and receipts | §14 | IP (separate plan codes/products; receipts arrive with gateway) | — |
| COM-04 | Admin plans, coupons, grace, renewal notices | §14 | NS | — |
| COM-05 | Payment attempts, gateway refs, settlement, refunds, invoices | §14 | NS | — |
| COM-06 | Webhooks are payment truth; reconcile exceptions | §14 | NS | — |
| COM-07 | Treatment fees not FMD revenue unless contract says so | §14 | NS | OD-04 |
| COM-08 | Scholar usage shown before limits; no surprise stops | §14 | IT (meter shown; refusal at limit with upgrade path, no silent charge) | OD-05 |
| NOT-01 | Event matrix (appointment, change, renewal, FMD Edge, AI task, recall, security) | §15 | NS | OD-14 |
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
| NFR-08 | Lint, tests, API docs, ADRs | §17 | IP (lint, tsc, node:test suite) | — |
| NFR-09 | Logs, metrics, tracing, alerts, AI traceability, cost | §17 | NS | — |
| NFR-10 | Portability and exit paths | §17 | NS | — |

## 10. End-to-end journeys and QA (§18–20)

| ID | Journey / criterion | Src | Status |
|---|---|---|---|
| E2E-01 | Patient concern → guidance → discovery → slot → confirm → reminders → records | IP (discover → profile → slot → review → confirm → appointments IT; AI hand-off and reminders NS) | IP (demo UI path only) |
| E2E-02 | FMD Edge request → reference → coordinator → patient confirms → closed | IP (submit → coordinate → confirm → close IT at service level; patient-facing confirmation UI NS) | IP (submit only) |
| E2E-03 | Clinic AI recall → criteria → preview → approve batch → send → outcomes → summary | IT (ai.test: list → drafts → approval preview → honest not-sent report) | NS |
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
| ANX-C-08 | Report categories, queues, appeals, repeat-offender controls | C1 | IP (report categories + queue + decisions IT; appeals and repeat-offender controls NS) | — |
| ANX-D-01 | Personalisation for patients, dentists, students, clinics with listed controls | D | IP (patients: explicit interests/follows IT; dentist/student/clinic personalisation NS) | OD-18 |
| ANX-D-02 | Explicit preferences first; behavioural signals only with notice | D | IT (explicit preferences only; no behavioural signals) | — |
| ANX-D-03 | Inspect, correct, reset, disable; explain "why" | D | IT (per-item reason, edit, reset) | — |
| ANX-D-04 | Paid distinguishable; no sensitive inference for ads; no patient-record ad targeting | D | IT (sponsored labelled, unboosted; no records used) | — |
| ANX-D-05 | Evaluate relevance, diversity, freshness, repetition, fairness | D | NS | — |
| ANX-E-01 | 8 onboarding steps (lead → activation) | E | IP (create → ops activation with evidence IT; checklist, training, commercial setup NS) | — |
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
| ANX-H-01 | Help centre, guides, onboarding material, request form, history | H | IP (help centre + request form + history IT; clinic onboarding guides NS) | — |
| ANX-H-02 | Classification: area, severity, impact, clinic/branch, version, repro | H | IP (area, severity, impact IT; clinic/branch/version NS) | — |
| ANX-H-03 | Secure attachments with redaction guidance | H | IT (screenshot/PDF only, 5 MB, PII warning, requester+staff access) | — |
| ANX-H-04 | No unsupported SLAs or 24/7 promise | H | IT (no SLA or 24/7 promise in UI) | OD-19 |
| ANX-H-05 | Updates, workaround, resolution, closure, reopen; playbooks | H | IT (status updates, resolution summary, reopen within 14 days) | — |
| ANX-H-06 | Volume, first response, resolution, reopen, CSAT, root causes | H | IP (first response, reopen rate IT; CSAT, root causes NS) | — |
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

Evidence: `web/src/components/hero/Hero.tsx`, `hero/phases.ts`, `hero/phases.check.ts` (`npm test`), `app/globals.css` (hero block + `--earth-filter` tokens), assets `public/img/hero/{earth,mascot}.webp` cut from `Refrenece Image Mascot and Hero.jpeg`. Browser checks were headless Chrome screenshots at 1440×900 and 390×844, across 5 themes plus reduced motion.

| ID | Requirement | Implementation | Verification | Status |
|---|---|---|---|---|
| HERO-01 | Earth with surface detail, depth, atmosphere, curvature | `Earth` (photo band from reference) | Screenshots p=0…1 | IT (visual) |
| HERO-02 | Rim light attached to the Earth's edge; silver-white default | Lit-layer mask reveals the photo's own rim; `--earth-filter` per theme | Screenshots, 5 themes | IT (visual) |
| HERO-03 | Initial: headline, horizon, focused centre light; mascot and chat hidden | p=0 | Screenshot | IT (visual) |
| HERO-04 | Stage A: headline out, sky dims, core intensifies, light spreads symmetrically along the curve | `PHASES.title/core/spread`, glints on `rimY()` | Screenshots p=0.12, 0.25 | IT (visual) |
| HERO-05 | Mascot starts at 75–80% illumination, progress-tied | `REVEAL` | `phases.check.ts` | IT |
| HERO-06 | Supplied mascot rises from behind the horizon, 3D turn, settles, rim-lit | Clip box at rim apex; rotateY −38°→0; overshoot −25%→−21% | Screenshots p=0.36–0.55 | IT (visual) |
| HERO-07 | AI stage separate, never beside the mascot | Opacity keyframes | `phases.check.ts` overlap sweep | IT |
| HERO-08 | AI stage: identity, greeting, composer, voice where supported, prompts, safety line | `HeroAssistantStage` | CDP: prompt click → assistant answers; stage `inert` when hidden | IT |
| HERO-09 | Stage E reverse descent; clean release | Same keyframes reversed; finite 520vh section | Screenshots p=0.9, 1 | IT (visual) |
| HERO-10 | Reversible scrub; no timers; no per-scroll state | `useScroll`/`useTransform`; one boolean flips at 2 thresholds | Code review | IU |
| HERO-11 | Mobile simplified; reduced-motion still version | 340vh on mobile; `StaticHero` | 390px screenshots; emulated reduced motion | IT (visual) |
| HERO-12 | No heavy 3D dependency; old WebGL molar removed | `Tooth.tsx` deleted; no new deps | `package.json` | IT |
| HERO-13 | No horizontal overflow | Fixed pre-existing AiValue glow bleed | `scrollWidth == clientWidth` at 390px | IT |

**Known limits:** the mascot cutout comes from a 45 KB 1280×720 JPEG, so it is slightly soft with faint edge speckles on light themes. The 3D turn is a perspective rotation of a 2D cutout, not a 3D model. See OD-H1.

## 13. Milestone 2 evidence log

| Slice | Evidence | Verified by |
|---|---|---|
| 2.1 Platform foundation | `web/src/server/{db,migrations,http,auth}.ts`, `server/adapters/otp.ts`, `app/api/auth/*`, `app/api/me/*`, `app/signin`, `app/account`, `lib/me.ts` | `server/auth.test.ts` (11 tests: normalisation, signup/sign-in, attempt lockout, expiry, rate limit, single-use ticket, no self-assigned internal roles, anonymous/forged/revoked denial, role denial audited, consent separation and history, deletion request); curl flow against dev server; headless-Chrome signup → `/account` |
| 2.2 FMD Edge | `server/concierge.ts`, migration 2, `app/api/concierge/*`, `app/api/admin/concierge/*`, `components/sections/FMD Edge.tsx` (+ `.concierge-card` tokens), `app/admin/concierge`, account "Your FMD Edge requests" | `server/concierge.test.ts` (5 tests: consent/validation/reference, rate limit, patient vs coordinator access and own-data only, full lifecycle with illegal-jump/confirmation/outcome/terminal rules and audit, cancel/reassign/overdue ordering); headless-Chrome submit (CQ reference shown) and coordinator queue; screenshots in Silver, Amber and Pearl |
| 2.3 Discovery & profiles | migration 3, `server/providers.ts`, `server/seed.ts` (labelled demo directory), `lib/catalog.ts`, `app/api/providers/*`, `components/providers.tsx`, `sections/Dentists.tsx`, `sections/ProfileDrawer.tsx`, `app/dentists/[id]`, `app/admin/verification` | `server/providers.test.ts` (5 tests: filters + injection-safe allow-lists, verified-first ranking & no invented ratings, sponsorship never reorders organic, bounded pagination, claim → approval with recorded checks + denials); removed fabricated ratings, distances and dead Call/Directions buttons |
| 2.4 Booking | migration 4, `server/booking.ts`, `app/api/bookings/*`, `app/api/providers/[id]/availability`, `components/booking/BookingPanel.tsx`, `app/appointments` | `server/booking.test.ts` (7 tests: live vs request-only availability, explicit confirmation + idempotency, DB-enforced no double-booking + duplicate refusal, min-notice, fee/terms snapshot, atomic reschedule + cancel + history + 404 for others, clinic-scoped confirm/decline); headless-Chrome signup → slot → review → confirm → /appointments; production build |
| 2.5 Records | migration 5, `server/records.ts`, `server/adapters/storage.ts` (private dev store, HMAC links, content sniffing), `app/api/records/*`, `app/records`, homepage CTA (removed an untrue "encrypted" claim) | `server/records.test.ts` (5 tests: content/size/metadata validation and no storage keys to clients, session-bound expiring links incl. tamper and theft, explicit time-limited sharing with dentists on FMD only + revocation applying to issued links + access history, expired shares, delete + export); HTTP checks: disguised HTML refused, nosniff/no-store/sandbox CSP headers, cross-user link 403, form-encoded POST refused |
| 2.6 Assistant | migration 6, `server/adapters/ai.ts` (provider interface + labelled dev provider), `server/assistant.ts` (escalation, output guard, allow-listed actions, consent-gated storage, rate limit), `app/api/assistant/*`, `components/hero/Assistant.tsx` | `server/assistant.test.ts` (5 tests: urgent escalation, dosing/diagnosis guard, navigate-only actions incl. prompt-injection producing no booking, consent-gated storage + owner-only + delete + withdrawal, validation + rate limit); HTTP checks for urgent and injection messages; hero prompt → panel in headless Chrome |
| 2.7 Membership | migration 7 (plan catalog at PRD prices, subscriptions, usage counters), `server/membership.ts`, `app/api/me/membership`, `app/api/admin/memberships`, account Membership card | `server/membership.test.ts` (3 tests: catalog prices/tax note/pending decisions/Clinic OS separate/checkout unavailable, Scholar entitlement only via active student membership incl. no self-activation, evidence required, professional not assumed, expiry; usage meter + refusal at limit) |
| 2.8 Content, jobs, support | migrations 8–10, `server/content.ts`, `server/jobs.ts`, `server/support.ts`, `lib/help.ts`, `app/api/{feed,posts,follow,reports,jobs,support,admin/moderation,admin/support,me/interests}`, `app/explore`, `app/jobs`, `app/help`, `app/admin/moderation`, `app/admin/support`, live homepage Explore, footer/treatment dead links fixed | `server/content.test.ts` (6 tests: verified-only authoring + review gate, case-post consent gate, explainable feed + interests/follows/reset + staff-only sponsor, likes/saves/polls/comments, reports → removal + duplicates, jobs permission/label/expiry/renew/report removal); `server/support.test.ts` (3 tests: isolation, staff triage + internal notes + reopen window, attachment type/size/access); production build |
| 3.1–3.6 Clinic OS | migration 11, `server/clinic/{workspace,calendar,patients,billing,operations,router,seed}.ts`, `app/api/clinic/*`, `app/clinic/**` (dashboard, calendar, patients, patient record, billing, inventory, tasks, team, settings, reports), `app/admin/clinics` | `server/clinic/clinic.test.ts` (10 tests: workspace creation/invites/last owner/tenant 404, permission matrix incl. finance vs clinical and refunds, calendar hours/buffers/conflicts/transitions, publish-requires-activation + FMD request confirm + patient cancel sync, duplicate detection + merge, sign/amend/AI-acceptance, odontogram + plan totals/ack, billing numbering/overpayment/idempotency/void/collection sheet, inventory negative stock/expiry/PO approval/receive, dashboard role filtering + report definitions); headless-Chrome walkthrough as demo owner; production build |
| 3.7 Clinic AI manager | migration 12, `server/clinic/ai/{tools,planner,engine,routes}.ts`, `server/adapters/messaging.ts`, `app/clinic/[clinicId]/ai` | `server/clinic/ai/ai.test.ts` (5 tests: recall journey with consent-aware drafts, approval preview and honest "not sent"; instruction cannot bypass approval + rejection; per-tool permission blocks + approver permission + cross-clinic 404; inventory PO draft; clarify/cancel/disable/schedules/usage) |
