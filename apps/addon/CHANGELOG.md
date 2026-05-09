## 0.4.11

### Phase 2 — pre-release for local QA (AppArmor SQLite lock fix)

Fixes the persistent HA add-on `SQLITE_BUSY` startup failure by granting
AppArmor file-lock permission on `/data/**`.

SQLite does not just need read/write access to `/data/lovelacer.sqlite`;
it also uses advisory file locks on the database and journal sidecars.
The profile previously allowed `/data/** rw,` but not `k`, so inside HA
the process could access the files while SQLite could not complete its
locking protocol. The profile now uses `/data/** rwk,`.

Same QA scope as 0.4.0–0.4.10.

## 0.4.10

### Phase 2 — pre-release for local QA (re-spin)

Fixes the remaining HA add-on startup lock failure seen on 0.4.9:

```
sqlite still busy after retries; renaming auxiliary files...
fatal startup error: SqliteError: database is locked
```

The 0.4.9 recovery removed wedged WAL sidecars, but each retry still
constructed a store by opening a new `better-sqlite3` connection before
running schema setup. If schema initialization threw `SQLITE_BUSY`, that
partially constructed store never reached `close()`, so the retry loop
could leak SQLite handles during the same startup attempt.

Storage initialization now opens one shared SQLite connection for all six
tables, runs all store schema setup on that connection, and closes the
connection immediately if any schema step fails. The individual stores
still support filename-owned connections for tests and local use, but the
HA boot path no longer opens the same `/data/lovelacer.sqlite` file six
times during startup.

Same QA scope as 0.4.0–0.4.9.

## 0.4.9

### Phase 2 — pre-release for local QA (re-spin)

Fixes the persistent SQLITE_BUSY case from 0.4.8 where the lock
state from a crashed previous container is permanently wedged —
not transient — so retrying with backoff alone never clears it.
User log on 0.4.8:

```
attempt=1 sqlite busy during store init; backing off and retrying
attempt=2 ...
attempt=3 ...
attempt=4 ...
fatal startup error: SqliteError: database is locked
```

Add a last-resort recovery to `openStoreWithRetry` in `main.ts`:
when all normal retries (5 attempts ≈ 7.5s) are exhausted with
SQLITE_BUSY, the auxiliary `.db-wal`/`.db-shm` sidecars are
**renamed** (not deleted) to `.busy-<timestamp>` siblings, then
the factory is called once more. The `.db-journal` rollback
sidecar is deliberately NOT touched — it holds undo data for an
in-progress transaction in non-WAL mode, and removing it would
leave the main DB with half-applied pages. Renaming preserves the
committed-but-unmerged WAL state on disk for forensics or manual
recovery — so the worst case is "the new DB session doesn't see
those transactions" rather than "data is gone". Per Codex review:
this is only safe under the HA add-on single-process /data/
contract; documented inline. Recovery is applied only on the first
store opened (subsequent stores share the same `.sqlite` file, so
cleanup runs once per process).

Same QA scope as 0.4.0–0.4.8.

## 0.4.8

### Phase 2 — pre-release for local QA (re-spin)

Fixes startup `SqliteError: database is locked` (`SQLITE_BUSY`)
surfaced once better-sqlite3 actually runs (0.4.6) on a supported
arch (0.4.7).

Each storage class shares the single `lovelacer.sqlite` file (with
its own table) and runs `PRAGMA journal_mode = WAL` plus
`CREATE TABLE IF NOT EXISTS` in its constructor. Stale
`.db-wal`/`.db-shm` lock state from a crashed previous container can
make any of those lock-acquiring init operations transiently
SQLITE_BUSY — and SQLite's deadlock detection on the WAL exclusive
upgrade short-circuits the busy timeout, so a longer per-DB timeout
wouldn't help.

Two-layer fix:

1. **WAL pragma is best-effort** in all six stores (`override`,
   `dismissed-suggestion`, `invite`, `applied-snapshot`, `settings`,
   `onboarding`). WAL is a perf optimization for concurrent
   reader/writer throughput; the default rollback-journal mode is
   correct for our single-writer workload. On SQLITE_BUSY we stay in
   the default mode and continue rather than failing startup. Real
   errors still propagate.
2. **Retry the whole store-construction path** in `main.ts` with
   exponential backoff (500 ms → 1 s → 2 s → 4 s, 5 attempts ≈ 7.5 s
   total). If `CREATE TABLE` or any other init op hits SQLITE_BUSY
   from genuinely-held locks, we ride out short-lived contention
   before failing.

Same QA scope as 0.4.0–0.4.7.

## 0.4.7

### Phase 2 — pre-release for local QA (re-spin)

Drops `armv7` from the supported-architecture list. The native-rebuild
step from 0.4.6 hangs indefinitely on armv7 under QEMU emulation
because `better-sqlite3` doesn't ship a `linux-armv7-musl` prebuild
and compiling SQLite from source under emulation is impractically
slow (multiple hours, often unfinishable). armv7 covers Raspberry
Pi 2/3 and Pi Zero — increasingly legacy in the HA ecosystem and
already dropped by many official add-ons. Current installs are
overwhelmingly aarch64 (Pi 4/5, HA Yellow, ODROID, NUC) or amd64
(PC/server), both of which now build cleanly. armv7 users will see
"this add-on doesn't support your architecture" in HA Supervisor —
clearer than a hung install. Same QA scope as 0.4.0–0.4.6.

## 0.4.6

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Fixes a native-module load failure
surfaced once AppArmor stopped blocking dlopen in 0.4.5:

```
fatal startup error: Error relocating .../better_sqlite3.node:
unsupported relocation type 7 (ERR_DLOPEN_FAILED)
```

CI runs `pnpm install` on `ubuntu-latest` (glibc-x64) and ships those
prebuilt native binaries to the image via `staged/`. They never worked
— they're built for the wrong libc (Alpine is musl, not glibc) and the
wrong arch (CI x64 prebuilds on aarch64/armv7 hosts). The musl dynamic
linker rejected them with an obvious relocation error.

Fix: rebuild native modules inside the container during the Docker
build, where the toolchain runs under the target arch and libc. The
new Dockerfile step installs build tools (`python3 make g++ npm`) and
pnpm as a virtual package, runs `pnpm rebuild` to refresh native
bindings (downloading matching musl/arch prebuilds when available,
compiling from source when not), then removes the build chain in the
same RUN layer to keep the final image lean.

Same QA scope as 0.4.0–0.4.5.

## 0.4.5

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Fixes a Node startup failure surfaced
once the shell shebang issues from 0.4.4 were out of the way:

```
fatal startup error: Error loading shared library
.../better-sqlite3/build/Release/better_sqlite3.node:
Permission denied (ERR_DLOPEN_FAILED)
```

`dlopen` of a native `.node` module needs AppArmor's `m` permission
(mmap with `PROT_EXEC`) on the file in addition to `r`. Our profile
had `/app/** r,` — fine for reading JS source but not for loading
shared libraries. Promote it to `/app/** rm,` so Node can dlopen the
native sqlite binding (and any other native deps that land in
node_modules in the future). Same QA scope as 0.4.0–0.4.4.

## 0.4.4

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Two fixes:

1. **Startup**: with `/init` no longer in the way (0.4.3), the kernel
   tried to resolve `run.sh`'s `#!/usr/bin/env bash` shebang and exec
   `bash`, which the HA base image ships at a path our AppArmor profile
   didn't whitelist — `env: can't execute 'bash': Permission denied`.
   Drop the bash dependency entirely: `run.sh` is now POSIX sh
   (`#!/bin/sh`), and the AppArmor profile whitelists Alpine's actual
   `/bin/sh` and `/bin/busybox` (the symlink target) instead of the
   wrong `/usr/bin/{bash,sh,env}` paths.

2. **CHANGELOG format**: HA Supervisor's CHANGELOG parser only
   recognises `## VERSION` headings — appending ` — YYYY-MM-DD` (as
   we'd been doing since 0.2.0) breaks the per-version split. Strip
   the date suffix from every version heading; the `published_at`
   metadata on each GitHub Release already carries the date.

Same QA scope as 0.4.0–0.4.3.

## 0.4.3

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Fixes startup failure on freshly installed
add-on: the HA base image inherits `ENTRYPOINT ["/init"]` from
s6-overlay, so Docker was running `/init /run.sh` instead of
`/run.sh` directly. With `init: false` we don't want s6-overlay,
and the AppArmor profile deliberately doesn't whitelist `/init` —
the result was `/bin/sh: can't open '/init': Permission denied`
the moment Supervisor hit _Start_. Override the entrypoint to `[]`
in the Dockerfile so only `CMD ["/run.sh"]` is exec'd. Same QA scope
as 0.4.0/0.4.1/0.4.2.

## 0.4.2

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Fixes the GHCR push path for the add-on
images: `home-assistant/builder` prepends the GHCR-login owner to
`--image`, so passing the fully-qualified `ghcr.io/studio81labs/...`
produced a doubled path (`ghcr.io/studio81labs/ghcr.io/studio81labs/
lovelacer-{arch}`) — which didn't match the `image:` field HA
Supervisor reads from `config.yaml`, causing every install attempt to
404 (surfaced as 403 by GHCR's auth layer). The build now passes only
the bare image name to the builder. Same QA scope as 0.4.0/0.4.1.

## 0.4.1

### Phase 2 — pre-release for local QA (re-spin)

No add-on behavior changes. Fixes a release-pipeline bug that caused
`v0.4.0` to publish without a `0.4.0` container tag on GHCR — HA
Supervisor saw `403 denied` because the manifest didn't exist. The
reusable build workflow now discriminates on `inputs.version` instead
of `github.event_name`, since the latter propagates the caller's
trigger and never equals `workflow_call`. Same QA scope as 0.4.0.

## 0.4.0

### Phase 2 — pre-release for local QA

No new features. Version bump to cut a pre-release build for end-to-end
smoke testing before the public 1.0 launch on r/homeassistant. Tracks the
smoke-test checklist in `docs/RELEASE_CHECKLIST.md`. Promote to 1.0.0 once
the checklist passes on the dev HA stack and on a real HA install.

## 0.3.0

### Phase 2 — final ticket

- Multi-language UI: the SPA now ships in English, Czech, and German.
  Switch via Settings → Display language. Czech is fully translated
  and reviewed; German is AI-drafted alpha-quality — translation PRs
  welcome at https://github.com/Studio81Labs/lovelacer.
- UI display language is independent of room-detection language.
  Both choices live in Settings.
- Browser language auto-detection on first run (cs-CZ → Czech,
  de-AT → German, anything else → English fallback).

## 0.2.0

### Phase 2 (Polish & Release)

- Re-analyze diff view: see what changes when you re-run Analyze.
- YAML export: save the generated dashboard as YAML alongside storage-mode apply.
- Floor-aware grouping: rooms group by floor when areas have a floor assigned.
- Bulk-assign for the Misc bucket: select multiple unscoped entities and assign in one click.
- Suggestions panel: smart improvements with one-click accept.
- Settings screen: configure language and which dashboard sections appear.
- Onboarding wizard: first-run flow walks new users through analyze → preview → apply.
- Brand identity: new logo, full visual identity, Inter + Instrument Serif typography, self-hosted fonts.

### Phase 1b (already shipped, summarised)

- Multi-language room detection: EN, CS, DE, ES, FR, IT, PL, NL.
- Per-entity overrides: drag rooms manually, mark entities hidden.
- Invite-code gate for closed alpha.
- HA add-on packaging with multi-arch images (aarch64, amd64, armv7).

### Phase 1a (already shipped, summarised)

- Initial analyze + apply flow against a single HA instance.
- HA storage-mode dashboard generation.
- WebSocket connection with retry/backoff.
