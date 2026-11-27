import { ACC, addDays, type Command, type ExpenseCategoryId, type IsoDate, type JournalEntry } from "@app/ledger";
import { CATEGORY_LABEL, rowText } from "./describe";
import { commandMap, openInvoices, type OpenInvoice } from "./selectors";
import type { BooksSnapshot } from "./store";

/**
 * The bank statement preview. No file is read: the "sample statement" is built from the
 * books' own bank (1000) movements for the 14 days before the demo day, plus three lines
 * the books don't have yet. Same anchor date, same statement.
 */

export const BANK_NAME = "Capitec Business";
export const FEE = 6500;
export const INTEREST = 312;

export type ExtraKind = "fee" | "interest" | "eft";

export interface MatchedLine {
  id: string;
  date: IsoDate;
  description: string;
  /** Signed: positive is money into the bank. */
  amount: number;
  entryId: string;
  matchedTo: string;
}

export interface ExtraLine {
  id: string;
  kind: ExtraKind;
  date: IsoDate;
  description: string;
  amount: number;
  /** For the customer EFT: the invoice it pays. */
  invoice?: { number: string; customer: string };
  /** Set once the books have it. */
  recordedAs?: string;
}

export interface SampleStatement {
  from: IsoDate;
  to: IsoDate;
  matched: MatchedLine[];
  extras: ExtraLine[];
  /** Closing balance on the statement. */
  statementBalance: number;
  /** The books' bank balance at the statement's last day. */
  booksBalance: number;
}


/** What the books call an entry, e.g. "4 items · Sale" or "Banked · Transfer". */
function inBooks(cmd: Command | undefined, s: BooksSnapshot, e?: JournalEntry): string {
  const t = rowText(cmd, s.book, e);
  const kind = t.detail.split(" · ")[0];
  return kind && kind !== t.title ? `${t.title} · ${kind}` : t.title;
}

const bankEffect = (e: JournalEntry) => e.lines.reduce((t, l) => (l.account === ACC.bank ? t + l.debit - l.credit : t), 0);
const extraId = (anchor: IsoDate, kind: ExtraKind) => `bank-${anchor}-${kind}`;


/** How a books entry would read on a bank statement. */
function statementText(cmd: Command | undefined, e: JournalEntry): string {
  switch (cmd?.kind) {
    case "sale":
      return cmd.paidWith === "eft" ? `EFT received${cmd.customer ? ` ${cmd.customer}` : ""}` : "Card machine settlement";
    case "payment_made":
      return `EFT to ${cmd.supplier}`;
    case "payment_received":
      return `EFT from ${cmd.customer ?? "customer"}`;
    case "expense":
      return cmd.category === "bank_fees" ? "Monthly service fee" : `Payment to ${cmd.supplier || CATEGORY_LABEL[cmd.category]}`;
    case "transfer":
      return cmd.to === "bank" ? "Cash deposit" : "ATM withdrawal";
    case "owner_drawing":
      return "Transfer to own account";
    default:
      return e.memo;
  }
}

export function sampleStatement(s: BooksSnapshot): SampleStatement {
  const to = addDays(s.anchorDate, -1);
  const from = addDays(to, -13);
  const cmds = commandMap(s);
  const ours = (id: string) => id.startsWith(`bank-${s.anchorDate}-`);

  const matched: MatchedLine[] = s.book.entries
    .filter((e) => e.date >= from && e.date <= to && !ours(e.id) && bankEffect(e) !== 0)
    .map((e) => {
      const cmd = cmds.get(e.id);
      return { id: `line-${e.id}`, date: e.date, description: statementText(cmd, e), amount: bankEffect(e), entryId: e.id, matchedTo: inBooks(cmd, s, e) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // The customer EFT pays the invoice it was recorded against, or else the oldest open one.
  const recordedEft = cmds.get(extraId(s.anchorDate, "eft"));
  const invoice =
    recordedEft?.kind === "payment_received"
      ? { number: recordedEft.invoiceNumber ?? "", customer: recordedEft.customer ?? "Customer", amount: recordedEft.amount }
      : openInvoices(s)[0];

  const extras: ExtraLine[] = [
    { id: extraId(s.anchorDate, "fee"), kind: "fee" as const, date: to, description: "Monthly account fee", amount: -FEE },
    { id: extraId(s.anchorDate, "interest"), kind: "interest" as const, date: to, description: "Interest received", amount: INTEREST },
    ...(invoice
      ? [{ id: extraId(s.anchorDate, "eft"), kind: "eft" as const, date: addDays(to, -1), description: `EFT from ${invoice.customer} ${invoice.number}`, amount: invoice.amount, invoice: { number: invoice.number, customer: invoice.customer } }]
      : []),
  ].map((x) => {
    const cmd = cmds.get(x.id);
    return cmd ? { ...x, recordedAs: inBooks(cmd, s) } : x;
  });

  const booksBalance = s.book.entries.filter((e) => e.date <= to).reduce((t, e) => t + bankEffect(e), 0);
  const beforeExtras = s.book.entries.filter((e) => e.date <= to && !ours(e.id)).reduce((t, e) => t + bankEffect(e), 0);
  return { from, to, matched, extras, statementBalance: beforeExtras + extras.reduce((t, x) => t + x.amount, 0), booksBalance };
}

/** The choices "Change" offers for a line; the first is the suggestion. */
export type ExtraChoice = { kind: "fee"; category: ExpenseCategoryId } | { kind: "interest"; as: "income" | "owner" } | { kind: "eft"; invoice: string };

export function defaultChoice(x: ExtraLine): ExtraChoice {
  if (x.kind === "fee") return { kind: "fee", category: "bank_fees" };
  if (x.kind === "interest") return { kind: "interest", as: "income" };
  return { kind: "eft", invoice: x.invoice?.number ?? "" };
}

/** The books command that records a statement line, dated on the statement. */
export function extraCommand(x: ExtraLine, choice: ExtraChoice, invoices: OpenInvoice[]): Command {
  const base = { id: x.id, date: x.date, amount: Math.abs(x.amount) };
  if (choice.kind === "fee") return { ...base, kind: "expense", category: choice.category, paidFrom: "bank" };
  if (choice.kind === "interest") return choice.as === "owner" ? { ...base, kind: "owner_contribution", into: "bank" } : { ...base, kind: "other_income", into: "bank", description: "Interest from the bank" };
  const inv = invoices.find((i) => i.number === choice.invoice) ?? (x.invoice ? { ...x.invoice, amount: base.amount } : undefined);
  return { ...base, kind: "payment_received", into: "bank", ...(inv ? { customer: inv.customer, invoiceNumber: inv.number } : {}) };
}
