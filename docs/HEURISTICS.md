# Heuristics — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27

The room detection algorithm. Determines, for every entity in the registry, which room it belongs to and how confident we are.

## Design principles

1. **Trust HA first.** If the user has set up areas, we use them. We don't override explicit user data.
2. **Be transparent about confidence.** Every assignment has a score. Low scores surface in the UI for review.
3. **Fail to "Misc," not to wrong placement.** Better to bucket an unknown into a Misc room than confidently place it in the wrong one.
4. **Multi-language from day one.** ~half of HA's user base is non-English-speaking; English-only matching is a non-starter. Current shipped keyword data covers EN, CS, and DE; the settings UI exposes Auto, EN, and CS.
5. **Respect overrides forever.** Once a user manually places an entity, we never re-decide for them.

## Detection priority chain

For every entity, evaluate sources in order. Higher-priority hits short-circuit lower ones, but their scores are recorded for the confidence calculation.

```
┌─────────────────────────────────────────────────────────────┐
│  Priority 0: User Override                                  │
│  → If override exists, use it. Confidence = 1.0. Stop.      │
└─────────────────────────────────────────────────────────────┘
                           │ no override
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Priority 1: Entity area_id                                 │
│  → Direct area assignment from entity registry              │
│  → Weight: 1.0                                              │
└─────────────────────────────────────────────────────────────┘
                           │ no entity area
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Priority 2: Device area_id                                 │
│  → Entity inherits room from its parent device              │
│  → Weight: 0.85                                             │
└─────────────────────────────────────────────────────────────┘
                           │ no device area
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Priority 3: Friendly name parsing                          │
│  → Match localized room keywords in friendly_name           │
│  → Weight: 0.6                                              │
└─────────────────────────────────────────────────────────────┘
                           │ no name match
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Priority 4: entity_id parsing                              │
│  → Match localized room keywords in object_id portion       │
│  → Weight: 0.5                                              │
└─────────────────────────────────────────────────────────────┘
                           │ no entity_id match
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Priority 5: Device name parsing                            │
│  → Same matching against device.name and device.name_by_user│
│  → Weight: 0.45                                             │
└─────────────────────────────────────────────────────────────┘
                           │ nothing matched
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Fallback: Misc room                                        │
│  → Surfaced in UI for user to assign                        │
│  → Confidence = 0.0                                         │
└─────────────────────────────────────────────────────────────┘
```

## Multi-language room detection

A `RoomKeyword` is a tuple of canonical room ID + language + matchers.

There are three related language surfaces:

- `LanguageCode` in `packages/shared/src/types.ts` declares EN, CS, DE, ES, FR, IT, PL, and NL so adding a future keyword pack stays a data change.
- `ROOM_KEYWORDS` in `packages/shared/src/room-keywords.ts` is the keyword data that ships today. It currently contains EN, CS, and DE rows.
- `SUPPORTED_LANGUAGES` is the user-facing detection setting. It currently exposes `auto`, `en`, and `cs`; `auto` matches all shipped keyword rows, including DE.

```typescript
type RoomKeyword = {
  canonical:
    | 'kitchen'
    | 'living_room'
    | 'bedroom'
    | 'bathroom'
    | 'office'
    | 'hallway'
    | 'garage'
    | 'garden'
    | 'dining_room'
    | 'laundry'
    | 'basement'
    | 'attic'
    | 'kids_room'
    | 'guest_room'
  language: 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'pl' | 'nl' // type-level future union
  patterns: string[] // exact words and common compounds
  excludes?: string[] // false-positive guards
}
```

### Sample keyword set (excerpt)

```typescript
const KEYWORDS: RoomKeyword[] = [
  // Kitchen
  { canonical: 'kitchen', language: 'en', patterns: ['kitchen'] },
  { canonical: 'kitchen', language: 'cs', patterns: ['kuchyne', 'kuchyně', 'kuch'] },
  { canonical: 'kitchen', language: 'de', patterns: ['kueche', 'küche', 'kuche'] },

  // Living room
  {
    canonical: 'living_room',
    language: 'en',
    patterns: ['living_room', 'living room', 'livingroom', 'lounge', 'family room'],
  },
  {
    canonical: 'living_room',
    language: 'cs',
    patterns: ['obyvak', 'obývák', 'obyvaci pokoj', 'obývací pokoj'],
  },
  { canonical: 'living_room', language: 'de', patterns: ['wohnzimmer', 'wohnraum'] },
  // ...

  // Bedroom
  {
    canonical: 'bedroom',
    language: 'en',
    patterns: ['bedroom', 'master_bedroom', 'master bedroom'],
    excludes: ['bathroom'],
  }, // 'bath' is a substring of 'bathroom' but different room
  { canonical: 'bedroom', language: 'cs', patterns: ['loznice', 'ložnice'] },
  { canonical: 'bedroom', language: 'de', patterns: ['schlafzimmer'] },
  // ...
]
```

The complete keyword table lives in `packages/shared/src/room-keywords.ts` — checked in, version-controlled, community-extensible. Today it ships ~14 canonical rooms × 3 keyword languages (EN, CS, DE) plus aliases. The broader `LanguageCode` union reserves ES, FR, IT, PL, and NL for future additions.

### Normalization before matching

Before matching, the candidate string goes through:

1. Lowercase
2. Remove diacritics (`küche` → `kuche`, `obývák` → `obyvak`)
3. Replace separators (`_`, `-`, multiple spaces) with single space
4. Trim

So `Light.Master_Bedroom_Lamp` becomes `light master bedroom lamp` and matches `master bedroom`.

### Language selection

Per Add-on `language` option:

- `auto` (default) — try all loaded languages, take the highest-confidence match
- explicit code — restrict matching to that language pack only. The user-facing setting currently supports `en` and `cs`; DE keywords participate through `auto` but are not yet an explicit selector option.

`auto` works because keyword sets are designed to minimize cross-language collisions. `kuchyne` won't match anything in English; `kitchen` won't match anything in Czech.

When ambiguity does occur (e.g., `garage` is similar across multiple languages), we prefer the language hinted by HA's `core.config` `language` field as a tiebreaker.

## Confidence scoring

Each detection source contributes a weighted signal. Base confidence is the maximum weight among fired signals; if multiple signals point to the **same** room they corroborate each other and add a small boost. Conflicting signals (different rooms) do not boost — they compete for `roomId` instead. See "Boost for corroboration" below.

```typescript
type Signal = {
  source: 'override' | 'entity_area' | 'device_area' | 'friendly_name' | 'entity_id' | 'device_name'
  weight: number
  matchedValue?: string
}

const WEIGHTS = {
  override: 1.0,
  entity_area: 1.0,
  device_area: 0.85,
  friendly_name: 0.6,
  entity_id: 0.5,
  device_name: 0.45,
}

// Base confidence only — see assemble() in detect.ts for the full formula
// including the corroboration boost.
function baseConfidence(signals: Signal[]): number {
  if (signals.length === 0) return 0
  return Math.max(...signals.map((s) => s.weight))
}
```

### Boost for corroboration

When multiple sources point to the same room, the assignment's confidence rises above the base (max-weight) value:

- `corroborationCount` = number of fired signals targeting the winning room.
- `boost = min(0.1, (corroborationCount - 1) * 0.05)` — +0.05 per additional corroborator, capped at +0.10.
- `confidence = min(1.0, winnerWeight + boost)` — capped at 1.0.

So an entity with `area_id = kitchen` AND name `Kitchen Light` has 2 corroborating signals → boost 0.05 → confidence `1.0 + 0.05 = 1.0` (capped). An entity with only a name match has 1 signal → no boost → confidence 0.6. An entity with name `Kitchen Light` AND device name `Kitchen Hub` (also matching kitchen) → 2 corroborating signals → 0.6 + 0.05 = 0.65.

Corroboration is target-specific. Signals firing toward different rooms don't boost each other — they compete for `roomId` instead. The implementation is in `packages/analyzer/src/detect.ts`'s `assemble()`, which has access to the internal `FiredSignal.target` field that the public `Signal` shape doesn't carry.

### Confidence buckets for UI

| Range       | Label  | UI treatment                                      |
| ----------- | ------ | ------------------------------------------------- |
| 0.85 – 1.00 | High   | No badge, default state                           |
| 0.50 – 0.84 | Medium | Yellow badge, expandable to show signals          |
| 0.01 – 0.49 | Low    | Orange badge, surfaced in "Review needed" panel   |
| 0.00        | None   | Goes to Misc room, surfaced in "Unassigned" panel |

## Domain grouping (within a room)

After room assignment, entities within each room are grouped by domain for card selection.

| Domain                                          | Group            | Card                  |
| ----------------------------------------------- | ---------------- | --------------------- |
| `light`, `switch` (with `device_class: outlet`) | Lights & Outlets | `tile`                |
| `climate`                                       | Climate          | `thermostat`          |
| `cover`                                         | Covers           | `tile`                |
| `media_player`                                  | Media            | `media-control`       |
| `sensor` (temperature, humidity, illuminance)   | Environment      | `tile`                |
| `binary_sensor` (motion, occupancy, door)       | Activity         | `tile`                |
| `lock`                                          | Security         | `tile`                |
| `camera`                                        | Cameras          | `picture-glance`      |
| `vacuum`                                        | Vacuum           | `tile`                |
| `fan`                                           | Fans             | `tile`                |
| Everything else                                 | Other            | `entities` (fallback) |

Detail in [DASHBOARD_GENERATION.md](./DASHBOARD_GENERATION.md).

## Edge cases

### Entity with no area, device with no area, name with no match

Goes to **Misc**. Surfaced in the Review screen for manual assignment.

### Entity area conflicts with device area

Entity area wins (priority 1 > priority 2). User intent at the entity level overrides the bulk device-level setting.

### Device controls multiple physical rooms

Example: a 4-channel relay controlling lights in kitchen, hallway, and two bedrooms. Each entity has been individually assigned `area_id`, so the entity-area heuristic resolves it. If they haven't been individually assigned, we fall through to name parsing per-entity.

### Helper / config / diagnostic entities

Entities with `entity_category: 'config'` or `'diagnostic'` are excluded from generation by default (controlled by setting `include_diagnostic`). They're available for inclusion in a Settings view if the user wants.

### Entities matching multiple room keywords

Example: `sensor.kitchen_bedroom_temperature` (rare but possible). Take the **first** match by document order in the string, on the assumption that primary intent comes first. Flag as low-confidence regardless.

### Hidden and disabled entities

`hidden_by` or `disabled_by` set → exclude from generation entirely. Not surfaced.

### Virtual / system entities

`sun.sun`, `weather.*`, `zone.*`, `person.*` — these don't belong to a room. Routed to a dedicated **Home / Overview** view rather than Misc.

```typescript
const NON_ROOM_DOMAINS = new Set([
  'sun',
  'weather',
  'zone',
  'person',
  'device_tracker',
  'updater',
  'persistent_notification',
])
```

### Floor support (HA 2024.8+)

If `floor_id` is set on areas, we group rooms by floor in the dashboard layout. If no floor data, ignore.

## Override mechanism

Overrides are entity-level and stored in SQLite (see [ARCHITECTURE.md](./ARCHITECTURE.md#local-data-model-sqlite)).

```typescript
type Override = {
  entity_id: string
  room_id: string | null // null = exclude from dashboard
  reason: 'manual' | 'rejected_suggestion'
  updated_at: number
}
```

Override semantics:

- Override → confidence 1.0, source 'override', shortcuts the priority chain.
- `room_id: null` → entity is hidden from the generated dashboard but kept for future suggestions.
- Overrides survive re-analysis and dashboard regeneration.
- "Reset overrides" is a destructive action behind a confirmation dialog.

## Suggestion engine (post-MVP, scoped here for completeness)

After analysis, generate suggestions:

| Suggestion              | Trigger                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Set area_id in HA**   | Entity has high-confidence name match but no `area_id`. Suggests user fix it at the source. |
| **Rename entity**       | `entity_id` is opaque (e.g., `0xabc_1`) but device name is clean.                           |
| **Group with device**   | Entity area differs from sibling entities of same device.                                   |
| **Move to better room** | Entity in Misc has medium-confidence match the user might want to accept.                   |
| **Hide diagnostic**     | Diagnostic entity slipped into a room view.                                                 |

These appear in a "Suggestions" panel. User accepts or dismisses each. Dismissals are remembered.

## Testing the heuristics

Fixture-driven, in `tests/fixtures/`:

```
tests/fixtures/
├── english-cluttered.json       # 200 entities, mixed quality, English
├── czech-tidy.json              # 80 entities, well-set-up Czech home
├── german-massive.json          # 600 entities, multi-floor German home
├── unset-areas.json             # 100 entities, no areas at all (worst case)
├── multilingual-mixed.json      # English HA UI but Czech entity names
└── pathological.json            # Edge cases: empty names, unicode, conflicts
```

For each fixture, we assert:

1. Each room has the expected entity count (±tolerance)
2. The Misc bucket size is below threshold
3. Average confidence is above threshold
4. Specific known-tricky entities land in the expected room

A regression in average confidence on any fixture fails CI.
