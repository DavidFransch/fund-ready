import { assertIsoDate, type IsoDate } from "./dates";
import { LedgerError } from "./errors";
import { assertCents, type Cents } from "./money";

export type ItemKind = "stock" | "non_stock";

export interface Item {
  id: string;
  name: string;
  /** Stock items are counted and valued. Non-stock items (services, made-to-order goods) never touch stock. */
  kind: ItemKind;
  /** Unit shown to the user, e.g. "bags", "trays", "hours". Quantities are whole numbers of this unit. */
  unit: string;
  /** Default selling price per unit. */
  salePrice: Cents;
  reorderLevel?: number;
}

export type MovementType = "opening" | "purchase" | "sale" | "count_adjustment";

export interface StockMovement {
  id: string;
  itemId: string;
  date: IsoDate;
  type: MovementType;
  /** Signed whole quantity: positive in, negative out. */
  qty: number;
  /** Signed total cost: positive in, negative out. */
  cost: Cents;
  /** Journal entry id this movement belongs to. */
  entryId: string;
}

export interface StockLevel {
  itemId: string;
  qty: number;
  /** Total cost of what is on hand (weighted average method). */
  cost: Cents;
  /** Unit cost of the most recent purchase; used to cost sales when stock has run out. */
  lastUnitCost: Cents;
}

export function emptyLevel(itemId: string): StockLevel {
  return { itemId, qty: 0, cost: 0, lastUnitCost: 0 };
}

function assertQty(qty: number): void {
  if (!Number.isSafeInteger(qty)) throw new LedgerError(`Quantity must be a whole number, got ${qty}`);
}

/**
 * Cost of taking `qty` units out of stock, using weighted average cost.
 * Taking everything removes exactly the cost on hand, so no rounding is left behind.
 * Selling more than is recorded is allowed (people sell before recording purchases);
 * the excess is costed at the last known unit cost.
 */
export function costOfIssue(level: StockLevel, qty: number): Cents {
  assertQty(qty);
  if (qty <= 0) throw new LedgerError("Issue quantity must be positive");
  if (level.qty <= 0) return qty * level.lastUnitCost;
  if (qty === level.qty) return level.cost;
  if (qty < level.qty) return Math.round((level.cost * qty) / level.qty);
  return level.cost + (qty - level.qty) * unitCost(level);
}

/** Current average unit cost (rounded, for display and costing). */
export function unitCost(level: StockLevel): Cents {
  if (level.qty > 0) return Math.round(level.cost / level.qty);
  return level.lastUnitCost;
}

export function applyMovement(level: StockLevel, m: StockMovement): StockLevel {
  assertIsoDate(m.date, "movement date");
  assertQty(m.qty);
  assertCents(m.cost, "movement cost");
  if (m.qty !== 0 && Math.sign(m.cost) !== 0 && Math.sign(m.cost) !== Math.sign(m.qty)) {
    throw new LedgerError("Movement quantity and cost must move in the same direction");
  }
  const qty = level.qty + m.qty;
  // Never drop cost here: the stock sub-ledger must always equal the Stock account.
  const cost = level.cost + m.cost;
  const lastUnitCost =
    (m.type === "purchase" || m.type === "opening") && m.qty > 0
      ? Math.round(m.cost / m.qty)
      : level.lastUnitCost;
  return { itemId: level.itemId, qty, cost, lastUnitCost };
}

/** Replay movements (in date order) into current stock levels. */
export function stockLevels(movements: readonly StockMovement[]): Map<string, StockLevel> {
  const sorted = [...movements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const levels = new Map<string, StockLevel>();
  for (const m of sorted) {
    levels.set(m.itemId, applyMovement(levels.get(m.itemId) ?? emptyLevel(m.itemId), m));
  }
  return levels;
}

export function totalStockValue(levels: Iterable<StockLevel>): Cents {
  let total = 0;
  for (const l of levels) total += l.cost;
  return total;
}
