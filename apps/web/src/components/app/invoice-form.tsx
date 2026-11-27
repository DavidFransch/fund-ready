"use client";

import { ACC, type Command } from "@app/ledger";
import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { effectOn, invoiceText, whatsAppLink } from "@/books/describe";
import { BUSINESS } from "@/books/seed";
import { newId } from "@/books/ids";
import { nextInvoiceNumber, stockRows } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { useConfirmedAction } from "@/components/app/confirm";
import { isEmail, TextInput } from "@/components/app/inputs";
import { BasketLines, BasketProfit, BasketTotal, useLineItems } from "@/components/app/line-items";
import { FormActions, InfoStrip, Loading, Screen } from "@/components/app/screen";

/** An invoice for a customer who pays later, with one line per stock item. */
export function InvoiceForm() {
  const { snapshot, check, sheet } = useConfirmedAction();
  const { preview } = useBooks();
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const rows = useMemo(() => (snapshot ? stockRows(snapshot) : []), [snapshot]);
  const basket = useLineItems(rows);
  if (!snapshot) return <Loading />;
  const invoiceNumber = nextInvoiceNumber(snapshot);

  const { priced, unpriced, overStock } = basket;
  const sendTo = email.trim();
  const badEmail = sendTo !== "" && !isEmail(sendTo);
  const missing = !priced.length
    ? "Add what you are invoicing"
    : unpriced
      ? `Type the price for ${unpriced.item.name}`
      : overStock
        ? `Only ${overStock.item.qty} ${overStock.item.name} in stock`
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
              {
                whatsApp: whatsAppLink(phone, invoiceText(cmd, BUSINESS.name)),
                ...(sendTo
                  ? {
                    saveLabel: "Save and send invoice",
                    // Sending isn't built yet: show what it will look like, and say so.
                    toast: { title: `Invoice ${invoiceNumber} sent`, description: `To ${sendTo}. Email is coming soon: nothing was sent yet.` },
                    }
                  : {}),
              },
            )
          }
        />
      }
    >
      <TextInput label="Who will pay?" value={customer} onChange={setCustomer} placeholder="Customer name" />
      <TextInput label="WhatsApp number" type="tel" value={phone} onChange={setPhone} placeholder="e.g. 082 123 4567" hint="Optional. Leave it empty to pick the chat in WhatsApp." />
      <TextInput label="Customer email" type="email" value={email} onChange={setEmail} placeholder="name@example.co.za" hint="Optional. We'll email them the invoice." />

      {priced.length > 0 && <BasketTotal basket={basket} />}
      <BasketLines basket={basket} label="On this invoice" emptyLabel="What are you invoicing?" />
      {priced.length > 0 && <BasketProfit basket={basket} cost={cost} noun="invoice" />}
      {priced.length > 0 && <InfoStrip icon={Wallet}>Added to what {customer.trim() || "the customer"} owes you</InfoStrip>}
      {sheet}
    </Screen>
  );
}
