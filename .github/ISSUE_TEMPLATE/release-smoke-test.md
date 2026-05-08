---
name: Release smoke test
about: Track a release-candidate end-to-end QA pass before promoting to a stable tag.
title: 'Release smoke test: vX.Y.Z'
labels: ['release', 'qa']
assignees: []
---

## Pre-release under test

- Tag: `vX.Y.Z`
- Commit: `<sha>`
- Add-on image: `ghcr.io/studio81labs/lovelacer-{arch}:X.Y.Z`

## Environments

- [ ] Dev HA stack (`pnpm dev:ha`, fresh `dev/ha-config/`)
- [ ] Real HA install (the maintainer's daily HA)

## Checklist

Run every section in `docs/RELEASE_CHECKLIST.md` against both environments.
Tick boxes inline as you go. The summary below mirrors the doc — if a section
fails, link the bug issue here and keep this issue open until it's fixed or
explicitly waived.

### Pre-flight

- [ ] Build, tests, lint clean
- [ ] Version + changelog match the tag
- [ ] CI green on the tagged commit

### Install

- [ ] Dev HA install
- [ ] Real HA install
- [ ] Clean startup, ingress panel loads

### Onboarding (P2-7)

- [ ] Wizard appears on fresh state
- [ ] Wizard completes end-to-end
- [ ] Completion persists

### Analyze + Preview

- [ ] Fixture analyze < 5s
- [ ] Misc bucket sane
- [ ] Idempotent re-analyze

### Re-analyze diff (P2-1)

- [ ] Additions
- [ ] Removals
- [ ] Moves
- [ ] Per-room badges

### YAML export (P2-2)

- [ ] File downloads
- [ ] `ha core check` clean
- [ ] Equivalent to storage apply

### Floor grouping (P2-3)

- [ ] Multi-floor renders sections
- [ ] Falls back to flat list

### Misc bucket (P2-4)

- [ ] Bulk-assign works
- [ ] Misc shrinks
- [ ] Overrides preserved

### Suggestions (P2-5)

- [ ] All 3 types surface
- [ ] Accept applies as override
- [ ] Dismiss persists

### Settings (P2-6)

- [ ] Language change re-analyzes
- [ ] Section toggles affect output
- [ ] Persistence
- [ ] Dirty guard

### i18n (P2-9)

- [ ] CS strings complete
- [ ] DE strings complete (alpha OK)
- [ ] No missing keys
- [ ] Browser auto-detect

### Apply

- [ ] Storage-mode dashboard appears
- [ ] Cards render
- [ ] Re-apply updates in place
- [ ] Recovery from manual deletion

### Brand (P2-8)

- [ ] Logo crisp
- [ ] Self-hosted fonts
- [ ] Store banner
- [ ] README screenshots current

### Privacy

- [ ] No external network requests
- [ ] No unrelated HA state modified
- [ ] State scoped to `/data`

### Real-install soak

- [ ] 48h uptime
- [ ] Re-analyze correct after a week
- [ ] Survives an HA Core upgrade

## Bugs filed during this run

<!-- Link any issues discovered. -->

-

## Decision

- [ ] **Promote** to stable `vX.Y.Z` and post to r/homeassistant
- [ ] **Re-spin** as the next rc tag (e.g. `vX.Y.Z-rc.2`) after fixing the bugs above
