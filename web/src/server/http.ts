/** Thin HTTP layer shared by route handlers. Business rules live in the services. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const bad = (message: string, code = "invalid") => new HttpError(400, code, message);
export const unauthenticated = () => new HttpError(401, "unauthenticated", "Please sign in.");
export const forbidden = () => new HttpError(403, "forbidden", "You don't have access to this.");
export const notFound = (what = "Not found") => new HttpError(404, "not_found", what);

/**
 * Wrap a handler: JSON errors, no stack traces to clients, and a CSRF guard —
 * mutating requests must be JSON (cross-site forms can't send that without a preflight)
 * and, when the browser sends Origin, it must match the host.
 */
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response> | Response) {
  return async (req: Request, ctx: C) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const ct = req.headers.get("content-type") ?? "";
        const isUpload = ct.startsWith("multipart/form-data");
        if (!ct.startsWith("application/json") && !isUpload) throw new HttpError(415, "unsupported", "Expected JSON.");
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(req.url).host) throw forbidden();
      }
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return Response.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {}
  throw bad("Request body must be a JSON object.");
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
}

/* --- tiny validators: return the value or throw 400 with a human message --- */
export function str(v: unknown, field: string, { min = 1, max = 500, optional = false } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (optional) return "";
    throw bad(`${field} is required.`);
  }
  if (typeof v !== "string") throw bad(`${field} must be text.`);
  const s = v.trim();
  if (s.length < min) throw bad(`${field} is too short.`);
  if (s.length > max) throw bad(`${field} is too long (max ${max} characters).`);
  return s;
}

export function oneOf<T extends string>(v: unknown, field: string, options: readonly T[]): T {
  if (typeof v === "string" && (options as readonly string[]).includes(v)) return v as T;
  throw bad(`${field} must be one of: ${options.join(", ")}.`);
}

export const bool = (v: unknown) => v === true;
