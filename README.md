# Books (working name)

Simple books and compliance for micro businesses, with a programme view for funders.
See [docs/technical-plan.md](docs/technical-plan.md) for the full plan.

## Layout

```
apps/web          Next.js app (entrepreneur app, funder view, API)
packages/ledger   accounting core — pure TypeScript, no framework, heavily tested
packages/db       Drizzle schema, migrations, database access, demo seed
infra/            GCP setup script and Cloud Build pipeline
docs/             plan and reference docs
```

## Fetola demo (browser only)

The demo at `/` runs entirely in the browser: no login, database or GCP. It runs the
`Book` from `@app/ledger` on the client, replays a deterministic sample business
(Mama Tee Spaza, Gugulethu, from the 1st of last month up to yesterday) and keeps
only the user's own commands in localStorage. Click-by-click script:
[docs/demo-script.md](docs/demo-script.md).

```bash
pnpm install
pnpm dev               # http://localhost:3000, no database needed
```

Code: `apps/web/src/books/` (store, sample business, selectors, plain-language
wording) and `apps/web/src/app/` (screens). Screens only use `useBooks()`, so the
store can later be replaced by server actions on `packages/db`.

What the demo simplifies:
- Every action is dated today; there is no back-dating and no undo or reversal screen.
- No month is closed, so period locking is not shown.
- Suppliers are matched by name for "money owed"; there are no supplier records.
- A sale is one item per action (the ledger supports more).
- Data lives in one browser. Use Reset demo to start over, or when moving device.
- The home card shows the last 7 days instead of the calendar week, so it is never
  empty on a Monday.

## Local development

Requirements: Node 22, pnpm 10, Postgres 16.

```bash
pnpm install
export DATABASE_URL=postgres://postgres@localhost:5432/books_dev
pnpm db:migrate        # apply migrations
pnpm db:seed           # four demo businesses with three months of history
pnpm dev               # http://localhost:3000
```

Checks:

```bash
pnpm test              # ledger and database tests (database tests use TEST_DATABASE_URL)
pnpm typecheck
pnpm build
```

## Accounting rules

The ledger package enforces these; the database enforces them again with triggers.

- Every action posts one balanced double-entry journal entry.
- Money is whole cents. Never decimals.
- History is append-only. Mistakes are corrected with reversing entries.
- Closed months reject new entries.
- Every command has a client-generated id, so retries never double-post.
- Stock is tracked as movements at weighted average cost; the stock records always equal the Stock account.

## Deploying (Google Cloud)

- `develop` branch → dev environment, `main` → production.
- Each push: Cloud Build builds the image, runs migrations as a Cloud Run job, then deploys.
- One-time setup: `infra/setup-gcp.sh` (see the header of that file).
