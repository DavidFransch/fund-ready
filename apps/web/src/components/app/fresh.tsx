"use client";

import { Fragment, useLayoutEffect, useState } from "react";

/**
 * Next keeps visited pages mounted but hidden (React Activity) so going back is
 * instant, which also keeps whatever was typed into a form. Remount the form each
 * time its page is hidden, so every visit starts blank and a saved sale can't be
 * offered again.
 */
export function FreshOnEachVisit({ children }: { children: React.ReactNode }) {
  const [visit, setVisit] = useState(0);
  // Layout effects clean up when the page is hidden, before the next visit shows it.
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}
