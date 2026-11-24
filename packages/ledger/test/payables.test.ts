import { describe, expect, it } from "vitest";
import {
  ACC,
  balanceSheet,
  LedgerError,
  netBalances,
  positions,
  rand,
  supplierBalances,
  totalStockValue,
  trialBalance,
  type Command,
} from "../src";
import { nomsasBook } from "./fixtures";

function stockMatchesLedger(book: ReturnType<typeof nomsasBook>) {
  expect(netBalances(book.entries).get(ACC.stock) ?? 0).toBe(totalStockValue(book.levels.values()));
}

const creditPurchase: Command = {
  kind: "expense",
  id: "buy-later",
  date: "2026-09-03",
  amount: rand(780),
  category: "stock",
  paidFrom: "credit",
  supplier: "Gugs Wholesalers",
  stockLines: [{ itemId: "flour", qty: 3, cost: rand(780) }],
};

describe("buying on credit and paying suppliers", () => {
  it("records a stock purchase on credit as money owed to the supplier, not money out", () => {
    const book = nomsasBook();
    const { entry } = book.execute(creditPurchase);
    expect(entry?.lines).toEqual([
      expect.objectContaining({ account: ACC.stock, debit: rand(780) }),
      expect.objectContaining({ account: ACC.creditors, credit: rand(780) }),
    ]);
    expect(entry?.memo).toBe("Stock from Gugs Wholesalers (pay later)");
    const pos = positions(book.entries);
    expect(pos.owedToSuppliers).toBe(rand(780));
    expect(pos.cashBox).toBe(rand(1000));
    expect(pos.bank).toBe(rand(5000));
    expect(book.level("flour").qty).toBe(5);
    stockMatchesLedger(book);
  });

  it("records a non-stock expense on credit", () => {
    const book = nomsasBook();
    book.execute({ kind: "expense", id: "bags", date: "2026-09-03", amount: rand(95), category: "packaging", paidFrom: "credit", supplier: "Plastics Co" });
    const net = netBalances(book.entries);
    expect(net.get(ACC.packaging)).toBe(rand(95));
    expect(net.get(ACC.creditors)).toBe(-rand(95));
  });

  it("clears the supplier when they are paid", () => {
    const book = nomsasBook();
    book.execute(creditPurchase);
    const { entry } = book.execute({ kind: "payment_made", id: "pay", date: "2026-09-10", amount: rand(780), from: "bank", supplier: "Gugs Wholesalers" });
    expect(entry?.source).toEqual({ type: "payment_made", ref: "Gugs Wholesalers" });
    expect(entry?.lines).toEqual([
      expect.objectContaining({ account: ACC.creditors, debit: rand(780) }),
      expect.objectContaining({ account: ACC.bank, credit: rand(780) }),
    ]);
    const pos = positions(book.entries);
    expect(pos.owedToSuppliers).toBe(0);
    expect(pos.bank).toBe(rand(4220));
    expect(balanceSheet(book.entries, "2026-09-30").balanced).toBe(true);
    expect(trialBalance(book.entries).balanced).toBe(true);
  });

  it("pays a supplier from the cash box", () => {
    const book = nomsasBook();
    book.execute(creditPurchase);
    book.execute({ kind: "payment_made", id: "pay", date: "2026-09-10", amount: rand(300), from: "cash", supplier: "Gugs Wholesalers" });
    const pos = positions(book.entries);
    expect(pos.cashBox).toBe(rand(700));
    expect(pos.owedToSuppliers).toBe(rand(480));
  });

  it("needs a supplier for credit purchases and payments", () => {
    const book = nomsasBook();
    expect(() => book.execute({ ...creditPurchase, supplier: " " } as Command)).toThrow(LedgerError);
    expect(() => book.execute({ kind: "payment_made", id: "p", date: "2026-09-10", amount: rand(10), from: "cash", supplier: "" })).toThrow(LedgerError);
  });

  it("rejects payments of zero or less", () => {
    const book = nomsasBook();
    expect(() => book.execute({ kind: "payment_made", id: "p", date: "2026-09-10", amount: 0, from: "cash", supplier: "X" })).toThrow(LedgerError);
    expect(() => book.execute({ kind: "payment_made", id: "p2", date: "2026-09-10", amount: -100, from: "cash", supplier: "X" })).toThrow(LedgerError);
  });

  it("is idempotent for supplier payments", () => {
    const book = nomsasBook();
    book.execute(creditPurchase);
    const pay: Command = { kind: "payment_made", id: "pay", date: "2026-09-10", amount: rand(780), from: "bank", supplier: "Gugs Wholesalers" };
    book.execute(pay);
    book.execute(pay);
    expect(positions(book.entries).bank).toBe(rand(4220));
  });

  it("works out what is owed per supplier, matching the Trade creditors account", () => {
    const book = nomsasBook();
    const commands: Command[] = [
      creditPurchase,
      { kind: "expense", id: "e2", date: "2026-09-04", amount: rand(120), category: "packaging", paidFrom: "credit", supplier: "gugs wholesalers " },
      { kind: "expense", id: "e3", date: "2026-09-05", amount: rand(200), category: "transport", paidFrom: "credit", supplier: "Taxi Rank Co" },
      { kind: "expense", id: "e4", date: "2026-09-05", amount: rand(50), category: "transport", paidFrom: "cash", supplier: "Taxi Rank Co" },
      { kind: "payment_made", id: "p1", date: "2026-09-06", amount: rand(200), from: "cash", supplier: "Taxi Rank Co" },
      { kind: "payment_made", id: "p2", date: "2026-09-07", amount: rand(500), from: "bank", supplier: "Gugs Wholesalers" },
    ];
    commands.forEach((c) => book.execute(c));
    const balances = supplierBalances(commands);
    expect(balances).toEqual([{ supplier: "Gugs Wholesalers", amount: rand(400) }]);
    expect(balances.reduce((s, b) => s + b.amount, 0)).toBe(positions(book.entries).owedToSuppliers);
    stockMatchesLedger(book);
  });
});
