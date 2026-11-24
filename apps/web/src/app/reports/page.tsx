"use client";

import { ACC } from "@app/ledger";
import { useMemo, useState } from "react";
import { formatDay, periodRange, type PeriodKind } from "@/books/dates";
import { activity, daily, periodSummary } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { ActivityList } from "@/components/app/activity";
import { PeriodPicker } from "@/components/app/period-picker";
import { Card, Loading, NightCard, Screen, SectionTitle } from "@/components/app/screen";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { snapshot } = useBooks();
  const [kind, setKind] = useState<PeriodKind>("week");
  const [offset, setOffset] = useState(0);

  const data = useMemo(() => {
    if (!snapshot) return null;
    const range = periodRange(kind, snapshot.today, offset);
    const entries = snapshot.book.entries;
    return {
      range,
      sum: periodSummary(entries, range.from, range.to),
      days: kind === "day" ? [] : daily(entries, range.from, range.to),
      dayActivity: kind === "day" ? activity(snapshot, { date: range.from }) : [],
    };
  }, [snapshot, kind, offset]);
  if (!snapshot || !data) return <Loading />;
  const { range, sum, days, dayActivity } = data;
  const maxDay = Math.max(1, ...days.map((d) => Math.max(d.sales, d.costs)));
  const maxExpense = Math.max(1, ...sum.expenseLines.map((l) => l.amount));
  const empty = sum.sales === 0 && sum.expenses === 0 && sum.costOfSales === 0;

  return (
    <Screen title="Reports" back="/" nav>
      <PeriodPicker
        today={snapshot.today}
        kind={kind}
        offset={offset}
        onChange={(k, o) => {
          setKind(k);
          setOffset(o);
        }}
      />

      <NightCard className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Big label="Sales" value={sum.sales} tone="text-accent" />
          <Big label="Costs" value={sum.costOfSales + sum.expenses} tone="text-night-muted" />
          <Big label={sum.netProfit < 0 ? "Loss" : "Profit"} value={Math.abs(sum.netProfit)} tone="text-accent" />
        </div>
        <p className="border-t border-night-line pt-3 text-sm leading-snug text-night-muted">
          {empty ? "Nothing recorded yet for this period." : `Money in ${money(sum.moneyIn)} · money out ${money(sum.moneyOut)}. Profit only counts stock once it is sold.`}
        </p>
      </NightCard>

      <Card className="flex flex-col gap-2 text-[15px]">
        <SectionTitle>How the profit is worked out</SectionTitle>
        <Row label="Sales" value={sum.sales} />
        <Row label="Cost of stock sold or lost" value={-sum.costOfSales} sub />
        <Row label="Made on sales" value={sum.grossProfit} strong />
        <Row label="Other costs" value={-sum.expenses} sub />
        <Row label={sum.netProfit < 0 ? "Loss" : "Profit"} value={sum.netProfit} strong />
      </Card>

      {kind !== "day" && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Day by day</SectionTitle>
            <span className="flex gap-3 text-[13px] text-ink-muted">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-brand" aria-hidden /> Sales
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-negative" aria-hidden /> Costs
              </span>
            </span>
          </div>
          <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Sales and costs per day for ${range.label.toLowerCase()}`}>
            {days.map((d) => (
              <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${formatDay(d.date)}: sales ${money(d.sales)}, costs ${money(d.costs)}`}>
                <div className="flex h-full w-full items-end justify-center gap-px">
                  <span className="w-1/2 max-w-3 rounded-t-sm bg-brand" style={{ height: `${(d.sales / maxDay) * 100}%` }} />
                  <span className="w-1/2 max-w-3 rounded-t-sm bg-negative" style={{ height: `${(d.costs / maxDay) * 100}%` }} />
                </div>
                {kind === "week" && <span className="text-[11px] text-ink-muted">{formatDay(d.date, { weekday: "short" })}</span>}
              </div>
            ))}
          </div>
          {kind === "month" && (
            <div className="flex justify-between text-[11px] text-ink-muted">
              <span>{formatDay(range.from, { day: "numeric", month: "short" })}</span>
              <span>{formatDay(range.to, { day: "numeric", month: "short" })}</span>
            </div>
          )}
        </Card>
      )}

      {sum.expenseLines.length > 0 && (
        <Card className="flex flex-col gap-2.5">
          <SectionTitle>Where the money went</SectionTitle>
          <div className="flex justify-between text-[15px]">
            <span>Cost of stock sold</span>
            <span className="font-bold tabular-nums">{money(sum.costOfSales - (sum.expenseLines.find((l) => l.code === ACC.stockAdjustments)?.amount ?? 0))}</span>
          </div>
          {sum.expenseLines.map((l) => (
            <div key={l.code} className="flex flex-col gap-1">
              <div className="flex justify-between text-[15px]">
                <span>{l.name}</span>
                <span className="font-bold tabular-nums">{money(l.amount)}</span>
              </div>
              <div className="h-2 rounded-full bg-panel-strong">
                <div className="h-2 rounded-full bg-negative" style={{ width: `${(l.amount / maxExpense) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {kind === "day" && dayActivity.length > 0 && (
        <>
          <SectionTitle>What happened</SectionTitle>
          <ActivityList rows={dayActivity} today={snapshot.today} />
        </>
      )}
    </Screen>
  );
}

function Big({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={cn("text-[13px]", tone)}>{label}</span>
      <span className="truncate text-[22px] font-bold tabular-nums">{money(value)}</span>
    </div>
  );
}

function Row({ label, value, sub, strong }: { label: string; value: number; sub?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "border-t border-divider pt-2 font-bold", sub && "text-ink-muted")}>
      <span>{label}</span>
      <span className="tabular-nums">{value < 0 ? `−${money(-value)}` : money(value)}</span>
    </div>
  );
}
