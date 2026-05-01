# P1b-1 German Keyword Pack + `german-massive` Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add German (`de`) language support to the room keyword database and ship a multi-floor `german-massive` test fixture (~130 entities) that exercises the new patterns, with detect + grouping snapshot tests verifying ≥85% of visible entities land in non-misc rooms.

**Architecture:** 14 new rows in `packages/shared/src/room-keywords.ts` (one per canonical room, pre-normalized per the existing storage convention). One new fixture file `tests/fixtures/german-massive.ts` using the established `_builder` helpers. Three new test files / extensions: `german-massive.test.ts` (structural), `detect.fixtures.test.ts` (per-entity room assignments), `grouping.fixtures.test.ts` (per-room domain split).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest (`globals: false`), the existing `tests/fixtures/_builder/` helpers (`area`, `floor`, `device`, `light`, `switch_`, `tempSensor`, `humiditySensor`, `motion`, `occupancy`, `door`, `climate`, `registryEntry`, `fixture`).

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1b-1-german-keyword-pack-design.md`](../specs/2026-05-01-p1b-1-german-keyword-pack-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'` (verbatimModuleSyntax).
- Tests use `import { describe, it, expect } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- If husky's lint-staged or `pnpm format:check` reports drift, run `pnpm --dir <worktree> format`, re-stage, and retry.
- The room-keywords storage convention: lowercase, no diacritics, single-space-separated, only `[a-z0-9 ]`. The schema test in `packages/shared/src/__tests__/room-keywords.test.ts` enforces this.

---

## Task 1: Add 14 German keyword rows to `room-keywords.ts`

**Files:**
- Modify: `packages/shared/src/room-keywords.ts`

The schema test in `packages/shared/src/__tests__/room-keywords.test.ts` already enforces the storage convention (lowercase, no diacritics, only `[a-z0-9 ]`, valid `canonical` + `language`). This task adds rows; the schema test catches typos at CI time without any new test code.

- [ ] **Step 1: Read the existing file**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/shared/src/room-keywords.ts
```

Confirm the existing pattern: each canonical room has one or two rows (one per language). The `cs` (Czech) rows always come right after the matching `en` row inside the same `// ── canonical ──` comment block.

- [ ] **Step 2: Append a `de` row to each canonical block**

For each of the 14 canonical rooms, add a `de` row immediately after the matching `cs` row (keeping the comment-block grouping intact). The complete set of new rows:

```ts
// kitchen
{ canonical: 'kitchen', language: 'de', patterns: ['kuche', 'kochnische'] },

// living_room
{ canonical: 'living_room', language: 'de', patterns: ['wohnzimmer', 'wohnraum', 'wohnbereich'] },

// bedroom — `excludes: ['bad']` mirrors the CS pattern's `excludes: ['koupelna']`
{
  canonical: 'bedroom',
  language: 'de',
  patterns: ['schlafzimmer', 'schlafraum'],
  excludes: ['bad'],
},

// bathroom
{ canonical: 'bathroom', language: 'de', patterns: ['bad', 'badezimmer', 'dusche', 'waschraum'] },

// office
{ canonical: 'office', language: 'de', patterns: ['buro', 'arbeitszimmer', 'arbeitsraum'] },

// hallway — `Diele` is regional (Northern Germany alternative to `Flur`)
{ canonical: 'hallway', language: 'de', patterns: ['flur', 'diele', 'eingang', 'eingangsbereich'] },

// garage
{ canonical: 'garage', language: 'de', patterns: ['garage'] },

// garden
{ canonical: 'garden', language: 'de', patterns: ['garten', 'aussen', 'terrasse', 'balkon'] },

// dining_room
{
  canonical: 'dining_room',
  language: 'de',
  patterns: ['esszimmer', 'essbereich', 'speisezimmer'],
},

// laundry — `waschraum` overlap with bathroom is intentional; corroboration breaks ties
{
  canonical: 'laundry',
  language: 'de',
  patterns: ['waschkuche', 'hauswirtschaftsraum', 'waschraum'],
},

// basement
{ canonical: 'basement', language: 'de', patterns: ['keller', 'untergeschoss'] },

// attic — `'speicher'` alone is too generic; use the explicit compound
{ canonical: 'attic', language: 'de', patterns: ['dachboden', 'speicherraum', 'dachgeschoss'] },

// kids_room
{ canonical: 'kids_room', language: 'de', patterns: ['kinderzimmer', 'kinder'] },

// guest_room
{ canonical: 'guest_room', language: 'de', patterns: ['gastezimmer', 'gastzimmer'] },
```

Each row goes inside its canonical's existing `// ── canonical ──` comment block, immediately after the `cs` row (or, if there's no `cs` row, after the `en` row).

- [ ] **Step 3: Run the schema test**

```bash
pnpm --dir <worktree> vitest run packages/shared/src/__tests__/room-keywords.test.ts
```

Expected: PASS. If a pattern violates the storage convention (uppercase, diacritic, etc.), the schema test fails with a specific message pointing at the offending row.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green. The analyzer's existing fixture tests (english-cluttered, czech-tidy) still pass — the new DE patterns don't conflict with EN or CS substrings the existing fixtures use.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/shared/src/room-keywords.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(shared): add German keyword rows to room-keywords.ts

14 new DE rows covering all canonical rooms. Storage convention
(lowercase, no diacritics, only [a-z0-9 ]) applies; schema test in
__tests__/room-keywords.test.ts catches typos at CI time.

Notable choices documented in the design spec:
- bedroom.excludes = ['bad'] mirrors CS's excludes = ['koupelna']
  for combined master-bath layouts.
- waschraum is shared between bathroom + laundry intentionally;
  corroboration breaks the tie based on sibling entities.
- attic uses 'speicherraum' compound instead of 'speicher' (memory
  sense too generic).
- hallway includes 'diele' as the Northern Germany regional variant.

P1b-1 layer 1 of 5 (keyword pack). Fixture next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `tests/fixtures/german-massive.ts`

**Files:**
- Create: `tests/fixtures/german-massive.ts`

Multi-floor German home. ~130 entities across 13 areas declared in the fixture, plus a couple more "no-area" outdoor entities. Mirrors the structure of `czech-tidy.ts` but bigger and with more domain variety.

- [ ] **Step 1: Read `czech-tidy.ts` for the pattern**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/tests/fixtures/czech-tidy.ts
```

Note: imports from `_builder/index.js`, declares floors then areas then devices then per-room entity arrays, exports a single `fixture({ meta, floors, areas, devices, entities })` call at the bottom.

- [ ] **Step 2: Create the fixture file**

Create `tests/fixtures/german-massive.ts`:

```ts
import {
  area,
  climate,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  occupancy,
  registryEntry,
  switch_,
  tempSensor,
} from './_builder/index.js'

const FX = 'german-massive'

// ── Floors ───────────────────────────────────────────────────────
const eg = floor('Erdgeschoss', { level: 0, icon: 'mdi:home-floor-g' })
const og = floor('Obergeschoss', { level: 1, icon: 'mdi:home-floor-1' })
const keller = floor('Keller', { level: -1, icon: 'mdi:home-floor-b' })

// ── Areas (German names with diacritics) ─────────────────────────
const kueche = area('Küche', { floor: eg.id, icon: 'mdi:silverware-fork-knife' })
const wohnzimmer = area('Wohnzimmer', { floor: eg.id, icon: 'mdi:sofa' })
const esszimmer = area('Esszimmer', { floor: eg.id, icon: 'mdi:silverware' })
const badEg = area('Bad EG', { floor: eg.id, icon: 'mdi:shower' })
const flur = area('Flur', { floor: eg.id, icon: 'mdi:door' })
const garage = area('Garage', { floor: eg.id, icon: 'mdi:garage-variant' })
const schlafzimmer = area('Schlafzimmer', { floor: og.id, icon: 'mdi:bed' })
const kinderzimmer = area('Kinderzimmer', { floor: og.id, icon: 'mdi:teddy-bear' })
const badOg = area('Bad OG', { floor: og.id, icon: 'mdi:shower' })
const gaestezimmer = area('Gästezimmer', { floor: og.id, icon: 'mdi:bed-empty' })
const kellerArea = area('Keller', { floor: keller.id, icon: 'mdi:stairs-down' })
const waschkueche = area('Waschküche', { floor: keller.id, icon: 'mdi:washing-machine' })
const hobbyraum = area('Hobbyraum', { floor: keller.id, icon: 'mdi:tools' })

// ── Devices ──────────────────────────────────────────────────────
const kuecheHue = device('Küche Hue', { manufacturer: 'Philips', area: kueche.id })
const kuecheBosch = device('Küche Bosch', { manufacturer: 'Bosch', area: kueche.id })
const kuecheAqara = device('Küche Aqara TH', { manufacturer: 'Aqara', area: kueche.id })

const wzHue = device('Wohnzimmer Hue', { manufacturer: 'Philips', area: wohnzimmer.id })
const wzAqara = device('Wohnzimmer Aqara TH', { manufacturer: 'Aqara', area: wohnzimmer.id })
const wzTado = device('Wohnzimmer Tado', { manufacturer: 'tado', area: wohnzimmer.id })
const wzSamsung = device('Wohnzimmer Samsung TV', {
  manufacturer: 'Samsung',
  area: wohnzimmer.id,
})

const ezHue = device('Esszimmer Hue', { manufacturer: 'Philips', area: esszimmer.id })

const badEgHue = device('Bad EG Hue', { manufacturer: 'Philips', area: badEg.id })
const badEgAqara = device('Bad EG Aqara TH', { manufacturer: 'Aqara', area: badEg.id })

const badOgHue = device('Bad OG Hue', { manufacturer: 'Philips', area: badOg.id })

const szHue = device('Schlafzimmer Hue', { manufacturer: 'Philips', area: schlafzimmer.id })
const szTado = device('Schlafzimmer Tado', { manufacturer: 'tado', area: schlafzimmer.id })
const szShelly = device('Schlafzimmer Shelly Blinds', {
  manufacturer: 'Shelly',
  area: schlafzimmer.id,
})

const kzHue = device('Kinderzimmer Hue', { manufacturer: 'Philips', area: kinderzimmer.id })

const gzHue = device('Gästezimmer Hue', { manufacturer: 'Philips', area: gaestezimmer.id })

const flurHue = device('Flur Hue', { manufacturer: 'Philips', area: flur.id })

const garageShelly = device('Garage Shelly', { manufacturer: 'Shelly', area: garage.id })

const kellerHue = device('Keller Hue', { manufacturer: 'Philips', area: kellerArea.id })

const wkBosch = device('Waschküche Bosch', { manufacturer: 'Bosch', area: waschkueche.id })

const hobbyHue = device('Hobbyraum Hue', { manufacturer: 'Philips', area: hobbyraum.id })

const gartenHue = device('Garten Hue', { manufacturer: 'Philips' })
// Garten/Terrasse area-less devices — entities tagged via friendlyName only

// ── Entities — Erdgeschoss ───────────────────────────────────────
const kuecheEntities = [
  light(FX, 'Küche Deckenlicht', { area: kueche.id, device: kuecheHue.id }),
  light(FX, 'Küche Spüle Lampe', { area: kueche.id, device: kuecheHue.id }),
  light(FX, 'Küche Arbeitsplatte', { area: kueche.id, device: kuecheHue.id }),
  switch_(FX, 'Küche Backofen', { area: kueche.id, device: kuecheBosch.id }),
  switch_(FX, 'Küche Geschirrspüler', { area: kueche.id, device: kuecheBosch.id }),
  switch_(FX, 'Küche Kühlschrank', { area: kueche.id }),
  motion(FX, 'Küche Bewegung', { area: kueche.id }),
  tempSensor(FX, 'Küche Temperatur', { area: kueche.id, device: kuecheAqara.id }),
  humiditySensor(FX, 'Küche Luftfeuchtigkeit', { area: kueche.id, device: kuecheAqara.id }),
  registryEntry(FX, 'sensor', 'Küche Helligkeit', { area: kueche.id }),
]

const wohnzimmerEntities = [
  light(FX, 'Wohnzimmer Deckenlicht', { area: wohnzimmer.id, device: wzHue.id }),
  light(FX, 'Wohnzimmer Stehlampe', { area: wohnzimmer.id, device: wzHue.id }),
  light(FX, 'Wohnzimmer Couch Lampe', { area: wohnzimmer.id, device: wzHue.id }),
  registryEntry(FX, 'media_player', 'Wohnzimmer Samsung TV', {
    area: wohnzimmer.id,
    device: wzSamsung.id,
  }),
  climate(FX, 'Wohnzimmer Heizung', { area: wohnzimmer.id, device: wzTado.id }),
  motion(FX, 'Wohnzimmer Bewegung', { area: wohnzimmer.id }),
  tempSensor(FX, 'Wohnzimmer Temperatur', { area: wohnzimmer.id, device: wzAqara.id }),
  humiditySensor(FX, 'Wohnzimmer Luftfeuchtigkeit', { area: wohnzimmer.id, device: wzAqara.id }),
  occupancy(FX, 'Wohnzimmer Anwesenheit', { area: wohnzimmer.id }),
  switch_(FX, 'Wohnzimmer Steckdose links', { area: wohnzimmer.id }),
]

const esszimmerEntities = [
  light(FX, 'Esszimmer Hängelampe', { area: esszimmer.id, device: ezHue.id }),
  light(FX, 'Esszimmer Wandlampe', { area: esszimmer.id, device: ezHue.id }),
  motion(FX, 'Esszimmer Bewegung', { area: esszimmer.id }),
  tempSensor(FX, 'Esszimmer Temperatur', { area: esszimmer.id }),
  switch_(FX, 'Esszimmer Steckdose Tisch', { area: esszimmer.id }),
]

const badEgEntities = [
  light(FX, 'Bad EG Deckenlicht', { area: badEg.id, device: badEgHue.id }),
  switch_(FX, 'Bad EG Lüfter', { area: badEg.id }),
  switch_(FX, 'Bad EG Handtuchwärmer', { area: badEg.id }),
  motion(FX, 'Bad EG Bewegung', { area: badEg.id }),
  humiditySensor(FX, 'Bad EG Luftfeuchtigkeit', { area: badEg.id, device: badEgAqara.id }),
  tempSensor(FX, 'Bad EG Temperatur', { area: badEg.id, device: badEgAqara.id }),
]

const flurEntities = [
  light(FX, 'Flur Deckenlicht 1', { area: flur.id, device: flurHue.id }),
  light(FX, 'Flur Deckenlicht 2', { area: flur.id, device: flurHue.id }),
  motion(FX, 'Flur Bewegung Eingang', { area: flur.id }),
  motion(FX, 'Flur Bewegung Treppe', { area: flur.id }),
  occupancy(FX, 'Flur Anwesenheit', { area: flur.id }),
  switch_(FX, 'Flur Schalter Garderobe', { area: flur.id }),
]

const garageEntities = [
  registryEntry(FX, 'cover', 'Garage Tor', { area: garage.id, device: garageShelly.id }),
  light(FX, 'Garage Deckenlicht', { area: garage.id }),
  motion(FX, 'Garage Bewegung', { area: garage.id }),
  tempSensor(FX, 'Garage Temperatur', { area: garage.id }),
  switch_(FX, 'Garage Steckdose Werkbank', { area: garage.id }),
]

// ── Entities — Obergeschoss ──────────────────────────────────────
const schlafzimmerEntities = [
  light(FX, 'Schlafzimmer Deckenlicht', { area: schlafzimmer.id, device: szHue.id }),
  light(FX, 'Schlafzimmer Bett links', { area: schlafzimmer.id, device: szHue.id }),
  light(FX, 'Schlafzimmer Bett rechts', { area: schlafzimmer.id, device: szHue.id }),
  occupancy(FX, 'Schlafzimmer Anwesenheit', { area: schlafzimmer.id }),
  climate(FX, 'Schlafzimmer Heizung', { area: schlafzimmer.id, device: szTado.id }),
  tempSensor(FX, 'Schlafzimmer Temperatur', { area: schlafzimmer.id }),
  humiditySensor(FX, 'Schlafzimmer Luftfeuchtigkeit', { area: schlafzimmer.id }),
  registryEntry(FX, 'cover', 'Schlafzimmer Rollladen', {
    area: schlafzimmer.id,
    device: szShelly.id,
  }),
  motion(FX, 'Schlafzimmer Bewegung', { area: schlafzimmer.id }),
]

const kinderzimmerEntities = [
  light(FX, 'Kinderzimmer Deckenlicht', { area: kinderzimmer.id, device: kzHue.id }),
  light(FX, 'Kinderzimmer Nachtlicht', { area: kinderzimmer.id, device: kzHue.id }),
  motion(FX, 'Kinderzimmer Bewegung', { area: kinderzimmer.id }),
  tempSensor(FX, 'Kinderzimmer Temperatur', { area: kinderzimmer.id }),
  humiditySensor(FX, 'Kinderzimmer Luftfeuchtigkeit', { area: kinderzimmer.id }),
  switch_(FX, 'Kinderzimmer Steckdose Schreibtisch', { area: kinderzimmer.id }),
]

const badOgEntities = [
  light(FX, 'Bad OG Spiegellicht', { area: badOg.id, device: badOgHue.id }),
  switch_(FX, 'Bad OG Lüftung', { area: badOg.id }),
  motion(FX, 'Bad OG Bewegung', { area: badOg.id }),
  humiditySensor(FX, 'Bad OG Luftfeuchtigkeit', { area: badOg.id }),
  tempSensor(FX, 'Bad OG Temperatur', { area: badOg.id }),
]

const gaestezimmerEntities = [
  light(FX, 'Gästezimmer Deckenlicht', { area: gaestezimmer.id, device: gzHue.id }),
  motion(FX, 'Gästezimmer Bewegung', { area: gaestezimmer.id }),
  tempSensor(FX, 'Gästezimmer Temperatur', { area: gaestezimmer.id }),
  switch_(FX, 'Gästezimmer Steckdose', { area: gaestezimmer.id }),
]

// ── Entities — Keller ────────────────────────────────────────────
const kellerEntities = [
  light(FX, 'Keller Deckenlicht 1', { area: kellerArea.id, device: kellerHue.id }),
  light(FX, 'Keller Deckenlicht 2', { area: kellerArea.id, device: kellerHue.id }),
  motion(FX, 'Keller Bewegung', { area: kellerArea.id }),
  humiditySensor(FX, 'Keller Luftfeuchtigkeit', { area: kellerArea.id }),
  registryEntry(FX, 'binary_sensor', 'Keller Wassermelder', {
    area: kellerArea.id,
    deviceClass: 'moisture',
  }),
  tempSensor(FX, 'Keller Temperatur', { area: kellerArea.id }),
]

const waschkuecheEntities = [
  switch_(FX, 'Waschküche Waschmaschine', { area: waschkueche.id, device: wkBosch.id }),
  switch_(FX, 'Waschküche Trockner', { area: waschkueche.id, device: wkBosch.id }),
  light(FX, 'Waschküche Deckenlicht', { area: waschkueche.id }),
  motion(FX, 'Waschküche Bewegung', { area: waschkueche.id }),
  humiditySensor(FX, 'Waschküche Luftfeuchtigkeit', { area: waschkueche.id }),
  registryEntry(FX, 'binary_sensor', 'Waschküche Wassermelder', {
    area: waschkueche.id,
    deviceClass: 'moisture',
  }),
  tempSensor(FX, 'Waschküche Temperatur', { area: waschkueche.id }),
]

const hobbyraumEntities = [
  light(FX, 'Hobbyraum Deckenlicht', { area: hobbyraum.id, device: hobbyHue.id }),
  motion(FX, 'Hobbyraum Bewegung', { area: hobbyraum.id }),
  switch_(FX, 'Hobbyraum Steckdose Werkbank', { area: hobbyraum.id }),
]

// ── Entities — outdoor (no area, friendly_name signal only) ─────
const outdoorEntities = [
  light(FX, 'Outdoor Light Garten', { device: gartenHue.id }),
  light(FX, 'Garten Wegbeleuchtung', { device: gartenHue.id }),
  light(FX, 'Terrasse Lampe', { device: gartenHue.id }),
  registryEntry(FX, 'weather', 'Garten Wetter', {}),
  occupancy(FX, 'Garten Anwesenheit', {}),
  registryEntry(FX, 'binary_sensor', 'Garten Tor Sensor', { deviceClass: 'door' }),
  tempSensor(FX, 'Garten Temperatur Außen', {}),
]

// ── Floating diagnostic / hidden / disabled (no area) ────────────
const floatingEntities = [
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Uptime', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Signal', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Linkquality', {
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hidden Battery Sonoff', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery Aqara', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery Tado', { hidden: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 1', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 2', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 3', { disabled: true }),
  registryEntry(FX, 'sensor', 'Disabled Stale Sensor', { disabled: true }),
]

export const germanMassive = fixture({
  meta: {
    name: 'german-massive',
    description:
      '~130 entities across 13 German-named areas spanning Erdgeschoss + ' +
      'Obergeschoss + Keller. Mostly area-attributed; ~7 outdoor entities tagged ' +
      'via friendlyName only (no area_id) and ~10 floating diagnostic / hidden / ' +
      'disabled entries to exercise normalization filters. Validates the new DE ' +
      'keyword pack including diacritic normalization (Küche → kuche), bedroom ' +
      'excludes(["bad"]), bathroom + laundry waschraum overlap, and substring ' +
      'matching across compound German words.',
  },
  floors: [eg, og, keller],
  areas: [
    kueche,
    wohnzimmer,
    esszimmer,
    badEg,
    flur,
    garage,
    schlafzimmer,
    kinderzimmer,
    badOg,
    gaestezimmer,
    kellerArea,
    waschkueche,
    hobbyraum,
  ],
  devices: [
    kuecheHue,
    kuecheBosch,
    kuecheAqara,
    wzHue,
    wzAqara,
    wzTado,
    wzSamsung,
    ezHue,
    badEgHue,
    badEgAqara,
    badOgHue,
    szHue,
    szTado,
    szShelly,
    kzHue,
    gzHue,
    flurHue,
    garageShelly,
    kellerHue,
    wkBosch,
    hobbyHue,
    gartenHue,
  ],
  entities: [
    ...kuecheEntities,
    ...wohnzimmerEntities,
    ...esszimmerEntities,
    ...badEgEntities,
    ...flurEntities,
    ...garageEntities,
    ...schlafzimmerEntities,
    ...kinderzimmerEntities,
    ...badOgEntities,
    ...gaestezimmerEntities,
    ...kellerEntities,
    ...waschkuecheEntities,
    ...hobbyraumEntities,
    ...outdoorEntities,
    ...floatingEntities,
  ],
})
```

- [ ] **Step 3: Verify the fixture compiles**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. The fixture file uses TypeScript types from `_builder/types.ts`; any missing required option or wrong helper signature surfaces as a tsc error.

- [ ] **Step 4: Verify the broader build is still green**

```bash
pnpm --dir <worktree> -r test
```

Expected: existing tests still pass. The new fixture isn't referenced from any test yet — that lands in Tasks 3-5.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add tests/fixtures/german-massive.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(fixtures): german-massive — multi-floor German home

~130 entities across 13 areas spanning Erdgeschoss, Obergeschoss, and
Keller. Mostly area-attributed with German names containing diacritics
(Küche, Bad EG, Bad OG, Gästezimmer, Waschküche). Includes ~7 outdoor
entities with no area_id (tagged via friendlyName), 10 floating
diagnostic / hidden / disabled entries, and a deliberately non-canonical
Hobbyraum to exercise misc-bucket fallback.

Domain mix covers all P1a-supported domains plus a Samsung TV
(media_player) and two covers (garage door, blinds) that fall through
to misc / "Other" in P1a — these get proper card mapping in P1b-2.

P1b-1 layer 2 of 5 (fixture). Structural test next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Structural test for `german-massive`

**Files:**
- Create: `tests/fixtures/__tests__/german-massive.test.ts`

Mirrors `czech-tidy.test.ts` and `english-cluttered.test.ts`. Asserts the fixture's structural integrity (entity count, area count, area names, area_id uniqueness, hidden/disabled entries present, all referenced devices exist, floor mapping). Does NOT yet verify detection — that's Tasks 4-5.

- [ ] **Step 1: Write the test file**

Create `tests/fixtures/__tests__/german-massive.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { germanMassive } from '../german-massive.js'

const fx = germanMassive

describe('german-massive fixture', () => {
  it('has thirteen rooms (areas)', () => {
    expect(fx.areas).toHaveLength(13)
  })

  it('has between 120 and 140 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(120)
    expect(fx.entities.length).toBeLessThanOrEqual(140)
  })

  it('declares three floors (Erdgeschoss, Obergeschoss, Keller)', () => {
    expect(fx.floors).toHaveLength(3)
    const names = fx.floors.map((f) => f.name)
    expect(names).toContain('Erdgeschoss')
    expect(names).toContain('Obergeschoss')
    expect(names).toContain('Keller')
  })

  it('every entity has a non-empty originalName', () => {
    for (const e of fx.entities) {
      expect(e.originalName, `entity ${e.entityId} has empty originalName`).toBeTruthy()
    }
  })

  it('all expected German-named areas appear in the area registry', () => {
    const expected = [
      'Küche',
      'Wohnzimmer',
      'Esszimmer',
      'Bad EG',
      'Bad OG',
      'Schlafzimmer',
      'Kinderzimmer',
      'Gästezimmer',
      'Flur',
      'Garage',
      'Keller',
      'Waschküche',
      'Hobbyraum',
    ]
    const names = fx.areas.map((a) => a.name)
    for (const expectedName of expected) {
      expect(names, `area "${expectedName}" missing`).toContain(expectedName)
    }
  })

  it('area ids are unique', () => {
    const ids = fx.areas.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least 5 hidden entities', () => {
    const hidden = fx.entities.filter((e) => e.hidden).length
    expect(hidden).toBeGreaterThanOrEqual(5)
  })

  it('has at least 4 disabled entities', () => {
    const disabled = fx.entities.filter((e) => e.disabled).length
    expect(disabled).toBeGreaterThanOrEqual(4)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds, `entity ${e.entityId} references missing device ${e.device}`).toContain(
          e.device,
        )
      }
    }
  })

  it('every entity referencing an area points at an existing area', () => {
    const areaIds = new Set(fx.areas.map((a) => a.id))
    for (const e of fx.entities) {
      if (e.area !== null) {
        expect(areaIds, `entity ${e.entityId} references missing area ${e.area}`).toContain(e.area)
      }
    }
  })

  it('every area referencing a floor points at an existing floor', () => {
    const floorIds = new Set(fx.floors.map((f) => f.id))
    for (const a of fx.areas) {
      if (a.floor !== null) {
        expect(floorIds, `area "${a.name}" references missing floor ${a.floor}`).toContain(a.floor)
      }
    }
  })

  it('contains every P1a domain (light, switch, sensor, binary_sensor, climate)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('contains at least one out-of-P1a-scope entity (cover or media_player)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    const outOfScope = ['cover', 'media_player'].some((d) => domains.has(d as never))
    expect(outOfScope).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/german-massive.test.ts
```

Expected: PASS — about 13 tests. If any assertion fails, the fixture has a structural inconsistency (e.g., a wrong area count, missing device reference). Fix the fixture, not the test.

- [ ] **Step 3: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green.

- [ ] **Step 4: Commit**

```bash
git -C <worktree> add tests/fixtures/__tests__/german-massive.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(fixtures): structural assertions for german-massive

Mirrors czech-tidy.test.ts: entity count, area count, floor count,
area name presence, hidden/disabled minimums, all device + area + floor
references resolve, all P1a domains represented + at least one
out-of-scope domain (cover or media_player) for misc-bucket testing.

P1b-1 layer 3 of 5 (structural test). Detect pipe next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend `detect.fixtures.test.ts` with `german-massive`

**Files:**
- Modify: `packages/analyzer/src/__tests__/detect.fixtures.test.ts`

Append a new `describe('detect — german-massive fixture', () => {...})` block matching the existing english-cluttered + czech-tidy patterns. The block runs `german-massive` through `fixtureToHaRegistries → normalize → detect` and asserts:
- Per-entity assignment is preserved by entity order.
- Misc bucket size is reasonable (≤15% of visible entities — the fixture has only 1 non-canonical area, `Hobbyraum`, so misc should be small).
- ≥85% of entities with non-null fixture area land in the canonical of that area.

- [ ] **Step 1: Read the existing file structure**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/analyzer/src/__tests__/detect.fixtures.test.ts
```

Note: imports `englishCluttered`, `czechTidy` from `../../../../tests/fixtures/...js`. Each fixture has its own `describe` block. The Czech block is the closest analog because Czech areas use slugs different from canonical ids (same situation as German: `kueche` slug vs. `kitchen` canonical).

- [ ] **Step 2: Add the german-massive import + describe block**

In `packages/analyzer/src/__tests__/detect.fixtures.test.ts`, add the new fixture import next to the existing two:

```ts
import { germanMassive } from '../../../../tests/fixtures/german-massive.js'
```

Append a new `describe` block at the end of the file (after the existing czech-tidy block):

```ts
describe('detect — german-massive fixture', () => {
  const ha = fixtureToHaRegistries(germanMassive)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('preserves entity order', () => {
    for (let i = 0; i < entities.length; i++) {
      expect(assignments[i]!.entityId).toBe(entities[i]!.entityId)
    }
  })

  it('misc bucket size is at most 15% of entities', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    const ratio = miscCount / assignments.length
    expect(
      ratio,
      `${miscCount}/${assignments.length} entities in misc`,
    ).toBeLessThanOrEqual(0.15)
  })

  it('≥85% of entities with non-null fixture area land in their fixture-area canonical', () => {
    // German area slugs differ from canonical ids (e.g. 'kueche' → 'kitchen'),
    // so we look up canonical via buildDetectionContext (same approach as
    // the czech-tidy block above).
    const ctx = buildDetectionContext(ha.areas)
    const areaIdToCanonical = new Map<string, string>()
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) {
        areaIdToCanonical.set(areaId, entry.canonical)
      }
    }

    const expectedById = new Map<string, string>()
    const haEntityById = new Map(ha.entities.map((e) => [e.entity_id, e]))
    for (const e of germanMassive.entities) {
      const haEntity = haEntityById.get(`${e.domain}.${e.objectId}`)
      const haAreaId = haEntity?.area_id ?? null
      if (haAreaId === null) continue
      const canonical = areaIdToCanonical.get(haAreaId)
      if (canonical === undefined) continue
      expectedById.set(`${e.domain}.${e.objectId}`, canonical)
    }

    let testable = 0
    let correct = 0
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const [id, expected] of expectedById) {
      const a = assignmentByEntityId.get(id)
      if (a === undefined) continue
      testable++
      if (a.roomId === expected) correct++
    }
    expect(testable).toBeGreaterThan(80)
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} matched`).toBeGreaterThanOrEqual(0.85)
  })

  it('all Bad EG and Bad OG entities resolve to bathroom', () => {
    const ctx = buildDetectionContext(ha.areas)
    const bathroomAreaIds: string[] = []
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical === 'bathroom') bathroomAreaIds.push(areaId)
    }
    expect(
      bathroomAreaIds.length,
      'fixture should declare two bathroom-canonical areas (Bad EG, Bad OG)',
    ).toBeGreaterThanOrEqual(2)

    const haEntityById = new Map(ha.entities.map((e) => [e.entity_id, e]))
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const e of ha.entities) {
      if (e.area_id === null) continue
      if (!bathroomAreaIds.includes(e.area_id)) continue
      const a = assignmentByEntityId.get(e.entity_id)
      expect(a?.roomId, `${e.entity_id} should be bathroom`).toBe('bathroom')
      // Quiet the unused-var lint for haEntityById (it'd be used in failure-debug paths)
      void haEntityById
    }
  })

  it('Hobbyraum entities fall through to misc (non-canonical room)', () => {
    const ctx = buildDetectionContext(ha.areas)
    let hobbyAreaId: string | null = null
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.name === 'Hobbyraum') {
        hobbyAreaId = areaId
        break
      }
    }
    expect(hobbyAreaId, 'Hobbyraum area should exist').not.toBeNull()

    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const e of ha.entities) {
      if (e.area_id !== hobbyAreaId) continue
      const a = assignmentByEntityId.get(e.entity_id)
      expect(a?.roomId, `${e.entity_id} should be misc`).toBe('misc')
    }
  })
})
```

- [ ] **Step 3: Run the new tests**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.fixtures.test.ts -t 'german-massive'
```

Expected: PASS — 6 tests. If the ≥85% threshold fails, look at the test output for which entities ended up in misc / wrong canonical and either:
1. Tweak the keyword patterns in `room-keywords.ts` (back to Task 1's commit; Task 1 should be re-amended only if the failure is genuinely a missing pattern, not a fixture issue).
2. Adjust the fixture entity name (if the entity has a confusing name that nobody would actually use in a real install).

The bathroom-resolves and Hobbyraum-misc tests pin specific behavior; if those fail, debug and fix at the keyword-pattern level.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/detect.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): detect.fixtures pipe german-massive through normalize+detect

New describe block runs german-massive through fixtureToHaRegistries →
normalize → detect, matching the existing english-cluttered and
czech-tidy blocks. Six assertions:

- One assignment per entity, order preserved.
- Misc bucket ≤15% of entities (fixture has 1 non-canonical area).
- ≥85% of entities with a fixture area land in that area's canonical
  (≥80 testable entities required).
- Both Bad EG and Bad OG areas resolve to bathroom (sanity check the
  duplicate-bathroom-area scenario).
- Hobbyraum entities fall through to misc (non-canonical room).

P1b-1 layer 4 of 5 (detect pipe). Grouping pipe next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extend `grouping.fixtures.test.ts` with `german-massive`

**Files:**
- Modify: `packages/analyzer/src/__tests__/grouping.fixtures.test.ts`

Final task. Adds a `describe('groupByDomain — german-massive fixture', () => {...})` block running `german-massive` through `groupByDomain` and locking the per-room domain split via inline snapshots.

- [ ] **Step 1: Read the existing file structure**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Note: imports `englishCluttered`, `czechTidy`, `fixtureToHaRegistries`, `normalize`, `detect`, `groupByDomain`. Each fixture has a `describe` block with a structural snapshot (per-room domain counts).

- [ ] **Step 2: Add german-massive import + describe block**

Add the import:

```ts
import { germanMassive } from '../../../../tests/fixtures/german-massive.js'
```

Append a new describe block after the existing czech-tidy block:

```ts
describe('groupByDomain — german-massive fixture', () => {
  const ha = fixtureToHaRegistries(germanMassive)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })

  it('matches structural snapshot', () => {
    const summary = groupings
      .filter((g) => g.roomId !== 'misc')
      .map((g) => ({
        roomId: g.roomId,
        groups: g.groups.map((sub) => ({ key: sub.key, count: sub.entities.length })),
      }))
    expect(summary).toMatchInlineSnapshot()
  })

  it('every canonical room has at least one group', () => {
    for (const g of groupings) {
      if (g.roomId === 'misc') continue
      expect(g.groups.length, `room ${g.roomId} should have ≥1 group`).toBeGreaterThan(0)
    }
  })

  it('hidden and disabled entities are excluded from grouping output', () => {
    const visibleEntityIds = new Set(
      ha.entities
        .filter((e) => e.hidden_by === null && e.disabled_by === null)
        .map((e) => e.entity_id),
    )
    for (const g of groupings) {
      for (const sub of g.groups) {
        for (const e of sub.entities) {
          expect(
            visibleEntityIds.has(e.entityId),
            `${e.entityId} (hidden or disabled) leaked into grouping`,
          ).toBe(true)
        }
      }
    }
  })
})
```

- [ ] **Step 3: Generate the snapshot**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts -t 'german-massive' -u
```

Expected: PASS. The `toMatchInlineSnapshot()` placeholder gets populated with the actual per-room domain split.

Open the file and inspect the snapshot. Sanity-check:
- `kitchen` should have `lights` (3) + a `climate` or `other` for the appliances, `activity`, `environment`.
- `bathroom` should appear once but represent both Bad EG + Bad OG entities (they share canonical = bathroom).
- `attic` should not appear (no fixture area with `Dachboden`/`Speicher` in the name).
- `misc` is filtered out by the snapshot helper.

If the snapshot looks wrong (e.g., `kitchen` is empty), debug:
1. The keyword patterns in `room-keywords.ts` may have a typo.
2. The fixture's area name might not match the pattern (e.g., `'Küchenecke'` would match `'kuche'` but `'Anrichte'` wouldn't).

- [ ] **Step 4: Re-run without `-u` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts -t 'german-massive'
```

Expected: PASS. The snapshot is now committed; subsequent runs should match.

- [ ] **Step 5: Verify the full build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All four green. If `format:check` fails on the new snapshot inline (Vitest formats it idiosyncratically), run `pnpm --dir <worktree> format`, re-stage, and retry.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/grouping.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): grouping.fixtures pipe german-massive through groupByDomain

New describe block runs german-massive through fixtureToHaRegistries →
normalize → detect → groupByDomain, locking the per-room domain split
via inline snapshot. Plus two anti-regression tests:

- Every non-misc canonical room has ≥1 group (no empty rooms in output).
- Hidden + disabled entities are excluded from the grouping output
  (matches existing behavior for english-cluttered + czech-tidy).

Closes P1b-1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1b-1 Acceptance Confirmation

- [ ] 14 new DE rows in `room-keywords.ts`, all passing the schema test.
- [ ] `german-massive.ts` fixture builds clean, structural test (~13 assertions) passes.
- [ ] `detect.fixtures.test.ts` runs `german-massive` through the pipe; ≥85% of entities with a fixture area land in that area's canonical; misc bucket ≤15%; both Bad EG + Bad OG resolve to bathroom; Hobbyraum falls through to misc.
- [ ] `grouping.fixtures.test.ts` snapshot for `german-massive` populated and stable.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` clean.
- [ ] No analyzer logic changes (data + fixture + tests only).
