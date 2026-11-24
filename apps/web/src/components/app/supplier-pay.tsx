"use client";

import { useState } from "react";
import { newId } from "@/books/ids";
import { suppliers } from "@/books/selectors";
import type { BooksSnapshot } from "@/books/store";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { Card } from "./screen";
import { centsToText, Choices, MoneyInput, parseRand } from "./inputs";
import type { Command } from "@app/ledger";

/** Pay a supplier what you owe them, from petty cash or the bank. */
export function SupplierPayForm({ snapshot, initial, onCheck }: { snapshot: BooksSnapshot; initial?: string; onCheck: (cmd: Command) => void }) {
  const owed = suppliers(snapshot);
  const [supplier, setSupplier] = useState<string | null>(initial ?? owed[0]?.supplier ?? null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [from, setFrom] = useState<"cash" | "bank" | null>(null);
  const balance = owed.find((o) => o.supplier === supplier)?.amount ?? 0;
  const shown = amountText ?? (balance ? centsToText(balance) : "");
  const amount = parseRand(shown);

  if (!owed.length) {
    return <Card className="text-[15px] text-ink-muted">You don&apos;t owe any suppliers right now.</Card>;
  }
  const missing = !supplier ? "Choose who you are paying" : !amount ? "Type how much you are paying" : !from ? "Choose where the money comes from" : null;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <Choices
          label="Who are you paying?"
          options={owed.map((o) => ({ value: o.supplier, label: o.supplier, hint: `you owe ${money(o.amount)}` }))}
          value={supplier}
          onChange={(v) => {
            setSupplier(v);
            setAmountText(null);
          }}
          columns={1}
        />
        <MoneyInput label="How much" value={shown} onChange={setAmountText} big />
        <Choices
          label="Where does the money come from?"
          options={[
            { value: "cash", label: "Petty cash" },
            { value: "bank", label: "Bank" },
          ]}
          value={from}
          onChange={setFrom}
          columns={2}
        />
      </Card>
      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        {missing && <p className="text-center text-sm text-ink-muted">{missing}</p>}
        <Button
          size="primary"
          disabled={!!missing}
          onClick={() => supplier && amount && from && onCheck({ kind: "payment_made", id: newId(), date: snapshot.today, amount, from, supplier })}
        >
          Check and save
        </Button>
      </div>
    </>
  );
}
