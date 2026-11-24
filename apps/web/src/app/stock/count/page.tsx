"use client";

import { ACC, type Command } from "@app/ledger";
import { useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { Choices, Stepper } from "@/components/app/inputs";
import { Loading, NightCard, Screen } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { useBooks } from "@/books/store";
import { money } from "@/lib/format";

type Reason = "lost" | "used";
const REASONS: { value: Reason; label: string }[] = [
  { value: "lost", label: "Lost or stolen" },
  { value: "used", label: "Used in the shop" },
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
    ? {
        kind: "stock_count",
        id: "count-preview",
        date: snapshot.today,
        counts: changed.map((r) => ({ itemId: r.id, counted: counted[r.id]!, reason: reasons[r.id] ?? "lost" })),
      }
    : null;
  const p = cmd ? preview(cmd) : null;
  const entry = p?.ok ? p.result.entry : null;
  const lost = effectOn(entry, ACC.stockAdjustments);
  const used = effectOn(entry, ACC.costOfSales);

  let headline = "Everything matches";
  let note = "Change any number that is different from your shelf.";
  if (lost > 0 || used > 0) {
    headline = lost > 0 ? `${money(lost)} stock loss` : `${money(used)} used in the shop`;
    note = "We will set your stock to what you counted and record the difference in your books.";
  } else if (lost < 0) {
    headline = `${money(-lost)} more than expected`;
    note = "We will set your stock to what you counted and add the extra back.";
  }

  return (
    <Screen title="Count my stock" back="/stock">
      <p className="-mt-1 text-[15px] leading-snug text-ink-muted">Count what is on your shelf. Change any number that is different.</p>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const value = counted[r.id] ?? r.qty;
          const diff = value - r.qty;
          return (
            <li key={r.id} className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line bg-card py-2.5 pr-2.5 pl-4">
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-bold">{r.name}</span>
                  <span className={diff === 0 ? "text-[13px] font-bold text-brand" : diff < 0 ? "text-[13px] font-bold text-spend" : "text-[13px] font-bold text-ink-soft"}>
                    {diff === 0 ? `Matches · expected ${r.qty}` : diff < 0 ? `Expected ${r.qty} · ${-diff} missing` : `Expected ${r.qty} · ${diff} extra`}
                  </span>
                </span>
                <Stepper value={value} onChange={(v) => setCounted({ ...counted, [r.id]: v })} label={r.unit} />
              </div>
              {diff < 0 && (
                <div className="pr-1.5">
                  <Choices label={`Why are ${-diff} missing?`} options={REASONS} value={reasons[r.id] ?? "lost"} onChange={(v) => setReasons({ ...reasons, [r.id]: v })} columns={2} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <NightCard className="flex flex-col gap-1.5 p-4">
        <span className="text-sm text-night-muted">{changed.length === 1 ? "1 item is different" : `${changed.length} items are different`}</span>
        <span className="font-display text-[26px] font-bold">{headline}</span>
        <span className="text-sm leading-snug text-night-muted">{note}</span>
      </NightCard>

      <div className="mt-auto pt-2">
        <Button size="primary" disabled={!cmd} onClick={() => cmd && check({ ...cmd, id: newId() } as Command)}>
          Update my stock
        </Button>
      </div>
      {sheet}
    </Screen>
  );
}
