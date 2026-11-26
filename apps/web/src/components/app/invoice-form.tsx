"use client";

import { ACC, times, type Command } from "@app/ledger";
import { Wallet } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { centsToText, MoneyInput, parseRand, Stepper, TextInput } from "@/components/app/inputs";
import { ItemIcon, ItemPicker } from "@/components/app/item-picker";
import { Amount, Divider, FormActions, InfoStrip, Loading, Panel, Pill, Screen } from "@/components/app/screen";
import { money } from "@/lib/format";

interface Line {
  itemId: string;
  qty: number;
  /** null until the price is changed: the list price applies. */
  priceText: string | null;
}

/** An invoice for a customer who pays later, with one line per stock item. */
export function InvoiceForm() {
  const { snapshot, check, sheet } = useConfirmedAction();
  const { preview } = useBooks();
  const [lines, setLines] = useState<Line[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const invoiceNumber = useMemo(() => {
    const n = snapshot?.commands.filter((c) => c.kind === "sale" && c.invoiceNumber).length ?? 0;
    return `INV-${String(n + 1).padStart(4, "0")}`;
  }, [snapshot]);
  if (!snapshot) return <Loading />;

  const priced = lines.flatMap((l) => {
    const item = rows.find((r) => r.id === l.itemId);
    if (!item) return [];
    const text = l.priceText ?? centsToText(item.salePrice);
    const price = parseRand(text);
    return [{ ...l, item, text, price, total: price ? times(price, l.qty) : 0 }];
  });
  const remaining = rows.filter((r) => !lines.some((l) => l.itemId === r.id));
  const total = priced.reduce((t, l) => t + l.total, 0);
  const units = priced.reduce((t, l) => t + l.qty, 0);
  const unpriced = priced.find((l) => !l.price);
  const missing = !priced.length
    ? "Add what you are invoicing"
    : unpriced
      ? `Type the price for ${unpriced.item.name}`
      : !customer.trim()
        ? "Say who will pay"
        : null;

  const cmd: Command | null =
    priced.length && !unpriced
      ? {
          kind: "sale",
          id: "invoice-preview",
          date: snapshot.today,
          paidWith: "credit",
          lines: priced.map((l) => ({ itemId: l.item.id, description: l.item.name, qty: l.qty, unitPrice: l.price! })),
          customer: customer.trim() || "Customer",
          invoiceNumber,
        }
      : null;
  const p = cmd ? preview(cmd) : null;
  const cost = p?.ok ? effectOn(p.result.entry, ACC.costOfSales) : 0;
  const profit = total - cost;

  const update = (itemId: string, change: Partial<Line>) => setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, ...change } : l)));
  const remove = (itemId: string) => {
    setLines((ls) => ls.filter((l) => l.itemId !== itemId));
    if (editing === itemId) setEditing(null);
  };

  return (
    <Screen
      title={`Invoice ${invoiceNumber}`}
      back="/"
      width="form"
      footer={
        <FormActions
          hint={missing}
          cancelHref="/"
          label="Review invoice"
          disabled={!!missing}
          onClick={() => cmd && !missing && check({ ...cmd, id: newId() } as Command)}
        />
      }
    >
      <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />

      {priced.length > 0 && (
        <>
          <div className="flex flex-col items-center gap-1.5 px-1 pt-3 pb-2 text-center">
            <Amount cents={total} className="text-[52px] tracking-[-0.04em]" />
            <span className="text-[15px] text-ink-muted">
              {priced.length === 1 ? "1 item" : `${priced.length} items`} · {units} {units === 1 ? "unit" : "units"}
            </span>
          </div>

          <Panel aria-label="On this invoice" className="flex flex-col py-0.5">
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
        </>
      )}

      {remaining.length > 0 && (
        <ItemPicker
          label={priced.length ? "Add another item" : "What are you invoicing?"}
          rows={remaining}
          detail={(r) => `${r.qty} in stock · sells for ${money(r.salePrice)}`}
          onPick={(id) => setLines((ls) => [...ls, { itemId: id, qty: 1, priceText: null }])}
        />
      )}

      {priced.length > 0 && (
        <Panel aria-label="What this invoice does" className="flex flex-col">
          <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">What these cost you</span>
            <span className="font-semibold">{money(cost)}</span>
          </div>
          <Divider />
          <div className="flex items-center justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">{profit >= 0 ? "Profit on this invoice" : "Loss on this invoice"}</span>
            <span className="flex items-center gap-2">
              {total > 0 && <Pill tone={profit >= 0 ? "brand" : "negative"}>{Math.round((profit / total) * 100)}% margin</Pill>}
              <span className={profit >= 0 ? "font-semibold text-positive" : "font-semibold text-negative"}>{money(Math.abs(profit))}</span>
            </span>
          </div>
        </Panel>
      )}

      {priced.length > 0 && <InfoStrip icon={Wallet}>Added to what {customer.trim() || "the customer"} owes you</InfoStrip>}
      {sheet}
    </Screen>
  );
}
