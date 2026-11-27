"use client";

import { LedgerError, rand } from "@app/ledger";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { STROKE } from "./screen";

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

/** Cents back into the plain text a user would type, e.g. 2200 -> "22.00". */
/** A date between `min` and `max` (ISO dates), defaulting to today. Hint says which day it is. */
export function DateInput({ label = "Date", value, onChange, min, max }: { label?: string; value: string; onChange: (v: string) => void; min: string; max: string }) {
  const id = useId();
  const outside = value < min || value > max;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      <input id={id} type="date" value={value} min={min} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} className={cn(field, "text-[15px]")} />
      <span className={cn("px-1 text-[13px]", outside ? "font-medium text-negative" : "text-ink-muted")}>
        {outside ? "Choose a day in the last 60 days, not in the future" : value === max ? "Today" : "Recorded on this day, not today"}
      </span>
    </div>
  );
}

/** Loose check that catches typos like "lwazi@" without rejecting real addresses. */
export function isEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

export function centsToText(cents: number): string {
  return (cents / 100).toFixed(2);
}

const field = "h-12 w-full min-w-0 rounded-xl border border-input-border bg-page px-3.5 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20";

export function MoneyInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  const invalid = value.trim() !== "" && parseRand(value) === null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      <div className={cn(field, "flex items-center gap-0.5 px-3.5 focus-within:border-brand", invalid && "border-negative")}>
        <span className="text-lg font-semibold text-ink-muted">R</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent text-lg font-semibold outline-none"
          placeholder="0.00"
        />
      </div>
      {invalid ? <span className="text-[13px] text-negative">Type an amount like 120 or 45.50</span> : hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  list,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string[];
  type?: "text" | "email" | "tel";
  /** Shown under the field, e.g. why it's optional. */
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list ? `${id}-list` : undefined}
        type={type}
        inputMode={type === "text" ? undefined : type}
        autoCapitalize={type === "text" ? undefined : "none"}
        autoComplete="off"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(field, "text-[15px] placeholder:text-ink-faint")}
      />
      {hint && (
        <span id={`${id}-hint`} className="px-1 text-[13px] text-ink-muted">
          {hint}
        </span>
      )}
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

/** Pill track with a white selected segment. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly Choice<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="grid gap-1 rounded-full bg-panel-strong p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cn("h-10 rounded-full text-sm", selected ? "bg-page font-semibold text-ink shadow-[0_1px_3px_rgba(17,20,18,0.1)]" : "font-medium text-ink-muted")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckDot() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10" className="fill-brand" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Grey tiles with a secondary line; the selected one gets a brand border and check. */
export function ChoiceTiles<T extends string>({ label, options, value, onChange }: { label: string; options: readonly Choice<T>[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 px-1 text-[13px] font-medium text-ink-muted">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-[14px] px-3 py-2.5 text-left",
                selected ? "border-[1.5px] border-brand bg-brand-wash" : "border border-panel bg-panel hover:border-input-border",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {selected && <CheckDot />}
                {o.label}
              </span>
              {o.hint && <span className="text-xs text-ink-muted">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Outline pills; the selected one is filled with ink. `columns` lays them out in a grid. */
export function Chips<T extends string>({ label, options, value, onChange, columns }: { label: string; options: readonly Choice<T>[]; value: T | null; onChange: (v: T) => void; columns?: number }) {
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-[13px] font-medium text-ink-muted">{label}</legend>
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
                "h-12 rounded-full px-4 text-[15px]",
                !columns && "h-11",
                selected ? "border-[1.5px] border-ink bg-ink font-semibold text-white" : "border border-input-border bg-page font-medium text-ink hover:bg-panel",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Two-way choice shown as radio pills, e.g. why stock is short. */
export function RadioPills<T extends string>({ label, options, value, onChange }: { label: string; options: readonly (Choice<T> & { tone: "negative" | "brand" })[]; value: T; onChange: (v: T) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // Three choices: two then one full-width on a phone, one row from tablet up.
      className={cn("grid grid-cols-2 gap-1.5", options.length === 3 && "sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1")}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-11 rounded-full text-sm",
              !selected && "border border-input-border bg-page font-medium text-ink",
              selected && o.tone === "negative" && "border-[1.5px] border-negative bg-negative-tint font-semibold text-[#8A2F10]",
              selected && o.tone === "brand" && "border-[1.5px] border-brand bg-brand-tint font-semibold text-brand-strong",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** − value + with 44px buttons. "pill": white pill (on a grey panel). "box": bordered field. */
export function Stepper({ value, onChange, min = 0, max, label, variant = "pill" }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; variant?: "pill" | "box" }) {
  const btn = "flex size-11 shrink-0 items-center justify-center rounded-full disabled:text-ink-faint";
  return (
    <div className={cn("flex items-center", variant === "pill" ? "h-11 rounded-full bg-page" : "h-12 justify-between rounded-xl border border-input-border bg-page px-0.5")}>
      <button type="button" className={btn} aria-label={`One less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="size-5" strokeWidth={STROKE} aria-hidden />
      </button>
      <span className={cn("text-center font-semibold", variant === "pill" ? "min-w-7 text-[17px]" : "text-lg")} aria-live="polite" aria-label={`${value} ${label}`}>
        {value}
      </span>
      <button type="button" className={btn} aria-label={`One more ${label}`} disabled={max !== undefined && value >= max} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}>
        <Plus className="size-5" strokeWidth={STROKE} aria-hidden />
      </button>
    </div>
  );
}

