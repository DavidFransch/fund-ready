import { addDays, addMonths, firstDayOfMonth, lastDayOfMonth, monthOf, type IsoDate } from "@app/ledger";

/** Today's date on this device, as YYYY-MM-DD in local time. */
export function localToday(now = new Date()): IsoDate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const asDate = (d: IsoDate) => new Date(`${d}T00:00:00Z`);

export function formatDay(d: IsoDate, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  // en-ZA pads days ("01 Oct"); the design writes "1 Oct".
  return asDate(d).toLocaleDateString("en-ZA", { timeZone: "UTC", ...opts }).replace(/\b0(\d)\b/g, "$1");
}

export type PeriodKind = "day" | "week" | "month";

export interface PeriodRange {
  kind: PeriodKind;
  offset: number;
  from: IsoDate;
  to: IsoDate;
  label: string;
}

/** Monday of the week containing `d`. */
export function weekStart(d: IsoDate): IsoDate {
  const dow = asDate(d).getUTCDay(); // 0 = Sunday
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

/** A day, week (Monday to Sunday) or month, `offset` periods away from the one containing `today`. */
export function periodRange(kind: PeriodKind, today: IsoDate, offset = 0): PeriodRange {
  if (kind === "day") {
    const d = addDays(today, offset);
    const label = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : formatDay(d);
    return { kind, offset, from: d, to: d, label };
  }
  if (kind === "week") {
    const from = addDays(weekStart(today), offset * 7);
    const to = addDays(from, 6);
    const label =
      offset === 0 ? "This week" : offset === -1 ? "Last week" : `${formatDay(from, { day: "numeric", month: "short" })} – ${formatDay(to, { day: "numeric", month: "short" })}`;
    return { kind, offset, from, to, label };
  }
  const month = addMonths(monthOf(today), offset);
  const from = firstDayOfMonth(month);
  const label = offset === 0 ? "This month" : offset === -1 ? "Last month" : formatDay(from, { month: "long", year: "numeric" });
  return { kind, offset, from, to: lastDayOfMonth(month), label };
}

export function daysIn(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
