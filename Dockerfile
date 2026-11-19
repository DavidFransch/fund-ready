# One image for every environment. Settings come from Cloud Run at runtime.
# Targets:  runner (default) — the web app;  migrate — runs database migrations.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# Install dependencies from the lockfile only, so this layer is cached between builds.
FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/ledger/package.json packages/ledger/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Same key for every instance, so Server Actions work behind Cloud Run's load balancer.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ARG DEPLOYMENT_VERSION
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
RUN pnpm --filter web build

# Database migrations, run as a Cloud Run job before each deploy.
FROM deps AS migrate
COPY packages packages
WORKDIR /repo/packages/db
CMD ["pnpm", "migrate"]

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
