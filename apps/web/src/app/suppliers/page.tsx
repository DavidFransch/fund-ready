"use client";

import { useConfirmedAction } from "@/components/app/confirm";
import { Loading, Screen } from "@/components/app/screen";
import { SupplierPayForm } from "@/components/app/supplier-pay";

export default function SuppliersPage() {
  const { snapshot, check, sheet } = useConfirmedAction();
  if (!snapshot) return <Loading />;
  return (
    <Screen title="Pay a supplier" back="/">
      <p className="-mt-1 text-[15px] leading-snug text-ink-muted">Suppliers you bought from on &quot;pay later&quot;, and what you still owe them.</p>
      <SupplierPayForm snapshot={snapshot} onCheck={check} />
      {sheet}
    </Screen>
  );
}
