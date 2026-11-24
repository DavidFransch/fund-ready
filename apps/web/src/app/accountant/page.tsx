"use client";

import { generalLedgerCsv, trialBalanceCsv } from "@app/ledger";
import { ArrowLeft, BookOpen, ChartLine, Download, Landmark, Scale, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { periodRange, type PeriodKind } from "@/books/dates";
import { BUSINESS } from "@/books/seed";
import { stockMatchesLedger } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { AccountantJournal } from "@/components/app/accountant-journal";
import { BalanceSheetView, downloadCsv, IncomeStatementView, SectionHeader, TrialBalanceTable } from "@/components/app/accountant-reports";
import { PeriodPicker } from "@/components/app/period-picker";
import { Logo, STROKE } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Section = "journal" | "tb" | "pl" | "bs" | "exports";
const SECTIONS: { value: Section; label: string; icon: LucideIcon }[] = [
  { value: "journal", label: "Journal", icon: BookOpen },
  { value: "tb", label: "Trial balance", icon: Scale },
  { value: "pl", label: "Profit and loss", icon: ChartLine },
  { value: "bs", label: "Balance sheet", icon: Landmark },
  { value: "exports", label: "Exports", icon: Download },
];

export default function AccountantPage() {
  const { snapshot } = useBooks();
  const [section, setSection] = useState<Section>("journal");
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  if (!snapshot) {
    return <div className="min-h-dvh animate-pulse bg-page" aria-busy="true" aria-label="Loading the books" />;
  }
  const entries = snapshot.book.entries;
  const range = periodRange(kind, snapshot.today, offset);
  const navItem = "flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-sm whitespace-nowrap";

  return (
    <div className="flex min-h-dvh flex-col bg-page lg:flex-row">
      <aside className="flex w-full flex-col gap-3 border-b border-hairline px-3.5 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:shrink-0 lg:gap-5 lg:border-r lg:border-b-0 lg:py-5">
        <div className="flex items-center gap-2.5 p-2">
          <Logo size={32} />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">{BUSINESS.name}</span>
            <span className="text-xs text-ink-muted">Accountant view</span>
          </span>
        </div>
        <nav aria-label="Books" className="flex gap-0.5 overflow-x-auto lg:flex-col">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-current={section === value ? "page" : undefined}
              onClick={() => setSection(value)}
              className={cn(navItem, section === value ? "bg-panel-strong font-semibold text-ink" : "font-medium text-[#3E4642] hover:bg-panel")}
            >
              <Icon className="size-[18px]" strokeWidth={STROKE} aria-hidden />
              {label}
            </button>
          ))}
          <Link href="/" className={cn(navItem, "font-medium text-[#3E4642] hover:bg-panel lg:hidden")}>
            <ArrowLeft className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Back to the app
          </Link>
        </nav>
        <Link href="/" className={cn(navItem, "mt-auto hidden font-medium text-[#3E4642] hover:bg-panel lg:flex")}>
          <ArrowLeft className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Back to the app
        </Link>
      </aside>

      <main className="min-w-0 flex-1">
        {section === "journal" && <AccountantJournal snapshot={snapshot} onExport={() => setSection("exports")} />}
        {section !== "journal" && (
          <div className="flex max-w-4xl flex-col gap-5 px-4 pt-6 pb-10 sm:px-7 sm:pt-7">
            {section === "tb" && <TrialBalanceTable entries={entries} asAt={snapshot.today} stockTies={stockMatchesLedger(snapshot)} />}
            {section === "pl" && (
              <>
                <SectionHeader title="Profit and loss" subtitle="Income statement for the period" />
                <div className="max-w-md">
                  <PeriodPicker
                    today={snapshot.today}
                    kind={kind}
                    offset={offset}
                    onChange={(k, o) => {
                      setKind(k);
                      setOffset(o);
                    }}
                  />
                </div>
                <IncomeStatementView entries={entries} from={range.from} to={range.to} />
              </>
            )}
            {section === "bs" && <BalanceSheetView entries={entries} asAt={snapshot.today} />}
            {section === "exports" && (
              <>
                <SectionHeader title="Exports" subtitle="For the accountant's own software (Xero, Sage, Excel)" />
                <div className="flex max-w-2xl flex-col gap-3 rounded-[18px] bg-panel p-4">
                  <ExportRow title="Trial balance" detail={`Every account's balance as at ${snapshot.today}`} onClick={() => downloadCsv(`trial-balance-${snapshot.today}.csv`, trialBalanceCsv(entries, snapshot.today))} />
                  <div className="h-px bg-divider" />
                  <ExportRow title="General ledger" detail={`All ${entries.length} journal entries, line by line`} onClick={() => downloadCsv(`general-ledger-${snapshot.today}.csv`, generalLedgerCsv(entries))} />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ExportRow({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-ink-muted">{detail}</span>
      </span>
      <Button variant="ink" className="h-10 rounded-full px-4 text-sm font-semibold" onClick={onClick}>
        <Download className="size-4" strokeWidth={STROKE} aria-hidden /> Download CSV
      </Button>
    </div>
  );
}
