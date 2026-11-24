"use client";

import type { Command } from "@app/ledger";
import { positions } from "@app/ledger";
import { useState } from "react";
import { newId } from "@/books/ids";
import { suppliers } from "@/books/selectors";
import type { BooksSnapshot } from "@/books/store";
import { money } from "@/lib/format";
import { centsToText, ChoiceTiles, MoneyInput, parseRand } from "./inputs";
import { FormActions, Panel } from "./screen";

/** Pay a supplier what you owe them, from petty cash or the bank. Returns the form body and its footer button. */
export function useSupplierPayForm(snapshot: BooksSnapshot, onCheck: (cmd: Command) => void) {
  const owed = suppliers(snapshot);
  const pos = positions(snapshot.book.entries);
  const [supplier, setSupplier] = useState<string | null>(owed[0]?.supplier ?? null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [from, setFrom] = useState<"cash" | "bank" | null>(null);
  const balance = owed.find((o) => o.supplier === supplier)?.amount ?? 0;
  const shown = amountText ?? (balance ? centsToText(balance) : "");
  const amount = parseRand(shown);
  const missing = !owed.length ? "Nothing to pay" : !supplier ? "Choose who you are paying" : !amount ? "Type how much you are paying" : !from ? "Choose where the money comes from" : null;

  const body = !owed.length ? (
    <Panel className="px-4 py-5 text-center text-[15px] text-ink-muted">You don&apos;t owe any suppliers right now.</Panel>
  ) : (
    <>
      <ChoiceTiles
        label="Who are you paying?"
        options={owed.map((o) => ({ value: o.supplier, label: o.supplier, hint: `You owe ${money(o.amount)}` }))}
        value={supplier}
        onChange={(v) => {
          setSupplier(v);
          setAmountText(null);
        }}
      />
      <MoneyInput label="How much" value={shown} onChange={setAmountText} />
      <ChoiceTiles
        label="Where does the money come from?"
        options={[
          { value: "cash", label: "Petty cash", hint: `${money(pos.cashBox)} available` },
          { value: "bank", label: "Bank", hint: `${money(pos.bank)} available` },
        ]}
        value={from}
        onChange={setFrom}
      />
    </>
  );
  const footer = (
    <FormActions
      hint={owed.length > 0 ? missing : null}
      cancelHref="/"
      label="Review payment"
      disabled={!!missing}
      onClick={() => supplier && amount && from && onCheck({ kind: "payment_made", id: newId(), date: snapshot.today, amount, from, supplier })}
    />
  );
  return { body, footer };
}
