import { createHash, randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import type { Auth } from "./auth.ts";
import { bad, HttpError, notFound } from "./http.ts";
import { signLink, sniffMime, storage, verifyLink } from "./adapters/storage.ts";

export const DOC_TYPES = {
  report: "Report",
  xray: "X-ray",
  photo: "Photo",
  prescription: "Prescription",
  treatment_plan: "Treatment plan",
  other: "Other document",
} as const;
type DocType = keyof typeof DOC_TYPES;

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const QUOTA_BYTES = Number(process.env.FMD_RECORDS_QUOTA_MB ?? 200) * 1024 * 1024;

type RecordRow = {
  id: string;
  user_id: string;
  title: string;
  doc_type: DocType;
  record_date: string;
  clinic_name: string;
  provider_name: string;
  episode: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  source: string;
  created_at: number;
  deleted_at: number | null;
};

function logAccess(recordId: string, actorId: string | null, kind: string, detail = "") {
  run("INSERT INTO record_access_events (id, record_id, actor_id, kind, detail, at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), recordId, actorId, kind, detail, Date.now());
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function usage(userId: string) {
  const used = one<{ n: number }>("SELECT COALESCE(SUM(size_bytes), 0) AS n FROM records WHERE user_id = ? AND deleted_at IS NULL", userId)!.n;
  return { usedBytes: used, quotaBytes: QUOTA_BYTES, maxFileBytes: MAX_FILE_BYTES };
}

export function uploadRecord(a: Auth, bytes: Uint8Array, meta: Record<string, unknown>) {
  if (bytes.byteLength === 0) throw bad("The file is empty.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new HttpError(413, "too_large", "Files must be 15 MB or smaller.");
  const mime = sniffMime(bytes);
  if (!mime) throw new HttpError(415, "unsupported_type", "Upload a PDF, JPEG, PNG, WebP or DICOM file.");
  const docType = typeof meta.docType === "string" && meta.docType in DOC_TYPES ? (meta.docType as DocType) : null;
  if (!docType) throw bad("Choose a document type.");
  const title = text(meta.title, 120);
  if (title.length < 2) throw bad("Give the document a name.");
  const date = text(meta.recordDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).getTime() > Date.now() + 86400_000) throw bad("Enter the document date (not in the future).");
  const u = usage(a.user.id);
  if (u.usedBytes + bytes.byteLength > u.quotaBytes) throw new HttpError(413, "quota", "You've reached your storage limit. Delete older files to make space.");

  const key = storage.put(bytes);
  try {
    return tx(() => {
      const id = randomUUID();
      run(
        `INSERT INTO records (id, user_id, title, doc_type, record_date, clinic_name, provider_name, episode, mime, size_bytes, sha256, storage_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, a.user.id, title, docType, date, text(meta.clinicName, 120), text(meta.providerName, 120), text(meta.episode, 80),
        mime, bytes.byteLength, createHash("sha256").update(bytes).digest("hex"), key, Date.now(),
      );
      logAccess(id, a.user.id, "uploaded");
      audit(a.user.id, "record.uploaded", "record", id, { docType, size: bytes.byteLength });
      return view(one<RecordRow>("SELECT * FROM records WHERE id = ?", id)!);
    });
  } catch (e) {
    storage.remove(key); // no orphaned files when the database write fails
    throw e;
  }
}

function view(r: RecordRow) {
  const shares = all<{ id: string; dentist_id: string; name: string; expires_at: number }>(
    `SELECT s.id, s.dentist_id, d.name, s.expires_at FROM record_shares s JOIN dentists d ON d.id = s.dentist_id
     WHERE s.record_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
    r.id,
    Date.now(),
  );
  return {
    id: r.id,
    title: r.title,
    docType: r.doc_type,
    docTypeLabel: DOC_TYPES[r.doc_type],
    recordDate: r.record_date,
    clinicName: r.clinic_name,
    providerName: r.provider_name,
    episode: r.episode,
    mime: r.mime,
    sizeBytes: r.size_bytes,
    source: r.source,
    createdAt: r.created_at,
    shares: shares.map((s) => ({ id: s.id, dentistId: s.dentist_id, dentistName: s.name, expiresAt: s.expires_at })),
  };
}

/** Owner's records with optional filters (MAIN-34). */
export function listRecords(a: Auth, f: { type?: string; clinic?: string; episode?: string } = {}) {
  const rows = all<RecordRow>("SELECT * FROM records WHERE user_id = ? AND deleted_at IS NULL ORDER BY record_date DESC, created_at DESC", a.user.id);
  return {
    items: rows
      .filter((r) => !f.type || r.doc_type === f.type)
      .filter((r) => !f.clinic || r.clinic_name === f.clinic)
      .filter((r) => !f.episode || r.episode === f.episode)
      .map(view),
    facets: {
      clinics: [...new Set(rows.map((r) => r.clinic_name).filter(Boolean))].sort(),
      episodes: [...new Set(rows.map((r) => r.episode).filter(Boolean))].sort(),
    },
    usage: usage(a.user.id),
  };
}

function owned(a: Auth, id: string) {
  const r = one<RecordRow>("SELECT * FROM records WHERE id = ? AND deleted_at IS NULL", id);
  if (!r || r.user_id !== a.user.id) throw notFound("Record not found.");
  return r;
}

/** Linked dentist profile ids for a dentist account (via an approved claim). */
function dentistProfilesOf(userId: string) {
  return all<{ id: string }>("SELECT id FROM dentists WHERE user_id = ?", userId).map((r) => r.id);
}

/** Owner, or a dentist with an active, unexpired share. Everyone else: 404. */
function canRead(a: Auth, r: RecordRow): "owner" | "share" | null {
  if (r.user_id === a.user.id) return "owner";
  const ids = dentistProfilesOf(a.user.id);
  if (!ids.length) return null;
  const ok = one(
    `SELECT 1 FROM record_shares WHERE record_id = ? AND revoked_at IS NULL AND expires_at > ? AND dentist_id IN (${ids.map(() => "?").join(",")})`,
    r.id,
    Date.now(),
    ...ids,
  );
  return ok ? "share" : null;
}

/** Short-lived signed link, issued only after the access check. */
export function issueLink(a: Auth, id: string, mode: "view" | "download") {
  const r = one<RecordRow>("SELECT * FROM records WHERE id = ? AND deleted_at IS NULL", id);
  if (!r || !canRead(a, r)) throw notFound("Record not found.");
  return signLink({ recordId: id, viewerId: a.user.id, mode });
}

/**
 * Serve bytes for a signed link. The token alone isn't enough: the current session must be the
 * viewer it was issued to, and access is re-checked (a share revoked a moment ago stops working).
 */
export function readByToken(a: Auth, token: string) {
  const t = verifyLink(token);
  if (!t || t.viewerId !== a.user.id) throw new HttpError(403, "link_invalid", "This link has expired. Open the document again from your records.");
  const r = one<RecordRow>("SELECT * FROM records WHERE id = ? AND deleted_at IS NULL", t.recordId);
  if (!r) throw notFound("Record not found.");
  const via = canRead(a, r);
  if (!via) throw new HttpError(403, "link_invalid", "You no longer have access to this document.");
  logAccess(r.id, a.user.id, t.mode === "download" ? "downloaded" : "viewed", via === "share" ? "via share" : "");
  const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/dicom": "dcm" }[r.mime] ?? "bin";
  return { bytes: storage.get(r.storage_key), mime: r.mime, filename: `${r.title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "record"}.${ext}`, mode: t.mode };
}

/* ---------------- sharing (explicit, per document, time-limited) ---------------- */

export function shareRecord(a: Auth, id: string, input: Record<string, unknown>) {
  const r = owned(a, id);
  const dentistId = typeof input.dentistId === "string" ? input.dentistId : "";
  const d = one<{ id: string; name: string; user_id: string | null }>("SELECT id, name, user_id FROM dentists WHERE id = ?", dentistId);
  if (!d) throw bad("Choose a dentist.");
  if (!d.user_id) throw new HttpError(409, "unclaimed", `${d.name} hasn't joined FMD yet, so documents can't be shared with them here. You can download the file and share it directly.`);
  const days = Number(input.days);
  if (![1, 7, 30, 90].includes(days)) throw bad("Choose how long the dentist can access it.");
  if (input.confirmed !== true) throw bad("Confirm that you want to share this document.");
  tx(() => {
    run("UPDATE record_shares SET revoked_at = ? WHERE record_id = ? AND dentist_id = ? AND revoked_at IS NULL", Date.now(), id, dentistId);
    run(
      "INSERT INTO record_shares (id, record_id, owner_id, dentist_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      randomUUID(), id, a.user.id, dentistId, Date.now(), Date.now() + days * 86400_000,
    );
    logAccess(id, a.user.id, "shared", `${d.name} · ${days} days`);
    audit(a.user.id, "record.shared", "record", id, { dentistId, days });
  });
  return view(r);
}

export function revokeShare(a: Auth, id: string, shareId: string) {
  const r = owned(a, id);
  const s = one<{ dentist_id: string }>("SELECT dentist_id FROM record_shares WHERE id = ? AND record_id = ? AND revoked_at IS NULL", shareId, id);
  if (!s) throw notFound("Share not found.");
  run("UPDATE record_shares SET revoked_at = ? WHERE id = ?", Date.now(), shareId);
  logAccess(id, a.user.id, "share_revoked");
  audit(a.user.id, "record.share_revoked", "record", id);
  return view(r);
}

/** Documents shared with the signed-in dentist (minimal patient identity: first name only). */
export function sharedWithMe(a: Auth) {
  const ids = dentistProfilesOf(a.user.id);
  if (!ids.length) return [];
  return all<RecordRow & { owner_name: string; expires_at: number }>(
    `SELECT r.*, u.name AS owner_name, s.expires_at FROM record_shares s JOIN records r ON r.id = s.record_id JOIN users u ON u.id = r.user_id
     WHERE s.dentist_id IN (${ids.map(() => "?").join(",")}) AND s.revoked_at IS NULL AND s.expires_at > ? AND r.deleted_at IS NULL
     ORDER BY s.created_at DESC`,
    ...ids,
    Date.now(),
  ).map((r) => ({ id: r.id, title: r.title, docTypeLabel: DOC_TYPES[r.doc_type], recordDate: r.record_date, patient: r.owner_name.split(" ")[0], expiresAt: r.expires_at }));
}

export function accessHistory(a: Auth, id: string) {
  owned(a, id);
  return all<{ kind: string; detail: string; at: number; actor: string | null }>(
    "SELECT e.kind, e.detail, e.at, u.name AS actor FROM record_access_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.record_id = ? ORDER BY e.at DESC",
    id,
  );
}

/** Patient-uploaded documents are deleted on request: shares end, the file is removed, metadata is tombstoned. */
export function deleteRecord(a: Auth, id: string) {
  const r = owned(a, id);
  if (r.source !== "patient_upload") throw new HttpError(409, "clinic_record", "Clinic-issued records can't be deleted here. Request deletion from your account.");
  tx(() => {
    run("UPDATE record_shares SET revoked_at = ? WHERE record_id = ? AND revoked_at IS NULL", Date.now(), id);
    run("UPDATE records SET deleted_at = ?, title = '[deleted]', clinic_name = '', provider_name = '', episode = '' WHERE id = ?", Date.now(), id);
    logAccess(id, a.user.id, "deleted");
    audit(a.user.id, "record.deleted", "record", id);
  });
  storage.remove(r.storage_key);
}

/** Portable export (MAIN-35): metadata manifest; files are downloaded via signed links. */
export function exportManifest(a: Auth) {
  const { items } = listRecords(a);
  for (const r of items) logAccess(r.id, a.user.id, "exported");
  audit(a.user.id, "records.exported", "user", a.user.id, { count: items.length });
  return {
    exportedAt: new Date().toISOString(),
    format: "fmd-records-manifest/v1",
    owner: { name: a.user.name },
    records: items.map((r) => ({ ...r, shares: r.shares.map((s) => ({ dentist: s.dentistName, expiresAt: new Date(s.expiresAt).toISOString() })) })),
  };
}
