ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.4
FROM node:24-alpine3.21 AS node-runtime

FROM node:24-alpine3.21 AS native-rebuild

RUN apk add --no-cache python3 make g++

WORKDIR /app

# `staged/` is produced by `pnpm deploy --filter @lovelacer/server --prod`
# in CI. It holds: dist/, package.json, and a self-contained node_modules/
# with all production deps (workspace deps fully resolved/inlined).
COPY staged/ ./

# Native modules in staged/node_modules/ were pre-built on ubuntu-x64-glibc
# by CI. Rebuild them in a Node/Alpine builder stage so the final HA base
# image does not need compiler packages from Alpine repositories whose musl
# versions can drift from the add-on base image.
#
# We use `npm rebuild` (not `pnpm rebuild`): pnpm deploy embeds the CI
# runner's store path into the bundle's metadata, and a fresh pnpm in
# the container then refuses with `ERR_PNPM_UNEXPECTED_STORE`.
#
# Scope to specific native packages — `npm rebuild` with no args runs
# prepare/install scripts on every dep in node_modules, including
# transitive packages whose `prepare` references devDeps that aren't
# in this prod-only deploy (e.g. balanced-match's prepare calls tshy).
# `better-sqlite3` is currently the only native module we ship; add
# others here if and when they're introduced.
RUN npm rebuild better-sqlite3

FROM ${BUILD_FROM}

# Match the working Smart Panel add-on shape more closely by using the
# official Node 24 runtime instead of Alpine's packaged nodejs from the HA
# base image. Keep jq for /data/options.json parsing and libstdc++ for native
# modules rebuilt in the builder stage.
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    apk add --no-cache jq libstdc++

# Build context for this Dockerfile is `apps/addon/` (HA builder action's
# default — it sets the build context to `--target` dir). The CI workflow
# pre-builds the server + web bundles into `apps/addon/staged/` before
# invoking the builder, so this Dockerfile is purely a runtime-image
# assembler: copy the pre-staged bundle, copy the entrypoint, run.

WORKDIR /app

COPY --from=native-rebuild /app ./

# Web SPA static assets, copied separately so the runtime image can serve
# them via @fastify/static. The web-dist path matches WEB_DIST_DIR in
# run.sh.
COPY web-dist/ /app/web-dist/

# Entrypoint
COPY config.yaml /app/addon-config.yaml
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

# The HA base images inherit `ENTRYPOINT ["/init"]` from s6-overlay, so
# Docker runs `/init /run.sh` rather than `/run.sh` directly. With
# `init: false` in config.yaml we don't want s6-overlay; clearing the
# entrypoint ensures only /run.sh runs (and avoids the AppArmor profile
# refusing to open /init, which we deliberately don't whitelist).
ENTRYPOINT []
CMD ["/run.sh"]
