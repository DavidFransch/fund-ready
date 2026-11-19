import { ACC, CHART, getAccount, isDebitNormal, type Account, type AccountCode } from "./accounts";
import type { IsoDate } from "./dates";
import type { JournalEntry } from "./journal";
import type { Cents } from "./money";

export interface Period {
  from?: IsoDate;
  to?: IsoDate;
}

function inPeriod(date: IsoDate, p: Period): boolean {
  return (!p.from || date >= p.from) && (!p.to || date <= p.to);
}

/** Net balance per account as debits minus credits. */
export function netBalances(entries: readonly JournalEntry[], period: Period = {}): Map<AccountCode, Cents> {
  const out = new Map<AccountCode, Cents>();
  for (const e of entries) {
    if (!inPeriod(e.date, period)) continue;
    for (const l of e.lines) out.set(l.account, (out.get(l.account) ?? 0) + l.debit - l.credit);
  }
  return out;
}

/** Balance in the account's natural direction (assets and expenses positive when debit). */
function natural(account: Account, net: Cents): Cents {
  return isDebitNormal(account.type) ? net : -net;
}

export interface ReportLine {
  code: AccountCode;
  name: string;
  plainName: string;
  amount: Cents;
}

function linesFor(net: Map<AccountCode, Cents>, filter: (a: Account) => boolean): ReportLine[] {
  return CHART.filter(filter)
    .map((a) => ({ code: a.code as AccountCode, name: a.name, plainName: a.plainName, amount: natural(a, net.get(a.code as AccountCode) ?? 0) }))
    .filter((l) => l.amount !== 0);
}

const total = (lines: ReportLine[]): Cents => lines.reduce((s, l) => s + l.amount, 0);

export interface TrialBalanceRow {
  code: AccountCode;
  name: string;
  debit: Cents;
  credit: Cents;
}

export function trialBalance(entries: readonly JournalEntry[], asAt?: IsoDate) {
  const net = netBalances(entries, asAt ? { to: asAt } : {});
  const rows: TrialBalanceRow[] = CHART.map((a) => {
    const n = net.get(a.code as AccountCode) ?? 0;
    return { code: a.code as AccountCode, name: a.name, debit: n > 0 ? n : 0, credit: n < 0 ? -n : 0 };
  }).filter((r) => r.debit !== 0 || r.credit !== 0);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export interface IncomeStatement {
  period: Period;
  revenue: ReportLine[];
  totalRevenue: Cents;
  costOfSales: ReportLine[];
  totalCostOfSales: Cents;
  grossProfit: Cents;
  expenses: ReportLine[];
  totalExpenses: Cents;
  netProfit: Cents;
}

export function incomeStatement(entries: readonly JournalEntry[], period: Period): IncomeStatement {
  const net = netBalances(entries, period);
  const revenue = linesFor(net, (a) => a.group === "revenue");
  const costOfSales = linesFor(net, (a) => a.group === "cost_of_sales");
  const expenses = linesFor(net, (a) => a.group === "operating_expense");
  const totalRevenue = total(revenue);
  const totalCostOfSales = total(costOfSales);
  const totalExpenses = total(expenses);
  const grossProfit = totalRevenue - totalCostOfSales;
  return {
    period,
    revenue,
    totalRevenue,
    costOfSales,
    totalCostOfSales,
    grossProfit,
    expenses,
    totalExpenses,
    netProfit: grossProfit - totalExpenses,
  };
}

export interface BalanceSheet {
  asAt: IsoDate;
  assets: ReportLine[];
  totalAssets: Cents;
  liabilities: ReportLine[];
  totalLiabilities: Cents;
  equity: ReportLine[];
  /** Income minus expenses not yet closed into retained earnings. */
  profitToDate: Cents;
  totalEquity: Cents;
  balanced: boolean;
}

export function balanceSheet(entries: readonly JournalEntry[], asAt: IsoDate): BalanceSheet {
  const net = netBalances(entries, { to: asAt });
  const assets = linesFor(net, (a) => a.type === "asset");
  const liabilities = linesFor(net, (a) => a.type === "liability");
  const equity = linesFor(net, (a) => a.type === "equity");
  const profitToDate =
    total(linesFor(net, (a) => a.type === "income")) - total(linesFor(net, (a) => a.type === "expense"));
  const totalAssets = total(assets);
  const totalLiabilities = total(liabilities);
  const totalEquity = total(equity) + profitToDate;
  return {
    asAt,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    profitToDate,
    totalEquity,
    balanced: totalAssets === totalLiabilities + totalEquity,
  };
}

export interface BudgetLine {
  account: AccountCode;
  amount: Cents;
}

export interface BudgetRow {
  code: AccountCode;
  plainName: string;
  isIncome: boolean;
  budget: Cents;
  actual: Cents;
  /** actual − budget */
  difference: Cents;
  status: "on_budget" | "ahead" | "behind" | "over" | "under";
}

export function budgetVsActual(
  entries: readonly JournalEntry[],
  budget: readonly BudgetLine[],
  period: Period,
): BudgetRow[] {
  const net = netBalances(entries, period);
  return budget.map((b) => {
    const account = getAccount(b.account);
    const isIncome = account.type === "income";
    const actual = natural(account, net.get(b.account) ?? 0);
    const difference = actual - b.amount;
    const status: BudgetRow["status"] =
      difference === 0 ? "on_budget" : isIncome ? (difference > 0 ? "ahead" : "behind") : difference > 0 ? "over" : "under";
    return { code: b.account, plainName: account.plainName, isIncome, budget: b.amount, actual, difference, status };
  });
}

/** Money in and out of the cash box and bank, ignoring moves between the two. */
export function cashFlowSummary(entries: readonly JournalEntry[], period: Period) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const e of entries) {
    if (!inPeriod(e.date, period) || e.source.type === "transfer") continue;
    for (const l of e.lines) {
      if (l.account !== ACC.cashBox && l.account !== ACC.bank) continue;
      moneyIn += l.debit;
      moneyOut += l.credit;
    }
  }
  return { moneyIn, moneyOut, leftOver: moneyIn - moneyOut };
}

/** The balances shown on the home screen. */
export function positions(entries: readonly JournalEntry[], asAt?: IsoDate) {
  const net = netBalances(entries, asAt ? { to: asAt } : {});
  return {
    cashBox: net.get(ACC.cashBox) ?? 0,
    bank: net.get(ACC.bank) ?? 0,
    owedToYou: net.get(ACC.debtors) ?? 0,
    stockValue: net.get(ACC.stock) ?? 0,
    owedToOwner: -(net.get(ACC.ownerLoan) ?? 0),
  };
}
