# FMD - Changes to the PRD

The PRD (`FMD_Master_PDR_Expanded_Revised.pdf`, 2 Oct 2026 + annex 4 Oct 2026) is still the product definition. This page lists **every deliberate difference** agreed since then, so the team doesn't build from the old wording. Each entry gives the PRD section, what it said, what we do now, who decided, and when.

**Last updated:** 9 Nov 2026

## Product changes

| # | PRD section | The PRD said | Now | Decided by · date |
|---|---|---|---|---|
| P1 | §6.6 Inventory and procurement; §7.2 "Inventory" agent tasks; §6.2 inventory alerts | FMD Clinic has inventory: items, stock, batches/expiry, movements, low-stock alerts, AI-drafted purchase orders | **Inventory is removed from FMD Clinic.** No sidebar item, no stock alerts on Home, no purchase-order AI tasks. | Owner · 9 Nov 2026 |
| P2 | §6.5 Billing and payments | Estimates, invoices, partial payments, outstanding balances, adjustments | **Full payment only.** Every bill is paid in full when it's raised; there are no part payments, dues or outstanding balances anywhere (Billing, Home, Patients). Recording a payment asks for **name, phone, patient ID, amount and mode** (UPI, Card, Cash, Net banking). Refunds and voids stay: owner only, with a reason kept on record. Treatment plans remain as estimates, not bills. | Owner · 9 Nov 2026 |
| P3 | §6.5 / §7.2 (future) | - | **Automatic billing (later, with FMD Manager):** after an appointment, the treatment is noted by FMD Manager or staff, and a bill is raised automatically with the patient's details pre-filled; staff only pick the payment mode. Clinics get "Raise bill" for completed appointments and treatments. | Owner · 9 Nov 2026 (future scope) |
| P4 | §4.10 Public AI interaction boundary | FMD Main's AI advises and navigates; it must not message providers, book or take actions for the patient | **FMD Main's assistant can act for the patient, with a tap to confirm.** It finds dentists, drafts messages and prepares bookings as cards; nothing is sent or booked until the patient taps **Send** or **Confirm**. This keeps §4.5's "explicit patient confirmation". | Owner · 9 Nov 2026 |
| P5 | §4.7 Content; §4.8 Dentist profiles | Feed, posts, profiles (no interaction model specified) | **FMD Main feels like Instagram:** dentist profiles with profile picture, counts, bio, highlights, Follow/Message/**Book**, and a post/reel grid; a Feed (stories + posts) and an Explore grid as two separate pages. Instagram's patterns only; FMD's own visual design. Verification and "Sponsored" labels stay as the PRD requires. | Client via owner · 9 Nov 2026 |
| P6 | §4.2 AI-first home | Assistant is the primary entry point | Kept, and made concrete: after sign-in, FMD Main opens on a **full-screen chat**, with a slim side rail for the other pages. Every page has one purpose. | Owner · 9 Nov 2026 |

## How it looks (design decisions not covered by the PRD)

| # | Decision | Decided by · date |
|---|---|---|
| D1 | Everything uses the landing page's dark theme (`obsidian-royal`), including FMD Clinic. The older build plan (§6.4) proposed a light Clinic theme; that is replaced. | Owner · 9 Nov 2026 |
| D2 | Clinic Home is "AI first": the FMD Manager briefing and approval cards on top, then four numbers, then next appointments and follow-ups. | Owner · 9 Nov 2026 |
| D3 | Calendar is a simple **agenda** (Morning/Afternoon/Evening, like booking a dine-in slot), with a **"By dentist"** showtimes-style view as an option. Not a Google-Calendar-style grid. | Owner · 9 Nov 2026 |
| D4 | Glass panels on laptops, solid panels on phones; larger, brighter text than the first mockups. | Owner · 9 Nov 2026 |
| D5 | Photos and videos for the Instagram-style screens come from free stock (Pexels, Unsplash) for now, stored compressed in the repo with credits; they're replaced with the client's media later. | Owner · 9 Nov 2026 |

## How it's built

| # | Decision | Decided by · date |
|---|---|---|
| B1 | Frontend first, on sample data; the backend comes after the UI is agreed (see `IMPLEMENTATION_ROADMAP.md`). | Owner · 9 Nov 2026 |
| B2 | Phases are shipped as PRs to `findmydentist/fmd-website`, each starting with approved mockups. Mockups and working notes are not committed. | Owner · 9 Nov 2026 |
| B3 | Demo sign-in with roles (owner, front desk, patient, dentist, student, company) and a profile menu on the homepage so visitors to the live site can explore every part. Sign-in accepts any phone number and shows the code on screen until real authentication exists. | Owner · 9 Nov 2026 |

## Unchanged and worth repeating

These PRD rules still apply and are built in:
- Signed clinical notes are never edited, only amended with a reason (§6.3).
- Anything that messages patients or changes bookings needs approval (§7.4).
- "Verified" shows only after real checks, and "Sponsored" is always labelled (§4.4).
- No AI diagnosis (§13).
- Clinic revenue is kept separate from FMD's own fees (§6.5).
- Figures are marked "operational, not audited" (§6.8).
