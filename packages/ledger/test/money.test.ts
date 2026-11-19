import { describe, expect, it } from "vitest";
import { formatRand, LedgerError, rand, sumCents, times } from "../src";

describe("money", () => {
  it("parses rand amounts into cents", () => {
    expect(rand(1800)).toBe(180000);
    expect(rand(0.1)).toBe(10);
    expect(rand("R1 800.50")).toBe(180050);
    expect(rand("1,800.50")).toBe(180050);
    expect(rand("1800,5")).toBe(180050);
    expect(rand("-640")).toBe(-64000);
  });

  it("rejects amounts with more than two decimals or junk", () => {
    expect(() => rand(1.005)).toThrow(LedgerError);
    expect(() => rand("12.345")).toThrow(LedgerError);
    expect(() => rand("abc")).toThrow(LedgerError);
  });

  it("formats cents the South African way", () => {
    expect(formatRand(180000)).toBe("R1 800.00");
    expect(formatRand(-64000)).toBe("−R640.00");
    expect(formatRand(123456789, { showCents: false })).toBe("R1 234 567");
  });

  it("only adds whole cents", () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(() => sumCents([1.5])).toThrow(LedgerError);
    expect(times(50000, 3)).toBe(150000);
    expect(() => times(100, 1.5)).toThrow(LedgerError);
  });
});
