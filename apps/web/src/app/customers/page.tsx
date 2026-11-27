"use client";

import { positions, type Command } from "@app/ledger";
import { useState } from "react";
import { newId } from "@/books/ids";
import { backdateRange, customerBalances } from "@/books/selectors";
import type { BooksSnapshot } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { FreshOnEachVisit } from "@/components/app/fresh";
import { centsToText, ChoiceTiles, DateInput, MoneyInput, parseRand } from "@/components/app/inputs";
import { FormActions, Loading, Panel, Screen } from "@/components/app/screen";
import { money } from "@/lib/format";

export default function CustomersPage() {
  return (
    <FreshOnEachVisit>
      <CustomersForm />
    </FreshOnEachVisit>
  );
}

function CustomersForm() {
  const { snapshot, check, sheet } = useConfirmedAction();
  if (!snapshot) return <Loading />;
  return <CustomerPayment snapshot={snapshot} check={check} sheet={sheet} />;
}

type Method = "cash" | "eft" | "card";

/** Record money a customer paid against one of their invoices. */
function CustomerPayment({ snapshot, check, sheet }: { snapshot: BooksSnapshot; check: (cmd: Command) => void; sheet: React.ReactNode }) {
  const owing = customerBalances(snapshot);
  const invoices = owing.flatMap((c) => c.invoices);
  const pos = positions(snapshot.book.entries);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(invoices[0]?.number ?? null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const range = backdateRange(snapshot);
  const day = date ?? snapshot.today;
  const invoice = invoices.find((i) => i.number === invoiceNumber);
  const shown = amountText ?? (invoice ? centsToText(invoice.amount) : "");
  const amount = parseRand(shown);
  const missing = !invoices.length
    ? null
    : !invoice
      ? "Choose which invoice they paid"
      : !amount
        ? "Type how much they paid"
        : amount > invoice.amount
          ? `That's more than the ${money(invoice.amount)} still owed`
          : !method
            ? "Choose how they paid"
            : day < range.min || day > range.max
              ? "Choose a date in the last 60 days"
              : null;

  return (
    <Screen
      title="Customers who owe you"
      back="/"
      width="form"
      footer={
        invoices.length > 0 && (
          <FormActions
            hint={missing}
            cancelHref="/"
            label="Review payment"
            disabled={!!missing}
            onClick={() =>
              invoice &&
              amount &&
              method &&
              !missing &&
              check({ kind: "payment_received", id: newId(), date: day, amount, into: method === "cash" ? "cash" : "bank", customer: invoice.customer, invoiceNumber: invoice.number })
            }
          />
        )
      }
    >
      <p className="-mt-1 px-1 text-[15px] leading-[1.45] text-ink-muted">Invoices not paid yet. When a customer pays, record it here.</p>
      {!invoices.length ? (
        <Panel className="px-4 py-5 text-center text-[15px] text-ink-muted">No customer owes you anything right now.</Panel>
      ) : (
        <>
          <ChoiceTiles
            label="Which invoice did they pay?"
            options={invoices.map((i) => ({ value: i.number, label: i.customer, hint: `${i.number} · owes ${money(i.amount)}` }))}
            value={invoiceNumber}
            onChange={(v) => {
              setInvoiceNumber(v);
              setAmountText(null);
            }}
          />
          <MoneyInput label="How much did they pay?" value={shown} onChange={setAmountText} />
          <ChoiceTiles
            label="How did they pay?"
            options={[
              { value: "cash", label: "Cash", hint: `Into petty cash (${money(pos.cashBox)})` },
              { value: "eft", label: "EFT", hint: "Into the bank" },
              { value: "card", label: "Card", hint: "Into the bank" },
            ]}
            value={method}
            onChange={setMethod}
          />
          <DateInput label="Date paid" value={day} onChange={setDate} min={range.min} max={range.max} />
        </>
      )}
      {sheet}
    </Screen>
  );
}
