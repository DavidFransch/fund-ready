"use client";

import { balanceSheet, incomeStatement, trialBalance, type JournalEntry } from "@app/ledger";
import { CircleAlert, CircleCheck } from "lucide-react";
import { formatDay } from "@/books/dates";
import { cn } from "@/lib/utils";
import { STROKE } from "./screen";

/** Accountant-style number: 1 234.50, negatives in brackets. */
export function acc(cents: number): string {
  if (cents === 0) return "–";
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `(${s})` : s;
}

/** Status as coloured text with an icon, e.g. "Debits equal credits". */
export function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", ok ? "text-positive" : "text-negative")}>
      <Icon className="size-[18px]" strokeWidth={STROKE} aria-hidden />
      {children}
    </span>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold">{title}</h1>
        <span className="text-sm text-ink-muted">{subtitle}</span>
      </div>
      {action}
    </div>
  );
}

const longDate = (d: string) => formatDay(d, { day: "numeric", month: "long", year: "numeric" });

export function TrialBalanceTable({ entries, asAt, stockTies }: { entries: readonly JournalEntry[]; asAt: string; stockTies: boolean }) {
  const tb = trialBalance(entries, asAt);
  const row = "grid grid-cols-[40px_minmax(0,1fr)_84px_84px] gap-2 px-2 sm:grid-cols-[72px_minmax(0,1fr)_120px_120px] sm:gap-3 sm:px-3";
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Trial balance" subtitle={`As at ${longDate(asAt)}`} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Status ok={tb.balanced}>{tb.balanced ? "Debits equal credits" : "Out of balance"}</Status>
        <Status ok={stockTies}>{stockTies ? "Stock records tie to 1200 Inventory" : "Stock records do not tie"}</Status>
      </div>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Trial balance" className="flex flex-col text-[13px] sm:min-w-[520px] sm:text-sm">
          <div role="row" className={cn(row, "pb-2.5 text-xs font-medium text-ink-muted")}>
            <span role="columnheader">Code</span>
            <span role="columnheader">Account</span>
            <span role="columnheader" className="text-right">
              Debit
            </span>
            <span role="columnheader" className="text-right">
              Credit
            </span>
          </div>
          {tb.rows.map((r) => (
            <div role="row" key={r.code} className={cn(row, "border-b border-hairline py-3")}>
              <span role="cell" className="font-mono text-ink-muted">
                {r.code}
              </span>
              <span role="cell">{r.name}</span>
              <span role="cell" className="text-right font-medium">
                {r.debit ? acc(r.debit) : ""}
              </span>
              <span role="cell" className="text-right font-medium">
                {r.credit ? acc(r.credit) : ""}
              </span>
            </div>
          ))}
          <div role="row" className={cn(row, "mt-1 rounded-lg bg-panel py-3 font-semibold")}>
            <span role="cell" className="col-span-2">
              Total
            </span>
            <span role="cell" className="text-right">
              {acc(tb.totalDebit)}
            </span>
            <span role="cell" className="text-right">
              {acc(tb.totalCredit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Statement({ children }: { children: React.ReactNode }) {
  return <div className="flex max-w-2xl flex-col rounded-[18px] bg-panel px-4 py-2 text-[15px]">{children}</div>;
}

function Line({ label, code, value, kind = "line" }: { label: string; code?: string; value?: number; kind?: "head" | "line" | "total" | "grand" }) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 py-2",
        kind === "head" && "pt-4 text-xs font-semibold tracking-[0.02em] text-ink-muted uppercase",
        kind === "line" && "pl-3",
        kind === "total" && "border-t border-divider font-semibold",
        kind === "grand" && "border-t-2 border-ink font-semibold",
      )}
    >
      <span>
        {code && <span className="mr-2 font-mono text-sm text-ink-muted">{code}</span>}
        {label}
      </span>
      <span className="whitespace-nowrap">{value === undefined ? "" : acc(value)}</span>
    </div>
  );
}

export function IncomeStatementView({ entries, from, to }: { entries: readonly JournalEntry[]; from: string; to: string }) {
  const is = incomeStatement(entries, { from, to });
  return (
    <Statement>
      <Line label="Revenue" kind="head" />
      {is.revenue.map((l) => (
        <Line key={l.code} code={l.code} label={l.name} value={l.amount} />
      ))}
      <Line label="Total revenue" value={is.totalRevenue} kind="total" />
      <Line label="Cost of sales" kind="head" />
      {is.costOfSales.map((l) => (
        <Line key={l.code} code={l.code} label={l.name} value={-l.amount} />
      ))}
      <Line label="Gross profit" value={is.grossProfit} kind="total" />
      <Line label="Operating expenses" kind="head" />
      {is.expenses.map((l) => (
        <Line key={l.code} code={l.code} label={l.name} value={-l.amount} />
      ))}
      <Line label="Total operating expenses" value={-is.totalExpenses} kind="total" />
      <Line label={is.netProfit < 0 ? "Net loss" : "Net profit"} value={is.netProfit} kind="grand" />
    </Statement>
  );
}

export function BalanceSheetView({ entries, asAt }: { entries: readonly JournalEntry[]; asAt: string }) {
  const bs = balanceSheet(entries, asAt);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Balance sheet" subtitle={`As at ${longDate(asAt)}`} />
      <Status ok={bs.balanced}>{bs.balanced ? "Assets equal liabilities plus equity" : "Does not balance"}</Status>
      <Statement>
        <Line label="Assets" kind="head" />
        {bs.assets.map((l) => (
          <Line key={l.code} code={l.code} label={l.name} value={l.amount} />
        ))}
        <Line label="Total assets" value={bs.totalAssets} kind="grand" />
        <Line label="Liabilities" kind="head" />
        {bs.liabilities.map((l) => (
          <Line key={l.code} code={l.code} label={l.name} value={l.amount} />
        ))}
        <Line label="Total liabilities" value={bs.totalLiabilities} kind="total" />
        <Line label="Equity" kind="head" />
        {bs.equity.map((l) => (
          <Line key={l.code} code={l.code} label={l.name} value={l.amount} />
        ))}
        <Line label="Profit for the period (not yet closed)" value={bs.profitToDate} />
        <Line label="Total equity" value={bs.totalEquity} kind="total" />
        <Line label="Total liabilities and equity" value={bs.totalLiabilities + bs.totalEquity} kind="grand" />
      </Statement>
    </div>
  );
}

/** Save a CSV in the browser. */
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
