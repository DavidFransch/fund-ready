import { LedgerError } from "./errors";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

/** Where an account appears on the income statement. */
export type AccountGroup = "revenue" | "cost_of_sales" | "operating_expense";

export interface Account {
  code: string;
  /** Formal name, as an accountant would see it. */
  name: string;
  /** Plain-language name shown to the entrepreneur. */
  plainName: string;
  type: AccountType;
  group?: AccountGroup;
}

/** Named account codes so code never uses magic strings. */
export const ACC = {
  bank: "1000",
  cashBox: "1010",
  debtors: "1100",
  stock: "1200",
  creditors: "2000",
  ownerLoan: "2100",
  capital: "3000",
  retainedEarnings: "3100",
  drawings: "3200",
  sales: "4000",
  otherIncome: "4100",
  costOfSales: "5000",
  stockAdjustments: "5100",
  wages: "6000",
  rent: "6100",
  transport: "6200",
  utilities: "6300",
  phoneData: "6400",
  bankCharges: "6500",
  packaging: "6600",
  consumables: "6700",
  otherExpenses: "6900",
} as const;

export type AccountCode = (typeof ACC)[keyof typeof ACC];

/** Default chart of accounts for a South African micro business (not VAT registered). */
export const CHART: readonly Account[] = [
  { code: ACC.bank, name: "Bank", plainName: "Bank", type: "asset" },
  { code: ACC.cashBox, name: "Cash on hand", plainName: "Cash box", type: "asset" },
  { code: ACC.debtors, name: "Trade debtors", plainName: "Money owed to you", type: "asset" },
  { code: ACC.stock, name: "Inventory", plainName: "Stock", type: "asset" },
  { code: ACC.creditors, name: "Trade creditors", plainName: "Money you owe suppliers", type: "liability" },
  { code: ACC.ownerLoan, name: "Shareholder loan", plainName: "Money the business owes you", type: "liability" },
  { code: ACC.capital, name: "Owner's capital", plainName: "Money you put in", type: "equity" },
  { code: ACC.retainedEarnings, name: "Retained earnings", plainName: "Profit kept from past years", type: "equity" },
  { code: ACC.drawings, name: "Owner's drawings", plainName: "Money you took out", type: "equity" },
  { code: ACC.sales, name: "Revenue", plainName: "Sales", type: "income", group: "revenue" },
  { code: ACC.otherIncome, name: "Other income", plainName: "Other money in", type: "income", group: "revenue" },
  { code: ACC.costOfSales, name: "Cost of sales", plainName: "Cost of what you sold", type: "expense", group: "cost_of_sales" },
  { code: ACC.stockAdjustments, name: "Stock losses and adjustments", plainName: "Stock lost or found", type: "expense", group: "cost_of_sales" },
  { code: ACC.wages, name: "Salaries and wages", plainName: "Wages", type: "expense", group: "operating_expense" },
  { code: ACC.rent, name: "Rent", plainName: "Rent", type: "expense", group: "operating_expense" },
  { code: ACC.transport, name: "Transport and fuel", plainName: "Transport", type: "expense", group: "operating_expense" },
  { code: ACC.utilities, name: "Electricity and water", plainName: "Electricity and water", type: "expense", group: "operating_expense" },
  { code: ACC.phoneData, name: "Telephone and data", plainName: "Airtime and data", type: "expense", group: "operating_expense" },
  { code: ACC.bankCharges, name: "Bank charges", plainName: "Bank fees", type: "expense", group: "operating_expense" },
  { code: ACC.packaging, name: "Packaging materials", plainName: "Packaging", type: "expense", group: "operating_expense" },
  { code: ACC.consumables, name: "Consumables and office supplies", plainName: "Shop supplies", type: "expense", group: "operating_expense" },
  { code: ACC.otherExpenses, name: "Sundry expenses", plainName: "Other", type: "expense", group: "operating_expense" },
];

const BY_CODE = new Map(CHART.map((a) => [a.code, a]));

export function getAccount(code: string): Account {
  const account = BY_CODE.get(code);
  if (!account) throw new LedgerError(`Unknown account code ${code}`);
  return account;
}

export function isAccountCode(code: string): code is AccountCode {
  return BY_CODE.has(code);
}

/** Assets and expenses grow with debits; the rest grow with credits. */
export function isDebitNormal(type: AccountType): boolean {
  return type === "asset" || type === "expense";
}

/**
 * Plain-language expense categories shown on "I paid for something".
 * "stock" is not an expense: it goes onto the Stock asset until it is sold.
 */
export const EXPENSE_CATEGORIES = [
  { id: "stock", label: "Stock", account: ACC.stock },
  { id: "packaging", label: "Packaging", account: ACC.packaging },
  { id: "transport", label: "Transport", account: ACC.transport },
  { id: "rent", label: "Rent", account: ACC.rent },
  { id: "wages", label: "Wages", account: ACC.wages },
  { id: "electricity", label: "Electricity", account: ACC.utilities },
  { id: "data", label: "Airtime and data", account: ACC.phoneData },
  { id: "bank_fees", label: "Bank fees", account: ACC.bankCharges },
  { id: "shop_supplies", label: "Shop supplies", account: ACC.consumables },
  { id: "other", label: "Other", account: ACC.otherExpenses },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function expenseCategory(id: ExpenseCategoryId) {
  const category = EXPENSE_CATEGORIES.find((c) => c.id === id);
  if (!category) throw new LedgerError(`Unknown expense category ${id}`);
  return category;
}
