#!/usr/bin/env bash
# One-time setup of the Google Cloud project. Safe to re-run: existing resources are skipped.
#
# Usage:
#   gcloud auth login
#   PROJECT_ID=my-books-app BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX \
#   GITHUB_OWNER=my-org GITHUB_REPO=books ./infra/setup-gcp.sh
#
# Creates: project, APIs, Artifact Registry, Cloud SQL (Postgres 16, Johannesburg) with dev
# and prod databases, storage buckets, service accounts, secrets, a billing budget and
# Cloud Build triggers (develop → dev, main → prod).

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${BILLING_ACCOUNT:?Set BILLING_ACCOUNT (gcloud billing accounts list)}"
: "${GITHUB_OWNER:?Set GITHUB_OWNER}"
: "${GITHUB_REPO:?Set GITHUB_REPO}"
REGION="${REGION:-africa-south1}"
SQL_INSTANCE="${SQL_INSTANCE:-books-db}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"
AR_REPO="${AR_REPO:-app}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-150}"
ENVS=(dev prod)

say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }
random_secret() { openssl rand -base64 32 | tr -d '\n'; }

say "Project ${PROJECT_ID}"
exists gcloud projects describe "$PROJECT_ID" || gcloud projects create "$PROJECT_ID" --name="Books app"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

say "Enabling APIs"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com storage.googleapis.com iam.googleapis.com \
  billingbudgets.googleapis.com

say "Artifact Registry"
exists gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" ||
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION"

say "Cloud SQL instance ${SQL_INSTANCE} (${SQL_TIER}, ${REGION}) — this takes a few minutes"
exists gcloud sql instances describe "$SQL_INSTANCE" ||
  gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=ENTERPRISE \
    --tier="$SQL_TIER" --region="$REGION" --storage-size=10GB --storage-auto-increase \
    --backup-start-time=01:00 --enable-point-in-time-recovery

say "Service accounts"
DEPLOYER="deployer@${PROJECT_ID}.iam.gserviceaccount.com"
exists gcloud iam service-accounts describe "$DEPLOYER" ||
  gcloud iam service-accounts create deployer --display-name="Cloud Build deployer"
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/logging.logWriter roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${DEPLOYER}" --role="$role" --condition=None >/dev/null
done

secret() { # secret NAME VALUE — create once, never overwrite an existing value
  if ! exists gcloud secrets describe "$1"; then
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=user-managed --locations="$REGION"
  fi
}
grant_secret() { # grant_secret NAME MEMBER
  gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:$2" --role=roles/secretmanager.secretAccessor >/dev/null
}

say "Shared secrets"
secret next-server-actions-key "$(random_secret)"
secret anthropic-api-key "replace-me"
grant_secret next-server-actions-key "$DEPLOYER"

for env in "${ENVS[@]}"; do
  say "Environment: ${env}"
  RUN_SA="run-${env}@${PROJECT_ID}.iam.gserviceaccount.com"
  exists gcloud iam service-accounts describe "$RUN_SA" ||
    gcloud iam service-accounts create "run-${env}" --display-name="Cloud Run (${env})"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUN_SA}" --role=roles/cloudsql.client --condition=None >/dev/null

  DB="books_${env}"
  DB_USER="app_${env}"
  exists gcloud sql databases describe "$DB" --instance="$SQL_INSTANCE" || gcloud sql databases create "$DB" --instance="$SQL_INSTANCE"
  if ! exists gcloud secrets describe "database-url-${env}"; then
    DB_PASS="$(openssl rand -hex 24)"
    exists gcloud sql users describe "$DB_USER" --instance="$SQL_INSTANCE" && gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" ||
      gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS"
    secret "database-url-${env}" "postgres://${DB_USER}:${DB_PASS}@/${DB}?host=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
  fi
  secret "better-auth-secret-${env}" "$(random_secret)"
  for s in "database-url-${env}" "better-auth-secret-${env}" anthropic-api-key; do grant_secret "$s" "$RUN_SA"; done

  BUCKET="gs://${PROJECT_ID}-files-${env}"
  exists gcloud storage buckets describe "$BUCKET" ||
    gcloud storage buckets create "$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
  gcloud storage buckets add-iam-policy-binding "$BUCKET" --member="serviceAccount:${RUN_SA}" --role=roles/storage.objectAdmin >/dev/null
  # Lets the app sign short-lived download links as itself.
  gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --member="serviceAccount:${RUN_SA}" --role=roles/iam.serviceAccountTokenCreator >/dev/null
done

say "Database owner: app users own their database schema"
cat <<EOF
  Cloud SQL does not let this script set database owners. Run once in Cloud SQL Studio
  (console → SQL → ${SQL_INSTANCE} → Cloud SQL Studio) as the postgres user:

    ALTER DATABASE books_dev OWNER TO app_dev;   ALTER SCHEMA public OWNER TO app_dev;   -- in books_dev
    ALTER DATABASE books_prod OWNER TO app_prod; ALTER SCHEMA public OWNER TO app_prod;  -- in books_prod
EOF

say "Billing budget (${BUDGET_AMOUNT} in your billing currency, alerts at 33%, 66%, 100%)"
if ! gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --format='value(displayName)' | grep -qx "books-app"; then
  gcloud billing budgets create --billing-account="$BILLING_ACCOUNT" --display-name="books-app" \
    --budget-amount="${BUDGET_AMOUNT}" --filter-projects="projects/${PROJECT_ID}" \
    --threshold-rule=percent=0.33 --threshold-rule=percent=0.66 --threshold-rule=percent=1.0
fi

say "Cloud Build triggers"
cat <<EOF
  First connect GitHub once in the console (needs your GitHub login):
    console → Cloud Build → Triggers → Connect repository → GitHub (Cloud Build GitHub App)
    → choose ${GITHUB_OWNER}/${GITHUB_REPO}
EOF
read -r -p "  Press Enter once the repository is connected (or Ctrl-C to do triggers later)... "
create_trigger() { # create_trigger NAME BRANCH ENV MIN_INSTANCES
  exists gcloud builds triggers describe "$1" --region="$REGION" && return 0
  gcloud builds triggers create github --name="$1" --region="$REGION" \
    --repo-owner="$GITHUB_OWNER" --repo-name="$GITHUB_REPO" --branch-pattern="^$2\$" \
    --build-config=infra/cloudbuild.yaml \
    --service-account="projects/${PROJECT_ID}/serviceAccounts/${DEPLOYER}" \
    --substitutions="_ENV=$3,_REGION=${REGION},_AR_REPO=${AR_REPO},_SQL_INSTANCE=${SQL_INSTANCE},_MIN_INSTANCES=$4"
}
create_trigger deploy-dev develop dev 0
create_trigger deploy-prod main prod 0

say "Done"
cat <<EOF
  Next:
  1. Add the Anthropic API key:  printf '%s' 'sk-ant-...' | gcloud secrets versions add anthropic-api-key --data-file=-
  2. Run the owner SQL above.
  3. Push to develop: Cloud Build migrates and deploys to
       https://app-dev-${PROJECT_NUMBER}.${REGION}.run.app
  4. Seed demo data once per environment (see docs/deploying.md).
  During pitch weeks keep production warm:  gcloud run services update app-prod --region=${REGION} --min-instances=1
EOF
