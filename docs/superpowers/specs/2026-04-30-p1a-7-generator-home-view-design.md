# P1a-7 Generator: Home Overview (minimal) — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-7 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Ship a `buildHomeView(input)` function in `@lovelacer/generator` that produces the dashboard's first view: a Welcome section (markdown card with a time-of-day greeting and optional weather state) plus a Quick stats glance card with up to 4 entities picked heuristically from the user's install. The home view degrades gracefully — bare-minimum installs see only the Welcome section.

## Non-goals

- People / Active rooms / Scenes / Cameras sections. P1b-5 expands the home view with the full set per [DASHBOARD_GENERATION.md § The Home overview view](../../DASHBOARD_GENERATION.md).
- Full Lovelace dashboard envelope. P1a-8 wraps `HomeView` + `RoomView[]` into `LovelaceConfig` and pushes via `lovelace/config/save`.
- Custom card types beyond `markdown` and `glance` for this ticket. (Plus the existing `tile`/`thermostat`/`entities`/`heading` from P1a-6.)
- Template engine work. The Welcome card's markdown content includes Jinja expressions; HA renders them client-side. We just emit the string.
- Localization. English-only greeting for P1a; P2-9 handles SPA i18n.

## Approach summary

`buildHomeView({ entities })` produces a `HomeView` (a `RoomView` type alias since the structural shape is identical). The function always emits a Welcome section with a markdown card; the greeting includes a weather state line only if a `weather.*` entity exists in the input. A separate `pickQuickStatsEntities` helper scans the input by curated patterns (weather, outdoor temperature/humidity, presence, power) and produces a glance card with up to 4 matched entities — but the glance section is dropped entirely if fewer than 2 entities match.

Strict heuristic picker: only entities whose `(entityId or friendlyName)` matches the documented patterns get into Quick stats. No "interesting sensors" guesswork.

## Architecture

```
packages/generator/src/
  home-view.ts                       # buildHomeView, pickQuickStatsEntities, type HomeView
  lovelace-types.ts                  # MODIFY: add MarkdownCard, GlanceCard to LovelaceCard union
  index.ts                           # MODIFY: re-export public surface
  __tests__/
    home-view.test.ts                # unit tests
    home-view.fixtures.test.ts       # fixture-driven snapshot tests
```

## Components

### 1. New card types in `lovelace-types.ts`

Append to the existing union:

```ts
export interface MarkdownCard {
  type: 'markdown'
  content: string
}

export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: string[]
}

export type LovelaceCard =
  | HeadingCard
  | TileCard
  | ThermostatCard
  | EntitiesCard
  | MarkdownCard   // NEW
  | GlanceCard     // NEW
```

The discriminated-union narrowing on `card.type === 'markdown'` etc. continues to work for downstream consumers (P1a-8 will need this when validating before push).

### 2. Public types and surface (`home-view.ts`)

```ts
import type { NormalizedEntity } from '@lovelacer/shared'
import type {
  GlanceCard,
  GridSection,
  MarkdownCard,
  RoomView,
} from './lovelace-types.js'

/**
 * Home view shares RoomView's structural shape (sections layout).
 * The discriminator is the `path: 'home'` value, not the type itself.
 */
export type HomeView = RoomView

export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
}

export function buildHomeView(input: BuildHomeViewInput): HomeView

/**
 * Apply the quick-stats patterns to the input entities. Used by
 * `buildHomeView` and exposed for tests / future consumers.
 *
 * Returns up to 4 entities in pattern order (weather first, etc.).
 * Caller decides whether to render — the rule "skip glance if <2"
 * lives in `buildHomeView`, not here.
 */
export function pickQuickStatsEntities(entities: NormalizedEntity[]): NormalizedEntity[]
```

### 3. Welcome section construction

`buildWelcomeSection(entities): GridSection` — always returns one section with one `MarkdownCard`.

Greeting template (HA Jinja, rendered client-side):

```
## Good {{ now().strftime('%H')|int < 12 and 'morning' or now().strftime('%H')|int < 18 and 'afternoon' or 'evening' }}
```

If a `weather.*` entity exists in the input (first one wins on `entityId` order), append a second line:

```
{{ states('<weatherEntityId>') }} · {{ state_attr('<weatherEntityId>', 'temperature') }}°
```

`<weatherEntityId>` is the literal entity_id string substituted at generation time. The two lines are joined with `\n\n`.

Examples:

- No weather entity:
  ```
  ## Good {{ now().strftime('%H')|int < 12 and 'morning' or now().strftime('%H')|int < 18 and 'afternoon' or 'evening' }}
  ```

- With `weather.home`:
  ```
  ## Good {{ now().strftime('%H')|int < 12 and 'morning' or now().strftime('%H')|int < 18 and 'afternoon' or 'evening' }}

  {{ states('weather.home') }} · {{ state_attr('weather.home', 'temperature') }}°
  ```

### 4. Quick stats picker (`pickQuickStatsEntities`)

Pure function. Scans the input and applies these patterns in this exact order, taking the **first** match per pattern (single match per pattern, not all matches). Stops at 4 results:

| Pattern | Rule |
| --- | --- |
| Weather | `domain === 'weather'` (any) |
| Outdoor temperature | `domain === 'sensor'` AND `deviceClass === 'temperature'` AND `(entityId.toLowerCase().includes('outdoor') OR entityId.toLowerCase().includes('outside') OR friendlyName.toLowerCase().includes('outdoor') OR friendlyName.toLowerCase().includes('outside'))` |
| Outdoor humidity | Same as above with `'humidity'` |
| Presence | `domain === 'binary_sensor'` AND (`deviceClass === 'presence'` OR `entityId matches /anyone[_-]?home\|someone[_-]?home\|presence/i`) |
| Power | `domain === 'sensor'` AND `deviceClass === 'power'` |

The function iterates patterns in declared order. For each pattern, it scans the entity list (in input order) for the first matching entity, then moves to the next pattern. Returns up to 4 entities total (in pattern order).

### 5. Quick stats section construction

`buildQuickStatsSection(entities): GridSection | null`:

- Calls `pickQuickStatsEntities(entities)`.
- If the result has fewer than 2 entities, return `null` — caller skips the section.
- Otherwise, return a `GridSection` containing a single `GlanceCard` with `title: 'Quick stats'` and `entities: result.map(e => e.entityId)`.

### 6. `buildHomeView` orchestration

```ts
export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const sections: GridSection[] = [buildWelcomeSection(input.entities)]
  const quickStats = buildQuickStatsSection(input.entities)
  if (quickStats !== null) sections.push(quickStats)
  return {
    type: 'sections',
    title: 'Home',
    path: 'home',
    icon: 'mdi:home-variant',
    sections,
  }
}
```

`title`, `path`, `icon` constants per [DASHBOARD_GENERATION.md § Icon selection](../../DASHBOARD_GENERATION.md).

### 7. Re-exports — `packages/generator/src/index.ts`

Append:

```ts
export { buildHomeView, pickQuickStatsEntities } from './home-view.js'
export type { BuildHomeViewInput, HomeView } from './home-view.js'
export type { GlanceCard, MarkdownCard } from './lovelace-types.js'
```

## Data flow

```
input { entities: NormalizedEntity[] }
  │
  ▼
buildHomeView()
  │
  ├─ welcome = buildWelcomeSection(entities)
  │     scans for first weather.* → conditional 2nd line in markdown content
  │     returns { type: 'grid', cards: [{ type: 'markdown', content }] }
  │
  ├─ quickStats = buildQuickStatsSection(entities)
  │     pickQuickStatsEntities(entities) → up to 4 entities
  │     if length < 2: return null
  │     else: return { type: 'grid', cards: [{ type: 'glance', title: 'Quick stats', entities: ids }] }
  │
  └─ return { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant', sections }
```

## Error handling

| Condition | Behavior |
| --- | --- |
| Empty `input.entities` | `buildHomeView` still produces a view with Welcome section only (greeting card without weather line). Quick stats section dropped (0 matches < 2). |
| Multiple `weather.*` entities | First one (by input order) wins for the markdown template. |
| All 4 patterns match | All 4 picked, glance card has 4 entities. |
| Pattern matches but only 1 across all patterns | Glance section dropped (< 2 threshold). |
| Entity has no `friendlyName` | Treated as empty string for the substring check; `entityId` check still applies. |

No throws. Pure function, total over its declared input space.

## Testing

### `home-view.test.ts` — unit tests

**Welcome card variations:**

- Empty entities → Welcome card has greeting only (no second line, no weather reference).
- One `weather.home` entity → Welcome card markdown ends with `{{ states('weather.home') }} · {{ state_attr('weather.home', 'temperature') }}°`.
- Two weather entities (`weather.home`, `weather.forecast`) → markdown references first one only.
- Welcome card always present even when entities is empty.

**Quick stats picker:**

- Outdoor temperature by entity_id substring: `sensor.outdoor_temperature` (deviceClass: 'temperature') → matched.
- Outdoor temperature by friendlyName substring: entity_id `sensor.x` with friendlyName `Outside Temp` and deviceClass `temperature` → matched.
- Outdoor temperature without 'outdoor'/'outside' marker → NOT matched (kitchen temp doesn't qualify).
- Outdoor humidity → matched the same way.
- Presence by deviceClass: binary_sensor with `deviceClass: 'presence'` → matched.
- Presence by entity_id pattern: `binary_sensor.anyone_home` → matched. `binary_sensor.someone-home` → matched. Variants tested: underscore, hyphen, mixed case.
- Power by deviceClass: sensor with `deviceClass: 'power'` → matched.
- Energy is NOT power: sensor with `deviceClass: 'energy'` → NOT matched.

**Picker ordering:**

- Patterns return in declared order: weather first, outdoor temp, outdoor humidity, presence, power.
- Multiple matches per pattern → only first one picked.
- 5 patterns potentially matchable → only 4 picked (cap), in pattern order.

**Glance threshold:**

- 0 matches → `buildQuickStatsSection` returns null.
- 1 match → `buildQuickStatsSection` returns null.
- 2 matches → `buildQuickStatsSection` returns a section with both.
- Section's glance card has `title: 'Quick stats'`.

**View metadata:**

- `type === 'sections'`.
- `title === 'Home'`.
- `path === 'home'`.
- `icon === 'mdi:home-variant'`.

**`buildHomeView` integration:**

- Empty input → 1 section (Welcome only).
- Input with weather + outdoor temp + presence → 2 sections (Welcome with weather line + Quick stats with 3 entities).
- Input with one outdoor temp only → 1 section (Welcome, no glance).

### `home-view.fixtures.test.ts` — fixture-driven snapshot

- `english-cluttered` → Welcome + Quick stats. Snapshot the structure (sections array with cards). The fixture has `Outdoor Temperature`, `Outdoor Humidity`, no weather, no anyone_home, no power → expect 2 entities in Quick stats.
- `czech-tidy` → Welcome only. The fixture has no outdoor/weather/presence/power entities (all area-attributed indoor sensors) → expect glance section dropped.
- Anti-regression: every entityId in the home view's glance card (when present) is in the input entity list.

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/generator/src/home-view.ts` | Create | `buildHomeView`, `pickQuickStatsEntities`, `HomeView` type alias, internal helpers |
| `packages/generator/src/lovelace-types.ts` | Modify | Add `MarkdownCard`, `GlanceCard` to union |
| `packages/generator/src/index.ts` | Modify | Re-export public surface |
| `packages/generator/src/__tests__/home-view.test.ts` | Create | Unit tests |
| `packages/generator/src/__tests__/home-view.fixtures.test.ts` | Create | Fixture-driven snapshot |

## Open questions resolved during brainstorming

- **Quick stats picker:** Heuristic patterns (option B). Hardcoded entity_ids would show "unavailable" on bare-minimum installs.
- **HomeView vs RoomView:** Type alias (`type HomeView = RoomView`). Same structural shape; naming clarity for consumers.
- **Welcome card without weather:** Greeting only (no empty 2nd line, no failing template).
- **Glance threshold:** ≥2 matches required, otherwise skip section entirely.
- **Pattern order:** Fixed declaration order — weather, outdoor temp, outdoor humidity, presence, power.
- **Multiple weather entities:** Pick the first; don't try to merge or pick a "primary".
- **Title/path/icon:** Pinned to `'Home' / 'home' / 'mdi:home-variant'` per dashboard doc.

## Risks

- **Pattern misses for non-English-named installs.** Czech users with `sensor.venku_teplota` ("outside temperature") won't match the English `outdoor`/`outside` substrings. The czech-tidy fixture explicitly tests this gap by producing a Welcome-only home view. Future tickets (P1b-1 for German keywords, P2-9 for SPA i18n) can extend the pattern list with localized substrings.
- **Jinja template syntax in markdown.** If HA's template engine evolves and breaks the `now().strftime(...)` syntax, the greeting renders raw. Acceptable for P1a alpha; revisit if reported.
- **MarkdownCard / GlanceCard added to LovelaceCard union.** P1a-8 will need to validate or pass through these card types when serializing the dashboard. The discriminated-union narrowing pattern already in place handles this without changes.

## Acceptance

P1a-7 closes when:

- [ ] `buildHomeView`, `pickQuickStatsEntities`, `HomeView` type, and the new card types exported from `@lovelacer/generator`.
- [ ] All unit tests in `home-view.test.ts` pass.
- [ ] Fixture snapshot tests in `home-view.fixtures.test.ts` pass for both fixtures (english-cluttered → Welcome + Quick stats; czech-tidy → Welcome only).
- [ ] Snapshots reviewed for sanity (the 2 entities in english-cluttered's Quick stats are the expected outdoor temp + outdoor humidity; czech-tidy has no glance section).
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
