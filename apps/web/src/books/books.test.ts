import { ACC, netBalances, trialBalance, balanceSheet, totalStockValue, positions, type Command } from "@app/ledger";
import { effectOn, invoiceText, summaryLine, whatsAppLink } from "./describe";
import { backdateRange, nextInvoiceNumber } from "./selectors";
import type { BooksSnapshot } from "./store";
import { describe, expect, it } from "vitest";
import { periodRange, weekStart } from "./dates";
import { generateSampleBusiness, HERO_ITEM, HERO_QTY, SAMPLE_CUSTOMER, SAMPLE_ITEMS } from "./seed";

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

  it("starts with an owner's loan that her drawings never use up", () => {
    const loan = -(netBalances(sample.book.entries).get(ACC.ownerLoan) ?? 0);
    expect(loan).toBeGreaterThan(0);
    expect(loan).toBeLessThan(15000_00);
  });

  it("has one unpaid invoice, to the sample customer", () => {
    const invoices = sample.commands.filter((c) => c.kind === "sale" && c.paidWith === "credit");
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ customer: SAMPLE_CUSTOMER, invoiceNumber: "INV-0001", date: "2026-11-23" });
    expect(positions(sample.book.entries).owedToYou).toBeGreaterThan(0);
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

describe("back-dating", () => {
  it("allows 60 days back but not before the books start, and never the future", () => {
    const { book } = generateSampleBusiness("2026-11-30");
    const snap = (today: string) => ({ today, book }) as unknown as BooksSnapshot;
    expect(backdateRange(snap("2026-11-30"))).toEqual({ min: "2026-10-01", max: "2026-11-30" });
    expect(backdateRange(snap("2026-12-15")).min).toBe("2026-10-16");
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

describe("invoice with several items", () => {
  const today = "2026-11-30";
  const { book } = generateSampleBusiness(today);
  const lines = SAMPLE_ITEMS.map((i) => ({ itemId: i.id, description: i.name, qty: 1, unitPrice: i.salePrice }));
  const total = lines.reduce((t, l) => t + l.unitPrice, 0);
  const before = SAMPLE_ITEMS.map((i) => book.level(i.id).qty);
  const cmd: Command = { kind: "sale", id: "inv-all", date: today, paidWith: "credit", customer: "Lwazi", invoiceNumber: "INV-0001", lines };
  const { entry } = book.execute(cmd);

  it("posts every line to debtors and revenue, and takes each item out of stock", () => {
    expect(effectOn(entry, ACC.debtors)).toBe(total);
    expect(-effectOn(entry, ACC.sales)).toBe(total);
    SAMPLE_ITEMS.forEach((i, n) => expect(book.level(i.id).qty).toBe(before[n]! - 1));
    expect(trialBalance(book.entries).balanced).toBe(true);
  });

  it("moves the invoice numbering on, whichever screen made it", () => {
    const commands = [cmd, { ...cmd, id: "sale-cash", paidWith: "cash", invoiceNumber: undefined } as Command];
    expect(nextInvoiceNumber({ commands } as unknown as BooksSnapshot)).toBe("INV-0002");
  });

  it("is described as several items", () => {
    expect(summaryLine(cmd, book)).toBe(`${SAMPLE_ITEMS.length} items to Lwazi, paid later`);
  });
});

describe("WhatsApp invoice", () => {
  const cmd: Command = { kind: "sale", id: "w", date: "2026-11-30", paidWith: "credit", customer: "Lwazi Crèche", invoiceNumber: "INV-0002", lines: [{ itemId: "bread", description: "Brown bread", qty: 3, unitPrice: 2000 }, { itemId: "milk", description: "Milk 1L", qty: 1, unitPrice: 2400 }] };

  it("lists the lines and the total", () => {
    const text = invoiceText(cmd, "Mama Tee Spaza");
    expect(text).toContain("Invoice INV-0002 from Mama Tee Spaza");
    expect(text).toContain("3 × Brown bread @ R20.00 = R60.00");
    expect(text).toContain("Total: R84.00");
  });

  it("turns a local number into an international wa.me link, or leaves the chat to pick", () => {
    expect(whatsAppLink("082 123 4567", "hi")).toBe("https://wa.me/27821234567?text=hi");
    expect(whatsAppLink("", "a b")).toBe("https://wa.me/?text=a%20b");
  });
});
