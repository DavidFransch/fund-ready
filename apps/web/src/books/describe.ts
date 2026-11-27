import { ACC, formatRand, type AccountCode, type Book, type Command, type ExpenseCategoryId, type JournalEntry } from "@app/ledger";

/**
 * Plain-language wording for what an action does. No accounting terms here:
 * those belong in the accountant view only.
 */

const R = (c: number) => formatRand(c);

export const CATEGORY_LABEL: Record<ExpenseCategoryId, string> = {
  stock: "Stock",
  packaging: "Packaging",
  transport: "Transport",
  rent: "Rent",
  wages: "Wages",
  electricity: "Electricity",
  data: "Airtime and data",
  bank_fees: "Bank fees",
  other: "Other",
};

const PAID_FROM_LABEL = { cash: "Petty cash", bank: "Bank", credit: "Pay later", own: "Own pocket" } as const;
const METHOD_LABEL = { cash: "Cash", card: "Card", eft: "EFT", credit: "Later" } as const;

function itemName(book: Book, id: string | undefined): string {
  return (id && book.items.get(id)?.name) || "Item";
}

function unit(book: Book, id: string): string {
  return book.items.get(id)?.unit ?? "";
}

/** Debits minus credits on one account in an entry. */
export function effectOn(entry: JournalEntry | null, account: AccountCode): number {
  if (!entry) return 0;
  return entry.lines.reduce((s, l) => (l.account === account ? s + l.debit - l.credit : s), 0);
}

export function entryTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.debit, 0);
}

export interface RowText {
  title: string;
  detail: string;
}

/** Title and secondary line for a list row, e.g. "Cooldrink 2L × 2" / "Sale · Cash". */
export function rowText(cmd: Command | undefined, book: Book, entry?: JournalEntry): RowText {
  if (!cmd) return { title: entry?.memo ?? "Entry", detail: "Journal" };
  switch (cmd.kind) {
    case "sale": {
      const first = cmd.lines[0]!;
      const title = cmd.lines.length === 1 ? `${first.itemId ? itemName(book, first.itemId) : first.description} × ${first.qty}` : `${cmd.lines.length} items`;
      return { title, detail: cmd.paidWith === "credit" ? `Invoice · ${cmd.customer ?? "customer"}` : `Sale · ${METHOD_LABEL[cmd.paidWith]}` };
    }
    case "expense": {
      if (cmd.category === "stock") {
        const lines = cmd.stockLines ?? [];
        const title = lines.length === 1 ? `${itemName(book, lines[0]!.itemId)} × ${lines[0]!.qty}` : "Stock";
        return { title, detail: `Stock in · ${PAID_FROM_LABEL[cmd.paidFrom]}` };
      }
      return { title: cmd.supplier || CATEGORY_LABEL[cmd.category], detail: `${CATEGORY_LABEL[cmd.category]} · ${PAID_FROM_LABEL[cmd.paidFrom]}` };
    }
    case "payment_made":
      return { title: cmd.supplier, detail: `Supplier paid · ${PAID_FROM_LABEL[cmd.from]}` };
    case "payment_received":
      return { title: cmd.customer ?? "Customer", detail: `Customer paid · ${PAID_FROM_LABEL[cmd.into]}` };
    case "stock_count": {
      const changed = book.movements.filter((m) => m.entryId === cmd.id);
      const short = changed.filter((m) => m.qty < 0).reduce((s, m) => s - m.qty, 0);
      const names = changed.map((m) => itemName(book, m.itemId)).join(", ");
      return { title: short ? `Stock count · ${short} short` : "Stock count", detail: names || "Everything matched" };
    }
    case "transfer":
      return cmd.to === "cash" ? { title: "Top up from bank", detail: "Transfer" } : { title: "Banked", detail: "Transfer" };
    case "owner_drawing":
      return { title: "Owner's pay", detail: `Drawing · ${PAID_FROM_LABEL[cmd.from]}` };
    case "owner_contribution":
      return { title: "Money put in", detail: `Owner · ${PAID_FROM_LABEL[cmd.into]}` };
    case "other_income":
      return { title: cmd.description || "Other money in", detail: `Other income · ${PAID_FROM_LABEL[cmd.into]}` };
    case "opening_balance":
      return { title: "Opening balances", detail: "Start of the books" };
  }
}

export type EntryType = "Sale" | "Purchase" | "Expense" | "Payment" | "Income" | "Stock" | "Petty cash" | "Owner" | "Opening";

export function entryType(cmd: Command | undefined): EntryType {
  switch (cmd?.kind) {
    case "sale":
      return "Sale";
    case "expense":
      return cmd.category === "stock" ? "Purchase" : "Expense";
    case "payment_made":
    case "payment_received":
      return "Payment";
    case "other_income":
      return "Income";
    case "stock_count":
      return "Stock";
    case "transfer":
      return "Petty cash";
    case "owner_drawing":
    case "owner_contribution":
      return "Owner";
    default:
      return "Opening";
  }
}

/** Which screen an action was recorded from, for the accountant. */
export function recordedFrom(cmd: Command | undefined): string {
  if (cmd?.id.startsWith("bank-")) return "Bank statement";
  switch (cmd?.kind) {
    case "sale":
      return cmd.invoiceNumber ? "Invoice" : "New sale";
    case "expense":
      return cmd.category === "stock" ? "Buy stock" : "Other expense";
    case "payment_made":
      return "Pay a supplier";
    case "payment_received":
      return "Customers";
    case "stock_count":
      return "Count stock";
    case "transfer":
      return "Petty cash";
    default:
      return "Set-up";
  }
}

/** One line of the confirm sheet: "Stock goes up · 4 → 12 bottles". */
export interface Outcome {
  icon: "stock" | "owe" | "money" | "cost" | "profit" | "loss" | "neutral";
  label: string;
  value: string;
  tone: "positive" | "negative" | "muted" | "ink";
}

export interface Before {
  cashBox: number;
  bank: number;
  owedToSupplier?: number;
  owedByCustomer?: number;
  /** Shareholder loan: what the business owes the owner (negative: the owner owes the business). */
  owedToOwner?: number;
}

/** What will happen, as short label/value rows shown before anything is saved. */
export function outcomes(cmd: Command, entry: JournalEntry | null, book: Book, before: Before): Outcome[] {
  const out: Outcome[] = [];
  const cashAfter = before.cashBox + effectOn(entry, ACC.cashBox);
  const bankAfter = before.bank + effectOn(entry, ACC.bank);
  const place = (p: "cash" | "bank") =>
    p === "cash"
      ? { icon: "money" as const, label: cashAfter >= before.cashBox ? "Petty cash goes up" : "Petty cash goes down", value: `${R(before.cashBox)} → ${R(cashAfter)}`, tone: "ink" as const }
      : { icon: "money" as const, label: bankAfter >= before.bank ? "Bank goes up" : "Bank goes down", value: `${R(before.bank)} → ${R(bankAfter)}`, tone: "ink" as const };
  const noMoneyMoves: Outcome = { icon: "neutral", label: "Petty cash and bank", value: "No change", tone: "muted" };

  switch (cmd.kind) {
    case "sale": {
      const total = cmd.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      for (const l of cmd.lines) {
        if (!l.itemId) continue;
        const now = book.level(l.itemId).qty;
        out.push({ icon: "stock", label: cmd.lines.length > 1 ? itemName(book, l.itemId) : "Stock goes down", value: `${now} → ${now - l.qty} ${unit(book, l.itemId)}`, tone: "ink" });
      }
      if (cmd.paidWith === "cash") out.push(place("cash"));
      else if (cmd.paidWith === "credit") out.push({ icon: "owe", label: `${cmd.customer} owes you`, value: R(total), tone: "ink" });
      else out.push(place("bank"));
      const cost = effectOn(entry, ACC.costOfSales);
      if (cost > 0) {
        out.push({ icon: "cost", label: "What these cost you", value: R(cost), tone: "ink" });
        out.push({ icon: "profit", label: total - cost >= 0 ? "Profit on this sale" : "Loss on this sale", value: R(Math.abs(total - cost)), tone: total - cost >= 0 ? "positive" : "negative" });
      }
      break;
    }
    case "expense": {
      if (cmd.category === "stock") {
        for (const l of cmd.stockLines ?? []) {
          const now = book.level(l.itemId).qty;
          out.push({ icon: "stock", label: "Stock goes up", value: `${now} → ${now + l.qty} ${unit(book, l.itemId)}`, tone: "ink" });
        }
      } else {
        out.push({ icon: "cost", label: `Spent on ${CATEGORY_LABEL[cmd.category].toLowerCase()}`, value: R(cmd.amount), tone: "negative" });
      }
      if (cmd.paidFrom === "cash" || cmd.paidFrom === "bank") out.push(place(cmd.paidFrom));
      if (cmd.paidFrom === "credit") {
        out.push({ icon: "owe", label: "You owe the supplier", value: R((before.owedToSupplier ?? 0) + cmd.amount), tone: "ink" });
        out.push(noMoneyMoves);
      }
      if (cmd.paidFrom === "own") {
        out.push({ icon: "owe", label: "The business owes you", value: R(cmd.amount), tone: "ink" });
        out.push(noMoneyMoves);
      }
      break;
    }
    case "payment_received": {
      const owed = before.owedByCustomer ?? 0;
      out.push({ icon: "owe", label: `${cmd.customer ?? "The customer"} owes you`, value: `${R(owed)} → ${R(Math.max(0, owed - cmd.amount))}`, tone: "ink" });
      out.push(place(cmd.into));
      break;
    }
    case "payment_made": {
      const owed = before.owedToSupplier ?? 0;
      out.push({ icon: "owe", label: `You owe ${cmd.supplier}`, value: `${R(owed)} → ${R(Math.max(0, owed - cmd.amount))}`, tone: "ink" });
      out.push(place(cmd.from));
      break;
    }
    case "stock_count": {
      for (const c of cmd.counts) {
        const now = book.level(c.itemId).qty;
        if (c.counted === now) continue;
        out.push({ icon: "stock", label: itemName(book, c.itemId), value: `${now} → ${c.counted} ${unit(book, c.itemId)}`, tone: "ink" });
      }
      const lost = effectOn(entry, ACC.stockAdjustments);
      const used = effectOn(entry, ACC.costOfSales);
      if (lost > 0) out.push({ icon: "loss", label: "Stock lost or stolen", value: R(lost), tone: "negative" });
      if (lost < 0) out.push({ icon: "profit", label: "Extra stock found", value: R(-lost), tone: "positive" });
      if (used > 0) out.push({ icon: "cost", label: "Used in the shop", value: R(used), tone: "ink" });
      if (!entry) out.push({ icon: "neutral", label: "Everything matches", value: "Nothing to record", tone: "muted" });
      break;
    }
    case "transfer":
      out.push(place("cash"), place("bank"));
      out.push({ icon: "neutral", label: "Money in or out of the business", value: "No change", tone: "muted" });
      break;
    default:
      if (entry) out.push({ icon: "neutral", label: entry.memo, value: R(entryTotal(entry)), tone: "ink" });
  }
  return out;
}

/** The one-line description under "Check and save". */
export function summaryLine(cmd: Command, book: Book): string {
  switch (cmd.kind) {
    case "sale": {
      const first = cmd.lines[0]!;
      const what = cmd.lines.length === 1 ? `${first.qty} × ${first.itemId ? itemName(book, first.itemId) : first.description}` : `${cmd.lines.length} items`;
      return cmd.paidWith === "credit" ? `${what} to ${cmd.customer}, paid later` : `${what}, paid by ${METHOD_LABEL[cmd.paidWith].toLowerCase()}`;
    }
    case "expense": {
      if (cmd.category === "stock") {
        const l = cmd.stockLines?.[0];
        return `${l ? `${l.qty} × ${itemName(book, l.itemId)}` : "Stock"}${cmd.supplier ? ` from ${cmd.supplier}` : ""}`;
      }
      return `${CATEGORY_LABEL[cmd.category]}${cmd.supplier ? ` · ${cmd.supplier}` : ""} · ${R(cmd.amount)}`;
    }
    case "payment_made":
      return `Paying ${cmd.supplier} ${R(cmd.amount)}`;
    case "payment_received":
      return `Payment from ${cmd.customer ?? "a customer"}${cmd.invoiceNumber ? ` for ${cmd.invoiceNumber}` : ""} · ${R(cmd.amount)}`;
    case "stock_count":
      return "Set your stock to what you counted";
    case "transfer":
      return cmd.to === "cash" ? `Top up petty cash with ${R(cmd.amount)} from the bank` : `Take ${R(cmd.amount)} from petty cash to the bank`;
    default:
      return "";
  }
}

export function saveLabel(cmd: Command): string {
  switch (cmd.kind) {
    case "sale":
      return cmd.invoiceNumber ? "Save invoice" : "Save sale";
    case "expense":
      return cmd.category === "stock" ? "Save purchase" : "Save expense";
    case "payment_made":
      return "Save payment";
    case "stock_count":
      return "Save count";
    case "transfer":
      return cmd.to === "cash" ? "Save top-up" : "Save deposit";
    case "payment_received":
      return "Save payment";
    case "other_income":
      return "Save income";
    default:
      return "Save";
  }
}

