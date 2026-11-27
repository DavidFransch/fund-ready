import { ACC, expenseCategory, type AccountCode, type ExpenseCategoryId } from "./accounts";
import { assertIsoDate, type IsoDate, type IsoMonth } from "./dates";
import { LedgerError } from "./errors";
import {
  applyMovement,
  costOfIssue,
  emptyLevel,
  unitCost,
  type Item,
  type StockLevel,
  type StockMovement,
} from "./inventory";
import { assertPeriodOpen, cr, dr, makeEntry, type JournalEntry, type JournalLine } from "./journal";
import { assertCents, sumCents, times, type Cents } from "./money";

/**
 * Commands are what the user does in plain language. `post()` turns each command
 * into one balanced journal entry plus any stock movements. Every command carries
 * a client-generated `id`, which becomes the entry id (idempotency key).
 */

export type PaymentMethod = "cash" | "card" | "eft" | "credit";
export type MoneyPlace = "cash" | "bank";

export interface SaleLine {
  /** Set for items from the catalogue. Free-text lines have no item. */
  itemId?: string;
  description: string;
  qty: number;
  unitPrice: Cents;
}

export interface RecordSale {
  kind: "sale";
  id: string;
  date: IsoDate;
  lines: SaleLine[];
  /** "credit" means the customer pays later (an invoice). */
  paidWith: PaymentMethod;
  customer?: string;
  invoiceNumber?: string;
}

export interface ReceivePayment {
  kind: "payment_received";
  id: string;
  date: IsoDate;
  amount: Cents;
  into: MoneyPlace;
  customer?: string;
  invoiceNumber?: string;
}

export interface StockPurchaseLine {
  itemId: string;
  qty: number;
  cost: Cents;
}

export interface RecordExpense {
  kind: "expense";
  id: string;
  date: IsoDate;
  amount: Cents;
  category: ExpenseCategoryId;
  /**
   * "own" means the owner paid from their own pocket: the business now owes them.
   * "credit" means the supplier is paid later: the business owes the supplier.
   */
  paidFrom: MoneyPlace | "own" | "credit";
  supplier?: string;
  /** Required when category is "stock"; costs must add up to `amount`. */
  stockLines?: StockPurchaseLine[];
}

/** Pay a supplier for something bought earlier on credit. */
export interface PaySupplier {
  kind: "payment_made";
  id: string;
  date: IsoDate;
  amount: Cents;
  from: MoneyPlace;
  supplier: string;
}

export interface RecordStockCount {
  kind: "stock_count";
  id: string;
  date: IsoDate;
  /** `reason` applies when there is less than recorded: "used" (e.g. ingredients cooked) or "lost" (default). */
  counts: { itemId: string; counted: number; reason?: "used" | "lost" }[];
}

export interface Transfer {
  kind: "transfer";
  id: string;
  date: IsoDate;
  amount: Cents;
  from: MoneyPlace;
  to: MoneyPlace;
}

export interface OwnerContribution {
  kind: "owner_contribution";
  id: string;
  date: IsoDate;
  amount: Cents;
  into: MoneyPlace;
}

/** Money in that isn't from selling, e.g. interest from the bank. */
export interface OtherIncome {
  kind: "other_income";
  id: string;
  date: IsoDate;
  amount: Cents;
  into: MoneyPlace;
  description?: string;
}

/** The owner takes money out of the business for themselves (not a business expense). */
export interface OwnerDrawing {
  kind: "owner_drawing";
  id: string;
  date: IsoDate;
  amount: Cents;
  from: MoneyPlace;
}

export interface OpeningBalances {
  kind: "opening_balance";
  id: string;
  date: IsoDate;
  cashBox: Cents;
  bank: Cents;
  stock: StockPurchaseLine[];
}

export type Command =
  | RecordSale
  | ReceivePayment
  | PaySupplier
  | RecordExpense
  | RecordStockCount
  | Transfer
  | OwnerContribution
  | OwnerDrawing
  | OtherIncome
  | OpeningBalances;

export interface PostingContext {
  items: ReadonlyMap<string, Item>;
  levels: ReadonlyMap<string, StockLevel>;
  closedThrough?: IsoMonth;
}

export interface PostingResult {
  entry: JournalEntry | null;
  movements: StockMovement[];
}

const PLACE_ACCOUNT: Record<MoneyPlace, AccountCode> = { cash: ACC.cashBox, bank: ACC.bank };

function paymentAccount(method: PaymentMethod): AccountCode {
  switch (method) {
    case "cash":
      return ACC.cashBox;
    case "card":
    case "eft":
      return ACC.bank;
    case "credit":
      return ACC.debtors;
  }
}

function positive(amount: Cents, label: string): void {
  assertCents(amount, label);
  if (amount <= 0) throw new LedgerError(`${label} must be more than zero`);
}

function wholePositive(qty: number, label: string): void {
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new LedgerError(`${label} must be a whole number above zero`);
}

/** Tracks stock levels while one command is being posted, so repeated items are costed correctly. */
class LevelTracker {
  private readonly working = new Map<string, StockLevel>();
  constructor(private readonly base: ReadonlyMap<string, StockLevel>) {}
  get(itemId: string): StockLevel {
    return this.working.get(itemId) ?? this.base.get(itemId) ?? emptyLevel(itemId);
  }
  apply(m: StockMovement): void {
    this.working.set(m.itemId, applyMovement(this.get(m.itemId), m));
  }
}

function stockItem(ctx: PostingContext, itemId: string): Item {
  const item = ctx.items.get(itemId);
  if (!item) throw new LedgerError(`Unknown item ${itemId}`);
  return item;
}

export function post(cmd: Command, ctx: PostingContext): PostingResult {
  assertIsoDate(cmd.date, "date");
  assertPeriodOpen(cmd.date, ctx.closedThrough);
  switch (cmd.kind) {
    case "sale":
      return postSale(cmd, ctx);
    case "payment_received":
      return postPayment(cmd);
    case "payment_made":
      return postSupplierPayment(cmd);
    case "expense":
      return postExpense(cmd, ctx);
    case "stock_count":
      return postStockCount(cmd, ctx);
    case "transfer":
      return postTransfer(cmd);
    case "owner_contribution":
      return postContribution(cmd);
    case "owner_drawing":
      return postDrawing(cmd);
    case "other_income":
      return postOtherIncome(cmd);
    case "opening_balance":
      return postOpening(cmd, ctx);
  }
}

function postSale(cmd: RecordSale, ctx: PostingContext): PostingResult {
  if (cmd.lines.length === 0) throw new LedgerError("A sale needs at least one line");
  if (cmd.paidWith === "credit" && !cmd.customer) {
    throw new LedgerError("Say who owes the money when they pay later");
  }
  const tracker = new LevelTracker(ctx.levels);
  const movements: StockMovement[] = [];
  const lineTotals: Cents[] = [];
  let cost = 0;

  cmd.lines.forEach((line, i) => {
    wholePositive(line.qty, "Quantity");
    assertCents(line.unitPrice, "Price");
    if (line.unitPrice < 0) throw new LedgerError("Price cannot be negative");
    lineTotals.push(times(line.unitPrice, line.qty));
    if (!line.itemId) return;
    const item = stockItem(ctx, line.itemId);
    if (item.kind !== "stock") return;
    const issueCost = costOfIssue(tracker.get(item.id), line.qty);
    const m: StockMovement = {
      id: `${cmd.id}:${i}`,
      itemId: item.id,
      date: cmd.date,
      type: "sale",
      qty: -line.qty,
      cost: -issueCost,
      entryId: cmd.id,
    };
    tracker.apply(m);
    movements.push(m);
    cost += issueCost;
  });

  const total = sumCents(lineTotals);
  positive(total, "Sale total");
  const who = cmd.customer ? ` to ${cmd.customer}` : "";
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: cmd.invoiceNumber ? `Invoice ${cmd.invoiceNumber}${who}` : `Sale${who}`,
    source: { type: "sale", ...(cmd.invoiceNumber ? { ref: cmd.invoiceNumber } : {}) },
    lines: [
      dr(paymentAccount(cmd.paidWith), total),
      cr(ACC.sales, total),
      dr(ACC.costOfSales, cost),
      cr(ACC.stock, cost),
    ],
  });
  return { entry, movements };
}

function postPayment(cmd: ReceivePayment): PostingResult {
  positive(cmd.amount, "Payment");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: `Payment received${cmd.customer ? ` from ${cmd.customer}` : ""}`,
    source: { type: "payment_received", ...(cmd.invoiceNumber ? { ref: cmd.invoiceNumber } : {}) },
    lines: [dr(PLACE_ACCOUNT[cmd.into], cmd.amount), cr(ACC.debtors, cmd.amount)],
  });
  return { entry, movements: [] };
}

function postSupplierPayment(cmd: PaySupplier): PostingResult {
  positive(cmd.amount, "Payment");
  if (!cmd.supplier?.trim()) throw new LedgerError("Say which supplier you paid");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: `Paid ${cmd.supplier.trim()}`,
    source: { type: "payment_made", ref: cmd.supplier.trim() },
    lines: [dr(ACC.creditors, cmd.amount), cr(PLACE_ACCOUNT[cmd.from], cmd.amount)],
  });
  return { entry, movements: [] };
}

function expenseCreditAccount(paidFrom: RecordExpense["paidFrom"]): AccountCode {
  if (paidFrom === "own") return ACC.ownerLoan;
  if (paidFrom === "credit") return ACC.creditors;
  return PLACE_ACCOUNT[paidFrom];
}

function postExpense(cmd: RecordExpense, ctx: PostingContext): PostingResult {
  positive(cmd.amount, "Amount");
  if (cmd.paidFrom === "credit" && !cmd.supplier?.trim()) {
    throw new LedgerError("Say which supplier you will pay later");
  }
  const credit = expenseCreditAccount(cmd.paidFrom);
  const category = expenseCategory(cmd.category);
  const movements: StockMovement[] = [];
  const debitLines: JournalLine[] = [];

  if (cmd.category === "stock") {
    const lines = cmd.stockLines ?? [];
    if (lines.length === 0) throw new LedgerError("Say which stock items were bought");
    const linesTotal = sumCents(lines.map((l) => l.cost));
    if (linesTotal !== cmd.amount) {
      throw new LedgerError(`Stock lines add up to ${linesTotal} cents but the slip total is ${cmd.amount}`);
    }
    const tracker = new LevelTracker(ctx.levels);
    let trueUp = 0;
    lines.forEach((l, i) => {
      const item = stockItem(ctx, l.itemId);
      if (item.kind !== "stock") throw new LedgerError(`${item.name} is not a stock item`);
      wholePositive(l.qty, "Quantity");
      positive(l.cost, "Line cost");
      const before = tracker.get(item.id);
      const purchase: StockMovement = {
        id: `${cmd.id}:${i}`,
        itemId: item.id,
        date: cmd.date,
        type: "purchase",
        qty: l.qty,
        cost: l.cost,
        entryId: cmd.id,
      };
      tracker.apply(purchase);
      movements.push(purchase);
      // Units sold before this purchase was recorded were costed at an estimate.
      // Now that the real cost is known, move the difference into cost of sales.
      if (before.qty < 0) {
        const backlog = Math.min(l.qty, -before.qty);
        const actual = Math.round((l.cost * backlog) / l.qty);
        const estimated = Math.round((-before.cost * backlog) / -before.qty);
        const adjustment = actual - estimated;
        if (adjustment !== 0) {
          const m: StockMovement = {
            id: `${cmd.id}:${i}:true-up`,
            itemId: item.id,
            date: cmd.date,
            type: "purchase",
            qty: 0,
            cost: -adjustment,
            entryId: cmd.id,
          };
          tracker.apply(m);
          movements.push(m);
          trueUp += adjustment;
        }
      }
    });
    debitLines.push(dr(ACC.stock, cmd.amount));
    if (trueUp > 0) debitLines.push(dr(ACC.costOfSales, trueUp, "Cost of earlier sales updated"), cr(ACC.stock, trueUp));
    if (trueUp < 0) debitLines.push(dr(ACC.stock, -trueUp), cr(ACC.costOfSales, -trueUp, "Cost of earlier sales updated"));
  } else {
    if (cmd.stockLines?.length) throw new LedgerError("Only stock purchases can add to stock");
    debitLines.push(dr(category.account, cmd.amount));
  }

  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: `${category.label}${cmd.supplier ? ` from ${cmd.supplier}` : ""}${cmd.paidFrom === "own" ? " (paid by owner)" : ""}${cmd.paidFrom === "credit" ? " (pay later)" : ""}`,
    source: { type: "expense", ...(cmd.paidFrom === "credit" && cmd.supplier ? { ref: cmd.supplier.trim() } : {}) },
    lines: [...debitLines, cr(credit, cmd.amount)],
  });
  return { entry, movements };
}

function postStockCount(cmd: RecordStockCount, ctx: PostingContext): PostingResult {
  const movements: StockMovement[] = [];
  let loss = 0;
  let used = 0;
  const seen = new Set<string>();
  cmd.counts.forEach((c, i) => {
    if (seen.has(c.itemId)) throw new LedgerError("Each item can only be counted once per count");
    seen.add(c.itemId);
    const item = stockItem(ctx, c.itemId);
    if (item.kind !== "stock") throw new LedgerError(`${item.name} is not a stock item and cannot be counted`);
    if (!Number.isSafeInteger(c.counted) || c.counted < 0) {
      throw new LedgerError("Counted quantity must be a whole number, zero or more");
    }
    const level = ctx.levels.get(item.id) ?? emptyLevel(item.id);
    const diff = c.counted - level.qty;
    if (diff === 0) return;
    // Losses take average cost out. Gains are valued so the result is exactly counted × unit cost.
    const cost =
      diff < 0
        ? -costOfIssue(level, -diff)
        : level.qty > 0
          ? diff * unitCost(level)
          : c.counted * unitCost(level) - level.cost;
    movements.push({
      id: `${cmd.id}:${i}`,
      itemId: item.id,
      date: cmd.date,
      type: "count_adjustment",
      qty: diff,
      cost,
      entryId: cmd.id,
    });
    // Stock used up (e.g. ingredients cooked) is cost of sales; anything else is a loss or a find.
    if (diff < 0 && c.reason === "used") used -= cost;
    else loss -= cost;
  });
  if (loss === 0 && used === 0) return { entry: null, movements };
  const lines: JournalLine[] = [];
  if (used > 0) lines.push(dr(ACC.costOfSales, used, "Stock used"));
  if (loss > 0) lines.push(dr(ACC.stockAdjustments, loss, "Stock lost"));
  if (loss < 0) lines.push(cr(ACC.stockAdjustments, -loss, "Extra stock found"));
  const net = used + loss;
  if (net > 0) lines.push(cr(ACC.stock, net));
  if (net < 0) lines.push(dr(ACC.stock, -net));
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: used > 0 && loss <= 0 ? "Stock count: stock used" : loss > 0 ? "Stock count: stock lost" : "Stock count: extra stock found",
    source: { type: "stock_count" },
    lines,
  });
  return { entry, movements };
}

function postTransfer(cmd: Transfer): PostingResult {
  positive(cmd.amount, "Amount");
  if (cmd.from === cmd.to) throw new LedgerError("Transfer needs two different places");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: cmd.to === "bank" ? "Cash deposited at the bank" : "Cash drawn from the bank",
    source: { type: "transfer" },
    lines: [dr(PLACE_ACCOUNT[cmd.to], cmd.amount), cr(PLACE_ACCOUNT[cmd.from], cmd.amount)],
  });
  return { entry, movements: [] };
}

function postContribution(cmd: OwnerContribution): PostingResult {
  positive(cmd.amount, "Amount");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: "Owner put money into the business",
    source: { type: "owner_contribution" },
    lines: [dr(PLACE_ACCOUNT[cmd.into], cmd.amount), cr(ACC.capital, cmd.amount)],
  });
  return { entry, movements: [] };
}

function postOtherIncome(cmd: OtherIncome): PostingResult {
  positive(cmd.amount, "Amount");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: cmd.description?.trim() || "Other money in",
    source: { type: "other_income" },
    lines: [dr(PLACE_ACCOUNT[cmd.into], cmd.amount), cr(ACC.otherIncome, cmd.amount)],
  });
  return { entry, movements: [] };
}

function postDrawing(cmd: OwnerDrawing): PostingResult {
  positive(cmd.amount, "Amount");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: "Owner took money out",
    source: { type: "owner_drawing" },
    lines: [dr(ACC.drawings, cmd.amount), cr(PLACE_ACCOUNT[cmd.from], cmd.amount)],
  });
  return { entry, movements: [] };
}

function postOpening(cmd: OpeningBalances, ctx: PostingContext): PostingResult {
  assertCents(cmd.cashBox, "Cash box");
  assertCents(cmd.bank, "Bank");
  if (cmd.cashBox < 0 || cmd.bank < 0) throw new LedgerError("Opening balances cannot be negative");
  const movements: StockMovement[] = cmd.stock.map((l, i) => {
    const item = stockItem(ctx, l.itemId);
    if (item.kind !== "stock") throw new LedgerError(`${item.name} is not a stock item`);
    wholePositive(l.qty, "Quantity");
    assertCents(l.cost, "Cost");
    return {
      id: `${cmd.id}:${i}`,
      itemId: item.id,
      date: cmd.date,
      type: "opening",
      qty: l.qty,
      cost: l.cost,
      entryId: cmd.id,
    };
  });
  const stockValue = sumCents(movements.map((m) => m.cost));
  const total = cmd.cashBox + cmd.bank + stockValue;
  positive(total, "Opening balances");
  const entry = makeEntry({
    id: cmd.id,
    date: cmd.date,
    memo: "Opening balances",
    source: { type: "opening_balance" },
    lines: [
      dr(ACC.cashBox, cmd.cashBox),
      dr(ACC.bank, cmd.bank),
      dr(ACC.stock, stockValue),
      cr(ACC.capital, total),
    ],
  });
  return { entry, movements };
}
