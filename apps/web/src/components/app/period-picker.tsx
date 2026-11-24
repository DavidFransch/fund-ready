"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDay, periodRange, type PeriodKind } from "@/books/dates";
import { Segmented } from "./inputs";
import { STROKE } from "./screen";

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Day / week / month, with a navigator to step back (next is disabled for the current period). */
export function PeriodPicker({ today, kind, offset, onChange }: { today: string; kind: PeriodKind; offset: number; onChange: (kind: PeriodKind, offset: number) => void }) {
  const range = periodRange(kind, today, offset);
  const arrow = "flex size-11 items-center justify-center rounded-full text-ink hover:bg-panel disabled:text-[#C4C9C6] disabled:hover:bg-transparent";
  const dates =
    kind === "day"
      ? formatDay(range.from, { weekday: "long", day: "numeric", month: "short" })
      : `${formatDay(range.from, { day: "numeric", month: "short" })} – ${formatDay(range.to, { day: "numeric", month: "short" })}`;
  return (
    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-4">
      <div className="lg:w-[264px]">
        <Segmented label="Period" options={KINDS} value={kind} onChange={(k) => onChange(k, 0)} />
      </div>
      <div className="-mx-2 flex items-center justify-between lg:mx-0 lg:min-w-[260px] lg:gap-2">
        <button type="button" className={arrow} aria-label="Previous period" onClick={() => onChange(kind, offset - 1)}>
          <ChevronLeft className="size-[22px]" strokeWidth={STROKE} aria-hidden />
        </button>
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-[15px] font-semibold">{range.label}</span>
          <span className="text-[13px] text-ink-muted">{dates}</span>
        </span>
        <button type="button" className={arrow} aria-label="Next period" disabled={offset >= 0} onClick={() => onChange(kind, offset + 1)}>
          <ChevronRight className="size-[22px]" strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </div>
  );
}
