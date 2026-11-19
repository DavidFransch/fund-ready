import { addDays, addMonths, monthOf, type IsoDate, type IsoMonth } from "./dates";

/**
 * Compliance scorecard, per Adrian's definition of a compliant company:
 * accounting up to date, tax returns submitted, CIPC annual returns submitted,
 * annual financial statements prepared. Funder extras are tracked separately
 * because only some funders ask for them.
 */

export interface ComplianceInput {
  today: IsoDate;
  /** Distinct days on which anything was recorded. */
  recordedDays: readonly IsoDate[];
  /** Latest month the books are closed for. */
  closedThrough?: IsoMonth;
  taxReturnsUpToDate: boolean;
  cipcAnnualReturnFiled: boolean;
  cipcNextDue?: IsoDate;
  annualFinancialStatementsPrepared: boolean;
}

export type ComplianceItemId = "accounting" | "tax" | "cipc" | "afs";

export interface ComplianceItem {
  id: ComplianceItemId;
  label: string;
  done: boolean;
  /** Filled in by us from the books, rather than ticked by the user. */
  automatic: boolean;
  detail: string;
}

export function recordedInLast(days: number, today: IsoDate, recordedDays: readonly IsoDate[]): number {
  const from = addDays(today, -(days - 1));
  return new Set(recordedDays.filter((d) => d >= from && d <= today)).size;
}

export function complianceScorecard(input: ComplianceInput) {
  const previousMonth = addMonths(monthOf(input.today), -1);
  const recent = recordedInLast(28, input.today, input.recordedDays);
  const booksClosed = !!input.closedThrough && input.closedThrough >= previousMonth;

  const items: ComplianceItem[] = [
    {
      id: "accounting",
      label: "Accounting up to date",
      done: booksClosed,
      automatic: true,
      detail: booksClosed
        ? `Recorded ${recent} of the last 28 days · books closed to ${input.closedThrough}`
        : `Last month is not closed yet · recorded ${recent} of the last 28 days`,
    },
    {
      id: "tax",
      label: "Tax returns submitted",
      done: input.taxReturnsUpToDate,
      automatic: false,
      detail: input.taxReturnsUpToDate ? "Up to date" : "Outstanding",
    },
    {
      id: "cipc",
      label: "CIPC annual return submitted",
      done: input.cipcAnnualReturnFiled,
      automatic: false,
      detail: input.cipcNextDue ? `Next one due ${input.cipcNextDue}` : input.cipcAnnualReturnFiled ? "Filed" : "Outstanding",
    },
    {
      id: "afs",
      label: "Annual financial statements",
      done: input.annualFinancialStatementsPrepared,
      automatic: false,
      detail: input.annualFinancialStatementsPrepared
        ? "Prepared"
        : "An accountant signs these off. Your year's books are ready for them.",
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, compliant: done === items.length };
}
