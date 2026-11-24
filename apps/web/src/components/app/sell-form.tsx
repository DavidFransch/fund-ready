"use client";

import { times, type PaymentMethod } from "@app/ledger";
import { useMemo, useState } from "react";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { centsToText, Choices, MoneyInput, parseRand, Stepper, TextInput } from "@/components/app/inputs";
import { ItemPicker, priceDetail } from "@/components/app/item-picker";
import { Card, Loading, Screen } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "eft", label: "EFT" },
  { value: "credit", label: "Later" },
];

/** "I sold something", or an invoice when the customer pays later. */
export function SellForm({ invoice = false }: { invoice?: boolean }) {
  const { snapshot, check, sheet } = useConfirmedAction();
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [priceText, setPriceText] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(invoice ? "credit" : null);
  const [customer, setCustomer] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const invoiceNumber = useMemo(() => {
    const n = snapshot?.commands.filter((c) => c.kind === "sale" && c.invoiceNumber).length ?? 0;
    return `INV-${String(n + 1).padStart(4, "0")}`;
  }, [snapshot]);
  if (!snapshot) return <Loading />;

  const item = rows.find((r) => r.id === itemId);
  const shownPrice = priceText ?? (item ? centsToText(item.salePrice) : "");
  const price = parseRand(shownPrice);
  const total = price && qty ? times(price, qty) : null;
  const missing = !item
    ? "Choose what you sold"
    : !price
      ? "Type the price"
      : !method
        ? "Choose how they paid"
        : method === "credit" && !customer.trim()
          ? "Say who will pay later"
          : null;

  function submit() {
    if (!snapshot || !item || !price || !method) return;
    check({
      kind: "sale",
      id: newId(),
      date: snapshot.today,
      paidWith: method,
      lines: [{ itemId: item.id, description: item.name, qty, unitPrice: price }],
      ...(customer.trim() ? { customer: customer.trim() } : {}),
      ...(invoice ? { invoiceNumber } : {}),
    });
  }

  return (
    <Screen title={invoice ? `Invoice ${invoiceNumber}` : "I sold something"} back="/">
      <Card className="flex flex-col gap-4">
        <ItemPicker label="What did you sell?" rows={rows} value={itemId} onChange={(id) => { setItemId(id); setPriceText(null); }} detail={priceDetail} />
        {item && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm text-ink-muted">How many {item.unit}?</span>
                <span className={qty > item.qty ? "text-[13px] font-bold text-negative" : "text-[13px] font-bold text-brand"}>
                  {qty > item.qty ? `You only have ${item.qty} on record` : `Stock goes ${item.qty} → ${item.qty - qty}`}
                </span>
              </span>
              <Stepper value={qty} min={1} onChange={setQty} label={item.unit} />
            </div>
            <MoneyInput label="Price for each" value={shownPrice} onChange={setPriceText} hint={priceText === null ? "Your usual price" : undefined} />
          </>
        )}
        {!invoice && <Choices label="How did they pay?" options={METHODS} value={method} onChange={setMethod} columns={4} />}
        {(invoice || method === "credit") && <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />}
      </Card>

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        {total !== null && (
          <p className="text-center text-[15px]">
            Total <span className="text-xl font-bold">{money(total)}</span>
          </p>
        )}
        {missing && <p className="text-center text-sm text-ink-muted">{missing}</p>}
        <Button size="primary" disabled={!!missing} onClick={submit}>
          Check and save
        </Button>
      </div>
      {sheet}
    </Screen>
  );
}
