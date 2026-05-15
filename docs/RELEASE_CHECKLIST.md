# Release Checklist

End-to-end smoke pass before promoting a Lovelacer pre-release to a public
stable tag. Every box must be checked on:

1. The dev HA stack (`dev/ha-stack.yml`), reset to a clean state.
2. A real HA install used in daily life, with at least 48h of usage between
   "apply" and the final review.

Open the corresponding **Release smoke test** issue from the issue templates
to track a run. One issue per pre-release tag.

---

## Pre-flight

- [ ] `pnpm install && pnpm build` succeeds with no warnings.
- [ ] `pnpm test` passes (78+ unit/fixture suites green).
- [ ] `pnpm lint` clean.
- [ ] Before cutting the pre-release tag, choose the next `X.Y.Z` version and update `apps/addon/config.yaml` `version` to that exact value.
- [ ] `apps/addon/CHANGELOG.md` has a top entry for the same `X.Y.Z` version, including user-facing changes and any known issues.
- [ ] Create the git tag as `vX.Y.Z`; the tag version must match `apps/addon/config.yaml` without the `v` prefix and must have a matching changelog entry.
- [ ] CI is green on the tagged commit (`build-addon.yml` produced multi-arch images).

## Install

- [ ] Dev HA: `pnpm dev:ha` brings HA up; add-on installs from the local repo.
- [ ] Real HA: add-on installs from the published add-on store entry.
- [ ] Add-on starts cleanly; no errors in the first 30s of logs.
- [ ] Ingress panel loads at **Settings → Add-ons → Lovelacer → Open Web UI**.
- [ ] The sidebar `Lovelacer` panel shows the correct icon (mdi:home-variant).

## Onboarding (P2-7)

- [ ] Fresh state (no `/data` files) → wizard appears on first open.
- [ ] Wizard walks through language → scan → preview → apply without errors.
- [ ] Completing the wizard persists; reload does not re-show it.
- [ ] Cancel / close mid-wizard returns to the previous step gracefully.

## Analyze + Preview

- [ ] **Analyze** completes against the dev fixture (`english-cluttered`) in <5s.
- [ ] Room view layout matches the fixture's areas (sanity-check 3 rooms).
- [ ] Misc bucket count is sane (<25% of total entities for a tidy fixture).
- [ ] Re-running Analyze with no HA changes produces an identical preview.

## Re-analyze diff view (P2-1)

- [ ] Add 5 entities to dev HA → re-analyze shows 5 additions in the correct rooms.
- [ ] Remove an entity → diff shows a "removed" warning.
- [ ] Move an entity to a different area → diff shows the move with old/new room.
- [ ] Per-room diff badges render the right counts.

## YAML export (P2-2)

- [ ] **Download YAML** button on Preview produces a valid file.
- [ ] `ha core check` against the downloaded YAML reports no errors.
- [ ] YAML output is byte-equivalent to the storage-mode apply (compare via diff).

## Floor-aware grouping (P2-3)

- [ ] `german-massive` fixture (multi-floor) renders sidebar with floor sections.
- [ ] Fixture without `floor_id` data falls back to a flat room list.
- [ ] Floor headers use the user's UI language (EN/CS/DE).

## Misc bucket UX (P2-4)

- [ ] Unassigned entities appear in the dedicated "Unassigned" panel.
- [ ] Multi-select + bulk-assign-to-room works.
- [ ] Misc bucket shrinks after assignment.
- [ ] Re-analyzing preserves the bulk-assigned overrides.

## Suggestions panel (P2-5)

- [ ] All three suggestion types appear when fixtures match conditions:
  - [ ] "Set area_id in HA"
  - [ ] "Move to better room"
  - [ ] "Hide diagnostic"
- [ ] **Accept** applies as an override and the suggestion disappears.
- [ ] **Dismiss** persists across runs (re-analyze doesn't resurrect it).

## Settings (P2-6)

- [ ] Gear button opens the Settings modal.
- [ ] Switching the room-detection language and re-analyzing changes the result.
- [ ] Toggling `included sections` (e.g. excluding Climate) removes that section
      from the next applied dashboard.
- [ ] Settings persist across add-on restarts.
- [ ] Closing with unsaved changes prompts the dirty guard.

## Multi-language UI (P2-9)

- [ ] Switching UI language to Czech translates every visible string.
- [ ] Switching to German translates every visible string (alpha-quality is OK,
      but no missing keys / `t('foo.bar')` literals leaking through).
- [ ] Switching back to English does not require a reload.
- [ ] Browser language auto-detection picks the right default on first run
      (`cs-CZ → cs`, `de-AT → de`, fallback `en`).

## Apply

- [ ] Storage-mode apply creates the dashboard at the configured `dashboard_url_path`.
- [ ] HA sidebar shows the new dashboard with the configured icon and title.
- [ ] Cards render: entities, areas, climate, weather (whichever sections are enabled).
- [ ] Re-applying after an Analyze updates the dashboard in place (no duplicates).
- [ ] Deleting the dashboard from HA's UI cleanly leaves Lovelacer state recoverable
      (next Apply re-creates it).

## Brand + visuals (P2-8)

- [ ] Logo renders crisp on retina (no pixelation).
- [ ] Inter + Instrument Serif fonts load self-hosted (no `fonts.googleapis.com` requests).
- [ ] Add-on store listing in HA shows the banner image.
- [ ] README screenshots are current (they reflect the shipped UI).

## Privacy + scope

- [ ] No outbound network requests to non-HA hosts during a full analyze + apply
      (verify with `tcpdump` or browser devtools).
- [ ] No existing automations, scripts, or unrelated dashboards are modified.
- [ ] All add-on state lives in `/data` (verify by `docker exec` and `ls /data`).

## Real-install soak (real HA only)

- [ ] Add-on runs for 48h without crashing or excessive memory growth.
- [ ] Apply, use the dashboard daily, re-analyze after a week — diff view is correct.
- [ ] At least one HA Core update during the soak period — add-on survives the upgrade.

---

## Promotion

Only promote to a stable `vX.Y.Z` tag (and post to r/homeassistant) when **every
box above is checked** in both the dev-stack and real-install columns of the
release smoke test issue, and any bugs filed during the run are either fixed
or explicitly accepted as known-issues in the release notes.
