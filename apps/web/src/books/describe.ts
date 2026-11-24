import { ACC, formatRand, type AccountCode, type Book, type Command, type JournalEntry } from "@app/ledger";

/**
 * Plain-language wording for what an action does. No accounting terms here:
 * those belong in the accountant view only.
 */

const R = (c: number) => formatRand(c, { showCents: c % 100 !== 0 });

function itemName(book: Book, id: string | undefined): string {
  return (id && book.items.get(id)?.name) || "item";
}

function unit(book: Book, id: string): string {
  return book.items.get(id)?.unit ?? "";
}

const place = (p: "cash" | "bank") => (p === "cash" ? "petty cash" : "the bank");

/** Debits minus credits on one account in an entry. */
export function effectOn(entry: JournalEntry | null, account: AccountCode): number {
  if (!entry) return 0;
  return entry.lines.reduce((s, l) => (l.account === account ? s + l.debit - l.credit : s), 0);
}

export function entryTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.debit, 0);
}

/** A short title for the activity list. */
export function titleFor(cmd: Command | undefined, book: Book, entry?: JournalEntry): string {
  if (!cmd) return entry?.memo ?? "Entry";
  switch (cmd.kind) {
    case "sale": {
      const first = cmd.lines[0]!;
      const what = cmd.lines.length === 1 ? `${first.qty} × ${first.itemId ? itemName(book, first.itemId) : first.description}` : `${cmd.lines.length} items`;
      return cmd.paidWith === "credit" ? `Sold ${what} to ${cmd.customer} (pay later)` : `Sold ${what}`;
    }
    case "expense": {
      const later = cmd.paidFrom === "credit" ? " (pay later)" : "";
      if (cmd.category === "stock") {
        const lines = cmd.stockLines ?? [];
        const what = lines.length === 1 ? `${lines[0]!.qty} × ${itemName(book, lines[0]!.itemId)}` : `stock`;
        return `Bought ${what}${cmd.supplier ? ` from ${cmd.supplier}` : ""}${later}`;
      }
      const label = { packaging: "packaging", transport: "transport", rent: "rent", wages: "wages", electricity: "electricity", data: "airtime and data", bank_fees: "bank fees", other: "something else" }[cmd.category];
      return `Paid for ${label}${cmd.supplier && cmd.category !== "data" ? ` (${cmd.supplier})` : ""}${later}`;
    }
    case "payment_made":
      return `Paid ${cmd.supplier} what you owed`;
    case "payment_received":
      return `${cmd.customer ?? "A customer"} paid you`;
    case "stock_count":
      return "Stock count";
    case "transfer":
      return cmd.to === "cash" ? "Petty cash topped up from the bank" : "Petty cash taken to the bank";
    case "owner_drawing":
      return "You took money for yourself";
    case "owner_contribution":
      return "You put money into the business";
    case "opening_balance":
      return "Starting balances";
  }
}

export interface Before {
  cashBox: number;
  bank: number;
  owedToSupplier?: number;
}

/** Bullet points shown on the confirmation step before anything is saved. */
export function whatWillHappen(cmd: Command, entry: JournalEntry | null, book: Book, before: Before): string[] {
  const out: string[] = [];
  const cashAfter = before.cashBox + effectOn(entry, ACC.cashBox);
  const bankAfter = before.bank + effectOn(entry, ACC.bank);
  const moneyLine = (amount: number, p: "cash" | "bank", dir: "in" | "out") =>
    dir === "in"
      ? `${R(amount)} goes into ${place(p)}. ${p === "cash" ? "Petty cash" : "The bank"} will have ${R(p === "cash" ? cashAfter : bankAfter)}.`
      : `${R(amount)} comes out of ${place(p)}. ${R(p === "cash" ? cashAfter : bankAfter)} left.`;

  switch (cmd.kind) {
    case "sale": {
      const total = cmd.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      if (cmd.paidWith === "cash") out.push(moneyLine(total, "cash", "in"));
      else if (cmd.paidWith === "credit") out.push(`${cmd.customer} owes you ${R(total)}.`);
      else out.push(moneyLine(total, "bank", "in"));
      for (const l of cmd.lines) {
        if (!l.itemId) continue;
        const now = book.level(l.itemId).qty;
        out.push(`${l.qty} ${unit(book, l.itemId)} of ${itemName(book, l.itemId)} come off your stock (${now} → ${now - l.qty}).`);
      }
      const cost = effectOn(entry, ACC.costOfSales);
      if (cost > 0) out.push(`They cost you ${R(cost)}, so you made ${R(total - cost)} on this sale.`);
      break;
    }
    case "expense": {
      if (cmd.category === "stock") {
        for (const l of cmd.stockLines ?? []) {
          const now = book.level(l.itemId).qty;
          out.push(`${l.qty} ${unit(book, l.itemId)} of ${itemName(book, l.itemId)} added to your stock (${now} → ${now + l.qty}).`);
        }
        out.push("Stock is not an expense yet. It becomes a cost when you sell it.");
      } else {
        out.push(`${R(cmd.amount)} is counted as money spent on ${titleFor(cmd, book).replace(/^Paid for /, "").replace(/ \(.*\)$/, "")}.`);
      }
      if (cmd.paidFrom === "cash" || cmd.paidFrom === "bank") out.push(moneyLine(cmd.amount, cmd.paidFrom, "out"));
      if (cmd.paidFrom === "credit") {
        out.push(`Nothing is paid today. You will owe ${cmd.supplier} ${R((before.owedToSupplier ?? 0) + cmd.amount)}.`);
      }
      if (cmd.paidFrom === "own") out.push(`You used your own money. The business now owes you ${R(cmd.amount)}.`);
      break;
    }
    case "payment_made":
      out.push(moneyLine(cmd.amount, cmd.from, "out"));
      out.push(`You will owe ${cmd.supplier} ${R(Math.max(0, (before.owedToSupplier ?? 0) - cmd.amount))}.`);
      break;
    case "stock_count": {
      for (const c of cmd.counts) {
        const now = book.level(c.itemId).qty;
        const diff = c.counted - now;
        if (diff === 0) continue;
        const why = diff > 0 ? `${diff} extra found` : c.reason === "used" ? `${-diff} used in the shop` : `${-diff} lost or stolen`;
        out.push(`${itemName(book, c.itemId)}: ${now} → ${c.counted} (${why}).`);
      }
      const lost = effectOn(entry, ACC.stockAdjustments);
      const used = effectOn(entry, ACC.costOfSales);
      if (lost > 0) out.push(`${R(lost)} of stock is recorded as lost. It lowers your profit.`);
      if (lost < 0) out.push(`${R(-lost)} of extra stock is added back.`);
      if (used > 0) out.push(`${R(used)} of stock used in the shop counts as a cost.`);
      if (!entry) out.push("Everything matches. Nothing changes in your books.");
      break;
    }
    case "transfer":
      out.push(`${R(cmd.amount)} moves from ${place(cmd.from)} to ${place(cmd.to)}.`);
      out.push(`Petty cash will have ${R(cashAfter)}. The bank will have ${R(bankAfter)}.`);
      out.push("This is not money in or out of the business, just a move.");
      break;
    default:
      if (entry) out.push(entry.memo);
  }
  return out;
}
