ARG BUILD_FROM
FROM ${BUILD_FROM}

# Alpine 3.21 ships Node 22 LTS in the main repo. nodejs-current pulls
# bleeding-edge — pin to the LTS package for stability across HA OS
# releases.
RUN apk add --no-cache nodejs npm jq

# Enable corepack so the workspace's pinned pnpm version (from package.json's
# `packageManager` field) is used at build time instead of npm-pulling latest.
RUN corepack enable

WORKDIR /app

# Copy lockfile + workspace manifests first for cache-friendly install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/analyzer/package.json packages/analyzer/
COPY packages/generator/package.json packages/generator/
COPY packages/ha-client/package.json packages/ha-client/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# Copy all source after the install layer so editing source doesn't bust
# the dep cache.
COPY packages packages

# Build server (TS → dist/) and web (Vite → dist/).
RUN pnpm --filter @lovelacer/server build \
 && pnpm --filter @lovelacer/web build

# Re-install with --prod to drop devDependencies from node_modules. The
# workspace symlinks remain intact so packages/server can resolve its
# workspace deps at runtime.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Entrypoint
COPY apps/addon/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
