/**
 * Digital records, sharing and access history (plan parts 3.1 and 3.2, PDR §4.6, §10, §13): sample data until the
 * backend has it. Proposed API:
 *   POST /records/upload-url {name, mime, size} → {upload_url, expires_at}   (422 with checkUpload's messages)
 *   PUT  <upload_url> (the file goes straight to private storage), then POST /records {details} → DentalRecord
 *   GET  /records?type&clinic&dentist&from&to&episode → DentalRecord[]      GET/PATCH/DELETE /records/{id}
 *   GET  /records/{id}/link?purpose=view|download → {url, expires_at}   (signed, short-lived; logged as access)
 *   GET  /me/storage → {used, limit}       POST /records/export → a zip of every file plus an index
 *   POST /records/shares {to, record_ids, expires_in_days|null, note} → Share     GET /me/shares     DELETE /shares/{id}
 *   GET  /records/{id}/access-events → AccessEvent[]
 * Rules: a file is never reachable by a permanent or raw storage URL; sharing is explicit, limited to the records
 * chosen, time-limited or revocable, and revoking takes effect at once; every view, download and share is logged.
 */
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import { demoPdf, demoXray, deleteFile, getFile, putFile } from "./files.ts";
import { CLINICS, search } from "./providers.ts";
import { read, write } from "./store.ts";

export const RECORD_TYPES = {
  report: "Report",
  xray: "X-ray",
  photo: "Photo",
  plan: "Treatment plan",
  prescription: "Prescription",
  invoice: "Invoice",
  certificate: "Warranty certificate",
  other: "Other",
} as const;
export type RecordType = keyof typeof RECORD_TYPES;

const MB = 1024 * 1024;
export const UPLOAD = { maxBytes: 20 * MB, quotaBytes: 100 * MB, mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] } as const;
/** a signed link works this long */
export const LINK_MINUTES = 5;
/** demo: a dentist opens what you shared this long after you share it */
export const VIEW_AFTER_MS = 15_000;

export type DentalRecord = {
  id: string;
  title: string;
  type: RecordType;
  /** the date of the document itself, YYYY-MM-DD */
  date: string;
  clinic: { id: string; name: string } | null;
  dentist: { id: string; name: string } | null;
  /** the treatment journey it belongs to (part 3.3) */
  episode_id: string | null;
  note: string | null;
  file: { name: string; mime: string; size: number };
  source: "you" | "clinic";
  uploaded_at: string;
  /** a warranty certificate's page (part 3.4) */
  certificate_id?: string;
};

export type AccessEvent = { record_id: string; at: string; who: string; what: "added it" | "uploaded" | "viewed" | "downloaded" | "shared" | "sharing ended" | "edited" };

export type Recipient = { kind: "dentist" | "clinic"; id: string; name: string; detail: string };
export type Share = { id: string; to: Recipient; record_ids: string[]; created_at: string; expires_at: string | null; note: string | null; revoked_at: string | null };
export type ShareView = Share & { state: "active" | "expired" | "revoked" };

type State = { records: DentalRecord[]; shares: Share[]; events: AccessEvent[] };

const key = (userId: string) => `fmd-demo:records:${userId}`;
const iso = (t: number) => new Date(t).toISOString();
const istDate = (t: number) => new Date(t + 5.5 * 3_600_000).toISOString().slice(0, 10);
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------------- the demo history ---------------- */

const KOR = { id: "kor", name: "Demo Dental Studio" };
const ADITI = { id: "aditi-sharma", name: "Dr. Aditi Sharma" };
const VENKAT = { id: "venkat-rao", name: "Dr. Venkat Rao" };

/** Documents the demo clinic released after the visits in the demo appointment history, plus one the person added. */
function seed(now: number): State {
  const day = 86_400_000;
  const d = (daysAgo: number) => istDate(now - daysAgo * day);
  const clinic = (id: string, title: string, type: RecordType, daysAgo: number, mime: string, episode: string | null, dentist = ADITI, extra: Partial<DentalRecord> = {}): DentalRecord => ({
    id,
    title,
    type,
    date: d(daysAgo),
    clinic: KOR,
    dentist,
    episode_id: episode,
    note: null,
    file: { name: `${title.replace(/[^\w]+/g, "-").toLowerCase()}.${mime === "application/pdf" ? "pdf" : "svg"}`, mime, size: mime === "application/pdf" ? 1800 : 2400 },
    source: "clinic",
    uploaded_at: iso(now - daysAgo * day + 4 * 3_600_000),
    ...extra,
  });
  const records: DentalRecord[] = [
    clinic("rec-summary", "Consultation summary", "report", 24, "application/pdf", "j-rct"),
    clinic("rec-xray", "Bitewing X-ray, lower left", "xray", 24, "image/svg+xml", "j-rct"),
    clinic("rec-plan", "Treatment plan v2: root canal and crown", "plan", 20, "application/pdf", "j-rct"),
    clinic("rec-inv-cons", "Invoice: consultation", "invoice", 24, "application/pdf", "j-rct"),
    clinic("rec-rx", "Prescription", "prescription", 24, "application/pdf", "j-rct"),
    clinic("rec-inv-fill", "Invoice: filling", "invoice", 241, "application/pdf", "j-fill", VENKAT),
    clinic("rec-cert", "Warranty certificate WC-2026-0147", "certificate", 240, "application/pdf", "j-fill", VENKAT, { certificate_id: "cert-0147" }),
    {
      id: "rec-old",
      title: "X-ray from my previous dentist",
      type: "photo",
      date: d(400),
      clinic: null,
      dentist: null,
      episode_id: null,
      note: "Photo of the printed X-ray they gave me.",
      file: { name: "old-xray.svg", mime: "image/svg+xml", size: 2400 },
      source: "you",
      uploaded_at: iso(now - 30 * day),
    },
  ];
  const events: AccessEvent[] = records.map((r) => ({ record_id: r.id, at: r.uploaded_at, who: r.source === "clinic" ? r.clinic!.name : "You", what: r.source === "clinic" ? "added it" : "uploaded" }));
  return { records, shares: [], events };
}

/** Contents for the seeded documents, made when first opened. */
function seedFile(r: DentalRecord): Blob {
  if (r.file.mime === "image/svg+xml") return demoXray(r.title);
  const by = [r.dentist?.name, r.clinic?.name].filter(Boolean).join(", ");
  const body: Record<string, string[]> = {
    "rec-summary": ["Reason for visit: pain when chewing, lower left, for 2 weeks.", "Findings: deep decay in the lower left first molar (tooth 36), reaching the nerve.", "Advice: root canal treatment, then a crown. See treatment plan.", "Next step: book the first treatment session."],
    "rec-plan": ["Version 2 (replaces version 1).", "1. Root canal treatment, tooth 36: Rs. 6,500", "2. Zirconia crown, tooth 36: Rs. 7,000", "X-rays during treatment: included", "Estimated total: Rs. 13,500", "Your dentist confirms the cost at each visit."],
    "rec-inv-cons": ["Consultation: Rs. 500", "Bitewing X-ray: included", "Paid at the clinic by UPI."],
    "rec-rx": ["Ibuprofen 400 mg: only if needed for pain, after food, up to 3 times a day, for 3 days.", "Warm salt-water rinses twice a day.", "Take only as your dentist directed."],
    "rec-inv-fill": ["Composite filling, tooth 15: Rs. 1,800", "Paid at the clinic by card."],
    "rec-cert": ["Certificate WC-2026-0147, issued by Demo Dental Studio.", "See the certificate page in FMD for the full terms."],
  };
  return demoPdf(r.title, [`${by} · ${r.date}`, "DEMO DOCUMENT · not a real medical record", "", ...(body[r.id] ?? [])]);
}

/* ---------------- state ---------------- */

/** Moves the demo along: a dentist opens what was shared with them a little later, while the share is active. */
function advance(s: State, now: number): State {
  const events = [...s.events];
  for (const sh of s.shares) {
    if (sh.revoked_at || (sh.expires_at && Date.parse(sh.expires_at) <= now) || now - Date.parse(sh.created_at) < VIEW_AFTER_MS) continue;
    const first = sh.record_ids.find((id) => s.records.some((r) => r.id === id));
    if (first && !events.some((e) => e.record_id === first && e.who === sh.to.name && e.what === "viewed"))
      events.push({ record_id: first, at: iso(Date.parse(sh.created_at) + VIEW_AFTER_MS), who: sh.to.name, what: "viewed" });
  }
  return { ...s, events };
}

function load(userId: string, now: number): State {
  const s = advance(read<State>(key(userId)) ?? seed(now), now);
  write(key(userId), s);
  return s;
}
const save = (userId: string, s: State) => write(key(userId), s);

/* ---------------- records ---------------- */

export type RecordFilters = { type?: string; clinic?: string; dentist?: string; episode?: string; from?: string; to?: string };

export async function listRecords(userId: string, f: RecordFilters = {}, now = Date.now()): Promise<DentalRecord[]> {
  return load(userId, now)
    .records.filter(
      (r) =>
        (!f.type || r.type === f.type) &&
        (!f.clinic || r.clinic?.id === f.clinic) &&
        (!f.dentist || r.dentist?.id === f.dentist) &&
        (!f.episode || (f.episode === "none" ? !r.episode_id : r.episode_id === f.episode)) &&
        (!f.from || r.date >= f.from) &&
        (!f.to || r.date <= f.to),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.uploaded_at.localeCompare(a.uploaded_at));
}

export async function getRecord(userId: string, id: string, now = Date.now()) {
  return load(userId, now).records.find((r) => r.id === id) ?? null;
}

export async function storage(userId: string, now = Date.now()) {
  return { used: load(userId, now).records.reduce((n, r) => n + r.file.size, 0), limit: UPLOAD.quotaBytes };
}

/** The first problem with a file someone wants to upload, or null. */
export function checkUpload(f: { type: string; size: number }, usedBytes: number): string | null {
  if (!(UPLOAD.mimes as readonly string[]).includes(f.type)) return "This type of file can't be added. Upload a PDF, JPG, PNG or WebP.";
  if (f.size > UPLOAD.maxBytes) return "This file is over 20 MB. Upload a smaller copy.";
  if (usedBytes + f.size > UPLOAD.quotaBytes) return "This would go over your 100 MB of storage. Delete something first.";
  return null;
}

export const guessType = (mime: string): RecordType => (mime.startsWith("image/") ? "photo" : "report");

export type RecordDetails = Pick<DentalRecord, "title" | "type" | "date" | "clinic" | "dentist" | "episode_id" | "note">;

export async function addRecord(userId: string, details: RecordDetails, file: Blob & { name: string }, now = Date.now()): Promise<DentalRecord> {
  const s = load(userId, now);
  const problem = checkUpload(file, s.records.reduce((n, r) => n + r.file.size, 0));
  if (problem) throw new Error(problem);
  if (!details.title.trim()) throw new Error("Give the record a name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) || details.date > istDate(now)) throw new Error("Choose the date on the document. It can't be in the future.");
  const r: DentalRecord = { ...details, id: newId("rec"), title: details.title.trim(), note: details.note?.trim() || null, file: { name: file.name, mime: file.type, size: file.size }, source: "you", uploaded_at: iso(now) };
  await putFile(r.id, file);
  save(userId, { ...s, records: [...s.records, r], events: [...s.events, { record_id: r.id, at: iso(now), who: "You", what: "uploaded" }] });
  return r;
}

export async function updateRecord(userId: string, id: string, patch: Partial<RecordDetails>, now = Date.now()): Promise<DentalRecord> {
  const s = load(userId, now);
  const r = s.records.find((x) => x.id === id);
  if (!r) throw new Error("We couldn't find that record.");
  const next = { ...r, ...patch, title: (patch.title ?? r.title).trim(), note: patch.note === undefined ? r.note : patch.note?.trim() || null };
  if (!next.title) throw new Error("Give the record a name.");
  if (next.date > istDate(now)) throw new Error("The date can't be in the future.");
  save(userId, { ...s, records: s.records.map((x) => (x.id === id ? next : x)), events: [...s.events, { record_id: id, at: iso(now), who: "You", what: "edited" }] });
  return next;
}

/** Deletes the record and its file, and takes it out of every share. Shares left with nothing in them end. */
export async function deleteRecord(userId: string, id: string, now = Date.now()) {
  const s = load(userId, now);
  const shares = s.shares.map((sh) => ({ ...sh, record_ids: sh.record_ids.filter((x) => x !== id) })).map((sh) => (sh.record_ids.length || sh.revoked_at ? sh : { ...sh, revoked_at: iso(now) }));
  save(userId, { records: s.records.filter((r) => r.id !== id), shares, events: s.events.filter((e) => e.record_id !== id) });
  await deleteFile(id);
}

/** A short-lived link to the file, logged as a view or download. Object URLs stand in for signed storage links. */
export async function getLink(userId: string, id: string, purpose: "view" | "download" = "view", now = Date.now()) {
  const s = load(userId, now);
  const r = s.records.find((x) => x.id === id);
  if (!r) throw new Error("We couldn't find that record.");
  let blob = await getFile(id);
  if (!blob) {
    blob = seedFile(r);
    await putFile(id, blob);
  }
  const url = URL.createObjectURL(blob);
  expireLink(url);
  save(userId, { ...s, events: [...s.events, { record_id: id, at: iso(now), who: "You", what: purpose === "view" ? "viewed" : "downloaded" }] });
  return { url, expires_at: iso(now + LINK_MINUTES * 60_000), name: r.file.name };
}

/** A small preview for the list; not logged, since nobody has opened the record. */
export async function getThumb(userId: string, id: string) {
  const r = load(userId, Date.now()).records.find((x) => x.id === id);
  if (!r || !r.file.mime.startsWith("image/")) return null;
  const blob = (await getFile(id)) ?? seedFile(r);
  const url = URL.createObjectURL(blob);
  expireLink(url);
  return url;
}

export async function accessEvents(userId: string, recordId: string, now = Date.now()) {
  return load(userId, now)
    .events.filter((e) => e.record_id === recordId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** The link stops working after LINK_MINUTES. (unref: in tests, a pending link doesn't keep Node running.) */
function expireLink(url: string) {
  const t = setTimeout(() => URL.revokeObjectURL(url), LINK_MINUTES * 60_000) as unknown as { unref?: () => void };
  t.unref?.();
}

/** Every file plus an index, in one zip. */
export async function exportAll(userId: string, now = Date.now()): Promise<Blob> {
  const s = load(userId, now);
  const files: Record<string, Uint8Array> = {};
  for (const r of s.records) {
    const blob = (await getFile(r.id)) ?? seedFile(r);
    files[`${r.date}-${r.id}-${r.file.name}`] = new Uint8Array(await blob.arrayBuffer());
  }
  files["index.json"] = strToU8(JSON.stringify({ exported_at: iso(now), records: s.records }, null, 2));
  return new Blob([zipSync(files)], { type: "application/zip" });
}

/* ---------------- sharing ---------------- */

/** Dentists and clinics on FMD that a person can share records with. */
export function findRecipients(q: string): Recipient[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const dentists = search({ q: t })
    .items.slice(0, 6)
    .map((p): Recipient => ({ kind: "dentist", id: p.id, name: p.name, detail: `${p.specialty} · ${p.clinic.name}, ${p.clinic.city}` }));
  const clinics = CLINICS.filter((c) => `${c.name} ${c.area} ${c.city}`.toLowerCase().includes(t))
    .slice(0, 4)
    .map((c): Recipient => ({ kind: "clinic", id: c.id, name: c.name, detail: `Clinic · ${c.area}, ${c.city}` }));
  return [...dentists, ...clinics];
}

const stateOf = (sh: Share, now: number): ShareView["state"] => (sh.revoked_at ? "revoked" : sh.expires_at && Date.parse(sh.expires_at) <= now ? "expired" : "active");

export async function listShares(userId: string, now = Date.now()): Promise<ShareView[]> {
  return load(userId, now)
    .shares.map((sh) => ({ ...sh, state: stateOf(sh, now) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function shareRecords(userId: string, input: { to: Recipient | null; record_ids: string[]; days: 7 | 30 | null; note: string }, now = Date.now()): Promise<Share> {
  const s = load(userId, now);
  if (!input.to) throw new Error("Choose who to share with.");
  const ids = input.record_ids.filter((id) => s.records.some((r) => r.id === id));
  if (!ids.length) throw new Error("Choose at least one record to share.");
  const sh: Share = {
    id: newId("sh"),
    to: input.to,
    record_ids: ids,
    created_at: iso(now),
    expires_at: input.days ? iso(now + input.days * 86_400_000) : null,
    note: input.note.trim() || null,
    revoked_at: null,
  };
  save(userId, { ...s, shares: [...s.shares, sh], events: [...s.events, ...ids.map((id): AccessEvent => ({ record_id: id, at: iso(now), who: `You, with ${sh.to.name}`, what: "shared" }))] });
  return sh;
}

/** Takes effect at once: the recipient's links stop working. */
export async function revokeShare(userId: string, shareId: string, now = Date.now()) {
  const s = load(userId, now);
  const sh = s.shares.find((x) => x.id === shareId);
  if (!sh) throw new Error("We couldn't find that share.");
  if (sh.revoked_at) return;
  save(userId, {
    ...s,
    shares: s.shares.map((x) => (x.id === shareId ? { ...x, revoked_at: iso(now) } : x)),
    events: [...s.events, ...sh.record_ids.map((id): AccessEvent => ({ record_id: id, at: iso(now), who: `You, with ${sh.to.name}`, what: "sharing ended" }))],
  });
}
