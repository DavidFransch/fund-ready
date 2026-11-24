"use client";

import { ACC, positions, times, type Command, type PaymentMethod } from "@app/ledger";
import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { centsToText, Chips, MoneyInput, parseRand, Stepper, TextInput } from "@/components/app/inputs";
import { ItemIcon, ItemPicker } from "@/components/app/item-picker";
import { Amount, Divider, InfoStrip, Loading, Panel, Pill, Screen } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "eft", label: "EFT" },
  { value: "credit", label: "Later" },
];

/** "New sale", or an invoice when the customer pays later. */
export function SellForm({ invoice = false }: { invoice?: boolean }) {
  const { snapshot, check, sheet } = useConfirmedAction();
  const { preview } = useBooks();
  const [itemId, setItemId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [qty, setQty] = useState(1);
  const [priceText, setPriceText] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(invoice ? "credit" : null);
  const [customer, setCustomer] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const invoiceNumber = useMemo(() => {
    const n = snapshot?.commands.filter((c) => c.kind === "sale" && c.invoiceNumber).length ?? 0;
    return `INV-${String(n + 1).padStart(4, "0")}`;
  }, [snapshot]);
  if (!snapshot) return <Loading />;

  const item = rows.find((r) => r.id === itemId);
  const listPrice = item?.salePrice ?? 0;
  const shownPrice = priceText ?? (item ? centsToText(listPrice) : "");
  const price = parseRand(shownPrice);
  const total = item && price ? times(price, qty) : 0;
  const missing = !item
    ? "Choose what you sold"
    : !price
      ? "Type the price"
      : !method
        ? "Choose how they paid"
        : method === "credit" && !customer.trim()
          ? "Say who will pay later"
          : null;

  const cmd: Command | null =
    item && price
      ? {
          kind: "sale",
          id: "sale-preview",
          date: snapshot.today,
          paidWith: method ?? "cash",
          lines: [{ itemId: item.id, description: item.name, qty, unitPrice: price }],
          ...(customer.trim() ? { customer: customer.trim() } : method === "credit" ? { customer: "Customer" } : {}),
          ...(invoice ? { invoiceNumber } : {}),
        }
      : null;
  const p = cmd ? preview(cmd) : null;
  const cost = p?.ok ? effectOn(p.result.entry, ACC.costOfSales) : 0;
  const profit = total - cost;
  const cash = positions(snapshot.book.entries).cashBox;
  const moneyNote =
    method === "cash"
      ? `Cash goes into petty cash: ${money(cash)} → ${money(cash + total)}`
      : method === "card" || method === "eft"
        ? `${method === "card" ? "Card" : "EFT"} money lands in the bank`
        : method === "credit"
          ? `Added to what ${customer.trim() || "the customer"} owes you`
          : null;

  return (
    <Screen
      title={invoice ? `Invoice ${invoiceNumber}` : "New sale"}
      back="/"
      footer={
        <>
          {missing && <p className="text-center text-[13px] text-ink-muted">{missing}</p>}
          <Button size="primary" disabled={!!missing} onClick={() => cmd && !missing && check({ ...cmd, id: newId() } as Command)}>
            {invoice ? "Review invoice" : "Review sale"}
          </Button>
        </>
      }
    >
      {item && !picking ? (
        <>
          <div className="flex flex-col items-center gap-1.5 px-1 pt-3 pb-2 text-center">
            <Amount cents={total} className="text-[52px] tracking-[-0.04em]" />
            <span className="text-[15px] text-ink-muted">
              {qty} × {item.name} at {money(price ?? 0)} {price === listPrice ? "(list price)" : "(your price)"}
            </span>
            {!editPrice && (
              <button type="button" onClick={() => setEditPrice(true)} className="min-h-11 px-3 text-sm font-medium text-brand hover:text-brand-strong">
                Change price
              </button>
            )}
          </div>
          {editPrice && <MoneyInput label="Price for each" value={shownPrice} onChange={setPriceText} />}

          <Panel className="flex items-center gap-3 p-3.5">
            <ItemIcon id={item.id} />
            <button type="button" onClick={() => setPicking(true)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
              <span className="text-base font-semibold">{item.name}</span>
              <span className={qty > item.qty ? "text-[13px] font-medium text-negative" : "text-[13px] text-ink-muted"}>
                {qty > item.qty ? `Only ${item.qty} on record` : `${item.qty} in stock`} · <span className="text-brand">Change</span>
              </span>
            </button>
            <Stepper value={qty} min={1} onChange={setQty} label={item.unit} />
          </Panel>
        </>
      ) : (
        <ItemPicker
          label="What did you sell?"
          rows={rows}
          detail={(r) => `${r.qty} in stock · sells for ${money(r.salePrice)}`}
          onPick={(id) => {
            setItemId(id);
            setPicking(false);
            setPriceText(null);
            setEditPrice(false);
          }}
        />
      )}

      {!invoice && <Chips label="Paid with" options={METHODS} value={method} onChange={setMethod} columns={4} />}
      {(invoice || method === "credit") && <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />}

      {item && !picking && (
        <Panel aria-label="What this sale does" className="flex flex-col">
          <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">Stock</span>
            <span className="font-semibold">
              {item.qty} → {item.qty - qty} {item.unit}
            </span>
          </div>
          <Divider />
          <div className="flex justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">What these cost you</span>
            <span className="font-semibold">{money(cost)}</span>
          </div>
          <Divider />
          <div className="flex items-center justify-between px-3.5 py-[13px] text-[15px]">
            <span className="text-ink-muted">{profit >= 0 ? "Profit on this sale" : "Loss on this sale"}</span>
            <span className="flex items-center gap-2">
              {total > 0 && <Pill tone={profit >= 0 ? "brand" : "negative"}>{Math.round((profit / total) * 100)}% margin</Pill>}
              <span className={profit >= 0 ? "font-semibold text-positive" : "font-semibold text-negative"}>{money(Math.abs(profit))}</span>
            </span>
          </div>
        </Panel>
      )}

      {item && !picking && moneyNote && <InfoStrip icon={Wallet}>{moneyNote}</InfoStrip>}
      {sheet}
    </Screen>
  );
}
