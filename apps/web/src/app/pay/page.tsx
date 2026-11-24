"use client";

import { times, type Command, type ExpenseCategoryId } from "@app/ledger";
import { Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { newId } from "@/books/ids";
import { knownSuppliers, stockRows, suppliers } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { centsToText, Choices, MoneyInput, parseRand, Stepper, TextInput } from "@/components/app/inputs";
import { costDetail, ItemPicker } from "@/components/app/item-picker";
import { Card, Loading, Screen } from "@/components/app/screen";
import { SupplierPayForm } from "@/components/app/supplier-pay";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

const CATEGORIES: { value: ExpenseCategoryId; label: string }[] = [
  { value: "stock", label: "Stock" },
  { value: "packaging", label: "Packaging" },
  { value: "transport", label: "Transport" },
  { value: "rent", label: "Rent" },
  { value: "wages", label: "Wages" },
  { value: "electricity", label: "Electricity" },
  { value: "data", label: "Airtime and data" },
  { value: "other", label: "Other" },
];

type PaidFrom = "cash" | "bank" | "credit" | "own";
const PAID_FROM: { value: PaidFrom; label: string; hint: string }[] = [
  { value: "cash", label: "Petty cash", hint: "paid now" },
  { value: "bank", label: "Bank", hint: "paid now" },
  { value: "credit", label: "Pay later", hint: "on account" },
  { value: "own", label: "My own pocket", hint: "business owes you" },
];

export default function PayPage() {
  const { snapshot, check, sheet } = useConfirmedAction();
  const [mode, setMode] = useState<"expense" | "supplier">("expense");
  const [payee, setPayee] = useState<string | undefined>();
  const [category, setCategory] = useState<ExpenseCategoryId>("stock");
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [paidFrom, setPaidFrom] = useState<PaidFrom | null>(null);

  const data = useMemo(() => snapshot && { rows: stockRows(snapshot), owed: suppliers(snapshot), names: knownSuppliers(snapshot) }, [snapshot]);
  if (!snapshot || !data) return <Loading />;

  const item = data.rows.find((r) => r.id === itemId);
  const isStock = category === "stock";
  // For stock, suggest the last cost per unit × quantity until the user types their own total.
  const suggested = isStock && item ? times(item.unitCost, qty) : null;
  const shown = amountText ?? (suggested ? centsToText(suggested) : "");
  const amount = parseRand(shown);

  const missing =
    isStock && !item
      ? "Choose which stock you bought"
      : !amount
        ? "Type how much it cost"
        : !paidFrom
          ? "Choose whose money paid"
          : paidFrom === "credit" && !supplier.trim()
            ? "Say who you will pay later"
            : null;

  function submit() {
    if (!snapshot || !amount || !paidFrom) return;
    const base = { kind: "expense" as const, id: newId(), date: snapshot.today, amount, paidFrom, ...(supplier.trim() ? { supplier: supplier.trim() } : {}) };
    const cmd: Command = isStock && item ? { ...base, category: "stock", stockLines: [{ itemId: item.id, qty, cost: amount }] } : { ...base, category };
    check(cmd);
  }

  return (
    <Screen title="I paid for something" back="/">
      {mode === "supplier" ? (
        <>
          <Button variant="outline" size="touch" onClick={() => setMode("expense")}>
            Record something new I paid for instead
          </Button>
          <SupplierPayForm snapshot={snapshot} initial={payee} onCheck={check} />
        </>
      ) : (
        <>
          {data.owed.map((o) => (
            <div key={o.supplier} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-sun-line bg-sun-soft px-4 py-3 text-sun-ink">
              <Truck className="size-5 shrink-0" aria-hidden />
              <span className="flex-1 text-[15px] leading-snug">
                You owe <b>{o.supplier}</b> {money(o.amount)}
              </span>
              <Button
                size="sm"
                variant="night"
                className="h-11 rounded-full px-4 font-bold"
                onClick={() => {
                  setPayee(o.supplier);
                  setMode("supplier");
                }}
              >
                Pay now
              </Button>
            </div>
          ))}

          <Card className="flex flex-col gap-4">
            <Choices label="What was it for?" options={CATEGORIES} value={category} onChange={(c) => { setCategory(c); setAmountText(null); }} />
            {isStock && (
              <>
                <ItemPicker label="Which stock?" rows={data.rows} value={itemId} onChange={(id) => { setItemId(id); setAmountText(null); }} detail={costDetail} />
                {item && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="text-sm text-ink-muted">How many {item.unit}?</span>
                      <span className="text-[13px] font-bold text-brand">
                        Stock goes {item.qty} → {item.qty + qty}
                      </span>
                    </span>
                    <Stepper value={qty} min={1} onChange={(q) => { setQty(q); setAmountText(null); }} label={item.unit} />
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <MoneyInput label={isStock ? "Total cost" : "How much"} value={shown} onChange={setAmountText} />
              <TextInput label={isStock ? "Supplier" : "Where"} value={supplier} onChange={setSupplier} placeholder="e.g. Gugs Wholesalers" list={data.names} />
            </div>
            <Choices label="Whose money paid?" options={PAID_FROM} value={paidFrom} onChange={setPaidFrom} columns={2} />
          </Card>

          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            {missing && <p className="text-center text-sm text-ink-muted">{missing}</p>}
            <Button size="primary" disabled={!!missing} onClick={submit}>
              {isStock ? "Check and update stock" : "Check and save"}
            </Button>
          </div>
        </>
      )}
      {sheet}
    </Screen>
  );
}
