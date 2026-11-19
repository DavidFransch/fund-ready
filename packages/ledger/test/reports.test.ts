import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ACC,
  balanceSheet,
  budgetVsActual,
  cashFlowSummary,
  complianceScorecard,
  generalLedgerCsv,
  incomeStatement,
  LedgerError,
  netBalances,
  rand,
  totalStockValue,
  trialBalance,
  trialBalanceCsv,
  type Command,
  type ExpenseCategoryId,
  type MoneyPlace,
  type PaymentMethod,
} from "../src";
import { ITEMS, nomsasBook } from "./fixtures";

function september() {
  const book = nomsasBook();
  book.execute({ kind: "sale", id: "s1", date: "2026-09-05", paidWith: "credit", customer: "Sizwe", lines: [{ itemId: "tray", description: "trays", qty: 3, unitPrice: rand(500) }] });
  book.execute({ kind: "sale", id: "s2", date: "2026-09-06", paidWith: "cash", lines: [{ description: "Vetkoek", qty: 1, unitPrice: rand(200) }] });
  book.execute({ kind: "expense", id: "e1", date: "2026-09-07", amount: rand(1500), category: "rent", paidFrom: "bank" });
  book.execute({ kind: "expense", id: "e2", date: "2026-09-08", amount: rand(60), category: "transport", paidFrom: "own" });
  book.execute({ kind: "transfer", id: "t1", date: "2026-09-09", amount: rand(500), from: "cash", to: "bank" });
  book.execute({ kind: "owner_drawing", id: "d1", date: "2026-09-10", amount: rand(300), from: "bank" });
  return book;
}

describe("reports", () => {
  it("builds an income statement from the ledger", () => {
    const is = incomeStatement(september().entries, { from: "2026-09-01", to: "2026-09-30" });
    expect(is.totalRevenue).toBe(rand(1700));
    expect(is.totalCostOfSales).toBe(rand(600));
    expect(is.grossProfit).toBe(rand(1100));
    expect(is.totalExpenses).toBe(rand(1560));
    expect(is.netProfit).toBe(-rand(460));
  });

  it("produces a balance sheet that balances and a trial balance that ties", () => {
    const book = september();
    const bs = balanceSheet(book.entries, "2026-09-30");
    expect(bs.balanced).toBe(true);
    expect(bs.profitToDate).toBe(-rand(460));
    // Drawings reduce equity but are not an expense.
    expect(bs.equity.find((l) => l.code === ACC.drawings)?.amount).toBe(-rand(300));
    expect(trialBalance(book.entries).balanced).toBe(true);
  });

  it("ignores moves between cash box and bank in money in/out", () => {
    const flow = cashFlowSummary(september().entries, { from: "2026-09-02", to: "2026-09-30" });
    expect(flow.moneyIn).toBe(rand(200));
    expect(flow.moneyOut).toBe(rand(1800));
  });

  it("compares budget with actual", () => {
    const rows = budgetVsActual(
      september().entries,
      [
        { account: ACC.sales, amount: rand(1500) },
        { account: ACC.rent, amount: rand(1500) },
        { account: ACC.transport, amount: rand(50) },
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(rows.map((r) => [r.plainName, r.status, r.difference])).toEqual([
      ["Sales", "ahead", rand(200)],
      ["Rent", "on_budget", 0],
      ["Transport", "over", rand(10)],
    ]);
  });

  it("exports CSVs for the accountant", () => {
    const book = september();
    expect(trialBalanceCsv(book.entries).split("\n")[0]).toBe("Account code,Account,Debit,Credit");
    expect(generalLedgerCsv(book.entries)).toContain("Shareholder loan");
  });
});

describe("compliance scorecard", () => {
  it("scores the four basics", () => {
    const s = complianceScorecard({
      today: "2026-10-06",
      recordedDays: ["2026-10-01", "2026-10-02", "2026-09-30"],
      closedThrough: "2026-09",
      taxReturnsUpToDate: true,
      cipcAnnualReturnFiled: true,
      cipcNextDue: "2027-03-14",
      annualFinancialStatementsPrepared: false,
    });
    expect(s.done).toBe(3);
    expect(s.compliant).toBe(false);
    expect(s.items.find((i) => i.id === "accounting")?.detail).toContain("3 of the last 28 days");
  });

  it("treats unclosed books as not up to date", () => {
    const s = complianceScorecard({
      today: "2026-10-06",
      recordedDays: [],
      closedThrough: "2026-08",
      taxReturnsUpToDate: true,
      cipcAnnualReturnFiled: true,
      annualFinancialStatementsPrepared: true,
    });
    expect(s.items[0]?.done).toBe(false);
  });
});

/** Property test: whatever sequence of valid actions a user takes, the books stay sound. */
describe("invariants under random activity", () => {
  const stockIds = ITEMS.filter((i) => i.kind === "stock").map((i) => i.id);
  const money = fc.integer({ min: 1, max: 500_000 });
  const qty = fc.integer({ min: 1, max: 30 });
  const day = fc.integer({ min: 2, max: 28 }).map((d) => `2026-09-${String(d).padStart(2, "0")}`);

  const command = fc.oneof(
    fc.record({
      kind: fc.constant("sale" as const),
      date: day,
      paidWith: fc.constantFrom<PaymentMethod[]>("cash", "card", "eft", "credit"),
      lines: fc.array(
        fc.record({ itemId: fc.constantFrom(...ITEMS.map((i) => i.id), undefined), qty, unitPrice: money }),
        { minLength: 1, maxLength: 4 },
      ),
    }),
    fc.record({ kind: fc.constant("expense" as const), date: day, amount: money, category: fc.constantFrom<ExpenseCategoryId[]>("rent", "transport", "wages", "other"), paidFrom: fc.constantFrom<("cash" | "bank" | "own")[]>("cash", "bank", "own") }),
    fc.record({ kind: fc.constant("stock_purchase" as const), date: day, paidFrom: fc.constantFrom<("cash" | "bank" | "own")[]>("cash", "bank", "own"), lines: fc.array(fc.record({ itemId: fc.constantFrom(...stockIds), qty, cost: money }), { minLength: 1, maxLength: 3 }) }),
    fc.record({ kind: fc.constant("stock_count" as const), date: day, itemId: fc.constantFrom(...stockIds), counted: fc.integer({ min: 0, max: 200 }), reason: fc.constantFrom<("used" | "lost")[]>("used", "lost") }),
    fc.record({ kind: fc.constant("payment_received" as const), date: day, amount: money, into: fc.constantFrom<MoneyPlace[]>("cash", "bank") }),
    fc.record({ kind: fc.constant("transfer" as const), date: day, amount: money, to: fc.constantFrom<MoneyPlace[]>("cash", "bank") }),
  );

  it("keeps debits = credits, balance sheet balanced, and stock sub-ledger = Stock account", () => {
    fc.assert(
      fc.property(fc.array(command, { maxLength: 40 }), (raw) => {
        const book = nomsasBook();
        raw
          .map((r, i): Command => {
            const id = `c${i}`;
            switch (r.kind) {
              case "sale":
                return { kind: "sale", id, date: r.date, paidWith: r.paidWith, customer: "Customer", lines: r.lines.map((l) => ({ ...(l.itemId ? { itemId: l.itemId } : {}), description: "line", qty: l.qty, unitPrice: l.unitPrice })) };
              case "expense":
                return { kind: "expense", id, date: r.date, amount: r.amount, category: r.category, paidFrom: r.paidFrom };
              case "stock_purchase":
                return { kind: "expense", id, date: r.date, category: "stock", paidFrom: r.paidFrom, amount: r.lines.reduce((s, l) => s + l.cost, 0), stockLines: r.lines.filter((l, j, a) => a.findIndex((x) => x.itemId === l.itemId) === j) };
              case "stock_count":
                return { kind: "stock_count", id, date: r.date, counts: [{ itemId: r.itemId, counted: r.counted, reason: r.reason }] };
              case "payment_received":
                return { kind: "payment_received", id, date: r.date, amount: r.amount, into: r.into };
              case "transfer":
                return { kind: "transfer", id, date: r.date, amount: r.amount, from: r.to === "cash" ? "bank" : "cash", to: r.to };
            }
          })
          // Dated commands are applied in date order, as the database will replay them.
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
          .forEach((cmd) => {
            if (cmd.kind === "expense" && cmd.category === "stock") {
              cmd.amount = (cmd.stockLines ?? []).reduce((s, l) => s + l.cost, 0);
            }
            try {
              book.execute(cmd);
            } catch (e) {
              if (!(e instanceof LedgerError)) throw e;
            }
          });

        expect(trialBalance(book.entries).balanced).toBe(true);
        expect(balanceSheet(book.entries, "2026-12-31").balanced).toBe(true);
        expect(netBalances(book.entries).get(ACC.stock) ?? 0).toBe(totalStockValue(book.levels.values()));
      }),
      { numRuns: 1000 },
    );
  });
});
