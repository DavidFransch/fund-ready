import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { ActivityRow } from "@/books/selectors";
import { money, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICON = { in: ArrowDownLeft, out: ArrowUpRight, move: ArrowLeftRight, none: ClipboardCheck } as const;

export function ActivityList({ rows, today }: { rows: ActivityRow[]; today: string }) {
  return (
    <ul className="flex flex-col divide-y divide-divider overflow-hidden rounded-[18px] border-[1.5px] border-divider bg-page">
      {rows.map((r) => {
        const Icon = ICON[r.direction];
        return (
          <li key={r.id}>
            <Link href={`/accountant?entry=${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-page">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  r.direction === "in" ? "bg-brand-tint text-brand-strong" : r.direction === "out" ? "bg-negative-tint text-negative" : "bg-panel-strong text-ink-muted",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold">{r.title}</span>
                <span className="text-[13px] text-ink-muted">
                  {relativeDay(r.date, today)}
                  {r.isUser && " · added in demo"}
                </span>
              </span>
              <span className={cn("text-[17px] font-bold tabular-nums", r.direction === "in" ? "text-brand" : r.direction === "out" ? "text-negative" : "text-ink-muted")}>
                {r.direction === "in" ? "+" : r.direction === "out" ? "−" : ""}
                {money(r.amount)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
