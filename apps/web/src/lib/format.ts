import { addDays, formatRand, type IsoDate } from "@app/ledger";
import { formatDay } from "@/books/dates";

/** Rand amount, dropping ".00" for whole amounts: R1 800, R12.50. */
export function money(cents: number): string {
  return formatRand(cents, { showCents: cents % 100 !== 0 });
}

export function relativeDay(d: IsoDate, today: IsoDate): string {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return formatDay(d);
}
