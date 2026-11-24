import type { Cents } from "./money";
import type { Command } from "./posting";

export interface SupplierBalance {
  /** The supplier's name as first recorded. */
  supplier: string;
  /** Amount still owed to the supplier (negative if overpaid). */
  amount: Cents;
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * What is still owed to each supplier: purchases on credit minus payments made.
 * Pass only commands the books accepted. Suppliers are matched by name, ignoring case.
 */
export function supplierBalances(commands: readonly Command[]): SupplierBalance[] {
  const out = new Map<string, SupplierBalance>();
  const add = (name: string, amount: Cents) => {
    const k = key(name);
    const row = out.get(k) ?? { supplier: name.trim(), amount: 0 };
    row.amount += amount;
    out.set(k, row);
  };
  for (const c of commands) {
    if (c.kind === "expense" && c.paidFrom === "credit" && c.supplier) add(c.supplier, c.amount);
    if (c.kind === "payment_made") add(c.supplier, -c.amount);
  }
  return [...out.values()].filter((r) => r.amount !== 0);
}
