"use client";

import { ACC, positions, type Command, type PaymentMethod } from "@app/ledger";
import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { Chips, isEmail, TextInput } from "@/components/app/inputs";
import { BasketLines, BasketProfit, BasketTotal, useLineItems } from "@/components/app/line-items";
import { FormActions, InfoStrip, Loading, Screen } from "@/components/app/screen";
import { money } from "@/lib/format";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "eft", label: "EFT" },
  { value: "credit", label: "Later" },
];

/** "New sale": one or more stock items, paid now or later. */
export function SellForm() {
  const { snapshot, check, sheet } = useConfirmedAction();
  const { preview } = useBooks();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const basket = useLineItems(rows);
  if (!snapshot) return <Loading />;

  const { priced, unpriced, total } = basket;
  const paidNow = method !== null && method !== "credit";
  // Receipts are for sales paid now; a pay-later sale is what an invoice is for.
  const sendTo = paidNow ? email.trim() : "";
  const badEmail = sendTo !== "" && !isEmail(sendTo);
  const missing = !priced.length
    ? "Choose what you sold"
    : unpriced
      ? `Type the price for ${unpriced.item.name}`
      : !method
        ? "Choose how they paid"
        : method === "credit" && !customer.trim()
          ? "Say who will pay later"
          : badEmail
            ? "Check the email address"
            : null;

  const cmd: Command | null =
    priced.length && !unpriced
      ? {
          kind: "sale",
          id: "sale-preview",
          date: snapshot.today,
          paidWith: method ?? "cash",
          lines: basket.saleLines(),
          ...(customer.trim() ? { customer: customer.trim() } : method === "credit" ? { customer: "Customer" } : {}),
        }
      : null;
  const p = cmd ? preview(cmd) : null;
  const cost = p?.ok ? effectOn(p.result.entry, ACC.costOfSales) : 0;
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
      title="New sale"
      back="/"
      width="form"
      footer={
        <FormActions
          hint={missing}
          cancelHref="/"
          label="Review sale"
          disabled={!!missing}
          onClick={() =>
            cmd &&
            !missing &&
            check(
              { ...cmd, id: newId() } as Command,
              sendTo
                ? {
                    saveLabel: "Save and send receipt",
                    // Sending isn't built yet: show what it will look like, and say so.
                    toast: { title: "Receipt sent", description: `To ${sendTo}. Email is coming soon: nothing was sent yet.` },
                  }
                : {},
            )
          }
        />
      }
    >
      {priced.length > 0 && <BasketTotal basket={basket} />}
      <BasketLines basket={basket} label="In this sale" emptyLabel="What did you sell?" />

      <Chips label="Paid with" options={METHODS} value={method} onChange={setMethod} columns={4} />
      {method === "credit" && <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />}
      {paidNow && <TextInput label="Email a receipt" type="email" value={email} onChange={setEmail} placeholder="name@example.co.za" hint="Optional. Leave it empty if they don't want one." />}

      {priced.length > 0 && <BasketProfit basket={basket} cost={cost} noun="sale" />}
      {priced.length > 0 && moneyNote && <InfoStrip icon={Wallet}>{moneyNote}</InfoStrip>}
      {sheet}
    </Screen>
  );
}
