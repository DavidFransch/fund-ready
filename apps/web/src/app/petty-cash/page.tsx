"use client";

import { ArrowDownToLine, Landmark } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { newId } from "@/books/ids";
import { byDay, pettyCash } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { MoneyInput, parseRand } from "@/components/app/inputs";
import { Amount, DayHeading, Divider, Loading, Panel, Screen, STROKE } from "@/components/app/screen";
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
    <Screen title="Petty cash" nav>
      <Panel aria-label="Petty cash balance" className="flex flex-col gap-[18px] rounded-3xl p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">In the cash box now</span>
          <Amount cents={balance} className="text-[40px]" />
          <span className="text-[13px] text-ink-muted">
            Today: <span className="font-semibold text-positive">+{money(todayIn)} in</span> · <span className="font-semibold text-negative">{money(todayOut)} out</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="touch" aria-pressed={move === "topup"} onClick={() => setMove(move === "topup" ? null : "topup")}>
            <ArrowDownToLine className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Top up
          </Button>
          <Button size="touch" variant="outline" aria-pressed={move === "deposit"} className={cn(move === "deposit" && "border-ink")} onClick={() => setMove(move === "deposit" ? null : "deposit")}>
            <Landmark className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Bank it
          </Button>
        </div>
        {move && (
          <div className="flex flex-col gap-3 border-t border-divider pt-4">
            <p className="text-[15px] font-medium">{move === "topup" ? "Take cash from the bank to put in petty cash" : "Take cash from petty cash to the bank"}</p>
            <MoneyInput label="How much" value={amountText} onChange={setAmountText} />
            <Button size="primary" disabled={!amount} onClick={submit}>
              {move === "topup" ? "Review top-up" : "Review deposit"}
            </Button>
          </div>
        )}
      </Panel>

      <section aria-label="Movements" className="mt-1.5 flex flex-col gap-2">
        {byDay(rows.slice(0, limit)).map((group) => (
          <Fragment key={group.date}>
            <DayHeading>{relativeDay(group.date, snapshot.today)}</DayHeading>
            <Panel className="flex flex-col">
              {group.rows.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && <Divider />}
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium">{r.title}</span>
                      <span className="truncate text-[13px] text-ink-muted">
                        {r.detail}
                        {r.time && ` · ${r.time}`}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className={cn("text-[15px] font-semibold whitespace-nowrap", r.amount > 0 ? "text-positive" : "text-negative")}>
                        {r.amount > 0 ? "+" : "−"}
                        {money(Math.abs(r.amount))}
                      </span>
                      <span className="text-xs text-ink-faint">{money(r.balance)}</span>
                    </span>
                  </div>
                </Fragment>
              ))}
            </Panel>
          </Fragment>
        ))}
        {rows.length > limit && (
          <Button variant="outline" size="touch" className="mt-2" onClick={() => setLimit(limit + 50)}>
            Show older
          </Button>
        )}
      </section>
      {sheet}
    </Screen>
  );
}
