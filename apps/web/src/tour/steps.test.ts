import type { Command } from "@app/ledger";
import { describe, expect, it } from "vitest";
import { stepAfter, tourSteps } from "./steps";

const purchase: Command = { kind: "expense", id: "p", date: "2026-11-30", amount: 17600, paidFrom: "credit", category: "stock", supplier: "Gugulethu Cash & Carry", stockLines: [{ itemId: "cooldrink", qty: 8, cost: 17600 }] };
const sale: Command = { kind: "sale", id: "s", date: "2026-11-30", paidWith: "cash", lines: [{ itemId: "cooldrink", description: "Cooldrink 2L", qty: 2, unitPrice: 3000 }] };
const bags: Command = { kind: "expense", id: "e", date: "2026-11-30", amount: 8500, paidFrom: "cash", category: "packaging" };

describe("guided tour", () => {
  it("has 14 steps, or 15 with the bank preview", () => {
    expect(tourSteps(false)).toHaveLength(14);
    expect(tourSteps(true)).toHaveLength(15);
    expect(tourSteps(true).at(-2)!.id).toBe("bank");
  });

  it("moves on when the step's action is saved", () => {
    const steps = tourSteps(false);
    const at = (id: string) => steps.findIndex((s) => s.id === id);
    expect(stepAfter(steps, at("books-panel"), purchase)).toBe(at("sale"));
    expect(stepAfter(steps, at("sale"), sale)).toBe(at("expense"));
    expect(stepAfter(steps, at("expense"), bags)).toBe(at("count"));
  });

  it("catches up when the user saves a step early, and ignores unrelated saves", () => {
    const steps = tourSteps(false);
    const at = (id: string) => steps.findIndex((s) => s.id === id);
    expect(stepAfter(steps, at("buy"), purchase)).toBe(at("sale"));
    expect(stepAfter(steps, at("welcome"), sale)).toBeNull();
  });
});
