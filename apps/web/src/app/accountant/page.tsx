"use client";

import { generalLedgerCsv, trialBalanceCsv } from "@app/ledger";
import { BookOpen, ChartLine, Check, ChevronDown, Download, Landmark, Scale, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { periodRange, type PeriodKind } from "@/books/dates";
import { stockMatchesLedger } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { AccountantJournal } from "@/components/app/accountant-journal";
import { DemoMenu } from "@/components/app/demo-menu";
import { BalanceSheetView, downloadCsv, IncomeStatementView, SectionHeader, TrialBalanceTable } from "@/components/app/accountant-reports";
import { PeriodPicker } from "@/components/app/period-picker";
import { AppSidebar, BottomNav, STROKE } from "@/components/app/screen";
import { SHEET_HANDLE, SHEET_OR_DIALOG } from "@/components/app/sheet-style";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Section = "journal" | "tb" | "pl" | "bs" | "exports";
const SECTIONS: { value: Section; label: string; icon: LucideIcon; detail: string }[] = [
  { value: "journal", label: "Journal", icon: BookOpen, detail: "Every entry, newest first" },
  { value: "tb", label: "Trial balance", icon: Scale, detail: "Every account's balance" },
  { value: "pl", label: "Profit and loss", icon: ChartLine, detail: "Sales, costs and profit for a period" },
  { value: "bs", label: "Balance sheet", icon: Landmark, detail: "What the business owns and owes" },
  { value: "exports", label: "Exports", icon: Download, detail: "CSV files for Xero, Sage or Excel" },
];

/** Phone and tablet: "Books / Journal ▾" opens a sheet of sections, in place of the tab strip that didn't fit. */
function SectionPicker({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const [open, setOpen] = useState(false);
  const current = SECTIONS.find((s) => s.value === section)!;
  return (
    <header className="flex items-center gap-3 px-5 pt-[22px] lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="text-[13px] font-medium text-ink-muted">Books</span>
          <span className="flex items-center gap-1.5 text-2xl font-semibold">
            {current.label}
            <ChevronDown className="size-5 text-ink-muted" strokeWidth={STROKE} aria-hidden />
          </span>
        </button>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={cn(SHEET_OR_DIALOG, "gap-3")}>
          <span aria-hidden className={SHEET_HANDLE} />
          <SheetHeader className="gap-1 p-0">
            <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Books</SheetTitle>
            <SheetDescription className="text-[15px] text-ink-muted">What the accountant sees, built from every action in the app.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1.5">
            {SECTIONS.map(({ value, label, icon: Icon, detail }) => (
              <button
                key={value}
                type="button"
                aria-current={section === value ? "page" : undefined}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
                className={cn("flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2.5 text-left", section === value ? "bg-panel-strong" : "bg-panel hover:bg-panel-strong")}
              >
                <Icon className="size-5 shrink-0" strokeWidth={STROKE} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{label}</span>
                  <span className="text-[13px] text-ink-muted">{detail}</span>
                </span>
                {section === value && <Check className="size-5 shrink-0 text-brand" strokeWidth={STROKE} aria-hidden />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <DemoMenu />
    </header>
  );
}

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
    <div className="flex min-h-dvh bg-page">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-1 flex-col">
          <SectionPicker section={section} onChange={setSection} />
          <nav aria-label="Books sections" className="hidden gap-1 overflow-x-auto border-b border-hairline px-3 py-2.5 sm:px-5 lg:flex lg:px-6">
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
          </nav>

          <main className="min-w-0 flex-1">
            {section === "journal" && <AccountantJournal snapshot={snapshot} onExport={() => setSection("exports")} />}
            {section !== "journal" && (
              <div className="flex max-w-4xl flex-col gap-5 px-4 pt-6 pb-10 sm:px-7 sm:pt-7 lg:px-8">
                {section === "tb" && <TrialBalanceTable entries={entries} asAt={snapshot.today} stockTies={stockMatchesLedger(snapshot)} />}
                {section === "pl" && (
                  <>
                    <SectionHeader title="Profit and loss" subtitle="Income statement for the period" />
                    <PeriodPicker
                      today={snapshot.today}
                      kind={kind}
                      offset={offset}
                      onChange={(k, o) => {
                        setKind(k);
                        setOffset(o);
                      }}
                    />
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
        <BottomNav />
      </div>
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
