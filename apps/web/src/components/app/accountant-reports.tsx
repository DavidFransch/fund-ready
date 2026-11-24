"use client";

import { balanceSheet, incomeStatement, trialBalance, type JournalEntry } from "@app/ledger";
import { Check, CircleAlert } from "lucide-react";
import { formatDay } from "@/books/dates";
import { cn } from "@/lib/utils";

/** Accountant-style number: 1 234.50, negatives in brackets. */
export function acc(cents: number): string {
  if (cents === 0) return "–";
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `(${s})` : s;
}

export function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : CircleAlert;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold", ok ? "bg-brand-soft text-brand-dark" : "bg-spend-soft text-spend-dark")}>
      <Icon className="size-4" aria-hidden />
      {children}
    </span>
  );
}

export function TrialBalanceTable({ entries, asAt }: { entries: readonly JournalEntry[]; asAt: string }) {
  const tb = trialBalance(entries, asAt);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Trial balance as at {formatDay(asAt, { day: "numeric", month: "long", year: "numeric" })}</h2>
        <Badge ok={tb.balanced}>{tb.balanced ? "Debits equal credits" : "Out of balance"}</Badge>
      </div>
      <div className="overflow-x-auto rounded-2xl border-[1.5px] border-line bg-card">
        <table className="w-full min-w-[480px] border-collapse text-[15px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-4 py-2.5 font-bold">Code</th>
              <th className="py-2.5 font-bold">Account</th>
              <th className="py-2.5 pr-4 text-right font-bold">Debit</th>
              <th className="py-2.5 pr-4 text-right font-bold">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.code} className="border-b border-line/60">
                <td className="px-4 py-2 font-mono text-sm text-ink-muted">{r.code}</td>
                <td className="py-2">{r.name}</td>
                <td className="py-2 pr-4 text-right">{r.debit ? acc(r.debit) : ""}</td>
                <td className="py-2 pr-4 text-right">{r.credit ? acc(r.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-bold">
              <td className="px-4 py-2.5" colSpan={2}>
                Total
              </td>
              <td className="py-2.5 pr-4 text-right">{acc(tb.totalDebit)}</td>
              <td className="py-2.5 pr-4 text-right">{acc(tb.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Statement({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-[1.5px] border-line bg-card px-4 py-2">
      <table className="w-full min-w-[420px] border-collapse text-[15px] tabular-nums">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Line({ label, code, value, kind = "line" }: { label: string; code?: string; value?: number; kind?: "head" | "line" | "total" | "grand" }) {
  return (
    <tr className={cn(kind === "head" && "text-xs tracking-wide text-ink-muted uppercase", kind === "total" && "border-t border-line font-bold", kind === "grand" && "border-t-2 border-ink font-bold")}>
      <td className={cn("py-1.5", kind === "line" && "pl-4", kind === "head" && "pt-4 font-bold")}>
        {code && <span className="mr-2 font-mono text-sm text-ink-muted">{code}</span>}
        {label}
      </td>
      <td className="py-1.5 text-right">{value === undefined ? "" : acc(value)}</td>
    </tr>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Balance sheet as at {formatDay(asAt, { day: "numeric", month: "long", year: "numeric" })}</h2>
        <Badge ok={bs.balanced}>{bs.balanced ? "Assets = liabilities + equity" : "Does not balance"}</Badge>
      </div>
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
