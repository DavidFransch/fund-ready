import { getDb } from "@app/db";
import { sql } from "drizzle-orm";
import { connection } from "next/server";

/** Liveness check for Cloud Run. `?db=1` also checks the database connection. */
export async function GET(request: Request) {
  await connection();
  const checkDb = new URL(request.url).searchParams.get("db") === "1";
  if (!checkDb) return Response.json({ ok: true });
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, db: "ok" });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
