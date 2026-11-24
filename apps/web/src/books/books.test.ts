import { ACC, netBalances, trialBalance, balanceSheet, totalStockValue, positions } from "@app/ledger";
import { describe, expect, it } from "vitest";
import { periodRange, weekStart } from "./dates";
import { generateSampleBusiness, HERO_ITEM, HERO_QTY, SAMPLE_ITEMS } from "./seed";

describe("sample business", () => {
  const today = "2026-11-30";
  const sample = generateSampleBusiness(today);

  it("is accepted in full by the ledger and ends yesterday", () => {
    expect(sample.rejected).toBe(0);
    expect(sample.commands.length).toBeGreaterThan(150);
    expect(sample.start).toBe("2026-10-01");
    expect(sample.book.entries.every((e) => e.date < today)).toBe(true);
    expect(sample.book.entries.some((e) => e.date === "2026-11-29")).toBe(true);
  });

  it("keeps the books sound", () => {
    const { entries } = sample.book;
    expect(trialBalance(entries).balanced).toBe(true);
    expect(balanceSheet(entries, today).balanced).toBe(true);
    expect(netBalances(entries).get(ACC.stock) ?? 0).toBe(totalStockValue(sample.book.levels.values()));
  });

  it("has realistic positions: cash and bank positive, supplier history present", () => {
    const pos = positions(sample.book.entries);
    expect(pos.cashBox).toBeGreaterThan(0);
    expect(pos.bank).toBeGreaterThan(0);
    expect(sample.commands.some((c) => c.kind === "payment_made")).toBe(true);
    expect(sample.commands.some((c) => c.kind === "expense" && c.paidFrom === "credit")).toBe(true);
    expect(sample.commands.some((c) => c.kind === "expense" && c.category === "packaging")).toBe(true);
  });

  it("lands the demo item on a known quantity at a round average cost", () => {
    const level = sample.book.level(HERO_ITEM);
    expect(level.qty).toBe(HERO_QTY);
    expect(level.cost).toBe(HERO_QTY * SAMPLE_ITEMS.find((i) => i.id === HERO_ITEM)!.cost);
  });

  it("gives every command a time of day", () => {
    expect(sample.commands.every((c) => /^\d\d:\d\d$/.test(sample.times.get(c.id) ?? ""))).toBe(true);
  });

  it("is deterministic for the same day and works for any day of the month", () => {
    expect(generateSampleBusiness(today).commands).toEqual(sample.commands);
    for (const d of ["2026-11-01", "2026-12-02", "2027-01-15", "2026-11-27"]) {
      const s = generateSampleBusiness(d);
      expect(s.rejected).toBe(0);
      expect(trialBalance(s.book.entries).balanced).toBe(true);
      expect(s.book.level(HERO_ITEM).qty).toBe(HERO_QTY);
    }
  });
});

describe("periods", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-11-30")).toBe("2026-11-30");
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(periodRange("week", "2026-11-26", -1)).toMatchObject({ from: "2026-11-16", to: "2026-11-22", label: "Last week" });
    expect(periodRange("month", "2026-11-26", -1)).toMatchObject({ from: "2026-10-01", to: "2026-10-31", label: "Last month" });
    expect(periodRange("day", "2026-11-26", 0)).toMatchObject({ from: "2026-11-26", label: "Today" });
  });
});
