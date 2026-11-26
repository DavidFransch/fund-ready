"use client";

import { FreshOnEachVisit } from "@/components/app/fresh";
import { PayForm } from "@/components/app/pay-form";

export default function BuyStockPage() {
  return (
    <FreshOnEachVisit>
      <PayForm initialMode="stock" />
    </FreshOnEachVisit>
  );
}
