"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useMemo, useState } from "react";
import { newId } from "@/books/ids";
import { pettyCash } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { MoneyInput, parseRand } from "@/components/app/inputs";
import { Card, Loading, NightCard, Screen, SectionTitle } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Move = "topup" | "deposit";

export default function PettyCashPage() {
  const { snapshot, check, sheet } = useConfirmedAction({ after: null });
  const [move, setMove] = useState<Move | null>(null);
  const [amountText, setAmountText] = useState("");
  const [limit, setLimit] = useState(25);
  const rows = useMemo(() => (snapshot ? pettyCash(snapshot) : []), [snapshot]);
  if (!snapshot) return <Loading />;

  const balance = rows[0]?.balance ?? 0;
  const amount = parseRand(amountText);
  const todayIn = rows.filter((r) => r.date === snapshot.today && r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const todayOut = rows.filter((r) => r.date === snapshot.today && r.amount < 0).reduce((s, r) => s - r.amount, 0);

  function submit() {
    if (!snapshot || !amount || !move) return;
    check({ kind: "transfer", id: newId(), date: snapshot.today, amount, from: move === "topup" ? "bank" : "cash", to: move === "topup" ? "cash" : "bank" });
    setMove(null);
    setAmountText("");
  }

  return (
    <Screen title="Petty cash" back="/" nav>
      <NightCard className="flex flex-col gap-3">
        <span className="text-[15px] text-night-muted">In the cash box now</span>
        <span className="font-display text-4xl font-bold">{money(balance)}</span>
        <div className="grid grid-cols-2 gap-2 border-t border-night-line pt-3 text-sm">
          <span className="flex flex-col">
            <span className="text-brand-on-dark">In today</span>
            <span className="text-[17px] font-bold">{money(todayIn)}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-spend-on-dark">Out today</span>
            <span className="text-[17px] font-bold">{money(todayOut)}</span>
          </span>
        </div>
      </NightCard>

      <div className="grid grid-cols-2 gap-3">
        <Button size="touch" variant={move === "topup" ? "night" : "outline"} aria-pressed={move === "topup"} onClick={() => setMove("topup")}>
          <ArrowDownToLine className="size-5" aria-hidden /> Top up
        </Button>
        <Button size="touch" variant={move === "deposit" ? "night" : "outline"} aria-pressed={move === "deposit"} onClick={() => setMove("deposit")}>
          <ArrowUpFromLine className="size-5" aria-hidden /> Deposit
        </Button>
      </div>

      {move && (
        <Card className="flex flex-col gap-3">
          <p className="text-[15px] font-bold">{move === "topup" ? "Take cash from the bank to put in petty cash" : "Take cash from petty cash to the bank"}</p>
          <MoneyInput label="How much" value={amountText} onChange={setAmountText} big />
          <Button size="touch" disabled={!amount} onClick={submit}>
            Check and save
          </Button>
        </Card>
      )}

      <SectionTitle>Every rand in and out</SectionTitle>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[18px] border-[1.5px] border-line bg-card">
        {rows.slice(0, limit).map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-bold">{r.title}</span>
              <span className="text-[13px] text-ink-muted">
                {relativeDay(r.date, snapshot.today)}
                {r.isUser && " · added in demo"}
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className={cn("font-display text-[17px] font-bold tabular-nums", r.amount > 0 ? "text-brand" : "text-spend")}>
                {r.amount > 0 ? "+" : "−"}
                {money(Math.abs(r.amount))}
              </span>
              <span className="text-[13px] text-ink-muted tabular-nums">left {money(r.balance)}</span>
            </span>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <Button variant="outline" size="touch" onClick={() => setLimit(limit + 50)}>
          Show older
        </Button>
      )}
      {sheet}
    </Screen>
  );
}
