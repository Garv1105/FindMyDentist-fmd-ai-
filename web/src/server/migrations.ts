/** Ordered, append-only. Never edit a shipped migration; add a new one. */
export const MIGRATIONS: string[] = [
  /* 1 — identity, sessions, consent, audit (PRD §4.1, §10, §13) */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL CHECK (account_type IN ('patient','dentist','student','company')),
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deletion_requested','disabled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
  );
  CREATE TABLE user_roles (
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    org_id TEXT NOT NULL DEFAULT '',
    granted_at INTEGER NOT NULL,
    granted_by TEXT,
    PRIMARY KEY (user_id, role, org_id)
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,               -- sha256(token); the token itself is never stored
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    user_agent TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE otp_challenges (
    id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at INTEGER,
    ticket_hash TEXT,                  -- issued when a verified target has no account yet
    ticket_expires_at INTEGER
  );
  CREATE INDEX otp_target ON otp_challenges(target, created_at);
  CREATE TABLE consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    purpose TEXT NOT NULL,
    granted INTEGER NOT NULL CHECK (granted IN (0,1)),
    policy_version TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX consents_user ON consents(user_id, purpose, created_at);
  CREATE TABLE deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','completed','rejected','withdrawn')),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    meta TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX audit_target ON audit_events(target_type, target_id);
  `,
  /* 2 — Concierge enquiries and coordination history (PRD §5) */ `
  CREATE TABLE concierge_enquiries (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    contact_method TEXT NOT NULL CHECK (contact_method IN ('phone','whatsapp','email')),
    contact_value TEXT NOT NULL,
    need TEXT NOT NULL,
    area TEXT NOT NULL,
    timing TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    consent_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high')),
    assignee_id TEXT REFERENCES users(id),
    next_action TEXT NOT NULL DEFAULT 'First contact with the patient',
    next_action_due INTEGER NOT NULL,
    first_contact_at INTEGER,
    outcome TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX concierge_status ON concierge_enquiries(status, next_action_due);
  CREATE INDEX concierge_user ON concierge_enquiries(user_id);
  CREATE TABLE concierge_events (
    id TEXT PRIMARY KEY,
    enquiry_id TEXT NOT NULL REFERENCES concierge_enquiries(id),
    at INTEGER NOT NULL,
    actor_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('created','status','note','contact_attempt','assigned','next_action','priority')),
    from_status TEXT,
    to_status TEXT,
    channel TEXT,
    result TEXT,
    body TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX concierge_events_enquiry ON concierge_events(enquiry_id, at);
  `,
  /* 3 — provider directory, verification, claims, sponsored placements (PRD §4.4, §4.8) */ `
  CREATE TABLE clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    hours TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE dentists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),           -- set when a verified dentist claims the profile
    name TEXT NOT NULL,
    photo TEXT NOT NULL DEFAULT '',
    specialty TEXT NOT NULL,
    experience_years INTEGER,
    qualifications TEXT NOT NULL DEFAULT '[]',   -- JSON array
    languages TEXT NOT NULL DEFAULT '[]',        -- JSON array
    bio TEXT NOT NULL DEFAULT '',
    verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified')),
    verification_checks TEXT NOT NULL DEFAULT '', -- what was actually checked, shown to users
    verified_at INTEGER,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE dentist_clinics (
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    fee_note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (dentist_id, clinic_id)
  );
  CREATE TABLE dentist_services (
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    service TEXT NOT NULL,
    PRIMARY KEY (dentist_id, service)
  );
  CREATE TABLE placements (
    id TEXT PRIMARY KEY,
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    kind TEXT NOT NULL CHECK (kind IN ('sponsored','featured')),
    sponsor TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL
  );
  CREATE TABLE profile_claims (
    id TEXT PRIMARY KEY,
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    registration_number TEXT NOT NULL,
    council TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
    reviewer_id TEXT REFERENCES users(id),
    reason TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    decided_at INTEGER
  );
  `,
  /* 4 — booking: published slots, clinic policy, patient booking requests (PRD §4.5, §6.4) */ `
  CREATE TABLE clinic_booking_policies (
    clinic_id TEXT PRIMARY KEY REFERENCES clinics(id),
    live_schedule INTEGER NOT NULL DEFAULT 0,      -- 1 = slots come from a connected schedule
    schedule_source TEXT NOT NULL DEFAULT 'none',  -- 'clinic_os' | 'demo' | 'none'
    min_notice_minutes INTEGER NOT NULL DEFAULT 120,
    cancellation_terms TEXT NOT NULL DEFAULT 'Cancellation terms are set by the clinic and confirmed with you.'
  );
  CREATE TABLE slots (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX slots_dentist ON slots(dentist_id, starts_at);
  CREATE TABLE booking_requests (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    slot_id TEXT REFERENCES slots(id),
    starts_at INTEGER,                 -- snapshot of the slot time (null = clinic proposes a time)
    preferred_window TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    fee_note TEXT NOT NULL,            -- what the patient saw when confirming
    cancellation_terms TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('requested','confirmed','declined','cancelled_by_patient','cancelled_by_clinic','rescheduled','completed','no_show')),
    rescheduled_from TEXT REFERENCES booking_requests(id),
    idempotency_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (user_id, idempotency_key)
  );
  -- a slot can be held by at most one active booking (enforced by the database, not the UI)
  CREATE UNIQUE INDEX booking_slot_active ON booking_requests(slot_id) WHERE slot_id IS NOT NULL AND status IN ('requested','confirmed');
  CREATE INDEX booking_user ON booking_requests(user_id, created_at);
  CREATE TABLE booking_events (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES booking_requests(id),
    at INTEGER NOT NULL,
    actor_id TEXT REFERENCES users(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  );
  `,
  /* 5 — patient-controlled dental records, sharing grants, access log (PRD §4.6, §10, §13) */ `
  CREATE TABLE records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('report','xray','photo','prescription','treatment_plan','other')),
    record_date TEXT NOT NULL,              -- YYYY-MM-DD as given by the patient
    clinic_name TEXT NOT NULL DEFAULT '',
    provider_name TEXT NOT NULL DEFAULT '',
    episode TEXT NOT NULL DEFAULT '',       -- patient's own grouping, e.g. "Root canal 2026"
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,       -- opaque; never sent to clients
    source TEXT NOT NULL DEFAULT 'patient_upload',
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX records_user ON records(user_id, record_date);
  CREATE TABLE record_shares (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE INDEX record_shares_dentist ON record_shares(dentist_id);
  CREATE TABLE record_access_events (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records(id),
    actor_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('uploaded','viewed','downloaded','shared','share_revoked','deleted','exported')),
    detail TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL
  );
  CREATE INDEX record_access_record ON record_access_events(record_id, at);
  `,
  /* 6 — public assistant conversations, stored only with ai_history consent (PRD §4.2) */ `
  CREATE TABLE ai_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX ai_conversations_user ON ai_conversations(user_id, updated_at);
  CREATE TABLE ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    text TEXT NOT NULL,
    actions TEXT NOT NULL DEFAULT '[]',
    urgent INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX ai_messages_conv ON ai_messages(conversation_id, created_at);
  `,
  /* 7 — plan catalog (PRD §14 prices), subscriptions, usage counters, entitlements */ `
  CREATE TABLE plans (
    code TEXT PRIMARY KEY,
    product TEXT NOT NULL CHECK (product IN ('main_membership','clinic_os','scholar_upgrade')),
    audience TEXT NOT NULL,
    name TEXT NOT NULL,
    price_paise INTEGER NOT NULL,          -- excluding GST
    period TEXT NOT NULL CHECK (period IN ('year','month','one_time','none')),
    features TEXT NOT NULL DEFAULT '[]',
    usage_limits TEXT NOT NULL DEFAULT '{}',
    pending_decision TEXT,                 -- shown to users while terms are unconfirmed
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    org_id TEXT,
    plan_code TEXT NOT NULL REFERENCES plans(code),
    status TEXT NOT NULL CHECK (status IN ('pending_verification','active','cancelled','expired')),
    starts_at INTEGER,
    ends_at INTEGER,
    source TEXT NOT NULL CHECK (source IN ('free','manual','gateway')),
    evidence TEXT NOT NULL DEFAULT '',     -- e.g. offline payment reference recorded by staff
    created_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX subscriptions_user ON subscriptions(user_id, status);
  CREATE TABLE usage_counters (
    user_id TEXT NOT NULL REFERENCES users(id),
    feature TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, feature, period_start)
  );
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('main_patient', 'main_membership', 'patient', 'Patient', 0, 'none', '["AI companion","Dentist discovery and booking requests","Private dental records","Concierge requests"]', '{}', NULL);
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('main_dentist', 'main_membership', 'dentist', 'Dentist membership', 55000, 'year', '["Verified professional profile","Content publishing (subject to review)","Jobs and opportunities"]', '{}', NULL);
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('main_student', 'main_membership', 'student', 'Student membership', 40000, 'year', '["FMD Scholar access within included usage","Student content and opportunities"]', '{"scholar_requests_per_month":300}', 'Scholar usage limits and the renewal grace period are not yet confirmed by FMD.');
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('main_company', 'main_membership', 'company', 'Dental company membership', 200000, 'year', '["Corporate page","Job postings","Promotional features (always labelled)"]', '{}', 'Included profile and promotional entitlements are not yet defined.');
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('clinic_os', 'clinic_os', 'clinic', 'FMD Clinic OS', 200000, 'month', '["Clinic management","Agentic AI clinic manager (fair use)"]', '{}', 'Fair-use AI limits and add-ons are not yet defined.');
  INSERT INTO plans (code, product, audience, name, price_paise, period, features, usage_limits, pending_decision) VALUES ('scholar_upgrade', 'scholar_upgrade', 'student', 'Scholar upgrade', 35000, 'one_time', '["Additional Scholar usage after included limits"]', '{}', 'Tentative price; billing period and exact benefit pending confirmation.');
  `,
  /* 8 — content hub, engagement, reports & moderation, explicit interests (PRD §4.7, Annex C, D) */ `
  CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    author_user_id TEXT REFERENCES users(id),
    author_dentist_id TEXT REFERENCES dentists(id),
    kind TEXT NOT NULL CHECK (kind IN ('education','post','poll','case')),
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_review','published','rejected','removed')),
    case_consent_ref TEXT,                 -- required for case posts (patient consent record)
    case_deidentified INTEGER NOT NULL DEFAULT 0,
    case_clinically_reviewed INTEGER NOT NULL DEFAULT 0,
    sponsored_by TEXT,                     -- set by staff only; always labelled
    moderation_note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    published_at INTEGER
  );
  CREATE INDEX posts_status ON posts(status, published_at);
  CREATE TABLE poll_options (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), label TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE TABLE poll_votes (post_id TEXT NOT NULL REFERENCES posts(id), user_id TEXT NOT NULL REFERENCES users(id), option_id TEXT NOT NULL REFERENCES poll_options(id), PRIMARY KEY (post_id, user_id));
  CREATE TABLE post_reactions (post_id TEXT NOT NULL REFERENCES posts(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
  CREATE TABLE post_saves (post_id TEXT NOT NULL REFERENCES posts(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
  CREATE TABLE follows (user_id TEXT NOT NULL REFERENCES users(id), dentist_id TEXT NOT NULL REFERENCES dentists(id), created_at INTEGER NOT NULL, PRIMARY KEY (user_id, dentist_id));
  CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','removed')),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','job')),
    target_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
    decided_by TEXT REFERENCES users(id),
    decision_note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    decided_at INTEGER,
    UNIQUE (target_type, target_id, reporter_id)
  );
  CREATE TABLE user_interests (user_id TEXT NOT NULL REFERENCES users(id), topic TEXT NOT NULL, PRIMARY KEY (user_id, topic));
  `,
  /* 9 — jobs and professional opportunities (PRD §4.9) */ `
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    poster_user_id TEXT NOT NULL REFERENCES users(id),
    org_name TEXT NOT NULL,
    title TEXT NOT NULL,
    role_type TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    requirements TEXT NOT NULL DEFAULT '',
    compensation TEXT NOT NULL DEFAULT '',
    apply_method TEXT NOT NULL CHECK (apply_method IN ('email','url','phone')),
    apply_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','removed')),
    employer_verified INTEGER NOT NULL DEFAULT 0,  -- only set by FMD staff after a real check
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX jobs_active ON jobs(status, expires_at);
  `,
  /* 10 — support tickets, thread, attachments (PRD §10 Support, Annex H) */ `
  CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    area TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low','normal','high','critical')),
    impact TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open','in_progress','waiting_on_user','resolved','closed')),
    assignee_id TEXT REFERENCES users(id),
    resolution TEXT NOT NULL DEFAULT '',
    reopened INTEGER NOT NULL DEFAULT 0,
    first_response_at INTEGER,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX tickets_user ON tickets(user_id, created_at);
  CREATE INDEX tickets_status ON tickets(status, severity);
  CREATE TABLE ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    from_staff INTEGER NOT NULL,
    internal INTEGER NOT NULL DEFAULT 0,   -- staff-only notes, never shown to the requester
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE ticket_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    storage_key TEXT NOT NULL,
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
  /* 11 — Clinic OS core: workspace, team, schedule, patients, clinical, billing, inventory, tasks (PRD §6) */ `
  CREATE TABLE clinic_workspaces (
    clinic_id TEXT PRIMARY KEY REFERENCES clinics(id),
    status TEXT NOT NULL CHECK (status IN ('setup','active','suspended')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE clinic_invites (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    accepted_by TEXT REFERENCES users(id),
    accepted_at INTEGER,
    revoked_at INTEGER,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE clinic_hours (
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    opens TEXT NOT NULL,
    closes TEXT NOT NULL
  );
  CREATE TABLE appointment_types (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    name TEXT NOT NULL,
    duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 5 AND 480),
    buffer_min INTEGER NOT NULL DEFAULT 0 CHECK (buffer_min BETWEEN 0 AND 120),
    fee_note TEXT NOT NULL DEFAULT '',
    bookable_online INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE chairs (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE clinic_patients (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    user_id TEXT REFERENCES users(id),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    dob TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    medical_alerts TEXT NOT NULL DEFAULT '',
    consent_treatment_at INTEGER,
    consent_comms INTEGER NOT NULL DEFAULT 0,
    last_visit_at INTEGER,
    merged_into TEXT REFERENCES clinic_patients(id),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX clinic_patients_clinic ON clinic_patients(clinic_id, full_name);
  CREATE INDEX clinic_patients_phone ON clinic_patients(clinic_id, phone);
  CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT REFERENCES clinic_patients(id),
    provider_dentist_id TEXT REFERENCES dentists(id),
    chair_id TEXT REFERENCES chairs(id),
    type_id TEXT REFERENCES appointment_types(id),
    kind TEXT NOT NULL DEFAULT 'visit' CHECK (kind IN ('visit','block')),
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('booked','confirmed','checked_in','completed','cancelled','no_show')),
    source TEXT NOT NULL DEFAULT 'clinic' CHECK (source IN ('clinic','fmd_booking','waitlist')),
    booking_request_id TEXT REFERENCES booking_requests(id),
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX appointments_clinic_time ON appointments(clinic_id, starts_at);
  CREATE TABLE appointment_events (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    actor_id TEXT REFERENCES users(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL
  );
  CREATE TABLE waitlist (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    preference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','booked','removed')),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE clinical_notes (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    appointment_id TEXT REFERENCES appointments(id),
    root_id TEXT NOT NULL,                 -- all versions of one note share root_id
    version INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','signed','superseded')),
    complaint TEXT NOT NULL DEFAULT '',
    findings TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '',
    amendment_reason TEXT NOT NULL DEFAULT '',
    ai_drafted INTEGER NOT NULL DEFAULT 0,
    author_id TEXT NOT NULL REFERENCES users(id),
    signed_by TEXT REFERENCES users(id),
    signed_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX clinical_notes_patient ON clinical_notes(patient_id, created_at);
  CREATE TABLE chart_entries (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    tooth INTEGER NOT NULL,               -- FDI notation 11–48 (and 51–85 primary)
    surfaces TEXT NOT NULL DEFAULT '',
    finding TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL           -- append-only: newer entries supersede, never overwrite
  );
  CREATE TABLE treatment_plans (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','proposed','accepted','declined','completed')),
    acknowledged_at INTEGER,
    acknowledged_note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE plan_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES treatment_plans(id),
    procedure TEXT NOT NULL,
    tooth TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL CHECK (qty > 0),
    unit_paise INTEGER NOT NULL CHECK (unit_paise >= 0),
    discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0)
  );
  CREATE TABLE patient_files (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    title TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','issued','partially_paid','paid','void')),
    total_paise INTEGER NOT NULL DEFAULT 0,
    void_reason TEXT NOT NULL DEFAULT '',
    plan_id TEXT REFERENCES treatment_plans(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    issued_at INTEGER,
    UNIQUE (clinic_id, number)
  );
  CREATE TABLE invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    description TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    unit_paise INTEGER NOT NULL CHECK (unit_paise >= 0),
    discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0)
  );
  CREATE TABLE clinic_payments (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    kind TEXT NOT NULL CHECK (kind IN ('payment','refund')),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    mode TEXT NOT NULL CHECK (mode IN ('cash','upi','card','bank','other')),
    reference TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    recorded_by TEXT NOT NULL REFERENCES users(id),
    recorded_at INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    UNIQUE (clinic_id, idempotency_key)
  );
  CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    supplier TEXT NOT NULL DEFAULT '',
    tracks_expiry INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    qty_delta INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('received','used','adjustment','expired','returned')),
    batch TEXT NOT NULL DEFAULT '',
    expires_on TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    recorded_by TEXT NOT NULL REFERENCES users(id),
    recorded_at INTEGER NOT NULL
  );
  CREATE TABLE purchase_orders (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    supplier TEXT NOT NULL,
    lines TEXT NOT NULL,                  -- JSON [{itemId, name, qty}]
    status TEXT NOT NULL CHECK (status IN ('draft','approved','sent','received','cancelled')),
    ai_drafted INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE clinic_tasks (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    assignee_id TEXT REFERENCES users(id),
    due_at INTEGER,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai','system')),
    source_ref TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );
  CREATE TABLE handovers (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
  /* 12 — Clinic AI manager: tasks, steps, approvals, schedules, outbound messages, usage (PRD §7) */ `
  CREATE TABLE ai_settings (
    clinic_id TEXT PRIMARY KEY REFERENCES clinics(id),
    enabled INTEGER NOT NULL DEFAULT 1,
    recall_months INTEGER NOT NULL DEFAULT 6,
    updated_by TEXT REFERENCES users(id),
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE ai_tasks (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    requested_by TEXT NOT NULL REFERENCES users(id),
    instruction TEXT NOT NULL,
    intent TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('clarifying','running','awaiting_approval','completed','partial','blocked','failed','cancelled')),
    question TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '[]',
    report TEXT NOT NULL DEFAULT '',
    schedule_id TEXT,
    planner TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX ai_tasks_clinic ON ai_tasks(clinic_id, created_at);
  CREATE TABLE ai_task_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES ai_tasks(id),
    seq INTEGER NOT NULL,
    tool TEXT NOT NULL,
    input TEXT NOT NULL DEFAULT '{}',
    risk TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','awaiting_approval','done','skipped','blocked','failed')),
    preview TEXT NOT NULL DEFAULT '',
    output TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER,
    finished_at INTEGER
  );
  CREATE TABLE ai_approvals (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES ai_tasks(id),
    step_id TEXT NOT NULL REFERENCES ai_task_steps(id),
    approver_id TEXT NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    note TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL
  );
  CREATE TABLE ai_schedules (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    instruction TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly')),
    next_run_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE outbound_messages (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
    channel TEXT NOT NULL,
    purpose TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','sent','not_sent','skipped_no_consent','failed')),
    status_detail TEXT NOT NULL DEFAULT '',
    task_id TEXT REFERENCES ai_tasks(id),
    created_at INTEGER NOT NULL,
    sent_at INTEGER
  );
  CREATE TABLE ai_usage (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    task_id TEXT REFERENCES ai_tasks(id),
    provider TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    est_cost_paise INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL
  );
  `,
  /* 13 — product renamed: FMD Concierge → FMD Edge (user-facing text only; table and route names unchanged) */ `
  UPDATE plans SET features = REPLACE(features, 'Concierge requests', 'FMD Edge requests') WHERE features LIKE '%Concierge requests%';
  `,
  /* 14 — homepage leads: Clinic OS demo / early access and the product-updates waitlist */ `
  CREATE TABLE leads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('clinic_demo','clinic_early_access','waitlist')),
    name TEXT NOT NULL DEFAULT '',
    clinic_name TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX leads_email ON leads(email, kind, created_at);
  `,
];
