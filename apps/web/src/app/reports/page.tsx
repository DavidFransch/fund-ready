"use client";

import { ACC } from "@app/ledger";
import { Fragment, useMemo, useState } from "react";
import { periodRange, type PeriodKind } from "@/books/dates";
import { activity, periodSummary, salesBars } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { ActivityList } from "@/components/app/activity";
import { Segmented } from "@/components/app/inputs";
import { PeriodPicker } from "@/components/app/period-picker";
import { PlainBalanceSheet } from "@/components/app/plain-balance-sheet";
import { Amount, Divider, Loading, Panel, Screen } from "@/components/app/screen";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { snapshot } = useBooks();
  const [kind, setKind] = useState<PeriodKind>("week");
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"profit" | "balance">("profit");

  const data = useMemo(() => {
    if (!snapshot) return null;
    const range = periodRange(kind, snapshot.today, offset);
    return {
      range,
      sum: periodSummary(snapshot.book.entries, range.from, range.to),
      bars: salesBars(snapshot, kind, range.from, range.to),
      dayActivity: kind === "day" ? activity(snapshot, { date: range.from }) : [],
    };
  }, [snapshot, kind, offset]);
  if (!snapshot || !data) return <Loading />;
  const { range, sum, bars, dayActivity } = data;
  const max = Math.max(1, ...bars.map((b) => b.sales));
  const stockLost = sum.expenseLines.find((l) => l.code === ACC.stockAdjustments)?.amount ?? 0;
  const running = sum.expenseLines.filter((l) => l.code !== ACC.stockAdjustments);
  const picker = (
    <PeriodPicker
      today={snapshot.today}
      kind={kind}
      offset={offset}
      onChange={(k, o) => {
        setKind(k);
        setOffset(o);
      }}
    />
  );

  const viewToggle = (
    <div className="lg:max-w-xs">
      <Segmented
        label="Report"
        options={[
          { value: "profit" as const, label: "Profit" },
          { value: "balance" as const, label: "Balance sheet" },
        ]}
        value={view}
        onChange={setView}
      />
    </div>
  );

  if (view === "balance") {
    return (
      <Screen title="Reports" nav>
        {viewToggle}
        <PlainBalanceSheet entries={snapshot.book.entries} asAt={snapshot.today} />
      </Screen>
    );
  }

  return (
    <Screen title="Reports" nav actions={picker}>
      {viewToggle}
      <div className="lg:hidden">{picker}</div>

      <div className="hidden grid-cols-3 gap-3 lg:grid">
        <Kpi label="Sales" cents={sum.sales} />
        <Kpi label="Expenses" cents={sum.costOfSales + sum.expenses} note={`incl. ${money(sum.costOfSales)} cost of what you sold`} />
        <Kpi label={sum.netProfit < 0 ? "Loss" : "Profit"} cents={Math.abs(sum.netProfit)} tone={sum.netProfit < 0 ? "negative" : "positive"} />
      </div>

      <section aria-label={sum.netProfit < 0 ? "Loss" : "Profit"} className="flex flex-col gap-1.5 px-1 lg:hidden">
        <span className="text-[13px] font-medium text-ink-muted">{sum.netProfit < 0 ? "Loss" : "Profit"}</span>
        <Amount cents={Math.abs(sum.netProfit)} className={cn("text-[40px]", sum.netProfit < 0 && "text-negative")} />
      </section>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
      <Panel data-tour="reports" aria-label="Sales by period" className="flex flex-col gap-2.5 rounded-[20px] px-3.5 pt-4 pb-3 lg:col-span-2 lg:px-5 lg:pt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink-muted">Sales</span>
          <span className="text-[15px] font-semibold">{money(sum.sales)}</span>
        </div>
        <div role="img" aria-label={`Sales for ${range.label.toLowerCase()}: ${bars.map((b) => `${b.label} ${money(b.sales)}`).join(", ")}`} className="flex h-[110px] items-end gap-2 lg:h-[260px] lg:gap-4">
          {bars.map((b) => (
            <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              {b.sales > 0 && <span className="hidden text-[11px] text-ink-muted lg:block">{money(b.sales)}</span>}
              <div className={cn("min-h-1 w-full max-w-7 rounded-md lg:max-w-12", b.current ? "bg-brand" : "bg-chart-muted")} style={{ height: `${Math.round((b.sales / max) * 100) * 0.84}%` }} />
              <span className="text-[11px] whitespace-nowrap text-ink-muted">{b.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel aria-label="Breakdown" className="flex flex-col rounded-[20px] lg:col-span-1">
        <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
          <span>Sales</span>
          <span className="font-semibold">{money(sum.sales)}</span>
        </div>
        <Divider />
        <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
          <span className="flex flex-col gap-0.5">
            <span>Cost of what you sold</span>
            {stockLost !== 0 && <span className="text-xs text-ink-muted">includes {money(stockLost)} stock lost</span>}
          </span>
          <span className="font-semibold">−{money(sum.costOfSales)}</span>
        </div>
        <Divider />
        <div className="flex flex-col gap-2 px-3.5 py-[13px] text-[15px]">
          <div className="flex justify-between">
            <span>Expenses</span>
            <span className="font-semibold">−{money(sum.expenses)}</span>
          </div>
          {running.map((c) => (
            <div key={c.code} className="flex justify-between text-[13px] text-ink-muted">
              <span>{c.name}</span>
              <span>{money(c.amount)}</span>
            </div>
          ))}
        </div>
        <Divider />
        <div className="flex justify-between px-3.5 py-[13px] text-[15px] font-semibold">
          <span>{sum.netProfit < 0 ? "Loss" : "Profit"}</span>
          <span className={sum.netProfit < 0 ? "text-negative" : "text-positive"}>{money(Math.abs(sum.netProfit))}</span>
        </div>
      </Panel>
      </div>

      {kind === "day" && dayActivity.length > 0 && (
        <Fragment>
          <h2 className="mt-1.5 px-1 text-[15px] font-semibold">What happened</h2>
          <ActivityList rows={dayActivity} />
        </Fragment>
      )}
    </Screen>
  );
}

function Kpi({ label, cents, note, tone }: { label: string; cents: number; note?: string; tone?: "positive" | "negative" }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-panel px-5 py-4">
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <Amount cents={cents} className={cn("text-[32px]", tone === "positive" && "text-positive", tone === "negative" && "text-negative")} />
      {note && <span className="text-xs text-ink-muted">{note}</span>}
    </div>
  );
}
