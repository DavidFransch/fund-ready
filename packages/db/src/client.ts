import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * DATABASE_URL works for local Postgres and for Cloud Run, where Cloud SQL is reached
 * over its Unix socket: postgres://USER:PASS@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE
 */
export function createDb(url = process.env.DATABASE_URL): { db: Db; pool: pg.Pool } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5) });
  return { db: drizzle(pool, { schema }), pool };
}

let shared: Db | undefined;

/** One pool per server process. */
export function getDb(): Db {
  shared ??= createDb().db;
  return shared;
}
