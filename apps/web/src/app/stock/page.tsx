"use client";

import { ClipboardCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo } from "react";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { ItemIcon } from "@/components/app/item-picker";
import { Amount, Divider, Loading, Panel, Screen, STROKE } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const STOCK_COLS = "grid grid-cols-[minmax(0,1.6fr)_100px_100px_110px_90px_110px] gap-3";

export default function StockPage() {
  const { snapshot } = useBooks();
  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  if (!snapshot) return <Loading />;
  const worth = rows.reduce((s, r) => s + r.value, 0);
  const low = rows.filter((r) => r.low).length;

  return (
    <Screen
      title="Stock"
      nav
      actions={
        <>
          <Button asChild size="touch" className="h-11">
            <Link href="/stock/count">
              <ClipboardCheck className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Count stock
            </Link>
          </Button>
          <Button asChild size="touch" variant="outline" className="h-11">
            <Link href="/pay">
              <ShoppingBag className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Buy stock
            </Link>
          </Button>
        </>
      }
    >
      <Panel aria-label="Stock value" className="flex flex-col gap-[18px] rounded-3xl p-5 lg:max-w-md">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Your stock cost you</span>
          <Amount cents={worth} className="text-[40px]" />
          <span className="text-[13px] text-ink-muted">
            {rows.length} items{low > 0 && <span className="font-semibold text-negative"> · {low} running low</span>}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <Button asChild size="touch">
            <Link href="/stock/count">
              <ClipboardCheck className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Count stock
            </Link>
          </Button>
          <Button asChild size="touch" variant="outline">
            <Link href="/pay">
              <ShoppingBag className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Buy stock
            </Link>
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-col py-0.5 lg:hidden">
        {rows.map((r, i) => (
          <Fragment key={r.id}>
            {i > 0 && <Divider inset />}
            <div className="flex min-h-16 items-center gap-3 px-3.5 py-3">
              <ItemIcon id={r.id} className="size-10" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{r.name}</span>
                <span className={cn("text-[13px]", r.low ? "font-medium text-negative" : "text-ink-muted")}>
                  {r.low ? `Running low · buy at ${r.reorderLevel}` : `Sells for ${money(r.salePrice)} · cost ${money(r.unitCost)}`}
                </span>
              </span>
              <span className="flex flex-col items-end">
                <span className="text-[17px] font-semibold">{r.qty}</span>
                <span className="text-xs text-ink-muted">{r.unit}</span>
              </span>
            </div>
          </Fragment>
        ))}
      </Panel>

      <div className="hidden overflow-x-auto lg:block">
      <div role="table" aria-label="Stock" className="flex min-w-[700px] flex-col text-sm">
        <div role="row" className={cn(STOCK_COLS, "px-3 pb-2.5 text-xs font-medium text-ink-muted")}>
          <span role="columnheader">Item</span>
          <span role="columnheader" className="text-right">
            On hand
          </span>
          <span role="columnheader" className="text-right">
            Avg cost
          </span>
          <span role="columnheader" className="text-right">
            Value
          </span>
          <span role="columnheader" className="text-right">
            Reorder at
          </span>
          <span role="columnheader">Status</span>
        </div>
        {rows.map((r) => (
          <div role="row" key={r.id} className={cn(STOCK_COLS, "items-center border-b border-hairline px-3 py-2.5")}>
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <ItemIcon id={r.id} className="size-9 bg-panel" />
              <span className="truncate font-medium">{r.name}</span>
            </span>
            <span role="cell" className="text-right font-semibold">
              {r.qty} <span className="font-normal text-ink-muted">{r.unit}</span>
            </span>
            <span role="cell" className="text-right">
              {money(r.unitCost)}
            </span>
            <span role="cell" className="text-right font-medium">
              {money(r.value)}
            </span>
            <span role="cell" className="text-right text-ink-muted">
              {r.reorderLevel}
            </span>
            <span role="cell" className={r.low ? "font-semibold text-negative" : "text-positive"}>
              {r.low ? "Running low" : "In stock"}
            </span>
          </div>
        ))}
      </div>
      </div>

      <p className="px-1 text-[13px] leading-snug text-ink-muted">Stock goes down by itself when you record a sale, and up when you record buying stock.</p>
    </Screen>
  );
}
