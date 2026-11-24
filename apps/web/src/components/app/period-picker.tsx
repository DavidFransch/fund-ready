"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDay, periodRange, type PeriodKind, type PeriodRange } from "@/books/dates";
import { cn } from "@/lib/utils";

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Day / week / month, with arrows to step back to earlier periods. */
export function PeriodPicker({
  today,
  kind,
  offset,
  onChange,
}: {
  today: string;
  kind: PeriodKind;
  offset: number;
  onChange: (kind: PeriodKind, offset: number) => void;
}) {
  const range: PeriodRange = periodRange(kind, today, offset);
  const arrow = "flex size-11 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card disabled:opacity-30";
  return (
    <div className="flex flex-col gap-2.5">
      <div role="group" aria-label="Show" className="grid grid-cols-3 gap-1 rounded-full bg-track p-1">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={k.value === kind}
            onClick={() => onChange(k.value, 0)}
            className={cn("h-11 rounded-full text-[15px] font-bold", k.value === kind ? "bg-card text-ink shadow-sm" : "text-ink-muted")}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={arrow} aria-label="Earlier" onClick={() => onChange(kind, offset - 1)}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="flex flex-col items-center">
          <span className="font-display text-xl font-bold">{range.label}</span>
          {range.from !== range.to && <span className="text-[13px] text-ink-muted">{`${formatDay(range.from)} – ${formatDay(range.to)}`}</span>}
        </span>
        <button type="button" className={arrow} aria-label="Later" disabled={offset >= 0} onClick={() => onChange(kind, offset + 1)}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
