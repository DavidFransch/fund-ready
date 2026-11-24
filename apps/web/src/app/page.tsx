"use client";

import { addDays } from "@app/ledger";
import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Landmark, Plus, ReceiptText, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { formatDay } from "@/books/dates";
import { BUSINESS } from "@/books/seed";
import { activity, home } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { ActivityList } from "@/components/app/activity";
import { DemoMenu } from "@/components/app/demo-menu";
import { Amount, Loading, Logo, NightCard, Panel, Screen, STROKE } from "@/components/app/screen";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTIONS: { href: string; label: string; icon: LucideIcon; primary?: boolean }[] = [
  { href: "/sell", label: "Sell", icon: Plus, primary: true },
  { href: "/pay", label: "Buy stock", icon: ShoppingBag },
  { href: "/expense", label: "Expense", icon: ReceiptText },
  { href: "/stock/count", label: "Count", icon: ClipboardCheck },
];

export default function HomePage() {
  const { snapshot } = useBooks();
  const data = useMemo(() => {
    if (!snapshot) return null;
    // A rolling week, so Monday morning (and a freshly reset demo) is never an empty card.
    const lastWeek = { from: addDays(snapshot.today, -6), to: snapshot.today };
    return { h: home(snapshot, lastWeek), today: activity(snapshot, { date: snapshot.today }) };
  }, [snapshot]);
  if (!snapshot || !data) return <Loading />;
  const { h, today } = data;

  return (
    <Screen
      nav
      header={
        <header className="flex items-center gap-3 px-5 pt-[18px]">
          <Logo />
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-base font-semibold tracking-[-0.01em]">{BUSINESS.name}</span>
            <span className="text-[13px] text-ink-muted">
              {BUSINESS.area} · {formatDay(snapshot.today, { weekday: "long", day: "numeric", month: "short" })}
            </span>
          </span>
          <DemoMenu />
        </header>
      }
    >
      {!snapshot.saved && (
        <p role="status" className="rounded-[14px] bg-negative-tint px-3.5 py-3 text-sm text-[#8A2F10]">
          This browser is not saving. Changes last until you close the page.
        </p>
      )}

      <NightCard aria-label="Your money" className="mt-1 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-night-muted">Cash and bank</span>
          <Amount cents={h.cashBox + h.bank} className="text-[38px]" centsClassName="text-night-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/petty-cash" className="flex flex-col gap-1 rounded-[14px] bg-night-raised p-3 hover:bg-night-line">
            <span className="flex items-center gap-1.5 text-xs text-night-muted">
              <Wallet className="size-3.5" strokeWidth={STROKE} aria-hidden /> Petty cash
            </span>
            <span className="text-base font-semibold">{money(h.cashBox)}</span>
          </Link>
          <div className="flex flex-col gap-1 rounded-[14px] bg-night-raised p-3">
            <span className="flex items-center gap-1.5 text-xs text-night-muted">
              <Landmark className="size-3.5" strokeWidth={STROKE} aria-hidden /> Bank
            </span>
            <span className="text-base font-semibold">{money(h.bank)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-night-line pt-3.5 text-[13px]">
          <span className="text-night-muted">Last 7 days</span>
          <span className="flex items-center gap-1 font-semibold text-accent">
            <ArrowUpRight className="size-3.5" strokeWidth={2.25} aria-hidden /> {money(h.moneyIn)} in
          </span>
          <span className="flex items-center gap-1 font-semibold">
            <ArrowDownLeft className="size-3.5" strokeWidth={2.25} aria-hidden /> {money(h.moneyOut)} out
          </span>
        </div>
      </NightCard>

      <nav aria-label="Quick actions" className="mt-1 grid grid-cols-4 gap-2">
        {ACTIONS.map(({ href, label, icon: Icon, primary }) => (
          <Link key={href} href={href} className="group flex flex-col items-center gap-2 text-[13px] font-medium">
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-[18px] transition-colors",
                primary ? "bg-brand text-white group-hover:bg-brand-strong" : "bg-panel text-brand group-hover:bg-panel-strong",
              )}
            >
              <Icon className="size-6" strokeWidth={STROKE} aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-1 grid grid-cols-2 gap-2">
        <Panel className="flex flex-col gap-1 rounded-2xl p-3.5">
          <span className="text-xs text-ink-muted">Customers owe you</span>
          <span className="text-[17px] font-semibold">{money(h.owedToYou)}</span>
        </Panel>
        <Link href="/suppliers" className="flex flex-col gap-1 rounded-2xl bg-panel p-3.5 hover:bg-panel-strong">
          <span className="text-xs text-ink-muted">You owe suppliers</span>
          <span className="text-[17px] font-semibold">{money(h.owedToSuppliers)}</span>
        </Link>
      </div>

      <section aria-label="Today" className="mt-1.5 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold">Today</h2>
          <Link href="/accountant" className="text-[13px] font-medium text-brand hover:text-brand-strong">
            See all
          </Link>
        </div>
        {today.length ? (
          <ActivityList rows={today} />
        ) : (
          <Panel className="px-4 py-5 text-center text-[15px] text-ink-muted">Nothing recorded yet today. Start with Sell or Buy stock.</Panel>
        )}
      </section>
    </Screen>
  );
}
