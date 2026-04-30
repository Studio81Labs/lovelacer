# Roadmap — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27

Phased build plan with concrete tickets. Estimates are working-evening units (~3h focused work) since this is a side project. Adjust to your actual cadence.

## Phase 0 — Foundation (1 week, ~5 evenings)

**Goal:** Repo is set up, dev environment runs end-to-end with stub data, no real product yet.

### P0-1 — Monorepo bootstrap · S

Set up pnpm workspaces, TypeScript strict, ESLint, Prettier, Husky, Vitest, GitHub Actions CI skeleton.
**AC:** `pnpm test` runs on a fresh clone; CI green on PR; shared `tsconfig.base.json` extended by all packages.

### P0-2 — Local HA dev container · M

Compose file under `dev/` running HA Core with a known fixture configuration. Pre-populated entities, devices, areas. Reachable on `localhost:8123` with a known long-lived token committed to `dev/`.
**AC:** `pnpm dev:ha` brings up a HA instance with ≥150 entities across 6 rooms; token works for WS auth.

### P0-3 — `ha-client` package skeleton · M

Wraps `home-assistant-js-websocket`. Exposes typed methods: `getEntityRegistry()`, `getDeviceRegistry()`, `getAreaRegistry()`, `getFloorRegistry()`. Reconnect with backoff.
**AC:** Connects to dev container; returns typed registries; survives a HA restart without crashing.

### P0-4 — Fastify server skeleton · S

Fastify server with `/api/health` returning HA connection state. Pino logging. Graceful shutdown.
**AC:** `curl localhost:3000/api/health` returns `{ ok: true, ha: { connected: true, entities: 152 } }`.

### P0-5 — Vue 3 SPA skeleton · S

Vite + Vue 3 + Pinia + Tailwind v4. Single placeholder route. Dev server proxies `/api` to backend.
**AC:** `pnpm dev` brings up frontend at `localhost:5173`, fetches `/api/health` and renders status.

**Phase 0 demo:** Show a working dev stack — HA dev container, Lovelacer backend, Lovelacer frontend, all talking to each other.

## Phase 1a — Internal alpha (3 weeks, ~15 evenings)

**Goal:** Smallest possible end-to-end product. Runs on your own HA via Add-on. Generates a dashboard. You use it daily. No public release yet.

**Deliberate constraints to keep this phase small:**

- Languages: **EN + CS only** (DE deferred to 1b)
- Domains supported: **light, switch, sensor (temperature/humidity only), binary_sensor (motion/occupancy/door only), climate**. Everything else is dumped into a generic `entities` card. Cover, media_player, lock, camera, vacuum, fan get proper card mapping in 1b.
- No diff view, no suggestions panel, no export-to-YAML, no overrides UI — just analyze, preview, apply.
- Confidence display is read-only. Manual overrides land in 1b.

### P1a-1 — Entity normalization · M

Same as previous P1-1.

### P1a-2 — Room keyword database (EN + CS) · M

Half the previous P1-2 scope. ~14 canonical rooms × 2 languages.
**AC:** Both languages pass fixture tests; new language can be added in <1 evening (validates schema).

### P1a-3 — Detection priority chain (no overrides yet) · M

Priority chain through to fallback, returning signals + confidence. No override layer at this stage — confidence display is informational.
**AC:** Fixture tests pass for `english-cluttered` and `czech-tidy`; misc bucket size reasonable.

### P1a-4 — Confidence scoring with corroboration · S

Same as previous P1-4.

### P1a-5 — Domain grouping (limited domains) · S

Mapping for light, switch, sensor (filtered), binary_sensor (filtered), climate. Everything else → `entities` fallback.
**AC:** Snapshot tests cover supported domains; unknown domains route correctly to fallback.

### P1a-6 — Generator: room views (basic) · M

One section per group, headings, sorted entities. No fancy section composition logic.
**AC:** Generated config validates; renders correctly in dev HA.

### P1a-7 — Generator: home overview (minimal) · S

Single welcome section + glance card with whatever's available. No people/cameras/scenes sections yet.
**AC:** Renders with sensible content even on bare-minimum HA installs.

### P1a-8 — Storage-mode apply · M

Same as previous P1-8.

### P1a-9 — `/api/analyze`, `/api/preview`, `/api/apply` · M

Same as previous P1-9.

### P1a-10 — Frontend: minimal Review + Preview + Apply · M

Single-page flow: list of detected rooms with entity counts and confidence summaries → preview → apply. No drag-and-drop, no per-entity overrides, no diff. Just enough to demonstrate end-to-end value.
**AC:** Click Analyze → see rooms → click Apply → new dashboard appears in HA.

### P1a-11 — Add-on packaging · M

Same as previous P1-13. Cannot defer — without this, "internal alpha" can't exist on real HA.
**AC:** Same as before.

**Phase 1a demo:** Install Add-on on your own HA. Click Analyze. Click Apply. Open the new dashboard. Time the whole flow — target < 5 minutes. Use it for a week. Find the bugs.

**~15 evenings total.** This is the moment of truth: does the heuristic core work well enough on real data to be worth continuing? If misc bucket > 30% on your own install, stop and rework heuristics before moving to 1b.

## Phase 1b — Closed beta ready (2 weeks, ~10 evenings)

**Goal:** Fill in what 1a deferred so a small group of friendly testers can try it.

### P1b-1 — German keyword pack · S

Add DE to room keyword database.
**AC:** German fixture passes detection thresholds.

### P1b-2 — Remaining domains: cover, media_player, lock, camera, vacuum, fan · M

Proper card mapping per [DASHBOARD_GENERATION.md](./DASHBOARD_GENERATION.md).
**AC:** Each domain renders with its target card type; snapshot tests pass.

### P1b-3 — Override storage and API · S

SQLite schema, `/api/overrides` GET/PUT, override applied during analysis.
**AC:** Same as previous P1-10.

### P1b-4 — Frontend: per-entity override UI · M

Add the room reassignment dropdown and "hide" toggle to the Review screen.
**AC:** Override saves; re-analysis respects it; reset works.

### P1b-5 — Home overview: full sections · M

Add people, scenes, and active-rooms sections. Cameras section if cameras exist.
**AC:** Sections appear/disappear based on entity availability; matches [DASHBOARD_GENERATION.md](./DASHBOARD_GENERATION.md).

### P1b-6 — Friendly invite flow · S

Closed-beta gating: Add-on prompts for an invite code on first run; code validates against a hardcoded list.
**AC:** Right code unlocks; wrong code shows polite error.

**Phase 1b demo:** Invite ~10 HA users from r/homeassistant or your network. Watch how they install, what they hit, where heuristics fail. Track the misc bucket size and override rate per install. Decision point: is this ready for public, or does it need another round?

**~10 evenings total.** Combined Phase 1 (a + b) = ~25 evenings, same as before — the resequencing isn't shorter, it just front-loads validation.

## Phase 2 — Polish & Release (3 weeks, ~15 evenings)

**Goal:** Production-quality first release. Ship to early adopters.

### P2-1 — Re-analysis diff view · M

Show differences vs last applied dashboard: new entities, removed entities, moved entities. Per-room diff badges.
**AC:** Adding 5 entities to dev HA → re-analyze shows 5 additions in correct rooms; removed entity warning shown.

### P2-2 — YAML export · S

`/api/export.yaml` endpoint, "Download YAML" button on Preview screen.
**AC:** Downloaded file is valid YAML, equivalent to applied storage config; tested against `ha core check`.

### P2-3 — Floor-aware grouping · S

If `floor_id` data present, group rooms by floor in sidebar.
**AC:** Two-floor fixture renders with floor section dividers; absent floor data falls back to flat list.

### P2-4 — Misc bucket UX · M

Dedicated "Unassigned" panel showing entities with no detection. Bulk-assign UI: select multiple → assign to room.
**AC:** Bulk assign works; misc shrinks after assignment; new analysis preserves assignments.

### P2-5 — Suggestions panel (lite) · M

Surface 3 suggestion types: "Set area_id in HA", "Move to better room", "Hide diagnostic". Accept / dismiss buttons.
**AC:** Suggestions appear when fixtures match conditions; dismiss persists across runs; accept applies as override.

### P2-6 — Settings screen · S

Add-on options surfaced in UI: language, card pack, included sections in overview.
**AC:** Changing language and re-analyzing changes detection; setting persists; backend re-reads on change.

### P2-7 — Onboarding flow · M

First-run wizard: language selection, scan, preview, apply. Replaces empty state.
**AC:** Fresh install with no DB state shows wizard; completed state stored, doesn't re-show.

### P2-8 — Logo, screenshots, README · S

Visual identity. Banner image. README.md for repo and Add-on with screenshots and quick-start.
**AC:** Add-on store listing renders with banner; README has 4+ screenshots; demo GIF in README.

### P2-9 — Multi-language UI strings · S

i18n for the SPA itself, EN + CS + DE. (Independent from room detection languages.)
**AC:** UI language switches correctly; no hardcoded English strings remain in components.

### P2-10 — Documentation site · M

Static docs site (Astro or VitePress) at `docs.lovelacer.dev` (or wherever) with installation, architecture, FAQ.
**AC:** Site builds in CI, deploys to Cloudflare Pages, includes install guide for Supervised + standalone Docker.

**Phase 2 demo:** Public release. Post to r/homeassistant. Goal: 50 installs week one.

## Phase 3 — Adoption response (4 weeks, ~20 evenings, reactive)

**Goal:** Address real-user feedback. Plan, don't pre-build.

Reserve this phase for whatever gets reported in the first month. Likely candidates:

- More languages (Spanish and Polish requested heavily, probably)
- Specific integration quirks (Zigbee2MQTT, ESPHome edge cases)
- Performance for very large installs (1000+ entities)
- Bug fixes on uncommon Lovelace card schemas
- HACS distribution (if community asks)

Ticket P3 list will be opened from issue tracker post-release.

## Phase 4 — AI tier MVP (4 weeks, ~20 evenings)

**Goal:** Tier 2 ships. AI features available with BYO API key (Anthropic, OpenAI, Ollama).

Detailed tickets in [`AI_FEATURES.md`](./AI_FEATURES.md) under "Ticket additions to roadmap." Summary:

- LLM provider abstraction + Anthropic, OpenAI, Ollama implementations
- F1 AI-assisted room detection (fallback for low-confidence heuristic results)
- F5 inline reasoning hints
- F2 entity rename suggestions
- F3 layout suggestions
- AI configuration UI in Add-on
- Cost tracking and budget enforcement
- Privacy documentation (`docs/PRIVACY.md`)

**Phase 4 demo:** Side-by-side comparison: same pathological-fixture HA install analyzed with heuristics-only vs AI-enabled. Show the misc bucket shrinking from 25 entities to 3, with reasoning surfaced for each AI-resolved entity.

## Phase 5 — Advanced AI features (~15 evenings, post-Tier-2 traction)

- F4 natural language operations
- F6 automation suggestions
- F7 style learning from existing dashboards
- F8 reanalyze with feedback loop

Built reactively based on Tier 2 user feedback. Don't pre-commit scope.

## Phase 6 — Lovelacer Cloud / Tier 3 (only if validated, ~30 evenings)

**Pre-condition:** Tier 2 has demonstrated demand. Concrete signals:

- ≥100 active Tier 2 users
- ≥20 explicit requests for "managed" version
- Email signups on a "Lovelacer Pro waitlist" page exceed 200

**Scope:**

- Cloudflare Worker relay endpoint (`api.lovelacer.dev`)
- License key issuance and validation (KV-backed)
- Stripe subscription + webhook integration
- Usage tracking (D1) for billing
- Marketing site at `lovelacer.dev`
- Customer support process (helpdesk inbox, response SLAs)
- EU VAT handling (Czechia-based business — talk to accountant)
- Terms of service, privacy policy, data processing agreement

**Why this is its own phase:** It's a SaaS business, not a feature. Different operational model, different risks. Commit only when the signal is unambiguous.

## Phase 7 — Suggestions Engine + Card Packs (post-v1.0)

Bigger features, planned but not committed.

### P7-1 — Full suggestions engine

All five suggestion types from [HEURISTICS.md](./HEURISTICS.md), with reasoning surfaced to the user.

### P7-2 — Mushroom card pack

Opt-in card pack with auto-detection of Mushroom installation.

### P7-3 — Energy view template

Pre-built energy dashboard from HA's energy entities.

### P7-4 — Multi-dashboard mode

Generate separate dashboards: e.g., "Living" (rooms) + "Tech" (network, system) + "Energy".

### P7-5 — Theme awareness

Detect user's active theme, generate dashboards that look good with it.

## Sizing reference

- **S** (Small) ≈ 1 evening
- **M** (Medium) ≈ 2–3 evenings
- **L** (Large) ≈ 4–5 evenings

## Total MVP estimate

- Phase 0: 5 evenings
- Phase 1a: 15 evenings
- Phase 1b: 10 evenings
- Phase 2: 15 evenings

**~45 evenings** to first public release. At 4 evenings/week, that's ~11 weeks. Realistic with one job-application sprint mixed in: 14–16 weeks.

The 1a/1b split doesn't shorten the total — it front-loads the moment of truth. After Phase 1a (~5 weeks in) you have a working tool on your own HA and a real signal whether the heuristics are good enough to keep going.

## Milestones

| Milestone                                   | Phase          | Date target               |
| ------------------------------------------- | -------------- | ------------------------- |
| Dev environment running                     | End of P0      | Week 1                    |
| First generated dashboard applied (your HA) | End of P1a     | Week 5                    |
| Internal alpha — used daily on your own HA  | Week after P1a | Week 6                    |
| Closed beta (invite ~10 HA users)           | End of P1b     | Week 8                    |
| Tier 1 public release                       | End of P2      | Week 13–16                |
| Tier 2 (AI) public release                  | End of P4      | Week 22–26                |
| Tier 3 (Cloud) decision point               | After P4       | Based on adoption signals |

## Definition of Done (per ticket)

- [ ] Code merged to `main`
- [ ] Tests passing (unit + relevant integration)
- [ ] Documented in code comments where non-obvious
- [ ] Type-safe (no `any` without justification)
- [ ] Manual smoke test on dev HA stack
- [ ] CHANGELOG.md updated for user-facing changes

## Definition of Done (per phase)

- [ ] All phase tickets DoD-complete
- [ ] Phase demo recorded (screen capture, ~2 min)
- [ ] Self-review of next phase tickets — adjust scope based on what was learned
