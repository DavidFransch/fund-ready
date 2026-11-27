import { describe, expect, it } from "vitest";
import { ACC, balanceSheet, incomeStatement, LedgerError, netBalances, positions, rand, totalStockValue, type Command } from "../src";
import { nomsasBook } from "./fixtures";

function stockMatchesLedger(book: ReturnType<typeof nomsasBook>) {
  expect(netBalances(book.entries).get(ACC.stock) ?? 0).toBe(totalStockValue(book.levels.values()));
}

describe("posting commands", () => {
  it("records a cash sale of a free-text line without touching stock", () => {
    const book = nomsasBook();
    const r = book.execute({
      kind: "sale",
      id: "s1",
      date: "2026-09-02",
      paidWith: "cash",
      lines: [{ description: "Vetkoek x20", qty: 1, unitPrice: rand(200) }],
    });
    expect(r.movements).toHaveLength(0);
    expect(positions(book.entries).cashBox).toBe(rand(1200));
    stockMatchesLedger(book);
  });

  it("invoices stock and service items: stock and cost of sales move only for stock", () => {
    const book = nomsasBook();
    const r = book.execute({
      kind: "sale",
      id: "inv42",
      date: "2026-09-05",
      paidWith: "credit",
      customer: "Sizwe Catering",
      invoiceNumber: "INV-0042",
      lines: [
        { itemId: "tray", description: "Samoosa tray (50)", qty: 3, unitPrice: rand(500) },
        { itemId: "staff", description: "Serving staff", qty: 2, unitPrice: rand(150) },
      ],
    });
    expect(r.movements).toEqual([expect.objectContaining({ itemId: "tray", qty: -3, cost: -rand(600) })]);
    const net = netBalances(book.entries);
    expect(net.get(ACC.debtors)).toBe(rand(1800));
    expect(net.get(ACC.sales)).toBe(-rand(1800));
    expect(net.get(ACC.costOfSales)).toBe(rand(600));
    expect(book.level("tray").qty).toBe(6);
    expect(book.level("staff").qty).toBe(0);
    stockMatchesLedger(book);
  });

  it("requires a customer for sales on credit", () => {
    const book = nomsasBook();
    expect(() =>
      book.execute({ kind: "sale", id: "x", date: "2026-09-02", paidWith: "credit", lines: [{ description: "x", qty: 1, unitPrice: 100 }] }),
    ).toThrow(LedgerError);
  });

  it("clears money owed when the customer pays", () => {
    const book = nomsasBook();
    book.execute({ kind: "sale", id: "s", date: "2026-09-05", paidWith: "credit", customer: "Sizwe", lines: [{ description: "x", qty: 1, unitPrice: rand(1800) }] });
    book.execute({ kind: "payment_received", id: "p", date: "2026-09-12", amount: rand(1800), into: "bank", customer: "Sizwe" });
    const pos = positions(book.entries);
    expect(pos.owedToYou).toBe(0);
    expect(pos.bank).toBe(rand(6800));
  });

  it("records interest from the bank as other income, not as sales", () => {
    const book = nomsasBook();
    const bankBefore = positions(book.entries).bank;
    book.execute({ kind: "other_income", id: "int1", date: "2026-09-30", amount: 312, into: "bank", description: "Interest" });
    expect(positions(book.entries).bank).toBe(bankBefore + 312);
    const is = incomeStatement(book.entries, { from: "2026-09-30", to: "2026-09-30" });
    expect(is.revenue.find((l) => l.code === ACC.otherIncome)?.amount).toBe(312);
    expect(is.revenue.find((l) => l.code === ACC.sales)).toBeUndefined();
    expect(() => book.execute({ kind: "other_income", id: "int2", date: "2026-09-30", amount: 0, into: "bank" })).toThrow(LedgerError);
  });

  it("buys stock from the cash box and updates quantities", () => {
    const book = nomsasBook();
    book.execute({
      kind: "expense",
      id: "slip1",
      date: "2026-09-03",
      amount: rand(640),
      category: "stock",
      paidFrom: "cash",
      supplier: "Wholesaler",
      stockLines: [
        { itemId: "flour", qty: 2, cost: rand(520) },
        { itemId: "boxes", qty: 40, cost: rand(120) },
      ],
    });
    expect(book.level("flour").qty).toBe(4);
    expect(book.level("boxes").qty).toBe(180);
    expect(positions(book.entries).cashBox).toBe(rand(360));
    stockMatchesLedger(book);
  });

  it("rejects stock purchases whose lines do not add up to the slip", () => {
    const book = nomsasBook();
    expect(() =>
      book.execute({ kind: "expense", id: "bad", date: "2026-09-03", amount: rand(640), category: "stock", paidFrom: "cash", stockLines: [{ itemId: "flour", qty: 2, cost: rand(500) }] }),
    ).toThrow(LedgerError);
  });

  it("records an expense paid from the owner's pocket as money owed to the owner", () => {
    const book = nomsasBook();
    book.execute({ kind: "expense", id: "taxi", date: "2026-09-04", amount: rand(60), category: "transport", paidFrom: "own" });
    expect(positions(book.entries).owedToOwner).toBe(rand(60));
    expect(netBalances(book.entries).get(ACC.transport)).toBe(rand(60));
  });

  it("records the stock-count difference as stock loss (R105 example from the canvas)", () => {
    const book = nomsasBook();
    const r = book.execute({
      kind: "stock_count",
      id: "count1",
      date: "2026-09-30",
      counts: [
        { itemId: "flour", counted: 2 },
        { itemId: "pastry", counted: 16 },
        { itemId: "boxes", counted: 135 },
      ],
    });
    expect(r.movements.map((m) => [m.itemId, m.qty])).toEqual([
      ["pastry", -2],
      ["boxes", -5],
    ]);
    expect(netBalances(book.entries).get(ACC.stockAdjustments)).toBe(rand(105));
    expect(book.level("pastry").qty).toBe(16);
    stockMatchesLedger(book);
  });

  it("records ingredients used in cooking as cost of sales, not as a loss", () => {
    const book = nomsasBook();
    book.execute({
      kind: "stock_count",
      id: "weekly",
      date: "2026-09-07",
      counts: [
        { itemId: "pastry", counted: 16, reason: "used" },
        { itemId: "boxes", counted: 135, reason: "lost" },
      ],
    });
    const net = netBalances(book.entries);
    expect(net.get(ACC.costOfSales)).toBe(rand(90));
    expect(net.get(ACC.stockAdjustments)).toBe(rand(15));
    stockMatchesLedger(book);
  });

  it("posts nothing when the count matches", () => {
    const book = nomsasBook();
    const r = book.execute({ kind: "stock_count", id: "c", date: "2026-09-30", counts: [{ itemId: "flour", counted: 2 }] });
    expect(r.entry).toBeNull();
  });

  it("allows selling before the purchase is recorded, then corrects cost of sales to the real price", () => {
    const book = nomsasBook();
    // 6 packs of mince on hand at R110 each; 8 are sold before the new stock is recorded.
    book.execute({ kind: "sale", id: "s", date: "2026-09-10", paidWith: "cash", lines: [{ itemId: "mince", description: "mince", qty: 8, unitPrice: rand(150) }] });
    expect(book.level("mince").qty).toBe(-2);
    // The purchase arrives at R120 a pack: the 2 oversold packs cost R20 more than estimated.
    book.execute({ kind: "expense", id: "buy", date: "2026-09-11", amount: rand(600), category: "stock", paidFrom: "cash", stockLines: [{ itemId: "mince", qty: 5, cost: rand(600) }] });
    expect(book.level("mince")).toMatchObject({ qty: 3, cost: rand(360) });
    expect(netBalances(book.entries).get(ACC.costOfSales)).toBe(rand(660 + 220 + 20));
    stockMatchesLedger(book);
  });

  it("is idempotent: retrying a command with the same id changes nothing", () => {
    const book = nomsasBook();
    const cmd: Command = { kind: "sale", id: "dup", date: "2026-09-02", paidWith: "cash", lines: [{ description: "x", qty: 1, unitPrice: rand(10) }] };
    book.execute(cmd);
    book.execute(cmd);
    expect(book.entries.filter((e) => e.id === "dup")).toHaveLength(1);
  });

  it("refuses entries in a closed month and corrects with a reversal", () => {
    const book = nomsasBook();
    book.execute({ kind: "sale", id: "s", date: "2026-09-10", paidWith: "cash", lines: [{ itemId: "tray", description: "t", qty: 1, unitPrice: rand(500) }] });
    book.closeMonth("2026-09");
    expect(() =>
      book.execute({ kind: "sale", id: "late", date: "2026-09-20", paidWith: "cash", lines: [{ description: "x", qty: 1, unitPrice: 100 }] }),
    ).toThrow(LedgerError);
    book.reverse("s", { id: "s-rev", date: "2026-10-01" });
    expect(book.level("tray").qty).toBe(9);
    expect(positions(book.entries).cashBox).toBe(rand(1000));
    stockMatchesLedger(book);
    expect(balanceSheet(book.entries, "2026-10-31").balanced).toBe(true);
  });
});
