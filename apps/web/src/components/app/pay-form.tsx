"use client";

import { positions, times, type Command, type ExpenseCategoryId } from "@app/ledger";
import { ChevronRight, Package, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL } from "@/books/describe";
import { newId } from "@/books/ids";
import { knownSuppliers, stockRows, suppliers } from "@/books/selectors";
import { useConfirmedAction } from "@/components/app/confirm";
import { centsToText, Chips, ChoiceTiles, MoneyInput, parseRand, Segmented, Stepper, TextInput } from "@/components/app/inputs";
import { ChosenItem, ItemPicker } from "@/components/app/item-picker";
import { Divider, InfoStrip, Loading, Panel, Screen, STROKE } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

type Mode = "stock" | "other";
type PaidFrom = "cash" | "bank" | "credit" | "own";

const OTHER_CATEGORIES = (["packaging", "transport", "rent", "wages", "electricity", "data", "bank_fees", "other"] as const).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));

/** "Buy stock" and "Other expense": one form, two modes. */
export function PayForm({ initialMode }: { initialMode: Mode }) {
  const { snapshot, check, sheet } = useConfirmedAction();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [itemId, setItemId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [qty, setQty] = useState(1);
  const [costText, setCostText] = useState<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategoryId | null>(null);
  const [amountText, setAmountText] = useState("");
  const [supplier, setSupplier] = useState("");
  const [paidFrom, setPaidFrom] = useState<PaidFrom | null>(null);

  const data = useMemo(
    () => snapshot && { rows: stockRows(snapshot), owed: suppliers(snapshot), names: knownSuppliers(snapshot), pos: positions(snapshot.book.entries) },
    [snapshot],
  );
  if (!snapshot || !data) return <Loading />;

  const isStock = mode === "stock";
  const item = data.rows.find((r) => r.id === itemId);
  // Suggest the last cost per unit until the user types their own.
  const shownCost = costText ?? (item ? centsToText(item.unitCost) : "");
  const costEach = parseRand(shownCost);
  const amount = isStock ? (item && costEach ? times(costEach, qty) : null) : parseRand(amountText);

  const missing = isStock
    ? !item
      ? "Choose which stock you bought"
      : !costEach
        ? "Type what each one cost"
        : null
    : !category
      ? "Choose what it was for"
      : !amount
        ? "Type how much it cost"
        : null;
  const stillMissing =
    missing ?? (!paidFrom ? "Choose how you are paying" : paidFrom === "credit" && !supplier.trim() ? "Say which supplier you will pay later" : null);

  function submit() {
    if (!snapshot || !amount || !paidFrom) return;
    const base = { kind: "expense" as const, id: newId(), date: snapshot.today, amount, paidFrom, ...(supplier.trim() ? { supplier: supplier.trim() } : {}) };
    const cmd: Command = isStock && item ? { ...base, category: "stock", stockLines: [{ itemId: item.id, qty, cost: amount }] } : { ...base, category: category! };
    check(cmd);
  }

  const payOptions: { value: PaidFrom; label: string; hint: string }[] = [
    { value: "cash", label: "Petty cash", hint: `${money(data.pos.cashBox)} available` },
    { value: "bank", label: "Bank", hint: `${money(data.pos.bank)} available` },
    { value: "credit", label: "Pay later", hint: "Owe the supplier" },
    { value: "own", label: "My own pocket", hint: "Business owes you" },
  ];

  return (
    <Screen
      title={isStock ? "Buy stock" : "Expense"}
      back="/"
      footer={
        <>
          {stillMissing && <p className="text-center text-[13px] text-ink-muted">{stillMissing}</p>}
          <Button size="primary" disabled={!!stillMissing} onClick={submit}>
            {isStock ? "Review purchase" : "Review expense"}
          </Button>
        </>
      }
    >
      <Segmented
        label="What did you pay for"
        options={[
          { value: "stock", label: "Stock for the shop" },
          { value: "other", label: "Other expense" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {data.owed.map((o) => (
        <Link key={o.supplier} href="/suppliers" className="flex items-center gap-3 rounded-[18px] bg-panel px-3.5 py-3 hover:bg-panel-strong">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-negative-tint text-negative">
            <Truck className="size-5" strokeWidth={STROKE} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-medium">You owe {o.supplier}</span>
            <span className="text-[13px] text-ink-muted">Pay them now</span>
          </span>
          <span className="text-[15px] font-semibold">{money(o.amount)}</span>
          <ChevronRight className="size-[18px] text-ink-muted" strokeWidth={STROKE} aria-hidden />
        </Link>
      ))}

      {isStock ? (
        item && !picking ? (
          <Panel className="flex flex-col">
            <ChosenItem row={item} detail={`${item.qty} in stock · last cost ${money(item.unitCost)}`} onChange={() => setPicking(true)} />
            <Divider className="mx-0" />
            <div className="grid grid-cols-2 gap-3 p-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-muted">Quantity</span>
                <Stepper variant="box" value={qty} min={1} onChange={setQty} label={item.unit} />
              </div>
              <MoneyInput label="Cost each" value={shownCost} onChange={setCostText} />
            </div>
            <div className="flex items-baseline justify-between px-3.5 pb-3.5">
              <span className="text-sm text-ink-muted">Total</span>
              <span className="text-2xl font-semibold tracking-[-0.02em]">{money(amount ?? 0)}</span>
            </div>
          </Panel>
        ) : (
          <ItemPicker
            label="Which stock did you buy?"
            rows={data.rows}
            detail={(r) => `${r.qty} in stock · last cost ${money(r.unitCost)}`}
            onPick={(id) => {
              setItemId(id);
              setPicking(false);
              setCostText(null);
            }}
          />
        )
      ) : (
        <Panel className="flex flex-col gap-4 p-3.5">
          <Chips label="What was it for?" options={OTHER_CATEGORIES} value={category} onChange={setCategory} />
          <MoneyInput label="How much" value={amountText} onChange={setAmountText} />
        </Panel>
      )}

      <TextInput
        label={isStock ? "Supplier" : "Description or shop"}
        value={supplier}
        onChange={setSupplier}
        placeholder={isStock ? "e.g. Gugulethu Cash & Carry" : "e.g. Carrier bags"}
        list={data.names}
      />

      <ChoiceTiles label="How are you paying?" options={payOptions} value={paidFrom} onChange={setPaidFrom} />

      {isStock && item && (
        <InfoStrip icon={Package}>
          Stock after this:{" "}
          <strong className="font-semibold">
            {item.qty} → {item.qty + qty} {item.unit}
          </strong>
        </InfoStrip>
      )}
      {sheet}
    </Screen>
  );
}
