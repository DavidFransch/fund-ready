"use client";

import { ClipboardCheck, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { Loading, NightCard, Screen } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function StockPage() {
  const { snapshot } = useBooks();
  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  if (!snapshot) return <Loading />;
  const worth = rows.reduce((s, r) => s + r.value, 0);
  const low = rows.filter((r) => r.low).length;

  return (
    <Screen title="My stock" back="/" nav>
      <NightCard className="flex items-center justify-between p-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm text-night-muted">Your stock cost you</span>
          <span className="font-display text-[26px] font-bold">{money(worth)}</span>
        </span>
        {low > 0 && <span className="text-sm font-bold text-sun">{low} running low</span>}
      </NightCard>

      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-line bg-card py-3 pr-4 pl-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-bold">{r.name}</span>
              <span className={cn("text-sm", r.low ? "font-bold text-spend" : "text-ink-muted")}>
                {r.low ? `Running low · buy when ${r.reorderLevel} or less` : `Sells for ${money(r.salePrice)} · cost ${money(r.unitCost)}`}
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className="font-display text-[22px] leading-tight font-bold">{r.qty}</span>
              <span className="text-[13px] text-ink-muted">{r.unit}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="rounded-xl bg-brand-soft px-3.5 py-3 text-[15px] leading-snug text-brand-dark">
        Stock goes down by itself when you record a sale, and up when you record buying stock.
      </p>

      <div className="mt-auto flex flex-col gap-2.5">
        <Button asChild size="touch" variant="outline">
          <Link href="/stock/count">
            <ClipboardCheck className="size-5" aria-hidden /> Count my stock
          </Link>
        </Button>
        <Button asChild size="touch" className="bg-sun text-ink hover:bg-sun/90">
          <Link href="/pay">
            <ShoppingCart className="size-5" aria-hidden /> I bought stock
          </Link>
        </Button>
      </div>
    </Screen>
  );
}
