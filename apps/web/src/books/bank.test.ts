import type { Command } from "@app/ledger";
import { describe, expect, it } from "vitest";
import { defaultChoice, extraCommand, FEE, INTEREST, openInvoices, sampleStatement } from "./bank";
import { generateSampleBusiness, SAMPLE_CUSTOMER } from "./seed";
import type { BooksSnapshot } from "./store";

function snapshot(anchorDate: string, extra: Command[] = []): BooksSnapshot {
  const { book, commands, times } = generateSampleBusiness(anchorDate);
  for (const c of extra) book.execute(c);
  return { version: 1, today: anchorDate, anchorDate, book, commands: [...commands, ...extra], userCommandIds: new Set(extra.map((c) => c.id)), times, saved: true };
}

describe("bank statement preview", () => {
  const anchor = "2026-11-30";

  it("is the same statement for the same demo day", () => {
    expect(sampleStatement(snapshot(anchor))).toEqual(sampleStatement(snapshot(anchor)));
  });

  it("matches the books' bank movements for the last 14 days and adds three lines they don't have", () => {
    const st = sampleStatement(snapshot(anchor));
    expect(st.from).toBe("2026-11-16");
    expect(st.to).toBe("2026-11-29");
    expect(st.matched.length).toBeGreaterThan(3);
    expect(st.matched.every((l) => l.date >= st.from && l.date <= st.to)).toBe(true);
    expect(st.extras.map((x) => x.kind)).toEqual(["fee", "interest", "eft"]);
    const eft = st.extras.find((x) => x.kind === "eft")!;
    expect(eft.invoice).toEqual({ number: "INV-0001", customer: SAMPLE_CUSTOMER });
    expect(eft.amount).toBe(openInvoices(snapshot(anchor))[0]!.amount);
    expect(st.statementBalance - st.booksBalance).toBe(-FEE + INTEREST + eft.amount);
  });

  it("reconciles once the three lines are recorded, and clears the invoice", () => {
    const before = snapshot(anchor);
    const st = sampleStatement(before);
    const cmds = st.extras.map((x) => extraCommand(x, defaultChoice(x), openInvoices(before)));
    const after = sampleStatement(snapshot(anchor, cmds));
    expect(after.booksBalance).toBe(after.statementBalance);
    expect(after.statementBalance).toBe(st.statementBalance);
    expect(after.extras.every((x) => x.recordedAs)).toBe(true);
    expect(after.matched).toHaveLength(st.matched.length);
    expect(openInvoices(snapshot(anchor, cmds))).toHaveLength(0);
  });
});
