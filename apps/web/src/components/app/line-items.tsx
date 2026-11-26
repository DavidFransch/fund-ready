"use client";

import { times } from "@app/ledger";
import { Fragment, useState } from "react";
import type { StockRow } from "@/books/selectors";
import { centsToText, MoneyInput, parseRand, Stepper } from "@/components/app/inputs";
import { ItemIcon, ItemPicker } from "@/components/app/item-picker";
import { Amount, Divider, Panel, Pill } from "@/components/app/screen";
import { money } from "@/lib/format";

interface Line {
  itemId: string;
  qty: number;
  /** null until the price is changed: the list price applies. */
  priceText: string | null;
}

export interface PricedLine extends Line {
  item: StockRow;
  text: string;
  price: number | null;
  total: number;
}

/** A basket of stock items for a sale or an invoice: one line per item. */
export function useLineItems(rows: StockRow[]) {
  const [lines, setLines] = useState<Line[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const priced: PricedLine[] = lines.flatMap((l) => {
    const item = rows.find((r) => r.id === l.itemId);
    if (!item) return [];
    const text = l.priceText ?? centsToText(item.salePrice);
    const price = parseRand(text);
    return [{ ...l, item, text, price, total: price ? times(price, l.qty) : 0 }];
  });

  return {
    priced,
    remaining: rows.filter((r) => !lines.some((l) => l.itemId === r.id)),
    total: priced.reduce((t, l) => t + l.total, 0),
    units: priced.reduce((t, l) => t + l.qty, 0),
    unpriced: priced.find((l) => !l.price),
    /** Lines for a sale command, once every line has a price. */
    saleLines: () => priced.map((l) => ({ itemId: l.item.id, description: l.item.name, qty: l.qty, unitPrice: l.price! })),
    add: (itemId: string) => setLines((ls) => [...ls, { itemId, qty: 1, priceText: null }]),
    update: (itemId: string, change: Partial<Line>) => setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, ...change } : l))),
    remove: (itemId: string) => {
      setLines((ls) => ls.filter((l) => l.itemId !== itemId));
      if (editing === itemId) setEditing(null);
    },
    editing,
    setEditing,
  };
}

export type LineItems = ReturnType<typeof useLineItems>;

/** The big total. One item reads like a till: "2 × Cooldrink 2L at R30.00 (list price)". */
export function BasketTotal({ basket }: { basket: LineItems }) {
  const { priced, total, units } = basket;
  const only = priced.length === 1 ? priced[0]! : null;
  return (
    <div className="flex flex-col items-center gap-1.5 px-1 pt-3 pb-2 text-center">
      <Amount cents={total} className="text-[52px] tracking-[-0.04em]" />
      <span className="text-[15px] text-ink-muted">
        {only
          ? `${only.qty} × ${only.item.name} at ${money(only.price ?? 0)} ${only.price === only.item.salePrice ? "(list price)" : "(your price)"}`
          : `${priced.length} items · ${units} ${units === 1 ? "unit" : "units"}`}
      </span>
    </div>
  );
}

/** Every line with its quantity, price, remove and line total, then the items not added yet. */
export function BasketLines({ basket, label, emptyLabel }: { basket: LineItems; label: string; emptyLabel: string }) {
  const { priced, remaining, add, update, remove, editing, setEditing } = basket;
  return (
    <>
      {priced.length > 0 && (
        <Panel aria-label={label} className="flex flex-col py-0.5">
          {priced.map((l, i) => {
            const short = l.qty > l.item.qty;
            return (
              <Fragment key={l.itemId}>
                {i > 0 && <Divider inset />}
                <div className="flex flex-col gap-2 px-3.5 py-3">
                  <div className="flex items-center gap-3">
                    <ItemIcon id={l.item.id} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{l.item.name}</span>
                      <span className={short ? "text-[13px] font-medium text-negative" : "text-[13px] text-ink-muted"}>
                        {short ? `Only ${l.item.qty} on record` : `${l.item.qty} in stock`}
                      </span>
                    </div>
                    <Stepper value={l.qty} min={1} onChange={(qty) => update(l.itemId, { qty })} label={l.item.unit} />
                  </div>
                  <div className="flex items-center gap-1 pl-[56px] text-[13px]">
                    <button
                      type="button"
                      onClick={() => setEditing(editing === l.itemId ? null : l.itemId)}
                      aria-expanded={editing === l.itemId}
                      className="min-h-9 pr-2 text-left text-ink-muted hover:text-ink"
                    >
                      {l.price ? money(l.price) : "No price"} each{l.price && l.price !== l.item.salePrice ? " (your price)" : ""} · <span className="font-medium text-brand">Change</span>
                    </button>
                    <button type="button" onClick={() => remove(l.itemId)} aria-label={`Remove ${l.item.name}`} className="min-h-9 px-2 font-medium text-ink-muted hover:text-negative">
                      Remove
                    </button>
                    <span className="ml-auto text-[15px] font-semibold">{money(l.total)}</span>
                  </div>
                  {editing === l.itemId && (
                    <div className="pl-[56px]">
                      <MoneyInput label={`Price for each ${l.item.name}`} value={l.text} onChange={(v) => update(l.itemId, { priceText: v })} />
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </Panel>
      )}

      {remaining.length > 0 && (
        <ItemPicker
          label={priced.length ? "Add another item" : emptyLabel}
          rows={remaining}
          detail={(r) => `${r.qty} in stock · sells for ${money(r.salePrice)}`}
          onPick={add}
        />
      )}
    </>
  );
}

/** Stock (for one item), what it cost and the profit with its margin. */
export function BasketProfit({ basket, cost, noun }: { basket: LineItems; cost: number; noun: "sale" | "invoice" }) {
  const { priced, total } = basket;
  const only = priced.length === 1 ? priced[0]! : null;
  const profit = total - cost;
  return (
    <Panel aria-label={`What this ${noun} does`} className="flex flex-col">
      {only && (
        <>
          <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">Stock</span>
            <span className="font-semibold">
              {only.item.qty} → {only.item.qty - only.qty} {only.item.unit}
            </span>
          </div>
          <Divider />
        </>
      )}
      <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
        <span className="text-ink-muted">What these cost you</span>
        <span className="font-semibold">{money(cost)}</span>
      </div>
      <Divider />
      <div className="flex items-center justify-between px-3.5 py-[13px] text-[15px]">
        <span className="text-ink-muted">{profit >= 0 ? `Profit on this ${noun}` : `Loss on this ${noun}`}</span>
        <span className="flex items-center gap-2">
          {total > 0 && <Pill tone={profit >= 0 ? "brand" : "negative"}>{Math.round((profit / total) * 100)}% margin</Pill>}
          <span className={profit >= 0 ? "font-semibold text-positive" : "font-semibold text-negative"}>{money(Math.abs(profit))}</span>
        </span>
      </div>
    </Panel>
  );
}
