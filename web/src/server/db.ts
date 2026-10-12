import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { MIGRATIONS } from "./migrations.ts";

/**
 * Single data module. Dev/test: Node's built-in SQLite (OD-20). SQL is kept portable
 * (no SQLite-only types) so the same statements can move to PostgreSQL.
 * Times are epoch milliseconds (INTEGER → BIGINT).
 */
const g = globalThis as unknown as { __fmdDb?: DatabaseSync; __fmdMigrated?: number };

export function db(): DatabaseSync {
  if (g.__fmdDb) {
    // the connection survives dev hot reloads; apply migrations added since it opened
    if (g.__fmdMigrated !== MIGRATIONS.length) {
      migrate(g.__fmdDb);
      g.__fmdMigrated = MIGRATIONS.length;
    }
    return g.__fmdDb;
  }
  const file = process.env.FMD_DB ?? join(process.cwd(), ".data", "fmd.db");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("PRAGMA foreign_keys = ON;");
  if (file !== ":memory:") d.exec("PRAGMA journal_mode = WAL;");
  migrate(d);
  g.__fmdDb = d;
  g.__fmdMigrated = MIGRATIONS.length;
  return d;
}

/** Dev only: seed the labelled demo directory once (never in production or tests). */
export function devSeed(seed: () => unknown) {
  const file = process.env.FMD_DB ?? "";
  if (process.env.NODE_ENV === "production" || file === ":memory:" || process.env.FMD_SEED_DEMO === "0") return;
  seed();
}

/** Test helper: drop the cached connection so the next db() opens a fresh one. */
export function resetDb() {
  g.__fmdDb?.close();
  g.__fmdDb = undefined;
}

function migrate(d: DatabaseSync) {
  d.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((d.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version));
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (done.has(v)) return;
    d.exec("BEGIN");
    try {
      d.exec(sql);
      d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(v, Date.now());
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  });
}

export const one = <T>(sql: string, ...p: SQLInputValue[]) => db().prepare(sql).get(...p) as T | undefined;
export const all = <T>(sql: string, ...p: SQLInputValue[]) => db().prepare(sql).all(...p) as T[];
export const run = (sql: string, ...p: SQLInputValue[]) => db().prepare(sql).run(...p);

/** Serialised write transaction; rolls back on any throw. Nested calls join the outer transaction. */
let depth = 0;
export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn();
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  } finally {
    depth--;
  }
}

/** Append-only audit trail (PRD §13). Never store raw secrets or clinical content in meta. */
export function audit(actorId: string | null, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  run(
    "INSERT INTO audit_events (at, actor_id, action, target_type, target_id, meta) VALUES (?, ?, ?, ?, ?, ?)",
    Date.now(),
    actorId,
    action,
    targetType,
    targetId,
    JSON.stringify(meta),
  );
}
