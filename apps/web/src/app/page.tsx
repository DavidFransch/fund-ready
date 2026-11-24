"use client";

import { Banknote, FileText, Landmark, Package, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { addDays } from "@app/ledger";
import { BUSINESS } from "@/books/seed";
import { activity, home, stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { ActivityList } from "@/components/app/activity";
import { DemoMenu } from "@/components/app/demo-menu";
import { Loading, NightCard, Screen, SectionTitle } from "@/components/app/screen";
import { money } from "@/lib/format";

export default function HomePage() {
  const { snapshot } = useBooks();
  const data = useMemo(() => {
    if (!snapshot) return null;
    // A rolling week, so Monday morning (and a freshly reset demo) is never an empty card.
    const lastWeek = { from: addDays(snapshot.today, -6), to: snapshot.today };
    return { h: home(snapshot, lastWeek), recent: activity(snapshot, { limit: 6 }), low: stockRows(snapshot).filter((r) => r.low).length };
  }, [snapshot]);
  if (!snapshot || !data) return <Loading />;
  const { h, recent, low } = data;

  return (
    <Screen
      nav
      header={
        <header className="flex items-center gap-3 px-6 pt-5">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-white" aria-hidden>
            {BUSINESS.owner[0]}
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] text-ink-muted">Molo, {BUSINESS.owner}</span>
            <span className="text-[17px] font-bold">{BUSINESS.name}</span>
          </span>
          <DemoMenu />
        </header>
      }
    >
      {!snapshot.saved && (
        <p role="status" className="rounded-xl bg-brand-tint px-3.5 py-2.5 text-sm text-brand-strong">
          This browser is not saving. Changes last until you close the page.
        </p>
      )}

      <NightCard className="mt-2 flex flex-col gap-3.5">
        <span className="text-[15px] text-night-muted">Last 7 days</span>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Money in" value={money(h.moneyIn)} tone="text-accent" />
          <Stat label="Money out" value={money(h.moneyOut)} tone="text-night-muted" />
          <Stat label="Left over" value={money(h.leftOver)} tone="text-accent" />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-night-line pt-3">
          <Link href="/petty-cash" className="flex items-center gap-2 rounded-lg hover:bg-white/5">
            <Wallet className="size-5 text-night-muted" aria-hidden />
            <span className="flex flex-col">
              <span className="text-[13px] text-night-muted">Petty cash</span>
              <span className="text-[17px] font-bold">{money(h.cashBox)}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-night-muted" aria-hidden />
            <span className="flex flex-col">
              <span className="text-[13px] text-night-muted">Bank</span>
              <span className="text-[17px] font-bold">{money(h.bank)}</span>
            </span>
          </div>
        </div>
        {(h.owedToSuppliers > 0 || h.owedToYou > 0) && (
          <div className="flex flex-col gap-0.5 text-sm text-night-muted">
            {h.owedToSuppliers > 0 && (
              <Link href="/suppliers" className="underline underline-offset-4 hover:text-white">
                You owe suppliers {money(h.owedToSuppliers)}
              </Link>
            )}
            {h.owedToYou > 0 && <span>Customers owe you {money(h.owedToYou)}</span>}
          </div>
        )}
      </NightCard>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/sell" className="flex min-h-[108px] flex-col justify-between rounded-[18px] border-[1.5px] border-brand bg-brand-tint p-3.5 text-brand-strong">
          <Banknote className="size-[30px]" aria-hidden />
          <span className="text-lg font-bold">I sold something</span>
        </Link>
        <Link href="/pay" className="flex min-h-[108px] flex-col justify-between rounded-[18px] border-[1.5px] border-negative bg-negative-tint p-3.5 text-negative">
          <Receipt className="size-[30px]" aria-hidden />
          <span className="text-lg font-bold">I paid for something</span>
        </Link>
        <Link href="/invoice" className="flex min-h-[88px] flex-col justify-between rounded-[18px] border-[1.5px] border-divider bg-page p-3.5">
          <FileText className="size-[26px]" aria-hidden />
          <span className="text-[17px] font-bold">Invoice</span>
        </Link>
        <Link href="/stock" className="flex min-h-[88px] flex-col justify-between rounded-[18px] border-[1.5px] border-divider bg-page p-3.5">
          <Package className="size-[26px]" aria-hidden />
          <span className="text-[17px] font-bold">
            My stock{low > 0 && <span className="text-negative"> · {low} low</span>}
          </span>
        </Link>
      </div>

      <div className="flex items-end justify-between">
        <SectionTitle>Recent</SectionTitle>
        <Link href="/accountant" className="text-sm font-bold text-brand underline-offset-4 hover:underline">
          See all in the books
        </Link>
      </div>
      <ActivityList rows={recent} today={snapshot.today} />
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={`text-[13px] ${tone}`}>{label}</span>
      <span className="truncate text-[22px] font-bold tabular-nums">{value}</span>
    </div>
  );
}
