import { Pool, type QueryResultRow } from "pg";

// One pool per process. Next.js hot-reloads modules in dev, so stash it on the
// global object or every edit leaks a pool and the DB runs out of connections.
const globalForDb = globalThis as unknown as { __gridgamePool?: Pool };

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Supabase's pooler terminates TLS with a cert that Node won't chase; local
  // Postgres has no TLS at all. Only ask for SSL when talking to a remote host.
  const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // Serverless: many short-lived instances, so keep each one's share small.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  if (!globalForDb.__gridgamePool) {
    globalForDb.__gridgamePool = makePool();
  }
  return globalForDb.__gridgamePool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs fn inside a transaction on a single dedicated client. */
export async function transaction<T>(
  fn: (run: <R extends QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(async <R extends QueryResultRow>(text: string, params: unknown[] = []) => {
      const r = await client.query<R>(text, params);
      return r.rows;
    });
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
