"use client";

import { Download, X } from "lucide-react";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { formatDay } from "@/books/dates";
import type { EntryType } from "@/books/describe";
import { byDay, journalRows, type JournalRow } from "@/books/selectors";
import type { BooksSnapshot } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { money, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeader, Status } from "./accountant-reports";
import { JournalEntryTable } from "./journal-entry";
import { STROKE } from "./screen";

type Filter = "today" | "all" | "sales" | "purchases" | "stock" | "cash";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "all", label: "All" },
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "stock", label: "Stock" },
  { value: "cash", label: "Petty cash" },
];

const TYPE_COLOR: Record<EntryType, string> = {
  Sale: "text-positive",
  Stock: "text-negative",
  "Petty cash": "text-brand",
  Purchase: "text-[#3E4642]",
  Expense: "text-[#3E4642]",
  Payment: "text-[#3E4642]",
  Owner: "text-[#3E4642]",
  Opening: "text-[#3E4642]",
};

function keep(r: JournalRow, f: Filter, today: string): boolean {
  switch (f) {
    case "today":
      return r.entry.date === today;
    case "sales":
      return r.type === "Sale";
    case "purchases":
      return r.type === "Purchase" || r.type === "Expense" || r.type === "Payment";
    case "stock":
      return r.touchesStock;
    case "cash":
      return r.touchesCash;
    default:
      return true;
  }
}

const WIDE = "(min-width: 1280px)";

/** True at 1280px and up, where the entry panel sits beside the table. */
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** The entry id in ?entry=, read from the browser so the page can stay prerendered. */
function useEntryParam(): string | null {
  return useSyncExternalStore(
    (cb) => {
      // After a client-side navigation the URL is updated after the first render: read it again.
      const t = window.setTimeout(cb, 0);
      window.addEventListener("popstate", cb);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("popstate", cb);
      };
    },
    () => new URLSearchParams(window.location.search).get("entry"),
    () => null,
  );
}

export function AccountantJournal({ snapshot, onExport }: { snapshot: BooksSnapshot; onExport: () => void }) {
  const focus = useEntryParam();
  const all = useMemo(() => journalRows(snapshot), [snapshot]);
  const focused = focus ? all.find((r) => r.entry.id === focus) : undefined;
  const [chosenFilter, setFilter] = useState<Filter | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  // A linked entry from an earlier day is only visible under "All".
  const filter: Filter = chosenFilter ?? (focused && focused.entry.date !== snapshot.today ? "all" : "today");
  const rows = all.filter((r) => keep(r, filter, snapshot.today));
  const selected = all.find((r) => r.entry.id === (picked ?? focus)) ?? rows[0];

  const today = all.filter((r) => r.entry.date === snapshot.today);
  const todayDebits = today.reduce((s, r) => s + r.entry.lines.reduce((t, l) => t + l.debit, 0), 0);
  const todayCredits = today.reduce((s, r) => s + r.entry.lines.reduce((t, l) => t + l.credit, 0), 0);
  const allDebits = all.reduce((s, r) => s + r.entry.lines.reduce((t, l) => t + l.debit, 0), 0);
  const allCredits = all.reduce((s, r) => s + r.entry.lines.reduce((t, l) => t + l.credit, 0), 0);

  const wide = useWide();
  // Below 1280px the entry opens as a full-screen sheet; a link from the app opens it straight away.
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const sheetOpen = !!(sheetFor ?? (focus && dismissed !== focus ? focus : null));

  function pick(id: string) {
    setPicked(id);
    setSheetFor(id);
  }

  function closeSheet(open: boolean) {
    if (open) return;
    setSheetFor(null);
    setDismissed(focus);
  }

  const cols = "grid grid-cols-[44px_minmax(0,1fr)_92px] items-center gap-3 sm:grid-cols-[64px_minmax(0,1fr)_120px_110px]";

  return (
    <div className="flex min-w-0 flex-col xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-10 sm:px-7 sm:pt-7 lg:px-8">
        <SectionHeader
          title="Journal"
          subtitle="Every action in the app, recorded as double entry"
          action={
            <Button variant="ink" className="h-10 rounded-full px-4 text-sm font-semibold" onClick={onExport}>
              <Download className="size-4" strokeWidth={STROKE} aria-hidden /> Export for accountant
            </Button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2.5">
          <Kpi label="Entries today" value={String(today.length)} />
          <Kpi label="Total debits" value={money(todayDebits)} />
          <Kpi label="Total credits" value={money(todayCredits)} />
          <div className="flex flex-col gap-1 rounded-2xl bg-panel px-4 py-3.5">
            <span className="text-xs font-medium text-ink-muted">Trial balance</span>
            <span className="flex h-[29px] items-center">
              <Status ok={allDebits === allCredits}>{allDebits === allCredits ? "Balanced" : "Out of balance"}</Status>
            </span>
          </div>
        </div>

        <div role="tablist" aria-label="Filter" className="flex gap-5 overflow-x-auto border-b border-hairline">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={f.value === filter}
              onClick={() => {
                setFilter(f.value);
                setLimit(60);
              }}
              className={cn("h-10 shrink-0 border-b-2 text-sm whitespace-nowrap", f.value === filter ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-ink-muted hover:text-ink")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Nothing here yet. Record something in the app and its journal entry appears here.</p>
        ) : (
          <div>
            <div className="flex flex-col">
              <div className={cn(cols, "px-2 pb-2.5 text-xs font-medium text-ink-muted sm:px-3")}>
                <span>Time</span>
                <span>What happened</span>
                <span className="hidden sm:block">Type</span>
                <span className="text-right">Amount</span>
              </div>
              {byDay(rows.slice(0, limit).map((r) => ({ ...r, date: r.entry.date }))).map((g) => (
                <Fragment key={g.date}>
                  <div className="mt-1 rounded-lg bg-panel px-3 py-2 text-xs font-semibold text-ink-muted">
                    {dayHeading(g.date, snapshot.today)}
                  </div>
                  {g.rows.map((r) => {
                    const isSel = r.entry.id === selected?.entry.id;
                    return (
                      <button
                        key={r.entry.id}
                        type="button"
                        aria-pressed={isSel}
                        onClick={() => pick(r.entry.id)}
                        className={cn(cols, "border-b border-hairline px-2 py-3 text-left sm:px-3", isSel ? "bg-brand-wash" : "hover:bg-panel")}
                      >
                        <span className="text-sm text-ink-muted">{r.time}</span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className={cn("truncate text-sm", isSel ? "font-semibold" : "font-medium")}>{r.title}</span>
                          <span className="truncate text-[13px] text-ink-muted">
                            {r.detail}
                            {r.isUser && " · added in demo"}
                          </span>
                        </span>
                        <span className={cn("hidden text-[13px] font-semibold sm:block", TYPE_COLOR[r.type])}>{r.type}</span>
                        <span className={cn("text-right text-sm", isSel ? "font-semibold" : "font-medium")}>{money(r.amount)}</span>
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
        {rows.length > limit && (
          <Button variant="outline" size="touch" className="self-center" onClick={() => setLimit(limit + 120)}>
            Show older entries ({rows.length - limit} more)
          </Button>
        )}
      </div>

      {selected && wide && <EntryPanel row={selected} today={snapshot.today} />}
      {selected && !wide && (
        <Sheet open={sheetOpen} onOpenChange={closeSheet}>
          <SheetContent side="bottom" showCloseButton={false} className="h-dvh max-h-dvh gap-0 overflow-y-auto border-0 p-0">
            <SheetClose className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-panel hover:bg-panel-strong">
              <X className="size-5" strokeWidth={STROKE} aria-hidden />
              <span className="sr-only">Close</span>
            </SheetClose>
            <SheetTitle className="sr-only">{selected.title}</SheetTitle>
            <SheetDescription className="sr-only">Journal entry {selected.ref}</SheetDescription>
            <div className="mx-auto w-full max-w-[640px]">
              <EntryPanel row={selected} today={snapshot.today} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/** "Today · Tuesday 24 November", or just the long date for older days. */
function dayHeading(date: string, today: string): string {
  const long = formatDay(date, { weekday: "long", day: "numeric", month: "long" });
  const rel = relativeDay(date, today);
  return rel === "Today" || rel === "Yesterday" ? `${rel} · ${long}` : long;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-panel px-4 py-3.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className="text-xl font-semibold whitespace-nowrap 2xl:text-[22px]">{value}</span>
    </div>
  );
}

function EntryPanel({ row, today }: { row: JournalRow; today: string }) {
  const debit = row.entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = row.entry.lines.reduce((s, l) => s + l.credit, 0);
  const when = row.entry.date === today ? `today ${row.time}` : `${row.entry.date} ${row.time}`;
  return (
    <aside aria-label="Journal entry" className="flex w-full flex-col gap-[18px] px-5 pt-14 pb-8 sm:px-6 xl:w-[360px] xl:shrink-0 xl:border-l xl:border-hairline xl:pt-7">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-medium text-ink-muted">{row.ref}</span>
        <span className="text-xl font-semibold tracking-[-0.01em]">{row.title}</span>
        <span className="text-sm text-ink-muted">
          {row.detail} · {when}
        </span>
      </div>
      <div className="rounded-2xl bg-panel p-3.5">
        <JournalEntryTable entry={row.entry} />
      </div>
      <Status ok={debit === credit}>{debit === credit ? "Debits equal credits" : "Out of balance"}</Status>
      <div className="flex flex-col rounded-2xl bg-panel text-sm">
        <div className="flex justify-between gap-3 px-3.5 py-3">
          <span className="text-ink-muted">Recorded from</span>
          <span className="text-right font-medium">{row.from}</span>
        </div>
        <div className="mx-3.5 h-px bg-divider" />
        <div className="flex justify-between gap-3 px-3.5 py-3">
          <span className="text-ink-muted">Recorded by</span>
          <span className="text-right font-medium">Thandeka (owner)</span>
        </div>
        <div className="mx-3.5 h-px bg-divider" />
        <div className="flex justify-between gap-3 px-3.5 py-3">
          <span className="text-ink-muted">Can it be edited?</span>
          <span className="text-right font-medium">No · reverse it instead</span>
        </div>
      </div>
    </aside>
  );
}
