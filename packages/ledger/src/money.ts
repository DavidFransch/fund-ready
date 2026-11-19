import { LedgerError } from "./errors";

/**
 * All money is stored as whole cents (an integer number of ZAR cents).
 * Never store or add rand amounts as decimals.
 */
export type Cents = number;

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertCents(value: number, label = "amount"): asserts value is Cents {
  if (!isCents(value)) {
    throw new LedgerError(`${label} must be a whole number of cents, got ${value}`);
  }
}

/**
 * Convert a rand amount to cents.
 * Accepts numbers (max 2 decimals) or strings like "1800", "R1 800.50", "1,800.50", "1800,50".
 */
export function rand(amount: number | string): Cents {
  if (typeof amount === "number") {
    const scaled = amount * 100;
    const rounded = Math.round(scaled);
    if (!Number.isFinite(amount) || Math.abs(scaled - rounded) > 1e-6) {
      throw new LedgerError(`${amount} has more than 2 decimal places`);
    }
    return rounded === 0 ? 0 : rounded;
  }
  let s = amount.trim().replace(/^R/i, "").replace(/[\s ]/g, "");
  const negative = s.startsWith("-") || s.startsWith("−");
  if (negative) s = s.slice(1);
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (/,\d{1,2}$/.test(s)) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new LedgerError(`"${amount}" is not a valid rand amount`);
  }
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  assertCents(cents);
  return negative && cents !== 0 ? -cents : cents;
}

/** Format cents for display, e.g. 180000 -> "R1 800.00". */
export function formatRand(cents: Cents, options: { showCents?: boolean } = {}): string {
  assertCents(cents);
  const { showCents = true } = options;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "−" : ""}R${whole}${showCents ? `.${frac}` : ""}`;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total, "total");
  return total;
}

/** Multiply a unit price in cents by a whole quantity. */
export function times(unitPrice: Cents, qty: number): Cents {
  assertCents(unitPrice, "unit price");
  if (!Number.isSafeInteger(qty)) throw new LedgerError(`quantity must be a whole number, got ${qty}`);
  const total = unitPrice * qty;
  assertCents(total, "line total");
  return total;
}
