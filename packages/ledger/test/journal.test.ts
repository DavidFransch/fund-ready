import { describe, expect, it } from "vitest";
import { ACC, assertPeriodOpen, cr, dr, LedgerError, makeEntry, reverseEntry, validateEntry } from "../src";

const base = { id: "e1", date: "2026-09-01", memo: "test", source: { type: "manual" as const } };

describe("journal", () => {
  it("accepts a balanced entry and drops zero lines", () => {
    const e = makeEntry({ ...base, lines: [dr(ACC.cashBox, 100), cr(ACC.sales, 100), dr(ACC.costOfSales, 0)] });
    expect(e.lines).toHaveLength(2);
  });

  it("rejects unbalanced, one-sided, negative and fractional entries", () => {
    expect(() => makeEntry({ ...base, lines: [dr(ACC.cashBox, 100), cr(ACC.sales, 99)] })).toThrow(LedgerError);
    expect(() => makeEntry({ ...base, lines: [dr(ACC.cashBox, 100)] })).toThrow(LedgerError);
    expect(() => makeEntry({ ...base, lines: [dr(ACC.cashBox, -100), cr(ACC.sales, -100)] })).toThrow(LedgerError);
    expect(() => makeEntry({ ...base, lines: [dr(ACC.cashBox, 1.5), cr(ACC.sales, 1.5)] })).toThrow(LedgerError);
    expect(() =>
      validateEntry({ ...base, lines: [{ account: ACC.cashBox, debit: 5, credit: 5 }, cr(ACC.sales, 0)] }),
    ).toThrow(LedgerError);
  });

  it("rejects unknown accounts and bad dates", () => {
    expect(() => makeEntry({ ...base, lines: [dr("9999" as never, 1), cr(ACC.sales, 1)] })).toThrow(LedgerError);
    expect(() => makeEntry({ ...base, date: "2026-02-30", lines: [dr(ACC.cashBox, 1), cr(ACC.sales, 1)] })).toThrow(
      LedgerError,
    );
  });

  it("reverses by mirroring, never editing", () => {
    const e = makeEntry({ ...base, lines: [dr(ACC.cashBox, 100), cr(ACC.sales, 100)] });
    const r = reverseEntry(e, { id: "e2", date: "2026-09-02" });
    expect(r.reverses).toBe("e1");
    expect(r.lines).toEqual([cr(ACC.cashBox, 100), dr(ACC.sales, 100)]);
  });

  it("blocks entries in closed months", () => {
    expect(() => assertPeriodOpen("2026-08-31", "2026-08")).toThrow(LedgerError);
    expect(() => assertPeriodOpen("2026-09-01", "2026-08")).not.toThrow();
  });
});
