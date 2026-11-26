import {
  ACC,
  CHART,
  cashFlowSummary,
  incomeStatement,
  netBalances,
  positions,
  supplierBalances,
  times,
  unitCost,
  type Command,
  type IsoDate,
  type JournalEntry,
} from "@app/ledger";
import { daysIn, formatDay, type PeriodKind } from "./dates";
import { entryTotal, entryType, recordedFrom, rowText, type EntryType } from "./describe";
import type { BooksSnapshot } from "./store";

export function commandMap(s: BooksSnapshot): Map<string, Command> {
  return new Map(s.commands.map((c) => [c.id, c]));
}

/** The number the next invoice gets: INV-0001, INV-0002, … across Sell (paid later) and Invoice. */
export function nextInvoiceNumber(s: BooksSnapshot): string {
  const n = s.commands.filter((c) => c.kind === "sale" && c.invoiceNumber).length;
  return `INV-${String(n + 1).padStart(4, "0")}`;
}

/** Entries in the order they happened (stable within a day). */
export function chronological(entries: readonly JournalEntry[]): JournalEntry[] {
  return entries.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1)).map((x) => x.e);
}

/** Starting balances are not money earned or spent, so they stay out of money in and out. */
const trading = (entries: readonly JournalEntry[]) => entries.filter((e) => e.source.type !== "opening_balance");

export function home(s: BooksSnapshot, week: { from: IsoDate; to: IsoDate }) {
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
  time: string;
  title: string;
  detail: string;
  amount: number;
  /** in: money came in; out: money went out; move: between petty cash and bank; none: no money moved. */
  direction: "in" | "out" | "move" | "none";
  isUser: boolean;
}

function saleTotal(cmd: Extract<Command, { kind: "sale" }>): number {
  return cmd.lines.reduce((t, l) => t + times(l.unitPrice, l.qty), 0);
}

function cashNet(e: JournalEntry): number {
  return e.lines.reduce((t, l) => (l.account === ACC.cashBox || l.account === ACC.bank ? t + l.debit - l.credit : t), 0);
}

/** Newest first. Pass `date` to keep one day only. */
export function activity(s: BooksSnapshot, opts: { limit?: number; date?: IsoDate } = {}): ActivityRow[] {
  const cmds = commandMap(s);
  const rows = chronological(s.book.entries)
    .reverse()
    .filter((e) => !opts.date || e.date === opts.date);
  return rows.slice(0, opts.limit ?? rows.length).map((e) => {
    const cmd = cmds.get(e.id);
    const net = cashNet(e);
    const direction = e.source.type === "transfer" ? "move" : net > 0 ? "in" : net < 0 ? "out" : "none";
    const text = rowText(cmd, s.book, e);
    return {
      id: e.id,
      date: e.date,
      time: s.times.get(e.id) ?? "",
      title: text.title,
      detail: text.detail,
      // An invoice moves no money, and its debits include cost of sales, so show what was sold.
      amount: cmd?.kind === "sale" ? saleTotal(cmd) : direction === "none" || direction === "move" ? entryTotal(e) : Math.abs(net),
      direction,
      isUser: s.userCommandIds.has(e.id),
    };
  });
}

export interface PettyCashRow {
  id: string;
  date: IsoDate;
  time: string;
  title: string;
  detail: string;
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
    const text = rowText(cmds.get(e.id), s.book, e);
    rows.push({ id: e.id, date: e.date, time: s.times.get(e.id) ?? "", title: text.title, detail: text.detail, amount, balance, isUser: s.userCommandIds.has(e.id) });
  }
  return rows.reverse();
}

/** Group rows (already newest first) by date, keeping order. */
export function byDay<T extends { date: IsoDate }>(rows: readonly T[]): { date: IsoDate; rows: T[] }[] {
  const out: { date: IsoDate; rows: T[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last?.date === r.date) last.rows.push(r);
    else out.push({ date: r.date, rows: [r] });
  }
  return out;
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

export interface ChartBar {
  label: string;
  sales: number;
  current: boolean;
}

/** Sales per time of day (day), per day (week) or per week of the month (month). */
export function salesBars(s: BooksSnapshot, kind: PeriodKind, from: IsoDate, to: IsoDate): ChartBar[] {
  const sales = (e: JournalEntry) => e.lines.reduce((t, l) => (l.account === ACC.sales || l.account === ACC.otherIncome ? t + l.credit - l.debit : t), 0);
  const inRange = s.book.entries.filter((e) => e.date >= from && e.date <= to);
  if (kind === "day") {
    const slots = [6, 9, 12, 15, 18];
    const nowHour = new Date().getHours();
    return slots.map((h) => ({
      label: `${h}–${h + 3}`,
      sales: inRange.filter((e) => {
        const hour = Number((s.times.get(e.id) ?? "12:00").slice(0, 2));
        return hour >= h && (h === 18 ? true : hour < h + 3);
      }).reduce((t, e) => t + sales(e), 0),
      current: from === s.today && nowHour >= h && nowHour < h + 3,
    }));
  }
  const days = daysIn(from, to);
  if (kind === "week") {
    return days.map((d) => ({
      label: formatDay(d, { weekday: "short" }),
      sales: inRange.filter((e) => e.date === d).reduce((t, e) => t + sales(e), 0),
      current: d === s.today,
    }));
  }
  const weeks: ChartBar[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      label: `${formatDay(chunk[0]!, { day: "numeric" })}–${formatDay(chunk[chunk.length - 1]!, { day: "numeric" })}`,
      sales: inRange.filter((e) => e.date >= chunk[0]! && e.date <= chunk[chunk.length - 1]!).reduce((t, e) => t + sales(e), 0),
      current: s.today >= chunk[0]! && s.today <= chunk[chunk.length - 1]!,
    });
  }
  return weeks;
}

export interface JournalRow {
  entry: JournalEntry;
  /** Sequential reference in the order entries were recorded, e.g. JE-0230. */
  ref: string;
  time: string;
  title: string;
  detail: string;
  type: EntryType;
  amount: number;
  from: string;
  isUser: boolean;
  touchesCash: boolean;
  touchesStock: boolean;
}

/** Every journal entry, newest first, with what the accountant view needs. */
export function journalRows(s: BooksSnapshot): JournalRow[] {
  const cmds = commandMap(s);
  return chronological(s.book.entries)
    .map((e, i) => {
      const cmd = cmds.get(e.id);
      const text = rowText(cmd, s.book, e);
      return {
        entry: e,
        ref: `JE-${String(i + 1).padStart(4, "0")}`,
        time: s.times.get(e.id) ?? "",
        title: text.title,
        detail: text.detail,
        type: entryType(cmd),
        amount: entryTotal(e),
        from: s.userCommandIds.has(e.id) ? recordedFrom(cmd) : "Sample history",
        isUser: s.userCommandIds.has(e.id),
        touchesCash: e.lines.some((l) => l.account === ACC.cashBox),
        touchesStock: e.lines.some((l) => l.account === ACC.stock),
      };
    })
    .reverse();
}
