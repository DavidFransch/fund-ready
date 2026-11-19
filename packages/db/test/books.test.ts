import { ACC, balanceSheet, Book, netBalances, rand, totalStockValue, type Command } from "@app/ledger";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessAccess, closeMonth, createDb, executeCommand, loadEntries, loadStock, reverseRecordedEntry, schema } from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/books_test";
const { db, pool } = createDb(url);

let businessId: string;
const itemIds: Record<string, string> = {};

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  const [b] = await db.insert(schema.businesses).values({ name: "Nomsa's Kitchen" }).returning();
  businessId = b!.id;
  for (const [key, kind, unit] of [
    ["tray", "stock", "trays"],
    ["flour", "stock", "bags"],
    ["staff", "non_stock", "hours"],
  ] as const) {
    const [row] = await db.insert(schema.items).values({ businessId, name: key, kind, unit, salePrice: rand(100) }).returning();
    itemIds[key] = row!.id;
  }
});

afterAll(async () => {
  await pool.end();
});

/** Drizzle wraps Postgres errors; check the database's own message. */
async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } };
    return `${err.message ?? ""} ${err.cause?.message ?? ""}`;
  }
  return "no error";
}

const run = (command: Command) => executeCommand(db, { businessId, userId: null, command });

describe("books in Postgres", () => {
  it("matches the in-memory reference books for the same commands", async () => {
    const cmds: Command[] = [
      { kind: "opening_balance", id: randomUUID(), date: "2026-09-01", cashBox: rand(1000), bank: rand(5000), stock: [{ itemId: itemIds.tray!, qty: 9, cost: rand(1800) }, { itemId: itemIds.flour!, qty: 2, cost: rand(520) }] },
      { kind: "sale", id: randomUUID(), date: "2026-09-05", paidWith: "credit", customer: "Sizwe", lines: [{ itemId: itemIds.tray!, description: "trays", qty: 3, unitPrice: rand(500) }, { itemId: itemIds.staff!, description: "staff", qty: 2, unitPrice: rand(150) }] },
      { kind: "expense", id: randomUUID(), date: "2026-09-06", amount: rand(640), category: "stock", paidFrom: "cash", stockLines: [{ itemId: itemIds.flour!, qty: 2, cost: rand(520) }, { itemId: itemIds.tray!, qty: 1, cost: rand(120) }] },
      { kind: "expense", id: randomUUID(), date: "2026-09-07", amount: rand(60), category: "transport", paidFrom: "own" },
      { kind: "stock_count", id: randomUUID(), date: "2026-09-30", counts: [{ itemId: itemIds.tray!, counted: 6 }] },
    ];
    const book = new Book([...Object.entries(itemIds)].map(([k, id]) => ({ id, name: k, kind: k === "staff" ? "non_stock" : "stock", unit: "x", salePrice: rand(100) })));
    for (const c of cmds) {
      book.execute(c);
      await run(c);
    }
    const entries = await loadEntries(db, businessId);
    expect(netBalances(entries)).toEqual(netBalances(book.entries));
    const { levels } = await loadStock(db, businessId);
    expect(totalStockValue(levels.values())).toBe(netBalances(entries).get(ACC.stock));
    expect(balanceSheet(entries, "2026-09-30").balanced).toBe(true);
  });

  it("ignores a retried command", async () => {
    const cmd: Command = { kind: "sale", id: randomUUID(), date: "2026-10-01", paidWith: "cash", lines: [{ description: "x", qty: 1, unitPrice: rand(10) }] };
    expect((await run(cmd)).duplicate).toBe(false);
    expect((await run(cmd)).duplicate).toBe(true);
    const entries = await loadEntries(db, businessId, { entryId: cmd.id });
    expect(entries).toHaveLength(1);
  });

  it("refuses to edit or delete history", async () => {
    expect(await pgError(db.execute(sql`update journal_lines set debit_cents = debit_cents + 1`))).toMatch(/append-only/);
    expect(await pgError(db.execute(sql`delete from journal_entries`))).toMatch(/append-only/);
  });

  it("refuses an unbalanced entry written directly to the database", async () => {
    const id = randomUUID();
    const message = await pgError(
      db.transaction(async (tx) => {
        await tx.insert(schema.journalEntries).values({ id, businessId, date: "2026-10-02", memo: "bad", sourceType: "manual" });
        await tx.insert(schema.journalLines).values([
          { entryId: id, businessId, accountCode: ACC.cashBox, debit: 100, credit: 0 },
          { entryId: id, businessId, accountCode: ACC.sales, debit: 0, credit: 99 },
        ]);
      }),
    );
    expect(message).toMatch(/does not balance/);
  });

  it("closes a month and corrects mistakes with reversals in the open month", async () => {
    const saleId = randomUUID();
    await run({ kind: "sale", id: saleId, date: "2026-10-10", paidWith: "cash", lines: [{ itemId: itemIds.tray!, description: "t", qty: 1, unitPrice: rand(500) }] });
    await closeMonth(db, businessId, "2026-10");
    await expect(run({ kind: "sale", id: randomUUID(), date: "2026-10-20", paidWith: "cash", lines: [{ description: "x", qty: 1, unitPrice: 100 }] })).rejects.toThrow(/closed/);
    const before = (await loadStock(db, businessId)).levels.get(itemIds.tray!)!.qty;
    await reverseRecordedEntry(db, { businessId, userId: null, entryId: saleId, reversalId: randomUUID(), date: "2026-11-01" });
    expect((await loadStock(db, businessId)).levels.get(itemIds.tray!)!.qty).toBe(before + 1);
    await expect(
      reverseRecordedEntry(db, { businessId, userId: null, entryId: saleId, reversalId: randomUUID(), date: "2026-11-02" }),
    ).rejects.toThrow();
  });

  it("only lets funders see businesses that consented", async () => {
    const [u] = await db.insert(schema.user).values({ id: "funder-1", name: "Funder", email: "f@example.com" }).returning();
    const [p] = await db.insert(schema.programmes).values({ name: "Demo programme", funderName: "Demo funder" }).returning();
    await db.insert(schema.programmeMembers).values({ programmeId: p!.id, userId: u!.id, role: "manager" });
    await db.insert(schema.programmeBusinesses).values({ programmeId: p!.id, businessId });
    expect(await businessAccess(db, u!.id, businessId)).toBeNull();
    await db.update(schema.programmeBusinesses).set({ consentedAt: new Date() });
    expect(await businessAccess(db, u!.id, businessId)).toEqual({ kind: "funder", programmeId: p!.id });
  });
});
