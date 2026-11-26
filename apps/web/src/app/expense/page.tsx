"use client";

import { FreshOnEachVisit } from "@/components/app/fresh";
import { PayForm } from "@/components/app/pay-form";

export default function ExpensePage() {
  return (
    <FreshOnEachVisit>
      <PayForm initialMode="other" />
    </FreshOnEachVisit>
  );
}
