"use client";

import { ACC, type Command } from "@app/ledger";
import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { effectOn } from "@/books/describe";
import { newId } from "@/books/ids";
import { stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { TextInput } from "@/components/app/inputs";
import { BasketLines, BasketProfit, BasketTotal, useLineItems } from "@/components/app/line-items";
import { FormActions, InfoStrip, Loading, Screen } from "@/components/app/screen";

/** An invoice for a customer who pays later, with one line per stock item. */
export function InvoiceForm() {
  const { snapshot, check, sheet } = useConfirmedAction();
  const { preview } = useBooks();
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const basket = useLineItems(rows);
  const invoiceNumber = useMemo(() => {
    const n = snapshot?.commands.filter((c) => c.kind === "sale" && c.invoiceNumber).length ?? 0;
    return `INV-${String(n + 1).padStart(4, "0")}`;
  }, [snapshot]);
  if (!snapshot) return <Loading />;

  const { priced, unpriced } = basket;
  const sendTo = email.trim();
  const badEmail = sendTo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendTo);
  const missing = !priced.length
    ? "Add what you are invoicing"
    : unpriced
      ? `Type the price for ${unpriced.item.name}`
      : !customer.trim()
        ? "Say who will pay"
        : badEmail
          ? "Check the email address"
          : null;

  const cmd: Command | null =
    priced.length && !unpriced
      ? {
          kind: "sale",
          id: "invoice-preview",
          date: snapshot.today,
          paidWith: "credit",
          lines: basket.saleLines(),
          customer: customer.trim() || "Customer",
          invoiceNumber,
        }
      : null;
  const p = cmd ? preview(cmd) : null;
  const cost = p?.ok ? effectOn(p.result.entry, ACC.costOfSales) : 0;

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
          onClick={() =>
            cmd &&
            !missing &&
            check(
              { ...cmd, id: newId() } as Command,
              sendTo
                ? {
                    saveLabel: "Save and send invoice",
                    // Sending isn't built yet: show what it will look like, and say so.
                    toast: { title: `Invoice ${invoiceNumber} sent`, description: `To ${sendTo}. Email is coming soon: nothing was sent yet.` },
                  }
                : {},
            )
          }
        />
      }
    >
      <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />
      <TextInput label="Customer email" type="email" value={email} onChange={setEmail} placeholder="name@example.co.za" hint="Optional. We'll email them the invoice." />

      {priced.length > 0 && <BasketTotal basket={basket} />}
      <BasketLines basket={basket} label="On this invoice" emptyLabel="What are you invoicing?" />
      {priced.length > 0 && <BasketProfit basket={basket} cost={cost} noun="invoice" />}
      {priced.length > 0 && <InfoStrip icon={Wallet}>Added to what {customer.trim() || "the customer"} owes you</InfoStrip>}
      {sheet}
    </Screen>
  );
}
