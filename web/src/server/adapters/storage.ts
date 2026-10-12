import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Private object storage adapter (OD-14: cloud vendor not chosen).
 * DEV implementation: files under ./.data/objects, outside /public, addressed by opaque keys.
 * A production adapter (S3-compatible, encrypted at rest) keeps the same interface.
 * Malware scanning is not available in this adapter — see PLT-07.
 */
const root = () => (process.env.FMD_DB === ":memory:" ? join(process.cwd(), ".data", "test-objects") : join(process.cwd(), ".data", "objects"));

export const storage = {
  configured: false,
  kind: "local-dev",
  put(bytes: Uint8Array): string {
    const key = randomUUID();
    mkdirSync(root(), { recursive: true });
    writeFileSync(join(root(), key), bytes);
    return key;
  },
  get(key: string): Buffer {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("bad key");
    return readFileSync(join(root(), key));
  },
  remove(key: string) {
    if (/^[0-9a-f-]{36}$/.test(key) && existsSync(join(root(), key))) rmSync(join(root(), key));
  },
};

/* ---------------- signed, expiring links ---------------- */

/** Secret from env; in dev, a random per-machine secret is created once under .data. */
function secret(): Buffer {
  if (process.env.FMD_SIGNING_SECRET) return Buffer.from(process.env.FMD_SIGNING_SECRET);
  const file = join(process.cwd(), ".data", "signing-secret");
  if (process.env.FMD_DB === ":memory:") return Buffer.from("test-secret-not-for-production");
  if (!existsSync(file)) {
    mkdirSync(join(process.cwd(), ".data"), { recursive: true });
    writeFileSync(file, randomBytes(32).toString("hex"));
  }
  return Buffer.from(readFileSync(file, "utf8"));
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Token binds record, the viewer it was issued to, purpose and expiry. */
export function signLink(p: { recordId: string; viewerId: string; mode: "view" | "download"; ttlSeconds?: number }) {
  const exp = Date.now() + (p.ttlSeconds ?? 300) * 1000;
  const payload = b64(JSON.stringify({ r: p.recordId, v: p.viewerId, m: p.mode, e: exp }));
  return { token: `${payload}.${mac(payload)}`, expiresAt: exp };
}

export function verifyLink(token: string): { recordId: string; viewerId: string; mode: "view" | "download" } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = mac(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof p.e !== "number" || p.e < Date.now()) return null;
    return { recordId: p.r, viewerId: p.v, mode: p.m === "download" ? "download" : "view" };
  } catch {
    return null;
  }
}

/* ---------------- content sniffing ---------------- */

/** Trust the bytes, not the file name or the browser-reported type. */
export function sniffMime(b: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((x, i) => b[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length > 132 && b[128] === 0x44 && b[129] === 0x49 && b[130] === 0x43 && b[131] === 0x4d) return "application/dicom"; // DICM at 128
  return null;
}
