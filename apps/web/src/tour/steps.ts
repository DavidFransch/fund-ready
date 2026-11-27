import type { Command } from "@app/ledger";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Screen the step happens on; null for the closing card, which works anywhere. */
  route: string | null;
  /** Name for the "Go to …" button when the user is somewhere else. */
  screen: string;
  /** `data-tour` value of the element to highlight. */
  target?: string;
  /** A saved command that completes this step and moves the tour on. */
  done?: (cmd: Command) => boolean;
  /** Move on as soon as this `data-tour` element appears (e.g. the Check and save sheet opens). */
  nextWhenVisible?: string;
  /** Only when this feature switch is on. */
  when?: "bankImport";
}

/** The Fetola story from docs/demo-script.md. */
export const STEPS: TourStep[] = [
  { id: "welcome", route: "/", screen: "Home", target: "home-welcome", title: "Welcome", body: "Meet Mama Tee Spaza in Gugulethu. Thandeka records her day in plain words. Every tap becomes proper books." },
  { id: "balance", route: "/", screen: "Home", target: "home-balance", title: "Cash and bank", body: "Cash in the box and money in the bank, always up to date." },
  { id: "owed", route: "/", screen: "Home", target: "home-owed", title: "Who owes what", body: "What customers owe her and what she owes suppliers, worked out for her." },
  {
    id: "buy",
    route: "/pay",
    screen: "Buy stock",
    target: "buy-stock",
    nextWhenVisible: "books-panel",
    title: "Buy stock, pay later",
    body: "She buys 8 Cooldrinks from her supplier and will pay later. Set quantity to 8 and choose Pay later.",
  },
  {
    id: "books-panel",
    route: "/pay",
    screen: "Buy stock",
    target: "books-panel",
    done: (c) => c.kind === "expense" && c.category === "stock",
    title: "Check and save",
    body: "Before saving, the app shows the accounting entry it creates. She never needs to read it. Her accountant can.",
  },
  { id: "sale", route: "/sell", screen: "New sale", target: "sale", done: (c) => c.kind === "sale", title: "Make a sale", body: "She sells 2 at the list price, for cash. See her profit on this sale." },
  { id: "expense", route: "/expense", screen: "Expense", target: "expense", done: (c) => c.kind === "expense" && c.category === "packaging", title: "An expense", body: "Carrier bags for R85 from petty cash. Packaging gets its own line." },
  {
    id: "count",
    route: "/stock/count",
    screen: "Count stock",
    target: "count",
    done: (c) => c.kind === "stock_count",
    title: "Count the stock",
    body: "Two bottles are missing. Count 8 and keep 'Lost or stolen'. The loss is recorded, so profit stays honest.",
  },
  { id: "petty-cash", route: "/petty-cash", screen: "Petty cash", target: "petty-cash", title: "Petty cash", body: "Every rand in and out of the cash box, with a running balance." },
  { id: "reports", route: "/reports", screen: "Reports", target: "reports", title: "Reports", body: "Sales, costs and profit by day, week or month, including the stolen stock." },
  { id: "journal", route: "/accountant", screen: "Books", target: "books-journal", title: "The journal", body: "Everything she just did, as real double-entry bookkeeping. Debits equal credits." },
  { id: "entry", route: "/accountant", screen: "Books", target: "books-entry", title: "No editing history", body: "History can't be edited. Mistakes are reversed, the way an accountant expects." },
  { id: "tb", route: "/accountant", screen: "Books", target: "books-tb", title: "Trial balance", body: "The trial balance balances and the stock records tie to the stock account." },
  {
    id: "bank",
    route: "/bank",
    screen: "Bank statement",
    target: "bank",
    when: "bankImport",
    title: "Bank statement (preview)",
    body: "Coming in the pilot: upload a bank statement from any bank and the app matches it to her records.",
  },
  { id: "end", route: null, screen: "Home", title: "That's the day", body: "That's the day. One app instead of four tools, and books an accountant can trust." },
];

/** The steps for the current switches. */
export function tourSteps(bankImport: boolean): TourStep[] {
  return STEPS.filter((s) => !s.when || bankImport);
}

/** Where a newly saved command takes the tour: past the first step (from `from`, within two) that it completes. */
export function stepAfter(steps: TourStep[], from: number, cmd: Command): number | null {
  for (let i = from; i < Math.min(steps.length, from + 3); i++) {
    if (steps[i]!.done?.(cmd)) return i + 1;
  }
  return null;
}
