import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/**
 * Money columns are whole cents in bigint (read as JS numbers; safe to R90 trillion).
 * Every business-owned row carries business_id. Journal tables are append-only
 * (enforced by triggers in the first migration).
 */
const cents = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const businessRole = pgEnum("business_role", ["owner", "accountant"]);
export const programmeRole = pgEnum("programme_role", ["manager", "viewer"]);
export const itemKind = pgEnum("item_kind", ["stock", "non_stock"]);
export const movementType = pgEnum("movement_type", ["opening", "purchase", "sale", "count_adjustment"]);
export const documentKind = pgEnum("document_kind", ["slip", "invoice_pdf", "compliance", "other"]);
export const invoiceType = pgEnum("invoice_type", ["quote", "invoice"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "accepted", "paid", "cancelled"]);

// ── Businesses and access ────────────────────────────────────────────────────

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number"),
  area: text("area"),
  sector: text("sector"),
  /** Month the financial year ends, 1–12 (South African companies often use 2). */
  yearEndMonth: integer("year_end_month").notNull().default(2),
  /** Latest closed month, "YYYY-MM". Entries dated in or before it are rejected. */
  closedThrough: text("closed_through"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: businessRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

export const programmes = pgTable("programmes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  funderName: text("funder_name").notNull(),
  createdAt: createdAt(),
});

export const programmeMembers = pgTable(
  "programme_members",
  {
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: programmeRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.programmeId, t.userId] })],
);

/** A funder sees a business only after the business has agreed to share with the programme. */
export const programmeBusinesses = pgTable(
  "programme_businesses",
  {
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    consentedBy: text("consented_by").references(() => user.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.programmeId, t.businessId] })],
);

// ── Catalogue ───────────────────────────────────────────────────────────────

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: itemKind("kind").notNull(),
    unit: text("unit").notNull(),
    salePrice: cents("sale_price_cents").notNull().default(0),
    reorderLevel: integer("reorder_level"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("items_business_idx").on(t.businessId)],
);

// ── Commands, journal and stock ─────────────────────────────────────────────

/** Every user action, stored once. Its id is the idempotency key and the journal entry id. */
export const commands = pgTable(
  "commands",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("commands_business_idx").on(t.businessId)],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    date: date("date", { mode: "string" }).notNull(),
    memo: text("memo").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref"),
    reverses: uuid("reverses"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("journal_entries_business_date_idx").on(t.businessId, t.date),
    uniqueIndex("journal_entries_one_reversal_idx").on(t.reverses),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    accountCode: text("account_code").notNull(),
    debit: cents("debit_cents").notNull().default(0),
    credit: cents("credit_cents").notNull().default(0),
    memo: text("memo"),
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.entryId),
    index("journal_lines_business_account_idx").on(t.businessId, t.accountCode),
    check("journal_lines_one_side", sql`${t.debit} >= 0 and ${t.credit} >= 0 and ((${t.debit} = 0) <> (${t.credit} = 0))`),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    entryId: uuid("entry_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    type: movementType("type").notNull(),
    qty: integer("qty").notNull(),
    cost: cents("cost_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_business_item_idx").on(t.businessId, t.itemId, t.date)],
);

// ── Invoices and quotes ─────────────────────────────────────────────────────

export interface InvoiceLine {
  itemId?: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    type: invoiceType("type").notNull(),
    number: text("number").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull(),
    total: cents("total_cents").notNull(),
    /** Set when an invoice is issued and posted to the books. Quotes never post. */
    entryId: uuid("entry_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invoices_business_number_idx").on(t.businessId, t.type, t.number)],
);

// ── Documents (slips and paperwork) ─────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    kind: documentKind("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** What slip reading found, kept for audit even after the user corrects it. */
    extracted: jsonb("extracted"),
    entryId: uuid("entry_id"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("documents_business_idx").on(t.businessId)],
);

// ── Budgets and compliance ──────────────────────────────────────────────────

/** Monthly budget per account. */
export const budgets = pgTable(
  "budgets",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    accountCode: text("account_code").notNull(),
    amount: cents("amount_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.accountCode] })],
);

export const complianceRecords = pgTable("compliance_records", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  taxReturnsUpToDate: boolean("tax_returns_up_to_date").notNull().default(false),
  cipcAnnualReturnFiled: boolean("cipc_annual_return_filed").notNull().default(false),
  cipcNextDue: date("cipc_next_due", { mode: "string" }),
  afsPrepared: boolean("afs_prepared").notNull().default(false),
  /** Funder extras: forecast, business plan, quotes. */
  extras: jsonb("extras").$type<Record<string, "not_started" | "draft" | "done">>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
