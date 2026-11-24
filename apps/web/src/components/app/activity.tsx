import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Package } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import type { ActivityRow } from "@/books/selectors";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Divider, Panel, STROKE } from "./screen";

const ICON = { in: ArrowDownLeft, out: ArrowUpRight, move: ArrowLeftRight, none: Package } as const;

/** Signed, coloured amount: in = positive with "+", out = negative with "−", neutral = ink. */
export function SignedMoney({ cents, direction, className }: { cents: number; direction: "in" | "out" | "move" | "none"; className?: string }) {
  return (
    <span className={cn("text-[15px] font-semibold whitespace-nowrap", direction === "in" && "text-positive", direction === "out" && "text-negative", className)}>
      {direction === "in" ? "+" : direction === "out" ? "−" : ""}
      {money(cents)}
    </span>
  );
}

/** Rows of what happened, each linking to its journal entry. */
export function ActivityList({ rows }: { rows: ActivityRow[]; /** @deprecated shim */ today?: string }) {
  return (
    <Panel className="flex flex-col py-0.5">
      {rows.map((r, i) => {
        const Icon = ICON[r.direction];
        return (
          <Fragment key={r.id}>
            {i > 0 && <Divider inset />}
            <Link href={`/accountant?entry=${r.id}`} className="flex min-h-16 items-center gap-3 rounded-[18px] px-3.5 py-3 hover:bg-panel-strong">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  r.direction === "in" ? "bg-brand-tint text-brand" : r.direction === "out" ? "bg-negative-tint text-negative" : "bg-page text-ink",
                )}
              >
                <Icon className="size-5" strokeWidth={STROKE} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium">{r.title}</span>
                <span className="truncate text-[13px] text-ink-muted">
                  {r.detail}
                  {r.time && ` · ${r.time}`}
                </span>
              </span>
              <SignedMoney cents={r.amount} direction={r.direction} />
            </Link>
          </Fragment>
        );
      })}
    </Panel>
  );
}
