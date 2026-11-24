"use client";

import type { StockRow } from "@/books/selectors";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pick one stock item from a list showing what is on hand. */
export function ItemPicker({
  label,
  rows,
  value,
  onChange,
  detail,
}: {
  label: string;
  rows: StockRow[];
  value: string | null;
  onChange: (id: string) => void;
  detail: (r: StockRow) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const selected = r.id === value;
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(r.id)}
              className={cn(
                "flex min-h-13 items-center justify-between gap-3 rounded-xl border-[1.5px] px-3.5 py-2 text-left",
                selected ? "border-night bg-night text-white" : "border-line-strong bg-card hover:border-ink-muted",
              )}
            >
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">{r.name}</span>
                <span className={cn("text-[13px]", selected ? "text-night-muted" : r.low ? "font-bold text-spend" : "text-ink-muted")}>
                  {r.qty} {r.unit} on hand{r.low ? " · running low" : ""}
                </span>
              </span>
              <span className={cn("text-sm whitespace-nowrap", selected ? "text-night-muted" : "text-ink-muted")}>{detail(r)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const costDetail = (r: StockRow) => `${money(r.unitCost)} each`;
export const priceDetail = (r: StockRow) => `sells for ${money(r.salePrice)}`;
