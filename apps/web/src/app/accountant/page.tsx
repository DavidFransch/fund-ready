"use client";

import { ACC, generalLedgerCsv, netBalances, trialBalanceCsv } from "@app/ledger";
import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { periodRange, type PeriodKind } from "@/books/dates";
import { BUSINESS } from "@/books/seed";
import { stockMatchesLedger } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { AccountantJournal } from "@/components/app/accountant-journal";
import { acc, Badge, BalanceSheetView, downloadCsv, IncomeStatementView, TrialBalanceTable } from "@/components/app/accountant-reports";
import { PeriodPicker } from "@/components/app/period-picker";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/app/screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccountantPage() {
  const { snapshot } = useBooks();
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const checks = useMemo(() => {
    if (!snapshot) return null;
    const entries = snapshot.book.entries;
    const debits = entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.debit, 0), 0);
    const credits = entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.credit, 0), 0);
    return { count: entries.length, debits, credits, stockOk: stockMatchesLedger(snapshot), stock: netBalances(entries).get(ACC.stock) ?? 0 };
  }, [snapshot]);
  if (!snapshot || !checks) return <Loading />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 bg-page px-4 pt-4 pb-10 sm:px-8">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="Back to the app" className="flex size-11 items-center justify-center rounded-full hover:bg-panel-strong">
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Accountant view</h1>
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
        <TabsList className="h-12 group-data-[orientation=horizontal]/tabs:h-12 w-fit max-w-full justify-start overflow-x-auto rounded-full bg-panel-strong p-1">
          <TabsTrigger value="journal" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Journal
          </TabsTrigger>
          <TabsTrigger value="tb" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Trial balance
          </TabsTrigger>
          <TabsTrigger value="pl" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Income statement
          </TabsTrigger>
          <TabsTrigger value="bs" className="h-10 flex-none rounded-full px-5 text-[15px] font-bold data-[state=active]:bg-night data-[state=active]:text-white">
            Balance sheet
          </TabsTrigger>
        </TabsList>
        <TabsContent value="journal">
          <AccountantJournal snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="tb">
          <TrialBalanceTable entries={snapshot.book.entries} asAt={snapshot.today} />
        </TabsContent>
        <TabsContent value="pl" className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-xl font-bold">Income statement</h2>
          <PeriodPicker today={snapshot.today} kind={kind} offset={offset} onChange={(k, o) => { setKind(k); setOffset(o); }} />
          <IncomeStatementView entries={snapshot.book.entries} from={periodRange(kind, snapshot.today, offset).from} to={periodRange(kind, snapshot.today, offset).to} />
        </TabsContent>
        <TabsContent value="bs" className="max-w-2xl">
          <BalanceSheetView entries={snapshot.book.entries} asAt={snapshot.today} />
        </TabsContent>
      </Tabs>

      <section aria-label="Downloads" className="flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        <span className="mr-2 text-[15px] font-bold">For the accountant&apos;s own software:</span>
        <Button variant="outline" size="touch" onClick={() => downloadCsv(`trial-balance-${snapshot.today}.csv`, trialBalanceCsv(snapshot.book.entries, snapshot.today))}>
          <Download className="size-5" aria-hidden /> Trial balance (CSV)
        </Button>
        <Button variant="outline" size="touch" onClick={() => downloadCsv(`general-ledger-${snapshot.today}.csv`, generalLedgerCsv(snapshot.book.entries))}>
          <Download className="size-5" aria-hidden /> General ledger (CSV)
        </Button>
      </section>
    </div>
  );
}

function Check({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-divider bg-page p-4">
      <span className="text-[15px] font-bold">{title}</span>
      <span className="text-sm leading-snug text-ink-muted">{detail}</span>
      <div>{children}</div>
    </div>
  );
}
