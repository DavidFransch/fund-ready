import type { Command } from "@app/ledger";

export interface TourStep {
  id: string;
  /** One or two short sentences. `**word**` is shown bold (the thing to tap). */
  body: string;
  /** Screen the step happens on; null for the closing card, which works anywhere. */
  route: string | null;
  /** `data-tour` value(s) of the element(s) to spotlight; several are lit as one box. */
  target?: string | string[];
  /** Tapping the target moves on (the tap still does its normal job, e.g. opens the screen). */
  advance?: "click";
  /** Move on as soon as an element matching this selector is on screen. */
  nextWhen?: string;
  /** A saved command that completes this step and moves the tour on. */
  done?: (cmd: Command) => boolean;
  /** Only when this feature switch is on. */
  when?: "bankImport";
}

/** A short tour of one sale, from Home to the accountant's books. */
export const STEPS: TourStep[] = [
  { id: "balance", route: "/", target: "home-balance", body: "Your cash and bank, always up to date." },
  { id: "sell", route: "/", target: "home-sell", advance: "click", body: "Let's record a sale. Tap **Sell**." },
  { id: "items", route: "/sell", target: "sale-items", nextWhen: '[data-tour="form-save"]:not(:disabled)', body: "Pick what you sold, like Cooldrink 2L." },
  { id: "review", route: "/sell", target: "form-save", nextWhen: '[data-tour="books-panel"]', body: "Set how many, then tap **Review sale**." },
  {
    id: "save",
    route: "/sell",
    target: ["books-panel", "sheet-save"],
    done: (c) => c.kind === "sale",
    body: "This is the bookkeeping entry it creates. Your stock went down by 2 too. You never need to read the entry. Your accountant can. Tap **Save**.",
  },
  { id: "books", route: "/", target: "nav-books", advance: "click", body: "Your accountant sees everything in **Books**. Tap it." },
  { id: "journal", route: "/accountant", target: "books-journal", body: "Every tap becomes double-entry books. Debits always equal credits." },
  { id: "bank", route: "/bank", target: "bank", when: "bankImport", body: "Coming soon: match a bank statement to your records." },
  { id: "end", route: null, body: "That's it. Try Buy stock, Expense or Count on your own." },
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

/** Every `data-tour` name the steps point at. */
export function targetNames(steps: TourStep[]): string[] {
  return steps.flatMap((s) => (s.target === undefined ? [] : Array.isArray(s.target) ? s.target : [s.target]));
}
