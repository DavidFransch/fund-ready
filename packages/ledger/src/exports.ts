import { getAccount } from "./accounts";
import type { IsoDate } from "./dates";
import type { JournalEntry } from "./journal";
import type { Cents } from "./money";
import { trialBalance } from "./reports";

const amount = (c: Cents) => (c / 100).toFixed(2);
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const row = (cells: string[]) => cells.map(csvCell).join(",");

/** Trial balance as CSV, for the accountant. */
export function trialBalanceCsv(entries: readonly JournalEntry[], asAt?: IsoDate): string {
  const tb = trialBalance(entries, asAt);
  return [
    row(["Account code", "Account", "Debit", "Credit"]),
    ...tb.rows.map((r) => row([r.code, r.name, amount(r.debit), amount(r.credit)])),
    row(["", "Total", amount(tb.totalDebit), amount(tb.totalCredit)]),
  ].join("\n");
}

/** Every journal line as CSV, for the accountant or import into other software. */
export function generalLedgerCsv(entries: readonly JournalEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return [
    row(["Date", "Entry", "Description", "Account code", "Account", "Debit", "Credit"]),
    ...sorted.flatMap((e) =>
      e.lines.map((l) => row([e.date, e.id, e.memo, l.account, getAccount(l.account).name, amount(l.debit), amount(l.credit)])),
    ),
  ].join("\n");
}
