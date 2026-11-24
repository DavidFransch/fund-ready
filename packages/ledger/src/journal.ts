import { getAccount, type AccountCode } from "./accounts";
import { assertIsoDate, assertIsoMonth, monthOf, type IsoDate, type IsoMonth } from "./dates";
import { LedgerError } from "./errors";
import { assertCents, type Cents } from "./money";

export interface JournalLine {
  account: AccountCode;
  debit: Cents;
  credit: Cents;
  memo?: string;
}

export type SourceType =
  | "opening_balance"
  | "sale"
  | "payment_received"
  | "payment_made"
  | "expense"
  | "stock_count"
  | "transfer"
  | "owner_contribution"
  | "owner_drawing"
  | "reversal"
  | "manual";

export interface JournalEntry {
  /** Client-generated id; doubles as the idempotency key of the command that produced it. */
  id: string;
  date: IsoDate;
  memo: string;
  source: { type: SourceType; ref?: string };
  lines: JournalLine[];
  /** Set on reversing entries: the id of the entry being reversed. */
  reverses?: string;
}

export const dr = (account: AccountCode, amount: Cents, memo?: string): JournalLine => ({
  account,
  debit: amount,
  credit: 0,
  ...(memo ? { memo } : {}),
});

export const cr = (account: AccountCode, amount: Cents, memo?: string): JournalLine => ({
  account,
  debit: 0,
  credit: amount,
  ...(memo ? { memo } : {}),
});

/** Throws if the entry breaks any double-entry rule. */
export function validateEntry(entry: JournalEntry): void {
  if (!entry.id) throw new LedgerError("Entry needs an id");
  assertIsoDate(entry.date, "entry date");
  if (entry.lines.length < 2) throw new LedgerError("Entry needs at least two lines");
  let debits = 0;
  let credits = 0;
  for (const line of entry.lines) {
    getAccount(line.account);
    assertCents(line.debit, "debit");
    assertCents(line.credit, "credit");
    if (line.debit < 0 || line.credit < 0) throw new LedgerError("Debits and credits cannot be negative");
    if ((line.debit === 0) === (line.credit === 0)) {
      throw new LedgerError("Each line must have either a debit or a credit, not both or neither");
    }
    debits += line.debit;
    credits += line.credit;
  }
  if (debits !== credits) {
    throw new LedgerError(`Entry ${entry.id} does not balance: debits ${debits} vs credits ${credits}`);
  }
}

/** Build an entry, dropping zero-amount lines, and validate it. */
export function makeEntry(input: Omit<JournalEntry, "lines"> & { lines: JournalLine[] }): JournalEntry {
  const entry: JournalEntry = {
    ...input,
    lines: input.lines.filter((l) => l.debit !== 0 || l.credit !== 0),
  };
  validateEntry(entry);
  return entry;
}

/** A correction never edits history: it posts the mirror image of the original. */
export function reverseEntry(
  original: JournalEntry,
  options: { id: string; date: IsoDate; memo?: string },
): JournalEntry {
  return makeEntry({
    id: options.id,
    date: options.date,
    memo: options.memo ?? `Reversal of: ${original.memo}`,
    source: { type: "reversal", ref: original.id },
    reverses: original.id,
    lines: original.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
  });
}

/** Throws if the date falls in a month that has been closed. */
export function assertPeriodOpen(date: IsoDate, closedThrough?: IsoMonth): void {
  if (!closedThrough) return;
  assertIsoMonth(closedThrough, "closed month");
  if (monthOf(date) <= closedThrough) {
    throw new LedgerError(`${monthOf(date)} is closed. Record corrections in the current month.`);
  }
}
