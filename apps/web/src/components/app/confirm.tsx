"use client";

import { positions, type Command, type JournalEntry } from "@app/ledger";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { whatWillHappen } from "@/books/describe";
import { suppliers } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { JournalEntryTable } from "./journal-entry";

interface Pending {
  cmd: Command;
  entry: JournalEntry | null;
  bullets: string[];
}

function supplierOf(cmd: Command): string | undefined {
  if (cmd.kind === "payment_made") return cmd.supplier;
  if (cmd.kind === "expense" && cmd.paidFrom === "credit") return cmd.supplier;
  return undefined;
}

/**
 * Every action goes through here: build the command, show in plain words what will
 * happen (and the journal entry behind it), and only save on "Yes, save it".
 */
export function useConfirmedAction({ after = "/" }: { after?: string | null } = {}) {
  const { snapshot, preview, execute } = useBooks();
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);

  function check(cmd: Command) {
    if (!snapshot) return;
    const p = preview(cmd);
    if (!p.ok) {
      toast.error(p.message);
      return;
    }
    const pos = positions(snapshot.book.entries);
    const supplier = supplierOf(cmd)?.trim().toLowerCase();
    const owedToSupplier = supplier ? (suppliers(snapshot).find((s) => s.supplier.toLowerCase() === supplier)?.amount ?? 0) : 0;
    setPending({ cmd, entry: p.result.entry, bullets: whatWillHappen(cmd, p.result.entry, snapshot.book, { cashBox: pos.cashBox, bank: pos.bank, owedToSupplier }) });
  }

  function confirm() {
    if (!pending) return;
    const r = execute(pending.cmd);
    setPending(null);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    const id = pending.cmd.id;
    toast.success("Saved", {
      description: r.result.entry ? "Your books are up to date." : "Nothing needed changing.",
      ...(r.result.entry ? { action: { label: "See it in the books", onClick: () => router.push(`/accountant?entry=${id}`) } } : {}),
    });
    if (after) router.push(after);
  }

  const sheet = <ConfirmSheet pending={pending} onCancel={() => setPending(null)} onConfirm={confirm} />;
  return { snapshot, check, sheet };
}

function ConfirmSheet({ pending, onCancel, onConfirm }: { pending: Pending | null; onCancel: () => void; onConfirm: () => void }) {
  const [showBooks, setShowBooks] = useState(false);
  return (
    <Sheet open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-[440px] gap-3 overflow-y-auto rounded-t-3xl px-5 pb-6">
        <SheetHeader className="px-0 pb-0">
          <SheetTitle className="font-display text-2xl font-bold">Is this right?</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">This is what will happen when you save.</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2">
          {pending?.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 rounded-xl bg-brand-soft px-3.5 py-3 text-[15px] leading-snug text-brand-dark">
              <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {pending?.entry && (
          <div className="rounded-xl border border-line bg-card">
            <button
              type="button"
              aria-expanded={showBooks}
              onClick={() => setShowBooks((v) => !v)}
              className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[15px] font-bold"
            >
              What your books record
              <ChevronDown className={`size-5 transition-transform ${showBooks ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {showBooks && (
              <div className="px-3.5 pb-3">
                <JournalEntryTable entry={pending.entry} />
              </div>
            )}
          </div>
        )}
        <div className="mt-1 flex flex-col gap-2">
          <Button size="primary" onClick={onConfirm}>
            Yes, save it
          </Button>
          <Button size="touch" variant="outline" onClick={onCancel}>
            Change something
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
