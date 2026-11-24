import {
  ACC,
  CHART,
  cashFlowSummary,
  incomeStatement,
  netBalances,
  positions,
  supplierBalances,
  unitCost,
  type Command,
  type IsoDate,
  type JournalEntry,
} from "@app/ledger";
import { daysIn, type PeriodRange } from "./dates";
import { entryTotal, titleFor } from "./describe";
import type { BooksSnapshot } from "./store";

export function commandMap(s: BooksSnapshot): Map<string, Command> {
  return new Map(s.commands.map((c) => [c.id, c]));
}

/** Entries in the order they happened (stable within a day). */
export function chronological(entries: readonly JournalEntry[]): JournalEntry[] {
  return entries.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1)).map((x) => x.e);
}

/** Starting balances are not money earned or spent, so they stay out of money in and out. */
const trading = (entries: readonly JournalEntry[]) => entries.filter((e) => e.source.type !== "opening_balance");

export function home(s: BooksSnapshot, week: PeriodRange) {
  const flow = cashFlowSummary(trading(s.book.entries), { from: week.from, to: week.to });
  return { ...flow, ...positions(s.book.entries) };
}

export interface PeriodSummary {
  sales: number;
  costOfSales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  moneyIn: number;
  moneyOut: number;
  /** Operating expenses and stock losses, by plain name. */
  expenseLines: { code: string; name: string; amount: number }[];
}

export function periodSummary(entries: readonly JournalEntry[], from: IsoDate, to: IsoDate): PeriodSummary {
  const is = incomeStatement(entries, { from, to });
  const flow = cashFlowSummary(trading(entries), { from, to });
  const stockLoss = is.costOfSales.find((l) => l.code === ACC.stockAdjustments);
  return {
    sales: is.totalRevenue,
    costOfSales: is.totalCostOfSales,
    grossProfit: is.grossProfit,
    expenses: is.totalExpenses,
    netProfit: is.netProfit,
    moneyIn: flow.moneyIn,
    moneyOut: flow.moneyOut,
    expenseLines: [...is.expenses, ...(stockLoss ? [stockLoss] : [])]
      .map((l) => ({ code: l.code, name: l.plainName, amount: l.amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export interface DayPoint {
  date: IsoDate;
  sales: number;
  /** Cost of what was sold plus running costs. */
  costs: number;
  profit: number;
}

export function daily(entries: readonly JournalEntry[], from: IsoDate, to: IsoDate): DayPoint[] {
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  return daysIn(from, to).map((date) => {
    const is = incomeStatement(inRange, { from: date, to: date });
    return { date, sales: is.totalRevenue, costs: is.totalCostOfSales + is.totalExpenses, profit: is.netProfit };
  });
}

export interface ActivityRow {
  id: string;
  date: IsoDate;
  title: string;
  amount: number;
  /** in: money came in; out: money went out; none: no money moved (stock count, credit). */
  direction: "in" | "out" | "move" | "none";
  isUser: boolean;
}

export function activity(s: BooksSnapshot, limit = 8): ActivityRow[] {
  const cmds = commandMap(s);
  return chronological(s.book.entries)
    .reverse()
    .slice(0, limit)
    .map((e) => {
      const cmd = cmds.get(e.id);
      const cashNet = e.lines.reduce((t, l) => (l.account === ACC.cashBox || l.account === ACC.bank ? t + l.debit - l.credit : t), 0);
      const direction = e.source.type === "transfer" ? "move" : cashNet > 0 ? "in" : cashNet < 0 ? "out" : "none";
      return {
        id: e.id,
        date: e.date,
        title: titleFor(cmd, s.book, e),
        amount: direction === "none" || direction === "move" ? entryTotal(e) : Math.abs(cashNet),
        direction,
        isUser: s.userCommandIds.has(e.id),
      };
    });
}

export interface PettyCashRow {
  id: string;
  date: IsoDate;
  title: string;
  /** Signed: positive into petty cash. */
  amount: number;
  balance: number;
  isUser: boolean;
}

/** Every movement in and out of petty cash (the Cash box account), newest first, with the balance after each. */
export function pettyCash(s: BooksSnapshot): PettyCashRow[] {
  const cmds = commandMap(s);
  let balance = 0;
  const rows: PettyCashRow[] = [];
  for (const e of chronological(s.book.entries)) {
    const amount = e.lines.reduce((t, l) => (l.account === ACC.cashBox ? t + l.debit - l.credit : t), 0);
    if (amount === 0) continue;
    balance += amount;
    rows.push({ id: e.id, date: e.date, title: titleFor(cmds.get(e.id), s.book, e), amount, balance, isUser: s.userCommandIds.has(e.id) });
  }
  return rows.reverse();
}

export interface StockRow {
  id: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  value: number;
  salePrice: number;
  reorderLevel: number;
  low: boolean;
}

export function stockRows(s: BooksSnapshot): StockRow[] {
  return [...s.book.items.values()]
    .filter((i) => i.kind === "stock")
    .map((i) => {
      const level = s.book.level(i.id);
      const reorderLevel = i.reorderLevel ?? 0;
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        qty: level.qty,
        unitCost: unitCost(level),
        value: level.cost,
        salePrice: i.salePrice,
        reorderLevel,
        low: level.qty <= reorderLevel,
      };
    });
}

export function suppliers(s: BooksSnapshot) {
  return supplierBalances(s.commands).filter((b) => b.amount > 0);
}

/** Supplier names used before, for suggestions. */
export function knownSuppliers(s: BooksSnapshot): string[] {
  const names = new Map<string, string>();
  for (const c of s.commands) {
    if ((c.kind === "expense" || c.kind === "payment_made") && c.supplier) names.set(c.supplier.toLowerCase(), c.supplier);
  }
  return [...names.values()].sort();
}

export function accountName(code: string): string {
  return CHART.find((a) => a.code === code)?.name ?? code;
}

export function stockMatchesLedger(s: BooksSnapshot): boolean {
  const ledger = netBalances(s.book.entries).get(ACC.stock) ?? 0;
  const sub = [...s.book.levels.values()].reduce((t, l) => t + l.cost, 0);
  return ledger === sub;
}
