import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "@app/ledger";
import { describe, expect, it } from "vitest";
import { stepAfter, STEPS, targetNames, tourSteps } from "./steps";

const sale: Command = { kind: "sale", id: "s", date: "2026-11-30", paidWith: "cash", lines: [{ itemId: "cooldrink", description: "Cooldrink 2L", qty: 2, unitPrice: 3000 }] };
const bags: Command = { kind: "expense", id: "e", date: "2026-11-30", amount: 8500, paidFrom: "cash", category: "packaging" };

/** Every `data-tour="…"` written in the app's source (outside the tour itself). */
function anchorsInSource(dir = join(__dirname, "..")): Set<string> {
  const found = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tour") anchorsInSource(path).forEach((a) => found.add(a));
    } else if (entry.name.endsWith(".tsx")) {
      for (const m of readFileSync(path, "utf8").matchAll(/data-tour=(?:\{[^}]*\}|"[^"]*")|tourId="[^"]*"/g)) {
        for (const name of m[0].matchAll(/"([^"]+)"/g)) found.add(name[1]!);
      }
    }
  }
  return found;
}

describe("guided tour", () => {
  it("is short: 8 steps, or 9 with the bank preview", () => {
    expect(tourSteps(false)).toHaveLength(8);
    expect(tourSteps(true)).toHaveLength(9);
    expect(tourSteps(true).at(-2)!.id).toBe("bank");
  });

  it("points only at elements that exist in the app", () => {
    const anchors = anchorsInSource();
    for (const name of targetNames(STEPS)) expect(anchors, name).toContain(name);
  });

  it("moves on to Books once the sale is saved", () => {
    const steps = tourSteps(false);
    const at = (id: string) => steps.findIndex((s) => s.id === id);
    expect(stepAfter(steps, at("save"), sale)).toBe(at("books"));
  });

  it("catches up when the sale is saved early, and ignores unrelated saves", () => {
    const steps = tourSteps(false);
    const at = (id: string) => steps.findIndex((s) => s.id === id);
    expect(stepAfter(steps, at("items"), sale)).toBe(at("books"));
    expect(stepAfter(steps, at("save"), bags)).toBeNull();
    expect(stepAfter(steps, at("balance"), sale)).toBeNull();
  });
});
