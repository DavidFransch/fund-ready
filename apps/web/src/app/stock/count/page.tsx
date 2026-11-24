"use client";

import { ACC, type Command } from "@app/ledger";
import { Fragment, useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { RadioPills, Stepper } from "@/components/app/inputs";
import { Divider, Loading, NightCard, Panel, Screen } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Reason = "lost" | "used";
const REASONS = [
  { value: "lost" as const, label: "Lost or stolen", tone: "negative" as const },
  { value: "used" as const, label: "Used in the shop", tone: "brand" as const },
];

export default function CountPage() {
  const { check, sheet } = useConfirmedAction({ after: "/stock" });
  const { snapshot, preview } = useBooks();
  const [counted, setCounted] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, Reason>>({});
  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  if (!snapshot) return <Loading />;

  const changed = rows.filter((r) => counted[r.id] !== undefined && counted[r.id] !== r.qty);
  const cmd: Command | null = changed.length
    ? { kind: "stock_count", id: "count-preview", date: snapshot.today, counts: changed.map((r) => ({ itemId: r.id, counted: counted[r.id]!, reason: reasons[r.id] ?? "lost" })) }
    : null;
  const p = cmd ? preview(cmd) : null;
  const entry = p?.ok ? p.result.entry : null;
  const lost = effectOn(entry, ACC.stockAdjustments);
  const used = effectOn(entry, ACC.costOfSales);

  let headline = "Everything matches";
  let note = "Nothing to record";
  if (lost > 0) [headline, note] = [`${money(lost)} stock loss`, "Recorded as stock lost or stolen"];
  else if (used > 0) [headline, note] = [`${money(used)} used`, "Counted as cost of sales"];
  else if (lost < 0) [headline, note] = [`${money(-lost)} extra`, "Recorded as stock found"];

  return (
    <Screen
      title="Count stock"
      back="/stock"
      footer={
        <>
          <NightCard aria-label="Count result" className="flex items-center justify-between gap-3 rounded-[20px] px-[18px] py-4">
            <span className="flex flex-col gap-1">
              <span className="text-[13px] text-night-muted">{changed.length === 1 ? "1 item is different" : `${changed.length} items are different`}</span>
              <span className="text-[22px] font-semibold tracking-[-0.02em] whitespace-nowrap">{headline}</span>
            </span>
            <span className="max-w-[120px] text-right text-[13px] leading-snug text-night-muted">{note}</span>
          </NightCard>
          <Button size="primary" disabled={!cmd} onClick={() => cmd && check({ ...cmd, id: newId() } as Command)}>
            Save count
          </Button>
        </>
      }
    >
      <p className="-mt-1 px-1 text-[15px] leading-[1.45] text-ink-muted">Count what is on the shelf. Change any number that is different.</p>
      <Panel className="flex flex-col">
        {rows.map((r, i) => {
          const value = counted[r.id] ?? r.qty;
          const diff = value - r.qty;
          return (
            <Fragment key={r.id}>
              {i > 0 && <Divider className="mx-0" />}
              <div className="flex flex-col gap-2.5 py-3 pr-2.5 pl-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-[15px] font-semibold">{r.name}</span>
                    <span className={cn("text-[13px]", diff === 0 ? "text-ink-muted" : diff < 0 ? "font-semibold text-negative" : "font-semibold text-positive")}>
                      {diff === 0 ? `Expected ${r.qty} · matches` : diff < 0 ? `Expected ${r.qty} · ${-diff} short` : `Expected ${r.qty} · ${diff} extra`}
                    </span>
                  </span>
                  <Stepper value={value} onChange={(v) => setCounted({ ...counted, [r.id]: v })} label={r.unit} />
                </div>
                {diff < 0 && (
                  <RadioPills label={`Why is ${r.name} short?`} options={REASONS} value={reasons[r.id] ?? "lost"} onChange={(v) => setReasons({ ...reasons, [r.id]: v })} />
                )}
              </div>
            </Fragment>
          );
        })}
      </Panel>
      {sheet}
    </Screen>
  );
}
