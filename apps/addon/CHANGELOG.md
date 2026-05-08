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
