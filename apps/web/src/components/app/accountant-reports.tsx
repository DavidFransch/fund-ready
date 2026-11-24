"use client";

import { trialBalance, type JournalEntry } from "@app/ledger";
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
