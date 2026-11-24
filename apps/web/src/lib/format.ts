import { addDays, formatRand, type IsoDate } from "@app/ledger";
import { formatDay } from "@/books/dates";

/** Rand amount with cents, e.g. R1 800.00. */
export function money(cents: number): string {
  return formatRand(cents);
}

export function relativeDay(d: IsoDate, today: IsoDate): string {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return formatDay(d, { weekday: "long", day: "numeric", month: "long" });
}
