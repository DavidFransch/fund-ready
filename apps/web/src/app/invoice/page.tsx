"use client";

import { FreshOnEachVisit } from "@/components/app/fresh";
import { InvoiceForm } from "@/components/app/invoice-form";

export default function InvoicePage() {
  return (
    <FreshOnEachVisit>
      <InvoiceForm />
    </FreshOnEachVisit>
  );
}
