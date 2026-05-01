ARG BUILD_FROM
FROM ${BUILD_FROM}

# Alpine 3.21 ships Node 22 LTS in the main repo. nodejs-current pulls
# bleeding-edge — pin to the LTS package for stability across HA OS
# releases. jq parses /data/options.json in run.sh.
RUN apk add --no-cache nodejs jq

# Build context for this Dockerfile is `apps/addon/` (HA builder action's
# default — it sets the build context to `--target` dir). The CI workflow
# pre-builds the server + web bundles into `apps/addon/staged/` before
# invoking the builder, so this Dockerfile is purely a runtime-image
# assembler: copy the pre-staged bundle, copy the entrypoint, run.

WORKDIR /app

# `staged/` is produced by `pnpm deploy --filter @lovelacer/server --prod`
# in CI. It holds: dist/, package.json, and a self-contained node_modules/
# with all production deps (workspace deps fully resolved/inlined).
COPY staged/ ./

# Web SPA static assets, copied separately so the runtime image can serve
# them via @fastify/static. The web-dist path matches WEB_DIST_DIR in
# run.sh.
COPY web-dist/ /app/web-dist/

# Entrypoint
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
