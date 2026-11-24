import { formatRand, type JournalEntry } from "@app/ledger";
import { accountName } from "@/books/selectors";
import { cn } from "@/lib/utils";

/**
 * One journal entry as an accountant reads it: mono code + account, debit, credit, totals.
 * "sheet" shows an em dash in empty cells; "panel" leaves them blank.
 */
export function JournalEntryTable({ entry, variant = "panel", className }: { entry: JournalEntry; variant?: "sheet" | "panel"; className?: string }) {
  const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
  const cell = (c: number) => (c === 0 ? (variant === "sheet" ? <span className="text-ink-faint">—</span> : "") : formatRand(c).replace(/^R/, ""));
  const row = "grid grid-cols-[minmax(0,1fr)_76px_76px] gap-2";
  return (
    <div role="table" aria-label="Journal entry" className={cn("flex flex-col text-[13px]", className)}>
      <div role="row" className={cn(row, "border-b border-divider pb-2 font-medium text-ink-muted")}>
        <span role="columnheader">Account</span>
        <span role="columnheader" className="text-right">
          Debit
        </span>
        <span role="columnheader" className="text-right">
          Credit
        </span>
      </div>
      {entry.lines.map((l, i) => (
        <div role="row" key={i} className={cn(row, "border-b border-divider py-2.5")}>
          <span role="cell" className="flex min-w-0 gap-2">
            <span className="font-mono text-ink-muted">{l.account}</span>
            <span className="min-w-0">
              {accountName(l.account)}
              {l.memo && <span className="block text-xs text-ink-muted">{l.memo}</span>}
            </span>
          </span>
          <span role="cell" className="text-right font-semibold">
            {cell(l.debit)}
          </span>
          <span role="cell" className="text-right font-semibold">
            {cell(l.credit)}
          </span>
        </div>
      ))}
      <div role="row" className={cn(row, "pt-2.5 font-semibold")}>
        <span role="cell">Total</span>
        <span role="cell" className="text-right">
          {formatRand(debit).replace(/^R/, "")}
        </span>
        <span role="cell" className="text-right">
          {formatRand(credit).replace(/^R/, "")}
        </span>
      </div>
    </div>
  );
}
