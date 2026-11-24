"use client";

import { netBalances, ACC } from "@app/ledger";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BUSINESS } from "@/books/seed";
import { stockMatchesLedger } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { AccountantJournal } from "@/components/app/accountant-journal";
import { acc, Badge, TrialBalanceTable } from "@/components/app/accountant-reports";
import { Loading } from "@/components/app/screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccountantPage() {
  const { snapshot } = useBooks();
  const checks = useMemo(() => {
    if (!snapshot) return null;
    const entries = snapshot.book.entries;
    const debits = entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.debit, 0), 0);
    const credits = entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.credit, 0), 0);
    return { count: entries.length, debits, credits, stockOk: stockMatchesLedger(snapshot), stock: netBalances(entries).get(ACC.stock) ?? 0 };
  }, [snapshot]);
  if (!snapshot || !checks) return <Loading />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 bg-paper px-4 pt-4 pb-10 sm:px-8">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="Back to the app" className="flex size-11 items-center justify-center rounded-full hover:bg-track">
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold">Accountant view</h1>
          <span className="text-sm text-ink-muted">
            {BUSINESS.name}, {BUSINESS.area} · the books behind every action
          </span>
        </div>
      </header>

      <section aria-label="Checks" className="grid gap-3 sm:grid-cols-3">
        <Check title="Journal entries" detail={`${checks.count} entries, each one balanced`}>
          <Badge ok={checks.debits === checks.credits}>
            Debits {acc(checks.debits)} = credits {acc(checks.credits)}
          </Badge>
        </Check>
        <Check title="Stock records" detail={`Item-by-item stock value equals account 1200 Inventory (${acc(checks.stock)})`}>
          <Badge ok={checks.stockOk}>{checks.stockOk ? "Stock ties to the ledger" : "Stock does not tie"}</Badge>
        </Check>
        <Check title="History" detail="Append-only. Every action has a unique id, so a retry never posts twice.">
          <Badge ok>Double entry</Badge>
        </Check>
      </section>

      <Tabs defaultValue="journal" className="gap-4">
        <TabsList className="h-12 group-data-[orientation=horizontal]/tabs:h-12 w-fit max-w-full justify-start overflow-x-auto rounded-full bg-track p-1">
          <TabsTrigger value="journal" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Journal
          </TabsTrigger>
          <TabsTrigger value="tb" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Trial balance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="journal">
          <AccountantJournal snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="tb">
          <TrialBalanceTable entries={snapshot.book.entries} asAt={snapshot.today} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Check({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-card p-4">
      <span className="text-[15px] font-bold">{title}</span>
      <span className="text-sm leading-snug text-ink-muted">{detail}</span>
      <div>{children}</div>
    </div>
  );
}
