import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { MIGRATIONS } from "./migrations.ts";

/**
 * Single data module: PostgreSQL. This app's tables live in their own schema (`app` by default) so they can share a
 * database with the FastAPI service (server/, schema `public`, owned by its Alembic migrations).
 * Times are epoch milliseconds (BIGINT, read back as numbers). Queries use `?` placeholders.
 *
 * Env: DATABASE_URL (required outside tests), FMD_DB_SCHEMA (default "app"), DATABASE_POOL_MAX (default 5),
 * DATABASE_SSL_VERIFY=1 to verify the server certificate (needs the CA in the system store). Tests (FMD_DB=":memory:")
 * use FMD_TEST_DATABASE_URL (default postgres://postgres:postgres@localhost:5432/fmd_app_test), schema app_test.
 */

// BIGINT (epoch ms, counts) and NUMERIC (SUM/AVG) as JS numbers: every value here is well inside 2^53
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);

export type Param = string | number | boolean | null | undefined | Buffer | Uint8Array;
type Db = pg.Pool | pg.PoolClient;

const testing = () => process.env.FMD_DB === ":memory:";
function settings() {
  if (testing())
    return { url: process.env.FMD_TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/fmd_app_test", schema: "app_test" };
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set: this app's data lives in PostgreSQL (see web/.env.example).");
  return { url, schema: process.env.FMD_DB_SCHEMA ?? "app" };
}

const g = globalThis as unknown as { __fmdPool?: pg.Pool; __fmdReady?: Promise<void>; __fmdMigrated?: number };
const txClient = new AsyncLocalStorage<pg.PoolClient>();

/** The pool, migrated. Survives dev hot reloads; migrations added since it opened are applied on the next call. */
async function pool(): Promise<pg.Pool> {
  if (!g.__fmdPool) {
    const { url, schema } = settings();
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__fmdPool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: process.env.DATABASE_SSL_VERIFY === "1" },
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      options: `-c search_path=${schema}`,
      allowExitOnIdle: true, // scripts and tests end without closing the pool by hand
    });
  }
  if (g.__fmdMigrated !== MIGRATIONS.length) {
    g.__fmdReady ??= migrate(g.__fmdPool).then(
      () => {
        g.__fmdMigrated = MIGRATIONS.length;
        g.__fmdReady = undefined;
      },
      (e) => {
        g.__fmdReady = undefined;
        throw e;
      },
    );
    await g.__fmdReady;
  }
  return g.__fmdPool;
}

/** Apply new migrations, one transaction each; an advisory lock keeps two instances from migrating at once. */
async function migrate(p: pg.Pool) {
  const { schema } = settings();
  const c = await p.connect();
  try {
    await c.query("SELECT pg_advisory_lock(hashtext('fmd-app-migrations'))");
    await c.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)");
    const done = new Set((await c.query<{ version: number }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
    for (const [i, sql] of MIGRATIONS.entries()) {
      const v = i + 1;
      if (done.has(v)) continue;
      await c.query("BEGIN");
      try {
        await c.query(sql);
        await c.query("INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", [v, Date.now()]);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw new Error(`Migration ${v} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.query("SELECT pg_advisory_unlock(hashtext('fmd-app-migrations'))").catch(() => {});
    c.release();
  }
}

/** `?` placeholders → `$1, $2…` (a `?` inside a quoted literal is left alone). */
const converted = new Map<string, string>();
function toPg(sql: string) {
  let out = converted.get(sql);
  if (out === undefined) {
    let n = 0;
    out = sql.replace(/'(?:[^']|'')*'|\?/g, (m) => (m === "?" ? `$${++n}` : m));
    converted.set(sql, out);
  }
  return out;
}

async function query<T extends pg.QueryResultRow>(sql: string, p: Param[]) {
  const db: Db = txClient.getStore() ?? (await pool());
  return await db.query<T>(toPg(sql), p.map((v) => (v === undefined ? null : v)));
}

export const one = async <T>(sql: string, ...p: Param[]) => ((await query(sql, p)).rows[0] as T | undefined) ?? undefined;
export const all = async <T>(sql: string, ...p: Param[]) => (await query(sql, p)).rows as T[];
export const run = async (sql: string, ...p: Param[]) => ({ changes: (await query(sql, p)).rowCount ?? 0 });

/**
 * A write transaction; rolls back on any throw. Nested calls join the outer transaction. SERIALIZABLE, so the
 * check-then-write rules (double bookings, idempotency keys, last owner) hold under concurrency as they did when
 * SQLite serialised all writes; a conflicting transaction is retried a few times.
 */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txClient.getStore()) return await fn();
  const p = await pool();
  for (let attempt = 1; ; attempt++) {
    const c = await p.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const r = await txClient.run(c, fn);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      const code = (e as { code?: string }).code;
      if ((code === "40001" || code === "40P01") && attempt < 5) {
        await new Promise((r) => setTimeout(r, 10 * attempt + Math.random() * 20));
        continue;
      }
      throw e;
    } finally {
      c.release();
    }
  }
}

/** Dev only: seed the labelled demo directory once (never in production or tests). */
export async function devSeed(seed: () => unknown) {
  if (process.env.NODE_ENV === "production" || testing() || process.env.FMD_SEED_DEMO === "0") return;
  await seed();
}

/**
 * Test helper: back to a freshly migrated database. The first call in a process rebuilds the test schema and notes the
 * tables the migrations themselves fill (reference data such as `plans`); later calls empty every other table.
 */
let testTables: string[] | null = null;
export async function resetDb() {
  if (!testing()) throw new Error("resetDb is for tests only.");
  const { schema } = settings();
  let p = await pool();
  if (!testTables) {
    await p.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    g.__fmdMigrated = undefined;
    p = await pool();
    const all = (await p.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename != 'schema_migrations'", [schema])).rows.map((t) => t.tablename);
    const filled = await Promise.all(all.map(async (t) => ((await p.query(`SELECT 1 FROM "${t}" LIMIT 1`)).rowCount ? null : t)));
    testTables = filled.filter((t): t is string => t !== null); // the tables a test may write to
    return;
  }
  if (testTables.length) await p.query(`TRUNCATE ${testTables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/** Close the pool (tests, scripts): lets the process exit. */
export async function closeDb() {
  await g.__fmdPool?.end();
  g.__fmdPool = undefined;
  g.__fmdMigrated = undefined;
}

/** Append-only audit trail (PRD §13). Never store raw secrets or clinical content in meta. */
export async function audit(actorId: string | null, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  await run(
    "INSERT INTO audit_events (at, actor_id, action, target_type, target_id, meta) VALUES (?, ?, ?, ?, ?, ?)",
    Date.now(),
    actorId,
    action,
    targetType,
    targetId,
    JSON.stringify(meta),
  );
}

/** A unique index refused the row (Postgres 23505), e.g. a slot someone else just took. */
export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";
