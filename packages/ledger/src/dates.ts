import { LedgerError } from "./errors";

/** Dates are ISO calendar dates ("2026-09-30"); months are "2026-09". Comparisons are string comparisons. */
export type IsoDate = string;
export type IsoMonth = string;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertIsoDate(value: string, label = "date"): asserts value is IsoDate {
  if (!DATE_RE.test(value)) throw new LedgerError(`${label} must be YYYY-MM-DD, got "${value}"`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new LedgerError(`${label} "${value}" is not a real date`);
  }
}

export function assertIsoMonth(value: string, label = "month"): asserts value is IsoMonth {
  if (!MONTH_RE.test(value)) throw new LedgerError(`${label} must be YYYY-MM, got "${value}"`);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function firstDayOfMonth(month: IsoMonth): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: IsoMonth, n: number): IsoMonth {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
