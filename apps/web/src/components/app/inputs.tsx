"use client";

import { LedgerError, rand } from "@app/ledger";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Parse what the user typed into whole cents, or null if it is not a valid amount. */
export function parseRand(text: string): number | null {
  if (!text.trim()) return null;
  try {
    const cents = rand(text);
    return cents > 0 ? cents : null;
  } catch (e) {
    if (e instanceof LedgerError) return null;
    throw e;
  }
}

/** Cents back into the plain text a user would type, e.g. 38400 -> "384", 1250 -> "12.50". */
export function centsToText(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function MoneyInput({
  label,
  value,
  onChange,
  big = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  big?: boolean;
  hint?: string;
}) {
  const id = useId();
  const invalid = value.trim() !== "" && parseRand(value) === null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center rounded-xl border-[1.5px] border-input-border bg-[#F9FBF9] px-3 focus-within:border-brand",
          big ? "h-14" : "h-12",
          invalid && "border-negative",
        )}
      >
        <span className={cn("font-bold text-ink-muted", big ? "text-3xl" : "text-xl")}>R</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className={cn("w-full min-w-0 bg-transparent pl-1 font-bold outline-none", big ? "text-3xl" : "text-xl")}
          placeholder="0"
        />
      </div>
      {invalid ? <span className="text-sm text-negative">Type an amount like 120 or 45.50</span> : hint && <span className="text-sm text-ink-muted">{hint}</span>}
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, list }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; list?: string[] }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list ? `${id}-list` : undefined}
        autoComplete="off"
        className="h-12 min-w-0 rounded-xl border-[1.5px] border-input-border bg-[#F9FBF9] px-3 text-base outline-none focus:border-brand"
      />
      {list && (
        <datalist id={`${id}-list`}>
          {list.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Single-choice buttons (≥44px). `columns` lays them out in a grid; otherwise they wrap as pills. */
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className={cn(columns ? "grid gap-2" : "flex flex-wrap gap-2")} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-xl border-[1.5px] px-3 py-1.5 text-[15px] leading-tight font-bold transition-colors",
                !columns && "min-h-11 rounded-full px-4",
                selected ? "border-night bg-night text-white" : "border-input-border bg-page text-ink hover:border-ink-muted",
              )}
            >
              {o.label}
              {o.hint && <span className={cn("text-xs font-normal", selected ? "text-night-muted" : "text-ink-muted")}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (v: number) => void; min?: number; label: string }) {
  const btn = "flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-input-border bg-page disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} aria-label={`One less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="size-5" aria-hidden />
      </button>
      <span className="min-w-10 text-center text-[22px] font-bold" aria-live="polite" aria-label={`${value} ${label}`}>
        {value}
      </span>
      <button type="button" className={btn} aria-label={`One more ${label}`} onClick={() => onChange(value + 1)}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}
