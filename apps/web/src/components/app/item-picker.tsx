"use client";

import { Croissant, CupSoda, Droplets, Milk, Package, Wheat, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import type { StockRow } from "@/books/selectors";
import { cn } from "@/lib/utils";
import { Divider, Panel, STROKE } from "./screen";

const ITEM_ICON: Record<string, LucideIcon> = { bread: Croissant, milk: Milk, cooldrink: CupSoda, maize: Wheat, oil: Droplets };

export function ItemIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ITEM_ICON[id] ?? Package;
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-page", className)}>
      <Icon className="size-[22px]" strokeWidth={STROKE} aria-hidden />
    </span>
  );
}

/** Choose one stock item from a grey panel of rows. `unavailable` greys out rows that can't be chosen, e.g. out of stock. */
export function ItemPicker({
  label,
  rows,
  onPick,
  detail,
  unavailable,
}: {
  label: string;
  rows: StockRow[];
  onPick: (id: string) => void;
  detail: (r: StockRow) => string;
  unavailable?: (r: StockRow) => boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[13px] font-medium text-ink-muted">{label}</span>
      <Panel className="flex flex-col py-0.5">
        {rows.map((r, i) => (
          <Fragment key={r.id}>
            {i > 0 && <Divider inset />}
            <button
              type="button"
              onClick={() => onPick(r.id)}
              disabled={unavailable?.(r)}
              className="flex min-h-16 items-center gap-3 rounded-[18px] px-3.5 py-2.5 text-left hover:bg-panel-strong disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ItemIcon id={r.id} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{r.name}</span>
                <span className={cn("text-[13px]", r.low ? "font-medium text-negative" : "text-ink-muted")}>{detail(r)}</span>
              </span>
            </button>
          </Fragment>
        ))}
      </Panel>
    </div>
  );
}

/** The chosen item at the top of a grey panel, with "Change" to pick again. */
export function ChosenItem({ row, detail, onChange }: { row: StockRow; detail: string; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex w-full items-center gap-3 p-3.5 text-left">
      <ItemIcon id={row.id} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{row.name}</span>
        <span className="text-[13px] text-ink-muted">{detail}</span>
      </span>
      <span className="text-sm font-medium text-brand">Change</span>
    </button>
  );
}

