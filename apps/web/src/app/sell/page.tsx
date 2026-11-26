"use client";

import { FreshOnEachVisit } from "@/components/app/fresh";
import { SellForm } from "@/components/app/sell-form";

export default function SellPage() {
  return (
    <FreshOnEachVisit>
      <SellForm />
    </FreshOnEachVisit>
  );
}
