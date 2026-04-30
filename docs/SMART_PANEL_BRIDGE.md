# Smart Panel Bridge — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27 · **Scope:** Strategic intent, not implementation spec

How Lovelacer relates to FastyBird Smart Panel, why the relationship matters, and how to design it without compromising Lovelacer's standing in the broader HA community.

## The strategic angle

Lovelacer's primary purpose is to be the best HA dashboard generator on its own merits. That is non-negotiable — anything less and we lose the audience.

But the same engine that produces a great Lovelace dashboard happens to be capable of producing a great Smart Panel layout. The room detection, entity grouping, domain-aware card mapping, and confidence scoring are all infrastructure that Smart Panel needs anyway. Reusing it is a free win for Smart Panel users, and a soft funnel for HA users who eventually want a wall-mounted experience.

The win condition: every Lovelacer install is a candidate Smart Panel customer who wasn't on the funnel before, _and_ every Smart Panel sale starts with a smoother HA setup story.

## What this is NOT

- **Not a marketing wrapper.** Lovelacer is not "Smart Panel onboarding tool." Smart Panel branding stays out of Lovelacer's UI, README, and Add-on Store listing.
- **Not a paywall.** Smart Panel export is a feature available to all Lovelacer users at no cost.
- **Not a data pipeline to FastyBird.** Lovelacer never sends user data to FastyBird servers as part of the bridge. Export happens client-side or via direct file output.
- **Not a dependency.** Lovelacer works perfectly for users who never touch Smart Panel and never will.

If anyone reading the Lovelacer README can tell that the author also runs FastyBird, that's fine. If anyone reading it feels the project exists to sell them Smart Panel, the bridge has been done wrong.

## What it IS

A **Smart Panel export target** sitting alongside YAML export and storage-mode apply. One of several output formats Lovelacer's generator can produce. Activated only when the user explicitly chooses it.

Practically: a button in the Preview screen labeled "Export for Smart Panel" that downloads a `smart-panel.json` (or whatever format Smart Panel expects) suitable for direct import on a Smart Panel device.

## Technical touchpoints

These are sketches. Lock specifics during the actual implementation phase, not now.

### Shared concept space

Lovelacer and Smart Panel both have the concepts of:

- Rooms (groups of entities)
- Domains / entity categories (lights, climate, sensors, etc.)
- Layout primitives (sections / panels / tabs)
- Iconography (room icons, entity icons)

The internal data model in `packages/analyzer` already produces a structure that maps cleanly to either target. Generators are pluggable.

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

**Not before Phase 2.** Lovelacer's Tier 1 must stand on its own — public release, real users, real feedback — before any Smart Panel-specific work goes in. Premature integration would muddy the OSS-tool narrative and might cause us to over-fit Lovelacer's data model to Smart Panel's needs.

Realistic target: post-Tier-1-public-release, as part of a "v1.1 — additional export formats" minor release. By then, Lovelacer has its own identity and Smart Panel export is genuinely just one of several targets.

## Reverse direction: Smart Panel pulling from Lovelacer

Could be valuable later. A Smart Panel device with Lovelacer installed on the same HA could read Lovelacer's analysis output (via local API) to build its own layout, rather than running its own simpler heuristics. This becomes a reason for a Smart Panel customer to also run Lovelacer — even if they never apply a Lovelace dashboard.

Out of scope until both products have shipped v1.0.

## Boundaries to stay inside

If at any point any of these become true, the bridge has gone too far:

1. Lovelacer's README mentions Smart Panel before mentioning HA dashboards
2. A Lovelacer feature requires Smart Panel installation to function
3. Smart Panel users get a feature in Lovelacer that non-Smart-Panel users don't
4. Lovelacer's update cadence is dictated by Smart Panel's release schedule
5. A Lovelacer user can't tell whether they're using a "real" tool or a marketing funnel

The defaults should make all five of these structurally hard to violate. The packaging keeps them separate. The Add-on Store listing for Lovelacer makes no mention of FastyBird ecosystem. The export is one button among others.

## Decision

Build Smart Panel export as a Phase 2.5 deliverable (between Tier 1 public release and Tier 2 AI work). Estimate: ~5 evenings for the export generator and UI integration, assuming Smart Panel layout format is documented and stable by then.

Until then, the analyzer and core architecture should remain target-agnostic. Don't bake any Smart Panel-specific concepts into shared types. Generators stay pluggable.
