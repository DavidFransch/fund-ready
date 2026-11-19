# Technical plan — MSME books and compliance app (working name)

Status: prototype for Adrian to test, then the Fetola pitch (before end of December 2026).
Owners: David Fransch and Adrian Quina.
Product name: not chosen yet. Code uses the neutral scope `@app`.

## 1. What we are building

A mobile-first app that replaces four separate tools (expenses, daybook, invoices, stock) for micro businesses under R1m turnover, and turns everyday actions into proper books, a monthly P&L and a compliance scorecard. A desktop view lets a funder's account manager see their whole programme.

Prototype scope:

| Real | Seeded | Scripted or left out |
|---|---|---|
| Login with demo roles (owner, accountant, funder) | 3–4 demo businesses with 3 months of history | Voice capture (later) |
| Double-entry ledger behind every screen | One funder programme | SMS login (before pilot) |
| Sales, expenses, invoices and quotes, stock, cash box, stock counts | Budgets | Sending the P&L to Fetola (button only) |
| Compliance scorecard (4 basics + funder extras) | | Accountant hand-off (button only) |
| Monthly report, budget vs actual, P&L, balance sheet | | VAT returns, payroll, bank feeds, SARS |
| Funder programme view from the same data | | |
| Slip reading with Claude (user confirms) | | |

## 2. Stack

| Layer | Choice |
|---|---|
| Front end | Next.js (App Router), React, TypeScript, installable web app |
| Styling | Tailwind CSS v4 (tokens in one CSS file), shadcn/ui on Radix, lucide-react, sonner |
| Fonts | next/font (Atkinson Hyperlegible for body, Bricolage Grotesque for headings) |
| Database | Postgres 16 on Cloud SQL, Johannesburg (`africa-south1`) |
| Database toolkit | Drizzle ORM and drizzle-kit migrations |
| Login | Better Auth (library inside the app; users stored in our Postgres) |
| Files | Cloud Storage (slips, documents) behind a storage wrapper |
| AI | Claude for slip reading (Anthropic API; check Vertex AI billing later) |
| Analytics | PostHog, EU region |
| Hosting | Cloud Run (Docker, Next.js standalone output) |
| Deploys | Cloud Build triggers: `develop` → dev, `main` → production |
| Tests | Vitest (ledger core is the priority) |
| Repo | pnpm workspaces + Turborepo |

Portability rules (so we can move to AWS or anywhere later):
- Plain Postgres only. No vendor-specific database features.
- Everything runs in one Docker image.
- File storage only through `packages/storage` (one file to swap for S3).
- Login lives in our database, not with a vendor.

## 3. Repo layout

```
apps/web          Next.js: entrepreneur app, funder view, API routes
packages/ledger   accounting core: pure TypeScript, no framework, heavily tested
packages/db       Drizzle schema, migrations, seed
docs/             this plan, analytics events, chart of accounts, decisions
infra/            GCP setup script, Cloud Build config
```

## 4. Accounting rules (non-negotiable, even in the prototype)

1. **Double entry.** Every user action posts a journal entry whose debits equal credits. Reports are calculated from the ledger, never stored.
2. **Money in whole cents** (integers). One money module, used everywhere. Currency ZAR.
3. **Append-only.** Entries are never edited or deleted. Corrections are reversing entries. Every entry records who made it and from which source (sale, slip, stock count…).
4. **Stock as movements.** Every in, out and count adjustment is a movement. Valuation: weighted average cost. Items are either `stock` or `service`; services never touch stock.
5. **Hidden chart of accounts.** Users see plain categories; each maps to an account code (see `docs/chart-of-accounts.md`).
6. **Period locking.** A month can be closed; closed months reject new entries (corrections go into the open month).
7. **Accountant exports.** Trial balance and general ledger export (CSV), later in Xero/Sage import format.
8. **Idempotency.** Every command carries a client-generated id so offline retries never double-post.

## 5. How user actions post (examples)

| Action | Debit | Credit |
|---|---|---|
| Cash sale R200 | Cash box | Sales |
| Sale on credit R1 800 | Debtors | Sales |
| Customer pays R1 800 by EFT | Bank | Debtors |
| Invoice with stock items | Debtors; Cost of sales | Sales; Stock |
| Stock bought with cash box | Stock | Cash box |
| Expense paid from own pocket | Expense account | Owner loan |
| Stock count shows 2 missing | Stock loss | Stock |

## 6. Multi-business and roles

- Every business-owned row carries `business_id`. All queries go through one data-access layer that requires a business context.
- Roles per business: `owner`, `accountant`, `funder_viewer`.
- A funder sees a business only when the business has granted its programme access (consent recorded).
- Row-level security in Postgres added before real users.

## 7. Environments and hosting

| | Dev | Production |
|---|---|---|
| Branch | `develop` | `main` |
| Cloud Run service | `app-dev` (scales to zero) | `app-prod` (min 1 instance during pitch weeks) |
| Database | `books_dev` | `books_prod` |
| Bucket | `<project>-files-dev` | `<project>-files-prod` |

One Cloud SQL instance (`db-f1-micro` or `db-g1-small`) holds both databases to keep cost low. Billing alerts at $50 and $150.

Deploy pipeline: push → Cloud Build → build image → run migrations (Cloud Run job) → deploy service.

## 8. Analytics (PostHog)

- EU region. Identify after login, reset on logout.
- Events named `object_action` (e.g. `sale_recorded`, `slip_scanned`, `stock_counted`). List kept in `docs/analytics-events.md`.
- Session replay masks **all text**, not just inputs (screens show balances and names).
- Never send amounts, names or slip contents as event properties.

## 9. Data protection (POPIA)

- Data stored in Johannesburg.
- Demo data only until a lawyer has checked our POPIA position, consent wording and funder data-sharing terms.
- Slip images and documents are private objects, served through short-lived signed links.

## 10. Build order

1. Repo, ledger core and tests.
2. Database schema, migrations, demo seed.
3. GCP setup script, Dockerfile, Cloud Build.
4. Login and roles.
5. Entrepreneur screens from the canvas, wired to the ledger.
6. Funder view.
7. Slip reading, PostHog, polish for Adrian's testing.

## 11. Open decisions

- Product name.
- Company that owns the IP (David and Adrian jointly).
- SMS provider for phone login (before pilot).
- Whether Claude via Vertex AI can bill to GCP credits.
