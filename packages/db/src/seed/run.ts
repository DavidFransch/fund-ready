import { addDays } from "@app/ledger";
import { createDb } from "../client";
import { seedDemo } from "./index";

/** Seeds demo business data. Users and memberships are created by the web app's seed (it owns login). */
const end = process.env.SEED_END ?? addDays(new Date().toISOString().slice(0, 10), -1);
const { db, pool } = createDb();
const ids = await seedDemo(db, end);
await pool.end();
console.log(`Seeded demo data up to ${end}:`, ids);
