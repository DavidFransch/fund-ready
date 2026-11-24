"use client";

import type { JournalEntry, SourceType } from "@app/ledger";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { titleFor } from "@/books/describe";
import { chronological, commandMap } from "@/books/selectors";
import type { BooksSnapshot } from "@/books/store";
import { Button } from "@/components/ui/button";
import { relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Choices } from "./inputs";
import { JournalEntryTable } from "./journal-entry";

const SOURCE_LABEL: Record<SourceType, string> = {
  opening_balance: "Opening balances",
  sale: "Sale",
  payment_received: "Customer payment",
  payment_made: "Supplier payment",
  expense: "Purchase / expense",
  stock_count: "Stock count",
  transfer: "Transfer",
  owner_contribution: "Owner contribution",
  owner_drawing: "Owner drawing",
  reversal: "Reversal",
  manual: "Manual journal",
};

type Filter = "demo" | "today" | "all";

/** The entry id in ?entry=, read from the browser so the page can stay prerendered. */
function useEntryParam(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("entry"),
    () => null,
  );
}

export function AccountantJournal({ snapshot }: { snapshot: BooksSnapshot }) {
  const focus = useEntryParam();
  const hasDemo = snapshot.userCommandIds.size > 0;
  const [chosen, setChosen] = useState<Filter | null>(null);
  const [limit, setLimit] = useState(30);
  // A linked entry from the sample history is only visible under "All".
  const focusIsDemo = focus ? snapshot.userCommandIds.has(focus) : true;
  const filter: Filter = chosen ?? (!focusIsDemo ? "all" : hasDemo ? "demo" : "all");

  const rows = useMemo(() => {
    const cmds = commandMap(snapshot);
    const all = chronological(snapshot.book.entries).reverse();
    const kept = all.filter((e) => (filter === "demo" ? snapshot.userCommandIds.has(e.id) : filter === "today" ? e.date === snapshot.today : true));
    return kept.map((e) => ({ entry: e, title: titleFor(cmds.get(e.id), snapshot.book, e) }));
  }, [snapshot, filter]);

  useEffect(() => {
    if (focus) document.getElementById(`entry-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-md">
        <Choices
          label="Show"
          options={[
            { value: "demo", label: "Added in demo" },
            { value: "today", label: "Today" },
            { value: "all", label: "Everything" },
          ]}
          value={filter}
          onChange={setChosen}
          columns={3}
        />
      </div>
      {rows.length === 0 && <p className="text-[15px] text-ink-muted">Nothing here yet. Record something in the app and its journal entry appears here.</p>}
      <ol className="grid gap-3 lg:grid-cols-2">
        {rows.slice(0, limit).map(({ entry, title }) => (
          <EntryCard key={entry.id} entry={entry} title={title} today={snapshot.today} highlight={entry.id === focus} isDemo={snapshot.userCommandIds.has(entry.id)} />
        ))}
      </ol>
      {rows.length > limit && (
        <Button variant="outline" size="touch" className="self-center" onClick={() => setLimit(limit + 60)}>
          Show older entries ({rows.length - limit} more)
        </Button>
      )}
    </div>
  );
}

function EntryCard({ entry, title, today, highlight, isDemo }: { entry: JournalEntry; title: string; today: string; highlight: boolean; isDemo: boolean }) {
  return (
    <li
      id={`entry-${entry.id}`}
      className={cn("flex flex-col gap-2 rounded-2xl border-[1.5px] bg-page p-4", highlight ? "border-accent ring-4 ring-accent/30" : "border-divider")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] text-ink-muted tabular-nums">
          {entry.date} · {relativeDay(entry.date, today)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-panel-strong px-2 py-0.5 font-bold text-ink-muted">{SOURCE_LABEL[entry.source.type]}</span>
        {isDemo && <span className="rounded-full bg-brand-tint px-2 py-0.5 font-bold text-brand-strong">Added in demo</span>}
        <span className="text-ink-muted">Memo: {entry.memo}</span>
      </div>
      <JournalEntryTable entry={entry} />
      <span className="truncate font-mono text-[11px] text-ink-muted" title="Entry id (also the command's idempotency key)">
        {entry.id}
      </span>
    </li>
  );
}
