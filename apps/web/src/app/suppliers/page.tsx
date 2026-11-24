"use client";

import { useConfirmedAction } from "@/components/app/confirm";
import { Loading, Screen } from "@/components/app/screen";
import { useSupplierPayForm } from "@/components/app/supplier-pay";
import type { BooksSnapshot } from "@/books/store";
import type { Command } from "@app/ledger";

export default function SuppliersPage() {
  const { snapshot, check, sheet } = useConfirmedAction();
  if (!snapshot) return <Loading />;
  return <SupplierScreen snapshot={snapshot} check={check} sheet={sheet} />;
}

function SupplierScreen({ snapshot, check, sheet }: { snapshot: BooksSnapshot; check: (cmd: Command) => void; sheet: React.ReactNode }) {
  const { body, footer } = useSupplierPayForm(snapshot, check);
  return (
    <Screen title="Pay a supplier" back="/" width="form" footer={footer}>
      <p className="-mt-1 px-1 text-[15px] leading-[1.45] text-ink-muted">Suppliers you bought from on &quot;pay later&quot;, and what you still owe them.</p>
      {body}
      {sheet}
    </Screen>
  );
}
