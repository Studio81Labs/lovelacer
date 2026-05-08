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

# Native modules in staged/node_modules/ were pre-built on
# ubuntu-x64-glibc by CI; they fail at runtime on Alpine (musl) and on
# non-x64 archs (aarch64/armv7) with ERR_DLOPEN_FAILED or "unsupported
# relocation type". Rebuild them against the container's actual
# arch+libc.
#
# We use `npm rebuild`, not `pnpm rebuild`: pnpm deploy embeds the CI
# runner's store path into the bundle's metadata, and a fresh pnpm in
# the container then refuses with `ERR_PNPM_UNEXPECTED_STORE`. npm
# rebuild doesn't care about pnpm metadata — it just walks
# `node_modules/*`, follows pnpm's symlinks into `.pnpm/`, and re-runs
# each package's install script (which downloads matching prebuilt
# binaries when available, falls back to compiling from source when
# not).
#
# Build toolchain is installed as a virtual package and removed in the
# same RUN layer so the final image stays lean.
RUN apk add --no-cache --virtual .build-deps python3 make g++ npm && \
    cd /app && npm rebuild && \
    apk del .build-deps

# Entrypoint
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
