import { formatRand, type JournalEntry } from "@app/ledger";
import { accountName } from "@/books/selectors";
import { cn } from "@/lib/utils";

const amt = (c: number) => (c === 0 ? "" : formatRand(c).replace(/^R/, ""));

/** One journal entry as an accountant reads it: account, debit, credit, totals. */
export function JournalEntryTable({ entry, className }: { entry: JournalEntry; className?: string }) {
  const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <table className={cn("w-full border-collapse text-sm tabular-nums", className)}>
      <thead>
        <tr className="border-b border-divider text-left text-xs tracking-wide text-ink-muted uppercase">
          <th className="py-1.5 pr-2 font-bold">Account</th>
          <th className="w-24 py-1.5 text-right font-bold">Debit</th>
          <th className="w-24 py-1.5 text-right font-bold">Credit</th>
        </tr>
      </thead>
      <tbody>
        {entry.lines.map((l, i) => (
          <tr key={i} className="border-b border-divider/60">
            <td className={cn("py-1.5 pr-2", l.credit > 0 && "pl-5")}>
              <span className="mr-1.5 font-mono text-xs text-ink-muted">{l.account}</span>
              {accountName(l.account)}
              {l.memo && <span className="block text-xs text-ink-muted">{l.memo}</span>}
            </td>
            <td className="py-1.5 text-right">{amt(l.debit)}</td>
            <td className="py-1.5 text-right">{amt(l.credit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-bold">
          <td className="py-1.5 pr-2 text-xs text-ink-muted uppercase">{debit === credit ? "Balanced" : "Out of balance"}</td>
          <td className="py-1.5 text-right">{amt(debit)}</td>
          <td className="py-1.5 text-right">{amt(credit)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
