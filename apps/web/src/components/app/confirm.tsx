"use client";

import { positions, type Command, type JournalEntry } from "@app/ledger";
import { BookOpen, ChevronDown, CircleMinus, Clock, Package, TrendingDown, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { outcomes, saveLabel, summaryLine, type Outcome } from "@/books/describe";
import { customerBalances, ownerLoanBalance, suppliers } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { JournalEntryTable } from "./journal-entry";
import { Divider, Pill, STROKE } from "./screen";
import { SHEET_HANDLE, SHEET_OR_DIALOG } from "./sheet-style";

interface Pending {
  cmd: Command;
  entry: JournalEntry | null;
  rows: Outcome[];
  summary: string;
  save: string;
  toast?: SavedToast;
}

/** Overrides for one action: the save button's wording and the toast after saving. */
export interface CheckOptions {
  saveLabel?: string;
  toast?: SavedToast;
}

interface SavedToast {
  title: string;
  description: string;
}

function supplierOf(cmd: Command): string | undefined {
  if (cmd.kind === "payment_made") return cmd.supplier;
  if (cmd.kind === "expense" && cmd.paidFrom === "credit") return cmd.supplier;
  return undefined;
}

/**
 * Every action goes through here: build the command, show in plain words what will
 * happen (and the journal entry behind it), and only save on "Save …".
 */
export function useConfirmedAction({ after = "/" }: { after?: string | null } = {}) {
  const { snapshot, preview, execute } = useBooks();
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);

  function check(cmd: Command, opts: CheckOptions = {}) {
    if (!snapshot) return;
    const p = preview(cmd);
    if (!p.ok) {
      toast.error(p.message);
      return;
    }
    const pos = positions(snapshot.book.entries);
    const supplier = supplierOf(cmd)?.trim().toLowerCase();
    const owedToSupplier = supplier ? (suppliers(snapshot).find((s) => s.supplier.toLowerCase() === supplier)?.amount ?? 0) : 0;
    const customer = cmd.kind === "payment_received" ? cmd.customer : undefined;
    const owedByCustomer = customer ? (customerBalances(snapshot).find((c) => c.customer === customer)?.amount ?? 0) : 0;
    const owedToOwner = ownerLoanBalance(snapshot);
    setPending({
      cmd,
      entry: p.result.entry,
      rows: outcomes(cmd, p.result.entry, snapshot.book, { cashBox: pos.cashBox, bank: pos.bank, owedToSupplier, owedByCustomer, owedToOwner }),
      summary: summaryLine(cmd, snapshot.book),
      save: opts.saveLabel ?? saveLabel(cmd),
      toast: opts.toast,
    });
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
    if (pending.toast) {
      // A custom message is longer: no action button beside it (it squeezes the text on a phone), and time to read it.
      toast.success(pending.toast.title, { description: pending.toast.description, duration: 8000 });
    } else {
      toast.success("Saved", {
        description: r.result.entry ? "Your books are up to date." : "Nothing needed changing.",
        ...(r.result.entry ? { action: { label: "See it in the books", onClick: () => router.push(`/accountant?entry=${id}`) } } : {}),
      });
    }
    if (after) router.push(after);
  }

  const sheet = <ConfirmSheet pending={pending} onCancel={() => setPending(null)} onConfirm={confirm} />;
  return { snapshot, check, sheet };
}

const ICONS: Record<Outcome["icon"], { icon: LucideIcon; tile: string }> = {
  stock: { icon: Package, tile: "bg-brand-tint text-brand" },
  owe: { icon: Clock, tile: "bg-negative-tint text-negative" },
  money: { icon: Wallet, tile: "bg-brand-tint text-brand" },
  cost: { icon: CircleMinus, tile: "bg-panel-strong text-ink-muted" },
  profit: { icon: TrendingUp, tile: "bg-brand-tint text-brand" },
  loss: { icon: TrendingDown, tile: "bg-negative-tint text-negative" },
  neutral: { icon: Wallet, tile: "bg-panel-strong text-ink-muted" },
};

function ConfirmSheet({ pending, onCancel, onConfirm }: { pending: Pending | null; onCancel: () => void; onConfirm: () => void }) {
  const [showBooks, setShowBooks] = useState(true);
  return (
    <Sheet open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // The guided tour's card sits outside the sheet: using it must not close the sheet.
        onPointerDownOutside={(e) => (e.target as Element | null)?.closest?.("[data-tour-card]") && e.preventDefault()}
        onInteractOutside={(e) => (e.target as Element | null)?.closest?.("[data-tour-card]") && e.preventDefault()}
        onFocusOutside={(e) => (e.target as Element | null)?.closest?.("[data-tour-card]") && e.preventDefault()}
        className={SHEET_OR_DIALOG}
      >
        <span aria-hidden className={SHEET_HANDLE} />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Check and save</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">{pending?.summary}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col rounded-2xl border border-divider">
          {pending?.rows.map((o, i) => {
            const { icon: Icon, tile } = ICONS[o.icon];
            return (
              <Fragment key={`${o.label}-${i}`}>
                {i > 0 && <Divider className="ml-[62px]" />}
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tile)}>
                    <Icon className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px]">{o.label}</span>
                  <span
                    className={cn(
                      "text-right text-[15px] whitespace-nowrap",
                      o.tone === "muted" ? "font-medium text-ink-muted" : "font-semibold",
                      o.tone === "positive" && "text-positive",
                      o.tone === "negative" && "text-negative",
                    )}
                  >
                    {o.value}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>

        {pending?.entry && (
          <div data-tour="books-panel" className="flex flex-col rounded-2xl bg-panel">
            <button
              type="button"
              aria-expanded={showBooks}
              onClick={() => setShowBooks((v) => !v)}
              className="flex min-h-12 items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <BookOpen className="size-[18px] text-brand" strokeWidth={STROKE} aria-hidden />
              <span className="flex-1 text-sm font-semibold">What your books record</span>
              <Pill>Balanced</Pill>
              <ChevronDown className={cn("size-[18px] text-ink-muted transition-transform", showBooks && "rotate-180")} strokeWidth={STROKE} aria-hidden />
            </button>
            {showBooks && <JournalEntryTable entry={pending.entry} variant="sheet" className="px-3.5 pb-3.5" />}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button size="primary" onClick={onConfirm}>
            {pending?.save ?? "Save"}
          </Button>
          <Button variant="tertiary" className="h-12 rounded-2xl text-[15px] font-medium" onClick={onCancel}>
            Edit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
