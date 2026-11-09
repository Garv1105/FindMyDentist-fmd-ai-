# FMD Main: build plan

**Source:** `FMD_Master_PDR_Expanded_Revised.pdf`, mainly §4 (FMD Main), §5 (Concierge), §10 (shared platform), §13–15 (safety, billing, notifications), §18–19 (journeys, QA) and Annex A, B, C, D, G, I, K.
**Written:** 9 Nov 2026. Replaces the M2 section of `IMPLEMENTATION_ROADMAP.md` for FMD Main. That roadmap predates the move to the FastAPI backend.
**Scope:** the FMD Main frontend in `web/`. The backend is FastAPI in `main-websie/server`, owned by the backend team. Admin, Accountant, Scholar and Clinic OS are out of scope here.

---

## 0. Progress

Each part has one of two backend states:
- **LIVE:** the FastAPI endpoint exists, and we call it through `src/lib/fmd.ts`.
- **DEMO:** no backend yet. We build the full UI on sample data in `src/sample/<part>.ts`, and the "API for the backend team" note in that part is the proposed contract.

| # | Part | Backend | Status |
|---|---|---|---|
| 1.1 | Sign up, log in, forgot password | LIVE | **Done** |
| 1.2 | Navigation entry and the signed-in app shell | – | **Done** |
| 1.3 | Account: profile, email, two-step, devices | LIVE | **Done** |
| 1.4 | Dentist profile | LIVE (partial) | **Done** |
| 1.5 | Account type and onboarding | DEMO | **Done** |
| 1.6 | Privacy and data: consents, communication preferences, export, deletion | DEMO | **Done** |
| 2.1 | Find a dentist (search) | DEMO | **Done** |
| 2.2 | Dentist and clinic profiles, claim a profile | DEMO | **Done** |
| 2.3 | Booking flow | DEMO | **Done** |
| 2.4 | My appointments | DEMO | **Done** |
| 3.1 | Digital records vault | DEMO | **Done** |
| 3.2 | Sharing and access history | DEMO | **Done** |
| 3.3 | Treatment journey (Annex B) | DEMO | **Done** |
| 3.4 | Warranty certificates and public verification (Annex A) | DEMO | **Done** |
| 4.1 | AI assistant: full chat | DEMO | **Done** |
| 4.2 | AI companion tools | DEMO | **Done** |
| 5.1 | Explore feed | DEMO | **Done** |
| 5.2 | Post detail, comments, reports | DEMO | **Done** |
| 5.3 | Create a post (dentists), consent gate, content import | DEMO | **Done** |
| 5.4 | Saved items and following | DEMO | **Done** |
| 6.1 | Concierge (FMD Edge): enquiry and status | DEMO | Not started (form exists, hidden) |
| 7.1 | Jobs: browse, detail, post, my postings | DEMO | Not started |
| 8.1 | Plans and membership | DEMO | Not started |
| 8.2 | Checkout, receipts, renewals, failed payments | DEMO | Not started |
| 9.1 | Notifications and preferences | DEMO | Not started |
| 9.2 | Help centre and support tickets | DEMO | Not started |
| 10.1 | Feedback and reviews (Annex G) | DEMO | Not started |
| 10.2 | Personalisation controls (Annex D) | DEMO | Not started |
| 10.3 | Referrals (Annex I), switched off by default | DEMO | Not started |
| 11 | Cross-cutting: legal pages, accessibility, localisation, analytics events, journey QA | – | Not started |

We work top to bottom, one part at a time. A part is ticked only once it meets §2 "Done for every part".

---

## 1. How we build

**Where code goes**
- Pages: `src/app/<route>/page.tsx`. A page is a thin wrapper around a client component and holds its `metadata`.
- Components: `src/components/main/<part>/`. Shared building blocks stay in `src/components/app/kit.tsx` and `Sheet.tsx`.
- Real API: `src/lib/fmd.ts` (`fmd()` plus typed helpers), reached through the `/api/v1` rewrite.
- Demo data: `src/sample/<part>.ts`. Every function is `async` and returns exactly the shape we propose for the API, following the clinic's `src/sample/clinic.ts`. Going live means replacing that one module's bodies with `fmd()` calls. Screens don't change.

**Look:** the same system as FMD Clinic: `app-glow` background, `Panel`, `Field`/`fieldCls`, `Button`/`ButtonLink`, `Tag` tones and `Notice`. Theme colours come only from CSS variables. Phone first: check at 390px wide first, then laptop.

**Labels that must never be faked (PDR §4.4, §4.7, §13)**
- Sample content shows a "Demo" tag.
- "Verified" appears only when the record says it was checked. "Sponsored" and "Featured" are always labelled, and look different from Verified.
- AI output carries "Educational guidance, not a diagnosis".
- Availability without a live schedule says "Clinic will confirm".

**Signed-in pages** redirect to `/login?next=<page>` when signed out. Use `useMe()`: `undefined` means loading and shows the page skeleton; `null` means signed out and redirects.

**Formats:** `en-IN` dates in IST, `₹` amounts with Indian digit grouping (₹1,00,000), mobile numbers shown as `+91 98765 43210`.

**Multi-step pages:** wrap the page in `<Fresh>` (`components/app/Fresh.tsx`). With `cacheComponents`, Next keeps a page's state when you leave it and restores it on return, so without `<Fresh>` a sign-in or onboarding flow would reopen at its last step with old details.

**Checks:** each part leaves one small `*.test.ts` for its real logic (filters, state machines, validation), run with `npx tsx --test`. Trivial UI doesn't need one.

---

## 2. Done for every part

- [ ] Every screen in the part exists, at 390px and laptop width.
- [ ] Loading, empty, error, success and recovery states (PDR definition of done).
- [ ] Keyboard-only use works, labels and focus are visible, errors are announced (`Notice` uses `role=alert`), and no status is shown by colour alone.
- [ ] Rules in the part's "Rules" list are enforced in the UI.
- [ ] DEMO parts: sample module in place, "Demo" labels shown, and the "API for the backend team" note is up to date.
- [ ] LIVE parts: tested against the real FastAPI backend (the Docker setup from 1.1).
- [ ] `tsc`, `eslint` and the tests pass. Progress table updated.

---

## 3. App structure

### 3.1 Routes

| Public | Signed in |
|---|---|
| `/` homepage, AI-first | `/account` and its sub-pages |
| `/login` `/register` `/forgot-password` | `/onboarding` |
| `/dentists` search, `/dentists/[id]`, `/clinics/[id]` | `/appointments`, `/appointments/[id]` |
| `/book/[dentistId]` (sign-in asked at the confirm step) | `/records`, `/records/[id]` |
| `/explore`, `/explore/[postId]` | `/journey`, `/journey/[id]`, `/certificates/[id]` |
| `/jobs`, `/jobs/[id]` | `/assistant` (full chat and history) |
| `/concierge` | `/explore/new`, `/saved` |
| `/plans` | `/jobs/new`, `/jobs/mine` |
| `/help`, `/help/[article]` | `/concierge/enquiries`, `/concierge/enquiries/[ref]` |
| `/verify/[code]` warranty check | `/membership`, `/checkout/[plan]`, `/billing` |
| `/terms` `/privacy` | `/notifications`, `/help/tickets`, `/help/tickets/[id]` |

### 3.2 Navigation
- **Homepage navbar:** keeps the section links. On the right, it shows "Log in" when signed out, or an avatar menu when signed in (Account, Appointments, Records, Log out). Controlled by `SHOW_ACCOUNT` in `src/toggle.ts`, so the live waitlist site doesn't expose unfinished parts until we switch it on.
- **App shell for every other page,** in the clinic's visual style:
  - Laptop: a top bar with the logo, Ask FMD AI, Find a dentist, Explore, Records and Appointments, and the avatar menu. The notifications bell is added with 9.1.
  - Phone: a top bar (logo, bell, avatar) and a bottom tab bar with Home (AI), Find, Explore, Records and Me.
  - Public pages use the same shell and show "Log in" in place of the avatar.

---

## 4. Parts

Each part lists: **PDR** references · **Screens** · **Workflow** · **Rules** · **States** · **Done when** · **API** (for DEMO parts, the contract we propose).

### Phase 1: Account foundation

#### 1.1 Sign up, log in, forgot password: LIVE, Done
Built in `src/components/auth/AuthForms.tsx`, against `/auth/*`: OTP sign-up, OTP or password login, two-step verification, reset with a proof token, refresh, logout. Gaps for later parts:
- account type (1.5)
- Terms and Privacy pages (11)
- a navigation entry (1.2)

#### 1.2 Navigation entry and app shell
- **PDR:** §4.1, §4.2 (AI is the main entry), K (consistent navigation).
- **Screens:** homepage navbar right side; `MainShell` (top bar, phone tab bar, avatar menu, bell placeholder); a signed-in route guard.
- **Workflow:**
  1. Signed out: "Log in" goes to `/login?next=<current page>`.
  2. Signed in: the avatar menu shows name and phone, Account, Appointments, Records, and Log out.
  3. Log out calls `/auth/logout` and returns to `/`.
- **Rules:** hidden behind `SHOW_ACCOUNT` until launch. If logging out fails, say so; the login cookies are HttpOnly, so only the backend can clear them.
- **Built:**
  - `components/main/MainShell.tsx` and `AccountMenu.tsx`
  - `app/(main)/layout.tsx` and a minimal `/account`
  - `useMe()` (one shared check per page load) and `useRequireMe()` in `lib/me.ts`
  - `SHOW_ACCOUNT` in `toggle.ts`, which is on in development
  - Links to parts not built yet show as "Soon". Flip `ready` in `MainShell.tsx` when each part lands.

#### 1.3 Account: LIVE
- **PDR:** §4.1, §10 (sessions, recovery), §13 (MFA, session revocation).
- **Screens:** `/account` with these sections:
  1. **Profile:** name, mobile (read-only), and from MeRead the year of birth, gender and city. The backend has no edit endpoint for these yet, so they show read-only and the gap is noted.
  2. **Email:** add, verify with a 6-digit code, remove (password asked).
  3. **Two-step verification:** start, verify the code, enable; disable (password asked).
  4. **Devices:** active sessions (device, place, last seen, "this device"), sign out one, sign out everywhere.
  5. **Membership:** a summary card linking to `/membership` (8.1).
  6. **Clinic workspaces:** the `workspaces` list from MeRead, each with "Open in FMD Clinic".
- **Workflow:** each section is a card with its own edit flow in a `Sheet`. Success shows a `Notice`, and the user data reloads (`authChanged()`).
- **Rules:** revoking the current session logs the user out. Sign out everywhere asks for confirmation first.
- **API (LIVE):**
  - `GET /auth/me`
  - `POST /me/email`, `POST /me/email/verify`, `DELETE /me/email`
  - `POST /me/mfa/start`, `POST /me/mfa`, `DELETE /me/mfa`
  - `GET /me/sessions`, `DELETE /me/sessions/{id}`, `POST /auth/logout-all`
- **Ask the backend team for:** `PATCH /me` (name, year of birth, gender, city); change password while signed in (today only the OTP reset exists); change mobile number (their phase C).
- **Built:** `components/main/account/Account.tsx`. Tested in a browser against the FastAPI backend:
  - add an email and verify it
  - two-step verification on, a second device logging in with password and code, then off (a wrong password is refused)
  - sign out one device (that device is sent to login)
  - remove the email
  - sign out everywhere
- **Behaviour to know:**
  - Changing a verified email replaces it on the backend as soon as the code is sent, so the sheet warns about it.
  - A wrong code or password is never retried. Only "Not authenticated" triggers a token refresh, so mistakes don't use up the user's OTP tries.
- **Left for later:**
  - membership card (comes with 8.1)
  - "Open in FMD Clinic" for `workspaces`: FMD Clinic still uses demo sign-in, so a real workspace can't open yet
  - profile editing (needs `PATCH /me`)

#### 1.4 Dentist profile: LIVE (partial)
- **PDR:** §4.8, §4.4 (verification versus promotion).
- **Screens:**
  - `/account/dentist`: council, registration number, qualifications, specialisation, and a verification status badge (Unverified, Pending, Verified, Rejected).
  - A public profile preview, which is DEMO: photo, about, clinic affiliations, services, languages and portfolio are not in the backend yet.
- **Workflow:**
  1. A dentist opens "I'm a dentist" from onboarding (1.5) or Account.
  2. They fill in council and registration and save (`PUT /me/dentist-profile`).
  3. The status shows "Unverified until FMD checks it".
  4. They complete the public profile fields (DEMO) and preview it.
- **Rules:** only show "Verified" when `verification_status` is verified, and say what was checked ("Registration checked with <council>"). No misleading claims.
- **API (LIVE):** `GET /me/dentist-profile` and `PUT /me/dentist-profile`.
- **Proposed API:**
  - `PUT /me/dentist-profile/public` with photo, about, years of experience, languages, services, clinic affiliations, consultation fee range
  - `POST /me/dentist-profile/documents` for registration proof
- **Built:**
  - `components/main/account/Dentist.tsx` at `/account/dentist`, plus a dentist-profile card on `/account`
  - Demo data in `sample/dentist.ts`, with `checkPublicProfile` and `checkDocument` (the rules the backend should copy), tested
- **Tested in a browser:**
  - registration saved through FastAPI
  - a wrong file type refused, a PDF accepted
  - photo resized in the browser
  - fee range in the wrong order refused
  - data kept after a reload
  - "Verified" shown with the council once FMD staff verify it (set in the test database)
  - changing the registration number warns, then resets to "Not verified yet"
  - a registration number already used by another account is refused by the backend (409)
- **Ask the backend team for:**
  - a staff endpoint to set `verification_status` (part of Admin)
  - uploading the proof document should move the status to "pending"

#### 1.5 Account type and onboarding: DEMO
- **PDR:** §4.1 (patient, dentist, student, dental company), §3 roles, §8.1 (student gets Scholar), §14 prices.
- **Screens:** `/onboarding`, shown once after sign-up:
  1. "What brings you to FMD?" with four cards: Patient (free), Dentist (₹550/yr), Student (₹400/yr, includes FMD Scholar), Dental company (₹2,000/yr).
  2. Step 2 depends on the type:
     - Patient: city and preferred language.
     - Dentist: goes to 1.4.
     - Student: college, course, year, student ID upload (eligibility check).
     - Company: company name, GSTIN (optional), website, contact person.
  3. Explains what each detail is used for, then finishes at Home, or at Plans for paid types.
- **Rules:** ask only for necessary details and explain sensitive-data use (§4.1). The type can be changed later from Account. Paid types stay usable as free accounts until payment (8.2).
- **Proposed API:**
  - `PUT /me/account-type` `{type}`
  - `PUT /me/student-profile`
  - `PUT /me/company-profile`
  - `POST /me/verification-documents`
  - `account_type` added to MeRead
- **Built:**
  - `components/main/onboarding/Onboarding.tsx` at `/onboarding`; demo data in `sample/onboarding.ts` (types, prices, `checkStudent`, `checkCompany` with GSTIN), tested
  - Sign-up now continues to `/onboarding`, keeping `?next=` and `?as=`; the homepage's "Join as a student" opens it with Student chosen
  - "Account type" card on `/account`: shows the type, its price, "works as a free account until paid", and Change
- **Paths:**
  - Patient: city and language, then on to where they were going
  - Dentist: straight to `/account/dentist` (1.4)
  - Student or company: details, then a "You're all set" screen explaining the membership
  - Every details step can be skipped
- **Tested in a browser:**
  - sign-up through to student onboarding
  - a GIF student ID refused
  - a wrong GSTIN refused
  - changing type starts from the current one
  - all four paths

#### 1.6 Privacy and data: DEMO
- **PDR:** §4.1, §13 (consent, export, deletion), L (purpose-specific consent).
- **Screens:** `/account/privacy`
  - Consents, each with what it covers, when it was given, notice version, and withdraw/give:
    - terms and privacy notice (required)
    - offers and marketing
    - AI conversation history
    - personalisation
  - Communication preferences per channel (SMS, WhatsApp, email, push) and per kind (appointments, reminders, account security, offers), plus quiet hours.
  - Download my data: request, then "ready", then a download link.
  - Delete my account: explains what is deleted and what must be kept by law, confirms by OTP, then shows "request received" and its status.
- **Rules:** required consents can't be withdrawn without deleting the account. Security messages can't be switched off. Marketing is off by default.
- **Proposed API:**
  - `GET /me/consents`, `POST /me/consents/{purpose}` `{granted}` (the backend already stores consents)
  - `GET` and `PUT /me/communication-preferences`
  - `POST /me/data-export`, `GET /me/data-export`
  - `POST /me/deletion-request`, `GET /me/deletion-request`, `DELETE /me/deletion-request` (cancel)
- **Built:** `components/main/account/Privacy.tsx` at `/account/privacy`, linked from `/account`. Demo data in `sample/privacy.ts`, which holds the rules and is tested:
  - required consents can't be withdrawn
  - withdrawing marketing switches every offers channel off
  - keep at least one appointment channel
  - email only with a verified email
  - the security row is fixed
  - quiet hours need different start and end times
  - the export link expires after 7 days
- **Tested in a browser:**
  - each consent rule
  - offers locked until marketing consent
  - email locked without a verified email
  - the save errors
  - export from preparing, to ready, to a real JSON download
  - deletion: checkbox gate, wrong code refused, request received, cancelled
- **Ask the backend team for:**
  - the consent endpoints. The backend already stores consents at sign-up (terms, privacy notice, and offers when ticked), but there's no way to read or change them. The demo assumes offers were not ticked.
  - an OTP purpose for confirming account deletion. The demo shows a pretend code.
- **Needs a decision from FMD and legal:** how long deletion takes, and exactly which records are kept and for how long. The page avoids promising either.

### Phase 2: Find and book

#### 2.1 Find a dentist: DEMO
- **PDR:** §4.4, §10 (search and discovery).
- **Reuse:** `sections/Dentists.tsx` (cards, filters), `lib/catalog.ts` (specialties and services), `lib/districts.ts`.
- **Screens:** `/dentists`
  - A search box: concern, treatment, dentist or clinic name.
  - Location: "Use my location" (asks permission only on tap) or type a city or area.
  - Filters: specialty, service, available today or this week, language, fee range, gender, distance.
  - Sort: relevance, distance, earliest slot.
  - Result cards: photo, name, specialty, experience, clinic, area and distance, languages, next slot or "Clinic will confirm", fee range, and Verified or Sponsored tags.
  - Pagination ("Show more"), suggestions when nothing matches, and a map toggle later.
- **Workflow:**
  1. Arrive from the homepage, the assistant ("Find an endodontist near me" opens this page with filters already set), or the navbar.
  2. Filter and sort, then open a profile (2.2) or tap a slot (straight into 2.3).
- **Rules:**
  - Sponsored results are labelled and kept apart from organic ranking.
  - Matching is informational: "Suggestions are based on what you told us; they're not a diagnosis."
  - Filters live in the URL, so results are shareable and the back button works.
- **Proposed API:** `GET /providers?q&loc&lat&lng&within&specialty&service&language&available=today|week&fee_max&gender&sort=relevance|distance|soonest&page` returns `{items, sponsored, total, page, pages, suggestions}`. The full contract is in `sample/providers.ts`.
- **Built:**
  - `components/main/dentists/Search.tsx` at `/dentists`; "Find a dentist" and "Find" in the app shell are now live
  - Demo directory and search in `sample/providers.ts`: 19 fictitious dentists in 14 clinics across 6 cities, every one labelled Demo
  - Plain-language concerns ("bleeding gums", "crooked teeth") map to the right specialists
  - Ranking: verified dentists first, then the strength of the match. A sponsored dentist is shown at most once per page, apart from the ordinary results and never repeated in them; it must match the filters too.
  - Availability shows only for clinics with a connected schedule; the rest say "Clinic will confirm a time"
  - "Use my location" asks only when tapped; the position in the URL is rounded to about 100 m
  - The rules are covered by 8 tests
- **Tested in a browser:**
  - the default list and "Show more"
  - a plain-language search
  - city plus specialty, and removing a filter chip
  - near me with a distance filter
  - available today
  - the no-results help
  - the phone filters sheet


#### 2.2 Dentist and clinic profiles, claim a profile: DEMO
- **PDR:** §4.4, §4.8.
- **Reuse:** `sections/ProfileDrawer.tsx`.
- **Screens:**
  - `/dentists/[id]`:
    - header with photo, name, verification line, specialties, experience and languages
    - about and qualifications
    - clinics with hours, address, map link and phone
    - services with fee ranges
    - availability strip
    - posts (from 5.1), reviews summary (10.1)
    - "Book" and "Save"
    - "Is this you? Claim this profile"
  - `/clinics/[id]`: photos, dentists at the clinic, services, hours, facilities and booking.
  - Claim flow: identity, registration number, proof upload, then "We'll review this. Status: Pending."
- **Rules:** verification shows what was actually checked. Unclaimed profiles say "Listed by FMD from public information".
- **Proposed API:**
  - `GET /providers/{id}`, `GET /clinics/{id}`
  - `POST /providers/{id}/claim`, `GET /me/claims`

#### 2.3 Booking flow: DEMO
- **PDR:** §4.5, §18 journey "concern to appointment", §11.4 (idempotency).
- **Reuse:** `booking/BookingPanel.tsx`.
- **Screens:** `/book/[dentistId]?clinic=&slot=`. The steps:
  1. Clinic and appointment type (consultation, cleaning, and so on, with durations).
  2. Day and time (live slots, or "request a time, clinic will confirm").
  3. Who it's for (me, or a family member: name and age).
  4. Reason or notes (optional, minimal health data).
  5. Review: dentist, clinic, address, date and time in IST, fee or fee range, payment at clinic or online, cancellation terms.
  6. Explicit "Confirm booking" button.
  7. Result: Confirmed, or "Requested: the clinic will confirm".
  8. Add to calendar, and link to My appointments.
- **Workflow:** sign-in is asked at step 5 if needed, keeping everything already entered.
- **Rules:**
  - Nothing is booked without the final explicit confirm (§4.5). The AI never books.
  - Each request gets a unique key, so a double tap doesn't create two bookings.
  - These cases each show a clear message and a next step: slot just taken (pick another, nothing charged), duplicate booking (link to the existing one), clinic changed the time, payment failed.
  - The clinic's buffers and booking rules decide which slots are offered.
- **Proposed API:**
  - `GET /providers/{id}/availability?clinic&from&to` returns `{mode: "live"|"request", slots: [{id, start, minutes, type}]}`
  - `POST /bookings` with an `Idempotency-Key` header, body `{slot_id|requested_window, clinic_id, type, for, notes}`, returns `Booking`
  - Booking statuses: `requested` → `confirmed` → `completed`. Also `cancelled_by_patient`, `cancelled_by_clinic`, `rescheduled` and `no_show`.

#### 2.4 My appointments: DEMO
- **PDR:** §4.5, §15 (reminders), B (journey).
- **Screens:**
  - `/appointments`: Upcoming and Past tabs, each card with a status tag.
  - `/appointments/[id]`:
    - status timeline (requested, confirmed, reminders sent, completed)
    - clinic details, directions and call
    - reschedule (pick a new slot, same review and confirm), cancel (shows the terms and asks to confirm)
    - documents from the visit (link to 3.1), "Leave feedback" after the visit (10.1)
    - support contact
- **Rules:** the status shown is the backend's, never one the browser invents. Cancellation terms are shown before confirming.
- **Proposed API:**
  - `GET /me/bookings?scope=upcoming|past`, `GET /bookings/{id}`
  - `POST /bookings/{id}/cancel`, `POST /bookings/{id}/reschedule` (both with `Idempotency-Key`)

### Phase 3: Records and treatment journey

#### 3.1 Digital records vault: DEMO
- **PDR:** §4.6, §10 (media and documents), §13.
- **Reuse:** the homepage `sections/Records.tsx` look.
- **Screens:**
  - `/records`:
    - storage used and limit
    - "Upload" button
    - filters: type (report, X-ray, photo, treatment plan, prescription, invoice, other), clinic, dentist, date range, treatment episode
    - grid or list view
  - Upload sheet: pick files, then for each file a type, date, clinic, optional episode and a note. Progress bar per file, with clear errors for wrong type, too large, or limit reached.
  - `/records/[id]`: preview (image zoom, PDF viewer), details, download, edit details, move to an episode, delete (asks to confirm), share (3.2), access history (3.2).
  - Export all: request, then a "ready" notice, then download.
- **Rules:** files open only through short-lived links, never a raw storage URL (§4.6). The AI summary from 4.2 is offered on reports and labelled as AI.
- **Proposed API:**
  - Upload in three steps: `POST /records/upload-url` returns a short-lived upload URL, the browser uploads the file to storage, then `POST /records` saves the file's details.
  - `GET /records?type&clinic&provider&from&to&episode`, `GET /records/{id}`, `PATCH /records/{id}`
  - `GET /records/{id}/link` returns `{url, expires_at}`
  - `DELETE /records/{id}`, `POST /records/export`, `GET /me/storage`

#### 3.2 Sharing and access history: DEMO
- **PDR:** §4.6, §13 (record consent), B (closure and continuity).
- **Screens:**
  - Share sheet: choose a dentist or clinic (search), choose the records, set expiry (7 days, 30 days, until revoked), add a note, then confirm.
  - `/records` "Shared" tab: active shares with who, what, expiry and "Revoke".
  - Access history per record: who opened it and when.
- **Rules:** sharing is always explicit, specific to chosen records, and can be revoked. Revoking takes effect immediately.
- **Proposed API:**
  - `POST /records/shares` `{provider_id|clinic_id, record_ids, expires_at}`
  - `GET /me/shares`, `DELETE /shares/{id}`
  - `GET /records/{id}/access-events`

#### 3.3 Treatment journey: DEMO (Annex B)
- **PDR:** Annex B, §4.3 (organise treatment plans), §18.
- **Screens:**
  - `/journey`: one card per treatment episode (for example "Root canal, upper left molar · Smile Studio"), with its stage.
  - `/journey/[id]`: a timeline through these stages:
    1. discover
    2. consultation
    3. estimate and plan, with versions and an "acknowledge" button
    4. consent status
    5. visits (completed and upcoming)
    6. documents and invoices
    7. payment status
    8. warranty (3.4)
    9. recall and follow-up
    10. closure
    - Each step shows status (planned, scheduled, completed, waiting for you, cancelled) and the next action.
- **Rules:**
  - Only what the clinic released is shown. The clinic's record is the source of truth.
  - Acknowledging a plan in the app is not legal or clinical consent. Say so.
  - Payment status comes from the backend, never guessed.
- **Proposed API:**
  - `GET /me/journeys`, `GET /journeys/{id}` returns the stages and events
  - `POST /journeys/{id}/plans/{plan_id}/acknowledge`

#### 3.4 Warranty certificates: DEMO (Annex A)
- **PDR:** Annex A.
- **Screens:**
  - Certificates list inside `/records` (its own type) and inside the journey.
  - `/certificates/[id]`:
    - certificate number
    - clinic as issuer, treating dentist
    - treatment and tooth or site, treatment date, issue date, valid until
    - covered items, exclusions, conditions, required follow-ups
    - status: active, expired, amended, voided or disputed
    - version history
    - QR code, download PDF, "Contact the clinic about this" link
  - `/verify/[code]` (public): shows the certificate is real, its status, clinic, treatment category and validity, with no patient details.
- **Rules:**
  - The clinic is the issuer. FMD shows the terms exactly as issued and never adds to or interprets them.
  - Exclusions and conditions are as prominent as coverage.
  - Corrections show as new versions.
- **Proposed API:** `GET /me/certificates`, `GET /certificates/{id}`, `GET /certificates/verify/{code}` (public, minimal fields).
- **Built (all of Phase 3):**
  - `components/main/records/` and `sample/records.ts`, `files.ts`, `journeys.ts`, `certificates.ts`, with 9 tests
  - Routes: `/records`, `/records/[id]`, `/journey`, `/journey/[id]`, `/certificates/[id]`, and the public `/verify/[code]`
  - File contents are kept in the browser's IndexedDB. Every view or download goes through a link that expires after 5 minutes, and each one is logged.
  - "Download everything" makes a ZIP using fflate, which ships with `three`.
  - Tested in a browser, end to end.
- **Not done:** the certificate QR code. It needs a QR library (e.g. `uqr`), and installing one was blocked. Until then the page shows the code and a "Copy check link" button.

### Phase 4: AI assistant

#### 4.1 AI assistant, full chat: DEMO
- **PDR:** §4.2, §4.10, §13 (clinical and AI safety), §18.
- **Reuse:** `hero/Assistant.tsx` and the mascot, now on the homepage with the "coming soon" reply.
- **Screens:**
  - Homepage entry, as today.
  - `/assistant`:
    - conversation list (history); new chat
    - message thread
    - input with text, microphone (voice), and attach image or document
    - language switcher: English, हिन्दी, తెలుగు, ಕನ್ನಡ, தமிழ்; mixed-language input allowed
  - Each reply can carry:
    - plain-language explanation
    - "Educational guidance, not a diagnosis"
    - sources when available
    - suggested next steps as buttons ("See endodontists near you", "Book a check-up", "Save to records")
  - A clear "urgent" card for concerning symptoms: reviewed escalation text, "Contact a dentist or emergency care now", and a call button.
  - Feedback per reply (helpful or not helpful).
- **Rules:**
  - It never diagnoses or prescribes, and its wording admits uncertainty (§4.2).
  - The AI only navigates. Buttons open our pages with details pre-filled, and the user confirms there. It never books, messages, submits or pays (§4.10).
  - History is saved only with the AI-history consent (1.6), and can be deleted.
  - Voice recording shows a clear "recording" state and can be stopped.
  - Uploaded files are treated as data, never as instructions.
- **Proposed API:**
  - `POST /assistant/messages` `{conversation_id?, text, language, attachment_ids?}` returns `{conversation_id, reply: {text, sources[], actions[{type:"navigate", label, target, params}]}, urgent: bool, stored: bool}`
  - `GET /assistant/conversations`, `GET /assistant/conversations/{id}`, `DELETE /assistant/conversations/{id}`
  - `POST /assistant/feedback`, `POST /assistant/speech-to-text`

#### 4.2 AI companion tools: DEMO
- **PDR:** §4.3.
- **Screens:** opened from the assistant or from Records and Journey:
  - **Treatment budget worksheet:** add procedures and estimates (typed in by the user, or from a clinic estimate), discounts and insurance part, with a total. Labelled "Estimate, not a quote". Save and export.
  - **Insurance explainer:** upload a policy or claim document. Gives a plain summary of what it says, which documents a claim usually needs, and a checklist. Labelled "We can't confirm coverage or approval".
  - **Report summary:** on any report in Records. A plain-language summary, its limitations, and "Discuss with your treating dentist".
  - **Reminders and checklists:** brushing and flossing, aligner changes, post-treatment care, next check-up. All created and controlled by the user; it never implies FMD is monitoring them.
  - **Dental history:** past treatments, allergies, medicines, preferences. Consent-gated, editable and deletable.
- **Proposed API:**
  - `POST /assistant/tools/{budget|insurance|report-summary}`
  - `GET` and `POST /me/reminders`
  - `GET` and `PUT /me/dental-history`
- **Built (all of Phase 4):**
  - `/assistant`: chat with saved chats (only with the AI-history consent), files, voice and a language switch. Voice uses the browser's own speech recognition.
  - `/assistant/tools/[budget|insurance|reminders|history]`, plus a report summary on report and plan records
  - `sample/assistant.ts` and `companion.ts`, with 7 tests. Answers come from the reviewed rule set in `server/adapters/ai.ts`.
  - The safety rules moved to `lib/aiSafety.ts`, so every answer, from the demo or a future model, goes through the same checks: urgent symptoms escalate, no dosing, no diagnosis, disclaimer always present.
  - Reply buttons are navigation only, from an allow-list of FMD pages.
  - The homepage assistant is unchanged (still in "coming soon" mode); "Ask FMD AI" in the app shell opens `/assistant`.
- **Demo limits, said plainly in the UI:**
  - replies are in English only
  - uploaded files aren't read
  - summaries only exist for the demo clinic's documents

### Phase 5: Explore and professional presence

#### 5.1 Explore feed: DEMO
- **PDR:** §4.7, Annex D.
- **Reuse:** `content/FeedCard.tsx`, `sections/Explore.tsx`.
- **Screens:**
  - `/explore`: tabs For you, Following, Learn and Reels.
  - Post types: video or reel, image post, article, poll.
  - "Why am I seeing this?" on each card (Annex D).
  - Content related to the user's last search appears near the top.
  - General education is mixed in, so the feed isn't only past searches.
  - Sponsored posts are labelled.
- **Rules:** personalisation uses declared interests first; behaviour signals only with consent (D). Sponsored never looks like organic.
- **Proposed API:** `GET /feed?tab&cursor` returns `{items: FeedItem[], next_cursor}`, where each `FeedItem` has a `reason` and a `sponsored_by`.

#### 5.2 Post detail, comments, reports: DEMO
- **PDR:** §4.7, §10 (content and moderation), Annex C1.
- **Screens:**
  - `/explore/[postId]`: full post, video player with captions, author card with Follow, like, save, share, comments (add, delete own).
  - Report sheet with categories: misinformation, misleading claim, privacy or consent, harassment, spam, copyright, inappropriate, other. Then "Thanks, we'll review it".
- **Proposed API:**
  - `GET /posts/{id}`
  - `POST`/`DELETE /posts/{id}/reactions`
  - `GET`/`POST /posts/{id}/comments`
  - `POST /posts/{id}/vote`
  - `POST /reports` `{target_type, target_id, category, note}`

#### 5.3 Create a post (dentists): DEMO
- **PDR:** §4.7, §4.8, Annex C (content import), §13 (case consent).
- **Screens:** `/explore/new`, for verified dentists and companies only:
  1. Post type.
  2. Media: upload, or import by link from a supported platform (embed with attribution where allowed).
  3. Caption, tags (specialty, topic), alt text, captions file.
  4. "Does this show a patient or a real case?" If yes: patient consent record required (upload or select), plus a de-identification checklist.
  5. Ownership declaration.
  6. Preview.
  7. Submit for review or schedule; then status: Draft, In review, Published or Rejected (with reason).
- **Rules:**
  - No identifiable patient case can be submitted without documented consent (§4.7).
  - Imports use official sharing or embedding only, with source and attribution kept (C).
- **Proposed API:**
  - `POST /posts` (draft), `PATCH /posts/{id}`, `POST /posts/{id}/submit`
  - `POST /posts/import-preview` `{url}`
  - `GET /me/posts`

#### 5.4 Saved items and following: DEMO
- **Screens:** `/saved` with tabs for posts, dentists and jobs, plus a "Following" list with unfollow.
- **Proposed API:** `GET /me/saves?type`, `POST`/`DELETE /saves`, `GET /me/following`, `POST`/`DELETE /follows/{dentist_id}`.
- **Built (all of Phase 5):**
  - Pages: `/explore` (For you, Following, Learn, Reels), `/explore/[postId]`, `/explore/new`, `/explore/mine`, `/saved`
  - `sample/content.ts`, with 6 tests
  - Every card has "Why am I seeing this?". One sponsored post sits third, labelled as paid, and never appears in Following.
  - A dentist search shapes the feed only with the personalisation consent; the search page records searches through `noteSearch`.
  - Poll results show only after you vote.
  - Reports need a reason.
  - Posting is for verified dentists only. Patient cases need documented consent and all four privacy checks. Links are allowed from YouTube, Instagram and LinkedIn only, with the creator credited. Posts go through review, then are published or scheduled, and a rejected post shows its reason.
- **Demo limit:** a dentist's own uploaded image or video isn't stored, so a published image or video post shows text only. Linked posts and articles are complete.

### Phase 6: Concierge (FMD Edge)

#### 6.1 Concierge enquiry and status: DEMO
- **PDR:** §5, §15, §18 journey "Concierge request".
- **Reuse:** `sections/Concierge.tsx` (the hidden form) and `lib/concierge.ts`.
- **Screens:**
  - `/concierge`: what the service is, the cities and areas it covers, how it works (you ask, we call you, we coordinate, you confirm), response expectations without promising 24/7, and the terms.
  - Enquiry form:
    - contact preference and best time
    - area
    - dental-care need
    - preferred timing
    - optional notes
    - an explanation of how the data is used and who may contact you
  - Confirmation: reference number and "We've received your request. This isn't a confirmed appointment yet."
  - `/concierge/enquiries` and `/concierge/enquiries/[ref]`: a status timeline (New, Contact attempted, Contacted, Needs clarification, Coordinating, Awaiting you, Confirmed, Closed, Cancelled), messages from the coordinator, "Cancel my request", and any proposal to accept or decline.
- **Rules:**
  - Collect only necessary health information.
  - Every clinic, fee, transport or plan proposal needs the patient's explicit OK before it's final.
  - FMD coordinates; it doesn't treat.
- **Proposed API:**
  - `GET /concierge/config`
  - `POST /concierge/enquiries` returns `{reference}`
  - `GET /me/concierge/enquiries`, `GET /concierge/enquiries/{ref}`
  - `POST /concierge/enquiries/{ref}/cancel`, `POST /concierge/enquiries/{ref}/proposals/{id}/respond`

### Phase 7: Jobs

#### 7.1 Jobs: DEMO
- **PDR:** §4.9.
- **Screens:**
  - `/jobs`: search, plus filters for role (associate, consultant, assistant, hygienist, receptionist, intern), city, type (full time, part time, locum), experience, and salary range.
  - `/jobs/[id]`: role, clinic or company, location, requirements, salary if given, how to apply (external link, email or phone), posted and expiry dates, report. Notice: "FMD hasn't verified this employer" unless verified.
  - `/jobs/new` (clinic owners, companies and verified dentists): the form, a preview, then publish.
  - `/jobs/mine`: active, expired and closed postings, with renew, edit and close.
- **Rules:** postings expire (30 days by default) and can be renewed. Never imply FMD has verified an employer.
- **Proposed API:** `GET /jobs?q&role&city&type&page`, `GET /jobs/{id}`, `POST /jobs`, `PATCH /jobs/{id}`, `POST /jobs/{id}/renew`, `POST /jobs/{id}/close`, `GET /me/jobs`.

### Phase 8: Plans and payments

#### 8.1 Plans and membership: DEMO
- **PDR:** §4.1 (membership screen), §8.1, §14.
- **Screens:**
  - `/plans`: one card per type. Patient free; Dentist ₹550/yr; Student ₹400/yr, which includes FMD Scholar; Company ₹2,000/yr. Each card shows features, limits, tax treatment and renewal.
  - `/membership`:
    - current plan, status (active, grace period, expired), renewal date
    - benefits
    - usage allowance with a meter (for students, the Scholar allowance and the optional extra ₹350, marked "tentative")
    - renew and cancel
- **Rules:**
  - Price, tax, renewal frequency, features, limits and refund terms are shown before purchase (§14).
  - FMD Main membership is kept separate from the Clinic OS subscription.
  - Limits are shown before the user hits them, so there are no surprise stops.
- **Proposed API:** `GET /plans`, `GET /me/membership` returns `{plan, status, renews_at, grace_until, usage: [{feature, used, limit, resets_at}]}`.

#### 8.2 Checkout, receipts, renewals, failed payments: DEMO
- **PDR:** §10 (payments), §14, §15.
- **Screens:**
  - `/checkout/[plan]`: review (plan, price, GST, total, renewal, refund terms), then pay. The gateway (Razorpay, PayU or similar) is simulated in the demo, then the result screen.
  - `/billing`: payments and receipts (download), failed payments with "Retry", and an auto-renew toggle.
- **Rules:**
  - Payment state comes only from the backend, which confirms it from the gateway's notification. A redirect back from the gateway alone counts as "Pending".
  - A double tap can't charge twice.
- **Proposed API:**
  - `POST /checkout` `{plan_id}` with `Idempotency-Key` returns a gateway order
  - `GET /payments/{id}`, `GET /me/payments`, `GET /me/invoices/{id}/pdf`
  - `POST /me/membership/cancel`

### Phase 9: Notifications and help

#### 9.1 Notifications: DEMO
- **PDR:** §15.
- **Screens:**
  - Bell panel and `/notifications`. Kinds: booking changes, reminders, Concierge updates, payment due or failed, security events, replies to my posts.
  - Mark read, mark all read.
  - Each one opens the related page.
- **Rules:** no clinical details in notification text (§15). Preferences live in 1.6.
- **Proposed API:** `GET /me/notifications?cursor`, `POST /me/notifications/read` `{ids|all}`.

#### 9.2 Help centre and support tickets: DEMO
- **PDR:** §10 (support), Annex H (applies to patients too).
- **Screens:**
  - `/help`: search, topics (account, booking, records, payments, AI, privacy), articles.
  - "Contact support" form: topic, description, optional screenshot, with a warning not to include health details.
  - `/help/tickets` and `/help/tickets/[id]`: status, messages, reopen.
  - Context-aware "Get help" links on failed booking, payment, upload and AI screens, which open the form already filled in.
- **Proposed API:** `GET /help/articles?q&topic`, `GET /help/articles/{slug}`, `POST /support/tickets`, `GET /me/tickets`, `GET /support/tickets/{id}`, `POST /support/tickets/{id}/messages`.

### Phase 10: Trust and growth (Annex)

#### 10.1 Feedback and reviews: DEMO (Annex G)
- **Screens:**
  - After a completed appointment: an invitation with structured ratings (getting an appointment, communication, environment, overall) and a comment.
  - A clear choice: "Private to the clinic" or "Public review".
  - Dentist profile reviews tab: verified-visit badge, clinic responses, report a review.
- **Rules:**
  - Only verified visits can post public reviews.
  - Never ask for clinical outcome scores.
  - Disclose any incentive; never hide negative reviews.
  - Respect invitation frequency limits.
- **Proposed API:** `POST /feedback` `{booking_id, ratings, comment, visibility}`, `GET /providers/{id}/reviews`, `POST /reviews/{id}/report`.

#### 10.2 Personalisation controls: DEMO (Annex D)
- **Screens:** `/account/personalisation`: declared interests (topics, concerns, specialties), "What we use to personalise", reset, and switch personalisation off. Each feed card links here from "Why am I seeing this?".
- **Proposed API:** `GET`/`PUT /me/interests`, `POST /me/personalisation/reset`, and the personalisation consent from 1.6.

#### 10.3 Referrals: DEMO, switched off (Annex I)
- **Screens:** `/account/invite`: personal link or code, invited friends and their status, terms.
- **Rules:** behind a `REFERRALS` flag that stays off until legal review. It's a patient-to-platform invite only, never a clinical referral, with no rewards for dentists.
- **Proposed API:** `GET /me/referral`, `GET /me/referral/invites`.

### Phase 11: Cross-cutting
- **Legal pages:** `/terms` and `/privacy`, with placeholder text until legal provides the real content. The consent screens link to them.
- **Accessibility pass (K):** keyboard-only completion of the two core journeys (§5 below), screen-reader check, contrast, 200% text zoom, form error recovery. Target WCAG 2.2 AA.
- **Localisation (§17, K):** move all text into message files; English first, then Hindi, Telugu, Kannada and Tamil. Translations are reviewed, never published straight from machine translation.
- **Analytics events (§16):** a short event dictionary covering sign-up conversion by type, search to profile to booking, AI usage and feedback, content engagement, and Concierge volume. Events never carry health data.
- **Going live checklist:** `SHOW_ACCOUNT` on, `FMD_API_URL` set, our domain in the backend's `ALLOWED_ORIGINS`, each DEMO module switched to `fmd()` as its endpoints ship.

---

## 5. Key journeys (final QA, PDR §18–19)

1. **Concern to appointment:**
   1. Ask the AI about tooth pain; the reply is educational with a caveat.
   2. "Find a dentist" opens `/dentists` with filters set.
   3. Open a profile, pick a slot, review, confirm.
   4. See it in My appointments, with reminders.
   5. After the visit, the documents show in Records and a feedback invite arrives.
2. **Concierge request:** read the service scope, submit, get a reference number, see status updates, accept a proposal, see the request closed with its outcome.
3. **Records and sharing:** upload an X-ray, share it with a new dentist for 7 days, see it in access history, revoke.
4. **Treatment with certificate:** follow a journey through plan, visits, invoice and certificate, then verify the certificate by QR code.
5. **Dentist presence:** sign up as a dentist, add registration details (Unverified), complete the profile, post a case with a consent record, see it in review.
6. **Student:** sign up as a student, buy the ₹400 membership (simulated), see the Scholar allowance on the membership page.
7. **Safety boundary:** the AI is asked to book an appointment. It shows options and opens the booking page, and nothing is booked without the user's confirmation.

---

## 6. Open decisions (need an answer before that part is final)

| # | Question | Blocks | Owner |
|---|---|---|---|
| D1 | `account_type` and student/company profiles in the backend | 1.5, 8.1 | Backend team |
| D2 | `PATCH /me`, change password while signed in, change mobile number | 1.3 | Backend team |
| D3 | Booking: fee collected online or at the clinic? Cancellation and refund rules? | 2.3, 8.2 | FMD (PDR §21) |
| D4 | Which cities Concierge covers, its fees and response times | 6.1 | FMD (PDR §21) |
| D5 | Membership verification documents, grace period, renewal rules | 1.5, 8.1 | FMD (PDR §21) |
| D6 | Terms and Privacy text | 11 | Legal |
| D7 | Languages at launch (all five, or English and Hindi first) | 4.1, 11 | FMD |
| D8 | Platforms allowed for content import | 5.3 | FMD (Annex N) |
| D9 | Public reviews at launch? | 10.1 | FMD (Annex N) |
| D10 | When the live site shows Log in (`SHOW_ACCOUNT`) | 1.2 | FMD |
