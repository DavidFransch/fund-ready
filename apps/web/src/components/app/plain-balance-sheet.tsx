"use client";

import { ACC, balanceSheet, type JournalEntry, type ReportLine } from "@app/ledger";
import { CircleCheck } from "lucide-react";
import { Fragment } from "react";
import { formatDay } from "@/books/dates";
import { money } from "@/lib/format";
import { Divider, Panel, STROKE } from "./screen";

interface Row {
  label: string;
  amount: number;
}

function Section({ title, rows, total, totalLabel }: { title: string; rows: Row[]; total: number; totalLabel: string }) {
  return (
    <Panel aria-label={title} className="flex flex-col rounded-[20px]">
      <span className="px-3.5 pt-[13px] pb-1 text-[13px] font-semibold tracking-[0.02em] text-ink-muted uppercase">{title}</span>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <div className="flex justify-between px-3.5 py-2.5 text-[15px]">
            <span>{r.label}</span>
            <span className="font-medium">{r.amount < 0 ? `(${money(-r.amount)})` : money(r.amount)}</span>
          </div>
        </Fragment>
      ))}
      {!rows.length && <span className="px-3.5 py-2.5 text-[15px] text-ink-muted">Nothing</span>}
      <Divider />
      <div className="flex justify-between px-3.5 py-[13px] text-[15px] font-semibold">
        <span>{totalLabel}</span>
        <span>{money(total)}</span>
      </div>
    </Panel>
  );
}

const rows = (lines: ReportLine[]): Row[] => lines.map((l) => ({ label: l.plainName, amount: l.amount }));

/**
 * The balance sheet in plain words for the owner. A shareholder loan in debit (the owner
 * took out more than the business owed them) is something the business owns, so it moves
 * from "owes" to "owns".
 */
export function PlainBalanceSheet({ entries, asAt }: { entries: readonly JournalEntry[]; asAt: string }) {
  const bs = balanceSheet(entries, asAt);
  const loan = bs.liabilities.find((l) => l.code === ACC.ownerLoan)?.amount ?? 0;
  const owns = [...rows(bs.assets), ...(loan < 0 ? [{ label: "The owner owes the business", amount: -loan }] : [])];
  const owes = rows(bs.liabilities.filter((l) => l.code !== ACC.ownerLoan || l.amount > 0));
  const stake = [...rows(bs.equity), { label: "Profit since the books started", amount: bs.profitToDate }];
  const ownsTotal = owns.reduce((t, r) => t + r.amount, 0);
  const owesTotal = owes.reduce((t, r) => t + r.amount, 0);
  const balanced = ownsTotal === owesTotal + bs.totalEquity;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[13px] text-ink-muted">
        <span>As at {formatDay(asAt, { weekday: "long", day: "numeric", month: "long" })}</span>
        {balanced && (
          <span className="flex items-center gap-1 font-semibold text-positive">
            <CircleCheck className="size-4" strokeWidth={STROKE} aria-hidden /> What it owns = what it owes + your stake
          </span>
        )}
      </p>
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        <Section title="What the business owns" rows={owns} total={ownsTotal} totalLabel="Total it owns" />
        <Section title="What it owes" rows={owes} total={owesTotal} totalLabel="Total it owes" />
        <Section title="Your stake" rows={stake} total={bs.totalEquity} totalLabel="Total stake" />
      </div>
    </div>
  );
}
