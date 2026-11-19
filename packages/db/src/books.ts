import {
  LedgerError,
  post,
  reverseEntry,
  stockLevels,
  type AccountCode,
  type Command,
  type Item,
  type JournalEntry,
  type StockMovement,
} from "@app/ledger";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { Db } from "./client";
import { businesses, commands, items, journalEntries, journalLines, stockMovements } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface ExecuteResult {
  /** True when this command id was already recorded; nothing new was written. */
  duplicate: boolean;
  entryId: string | null;
}

function itemIdsIn(cmd: Command): string[] {
  switch (cmd.kind) {
    case "sale":
      return cmd.lines.flatMap((l) => (l.itemId ? [l.itemId] : []));
    case "expense":
      return (cmd.stockLines ?? []).map((l) => l.itemId);
    case "stock_count":
      return cmd.counts.map((c) => c.itemId);
    case "opening_balance":
      return cmd.stock.map((l) => l.itemId);
    default:
      return [];
  }
}

async function loadItems(tx: Tx | Db, businessId: string): Promise<Map<string, Item>> {
  const rows = await tx.select().from(items).where(eq(items.businessId, businessId));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        kind: r.kind,
        unit: r.unit,
        salePrice: r.salePrice,
        ...(r.reorderLevel != null ? { reorderLevel: r.reorderLevel } : {}),
      },
    ]),
  );
}

async function loadMovements(tx: Tx | Db, businessId: string, itemIds?: string[]): Promise<StockMovement[]> {
  if (itemIds && itemIds.length === 0) return [];
  const rows = await tx
    .select()
    .from(stockMovements)
    .where(
      itemIds
        ? and(eq(stockMovements.businessId, businessId), inArray(stockMovements.itemId, itemIds))
        : eq(stockMovements.businessId, businessId),
    )
    .orderBy(asc(stockMovements.date), asc(stockMovements.createdAt));
  return rows.map((r) => ({ id: r.id, itemId: r.itemId, date: r.date, type: r.type, qty: r.qty, cost: r.cost, entryId: r.entryId }));
}

async function writeResult(
  tx: Tx,
  businessId: string,
  userId: string | null,
  entry: JournalEntry | null,
  movements: StockMovement[],
): Promise<void> {
  if (entry) {
    await tx.insert(journalEntries).values({
      id: entry.id,
      businessId,
      date: entry.date,
      memo: entry.memo,
      sourceType: entry.source.type,
      sourceRef: entry.source.ref ?? null,
      reverses: entry.reverses ?? null,
      createdBy: userId,
    });
    await tx.insert(journalLines).values(
      entry.lines.map((l) => ({
        entryId: entry.id,
        businessId,
        accountCode: l.account,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo ?? null,
      })),
    );
  }
  if (movements.length) {
    await tx.insert(stockMovements).values(movements.map((m) => ({ ...m, businessId })));
  }
}

/**
 * Record one user action. Runs in a single transaction, serialised per business,
 * so stock costing always sees a consistent history. Safe to retry with the same id.
 */
export async function executeCommand(
  db: Db,
  input: { businessId: string; userId: string | null; command: Command },
): Promise<ExecuteResult> {
  const { businessId, userId, command } = input;
  return db.transaction(async (tx) => {
    const [business] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");
    if (!business) throw new LedgerError("Business not found");

    const [existing] = await tx.select({ id: commands.id }).from(commands).where(eq(commands.id, command.id));
    if (existing) return { duplicate: true, entryId: null };

    const itemMap = await loadItems(tx, businessId);
    const levels = stockLevels(await loadMovements(tx, businessId, [...new Set(itemIdsIn(command))]));
    const result = post(command, { items: itemMap, levels, closedThrough: business.closedThrough ?? undefined });

    await tx.insert(commands).values({ id: command.id, businessId, kind: command.kind, payload: command, createdBy: userId });
    await writeResult(tx, businessId, userId, result.entry, result.movements);
    return { duplicate: false, entryId: result.entry?.id ?? null };
  });
}

/** Correct a mistake by posting the mirror image of an entry (and its stock movements). */
export async function reverseRecordedEntry(
  db: Db,
  input: { businessId: string; userId: string | null; entryId: string; reversalId: string; date: string; memo?: string },
): Promise<ExecuteResult> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select().from(businesses).where(eq(businesses.id, input.businessId)).for("update");
    if (!business) throw new LedgerError("Business not found");
    const [existing] = await tx.select({ id: commands.id }).from(commands).where(eq(commands.id, input.reversalId));
    if (existing) return { duplicate: true, entryId: null };

    const [original] = await loadEntries(tx, input.businessId, { entryId: input.entryId });
    if (!original) throw new LedgerError("Entry not found");
    if (business.closedThrough && input.date.slice(0, 7) <= business.closedThrough) {
      throw new LedgerError("Corrections must be dated in an open month");
    }
    const entry = reverseEntry(original, { id: input.reversalId, date: input.date, ...(input.memo ? { memo: input.memo } : {}) });
    const movements = (
      await tx.select().from(stockMovements).where(eq(stockMovements.entryId, input.entryId))
    ).map((m, i): StockMovement => ({
      id: `${input.reversalId}:${i}`,
      itemId: m.itemId,
      date: input.date,
      type: m.type,
      qty: -m.qty,
      cost: -m.cost,
      entryId: input.reversalId,
    }));
    await tx.insert(commands).values({
      id: input.reversalId,
      businessId: input.businessId,
      kind: "reversal",
      payload: { reverses: input.entryId, date: input.date },
      createdBy: input.userId,
    });
    await writeResult(tx, input.businessId, input.userId, entry, movements);
    return { duplicate: false, entryId: entry.id };
  });
}

export async function closeMonth(db: Db, businessId: string, month: string): Promise<void> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new LedgerError("Month must be YYYY-MM");
  await db.transaction(async (tx) => {
    const [business] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");
    if (!business) throw new LedgerError("Business not found");
    if (business.closedThrough && month < business.closedThrough) throw new LedgerError("That month is already closed");
    await tx.update(businesses).set({ closedThrough: month }).where(eq(businesses.id, businessId));
  });
}

/** Load journal entries with their lines, for reports. */
export async function loadEntries(
  db: Db | Tx,
  businessId: string,
  options: { to?: string; entryId?: string } = {},
): Promise<JournalEntry[]> {
  const conditions = [eq(journalEntries.businessId, businessId)];
  if (options.to) conditions.push(lte(journalEntries.date, options.to));
  if (options.entryId) conditions.push(eq(journalEntries.id, options.entryId));
  const rows = await db
    .select({ entry: journalEntries, line: journalLines })
    .from(journalEntries)
    .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
    .where(and(...conditions))
    .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt), asc(journalLines.id));

  const byId = new Map<string, JournalEntry>();
  for (const { entry: e, line: l } of rows) {
    let entry = byId.get(e.id);
    if (!entry) {
      entry = {
        id: e.id,
        date: e.date,
        memo: e.memo,
        source: { type: e.sourceType as JournalEntry["source"]["type"], ...(e.sourceRef ? { ref: e.sourceRef } : {}) },
        lines: [],
        ...(e.reverses ? { reverses: e.reverses } : {}),
      };
      byId.set(e.id, entry);
    }
    entry.lines.push({ account: l.accountCode as AccountCode, debit: l.debit, credit: l.credit, ...(l.memo ? { memo: l.memo } : {}) });
  }
  return [...byId.values()];
}

export async function loadStock(db: Db, businessId: string) {
  const [itemMap, movements] = await Promise.all([loadItems(db, businessId), loadMovements(db, businessId)]);
  return { items: itemMap, levels: stockLevels(movements) };
}
