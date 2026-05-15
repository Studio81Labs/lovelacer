# Smart Panel Bridge — Lovelacer

**Status:** Design note · **Last updated:** 2026-04-27

Design note for the FastyBird Smart Panel export target — what it is, what it is not, and how it fits into Lovelacer without leaking into the core experience.

## Context

Lovelacer's analyzer produces a target-agnostic representation of a Home Assistant install: rooms, domains, entity groupings, confidence scores. The Lovelace generator consumes that representation and emits Lovelace YAML / storage-mode payloads. The same representation is also a good fit for FastyBird Smart Panel's layout format, so a Smart Panel generator is a natural sibling.

The bridge is one of several export targets. It's opt-in, additive, and does not change anything about Lovelacer's primary purpose: generate a good Lovelace dashboard.

## What it is

A **Smart Panel export target** alongside YAML export and storage-mode apply. One of several output formats Lovelacer's generator can produce. Activated only when the user explicitly chooses it.

Practically: a button in the Preview screen labeled "Export for Smart Panel" that downloads a `smart-panel.json` (or whatever format Smart Panel expects) suitable for direct import on a Smart Panel device.

## What it is not

- **Not a marketing wrapper.** Smart Panel branding stays out of Lovelacer's UI, README, and Add-on Store listing.
- **Not a paywall.** Smart Panel export is available to all Lovelacer users at no cost.
- **Not a data pipeline to FastyBird.** Lovelacer never sends user data to FastyBird servers as part of the bridge. Export happens client-side or via direct file output.
- **Not a dependency.** Lovelacer works for users who never touch Smart Panel.

## Technical sketch

Details are deliberately loose — lock specifics during the actual implementation phase.

### Shared concept space

Lovelacer and Smart Panel both have the concepts of:

- Rooms (groups of entities)
- Domains / entity categories (lights, climate, sensors, etc.)
- Layout primitives (sections / panels / tabs)
- Iconography (room icons, entity icons)

The data model in `packages/analyzer` already produces a structure that maps cleanly to either target. Generators are pluggable.

### A new generator package: `packages/generator-smartpanel`

Sibling to `packages/generator` (which produces Lovelace configs). Takes the same analyzer output, produces Smart Panel layout JSON. Lives in the same monorepo.

Architecture stays clean because:

- Analyzer doesn't know about either target
- Lovelace generator doesn't know Smart Panel exists
- Smart Panel generator doesn't know Lovelace exists
- Server picks which generator to invoke based on user request

### UI

A discreet "Other export formats" link on the Preview screen, expanding to:

- Download YAML
- Export for Smart Panel (link to docs explaining what this is)
- (future) Export for Hubitat / OpenHAB / etc. as community contributions

No Smart Panel branding in Lovelacer's UI beyond a single line of copy explaining what the export format is for and a link to smart-panel.fastybird.com for users who want to learn more.

### When to build it

**Not before Phase 2.** Lovelacer's Tier 1 should stand on its own — public release, real users, real feedback — before any Smart Panel-specific work goes in. Premature integration risks over-fitting Lovelacer's data model to Smart Panel's needs.

Realistic target: post-Tier-1 public release, as part of a "v1.1 — additional export formats" minor release. By then, Lovelacer has its own identity and Smart Panel export is genuinely one of several targets.

## Reverse direction: Smart Panel pulling from Lovelacer

Potentially useful later. A Smart Panel device with Lovelacer installed on the same HA could read Lovelacer's analysis output (via local API) to build its own layout, rather than running its own simpler heuristics.

Out of scope until both products have shipped v1.0.

## Design constraints

To keep the bridge additive rather than entangling, the design should structurally avoid:

1. Mentioning Smart Panel before Lovelacer's primary purpose in any user-facing surface
2. Any Lovelacer feature that requires Smart Panel installation to function
3. Features available to Smart Panel users that non-Smart-Panel users don't get
4. Lovelacer's update cadence being dictated by Smart Panel's release schedule
5. UI copy that frames Lovelacer as a Smart Panel onboarding tool

The packaging keeps the two products separate. The Add-on Store listing for Lovelacer makes no mention of the FastyBird ecosystem. The export is one button among others.

## Decision

Build Smart Panel export as a Phase 2.5 deliverable (between Tier 1 public release and Tier 2 AI work). Estimate: ~5 evenings for the export generator and UI integration, assuming Smart Panel layout format is documented and stable by then.

Until then, the analyzer and core architecture remain target-agnostic. Do not bake Smart Panel-specific concepts into shared types. Generators stay pluggable.
