# Room View Toggle Chips Design

Date: 2026-05-16

## Context

The analysis screen shows a `DashboardPreview` section with the heading
`Will create N dashboard views` and a pill list sourced from
`preview.config.views`. The same generated config is used by the Apply bar,
YAML export, and apply snapshot, so any room selection behavior must change
the generated config rather than only changing the visible pill list.

Room-specific user preferences already live in settings:

- `roomOrder` controls displayed and generated room ordering.
- `roomOverrides` stores room display metadata such as custom name, icon, and
  whether to show the name on generated room cards.

This feature should follow that model. If a user starts over with a new
analysis, hidden room-view choices are remembered.

## Goal

Let users exclude individual room views from the generated Home Assistant
dashboard by toggling chips in the dashboard preview. All room views are
included by default. Hidden rooms remain editable in Lovelacer and can be
turned back on later.

## Non-Goals

- Do not hide entities from Lovelacer analysis.
- Do not move entities between rooms.
- Do not remove rooms from the room list UI.
- Do not make the Home dashboard view optional.
- Do not add a larger dashboard builder or per-card selection flow.

## Data Model

Add an optional field to the existing room override shape:

```ts
export interface RoomDisplayOverride {
  name?: string
  icon?: string
  showNameOnCard?: boolean
  hiddenFromDashboard?: boolean
}
```

Semantics:

- `undefined` or `false`: the room is included in generated dashboard views.
- `true`: the room is excluded from generated dashboard views.

The field is intentionally part of `roomOverrides` because it is a persistent
room-level dashboard preference, just like room name, icon, and card-label
visibility. No SQL migration is needed because settings are stored as JSON in
the single-row settings table. Storage validation and route Zod validation must
accept the new optional boolean.

Sanitization should preserve `hiddenFromDashboard: true` and remove falsey
values so saved settings remain compact. An override with only
`hiddenFromDashboard: true` is valid and must not be dropped as empty.

## Generation Behavior

The server preview pipeline should filter dashboard room groupings by
`roomOverrides[roomId]?.hiddenFromDashboard !== true` before generating the
Lovelace config.

The hidden-room filter must apply before:

- `buildHomeView`, so home sections such as rooms-by-floor and active rooms do
  not link to a room view that will not exist.
- `buildRoomViews`, so hidden rooms do not become HA dashboard tabs.
- `buildLovelaceConfig`, so apply/export/snapshot all share one filtered config.

The analysis response should still include hidden rooms in `rooms[]`, with
their assignments intact. This keeps the room editable and lets the user toggle
the dashboard view back on from the preview controls.

If every room is hidden, the generated config still includes the Home view. The
preview heading should count the Home view and the Apply flow remains valid.

## UI Behavior

`DashboardPreview` changes from a static pill list to toggle chips.

Rules:

- The Home chip is displayed as selected and disabled.
- Room chips are selected by default.
- Clicking a selected room chip saves `hiddenFromDashboard: true` for that room.
- Clicking a hidden room chip removes that flag.
- Hidden chips remain visible in the preview area, styled as muted and struck
  or otherwise clearly inactive.
- The heading should communicate the active generated count, for example
  `Will create 11 of 13 dashboard views` when two room views are hidden.
- The existing compact layout should stay intact. Toggle chips were chosen over
  a checkbox list or mini-card grid to preserve the current preview shape.

The save path should mirror room customization behavior:

- Stage and save the room override through the settings store.
- Trigger preview refresh so the generated config, heading, Apply bar, and YAML
  export reflect the persisted choice.
- Disable or visually busy the chip while its save or preview refresh is in
  flight to avoid conflicting repeated clicks.
- On save failure, revert the optimistic chip state using the existing settings
  store reconciliation behavior and surface the existing settings error path.

## Components and Contracts

Shared/server/web type surfaces must stay aligned:

- `packages/shared/src/types.ts`: extend `RoomDisplayOverride`.
- `packages/web/src/api/types.ts`: mirror the field.
- `packages/server/src/routes/settings.ts`: accept the optional boolean.
- `packages/server/src/storage/settings-store.ts`: validate the optional
  boolean on read.
- `packages/web/src/stores/settings.ts`: clone, sanitize, compare, and save the
  new field with existing room override logic.
- `packages/server/src/pipeline.ts`: filter dashboard groupings using the new
  room override flag.
- `packages/web/src/components/DashboardPreview.vue`: render toggle chips and
  emit room visibility changes.
- `packages/web/src/App.vue`: pass effective room override state and a save
  handler into `DashboardPreview`.
- `packages/web/src/components/ApplyBar.vue`: continue reading from
  `analyze.preview.config.views.length`; after refresh this count is already
  filtered.

## Accessibility

Each room toggle should be a real `button` with:

- `aria-pressed` matching inclusion state.
- A disabled state for Home and in-flight saves.
- A label that makes the action clear, such as `Hide Kitchen dashboard view`
  or `Show Kitchen dashboard view`.

Visual state must not rely only on color. Use an icon, opacity, text treatment,
or border style to distinguish excluded room views.

## Testing

Server and generator-facing tests:

- Settings route accepts and returns `hiddenFromDashboard`.
- Settings storage accepts valid optional booleans and rejects wrong types.
- Preview pipeline excludes hidden rooms from `config.views`.
- Home view does not include navigation cards for hidden rooms.
- Hidden rooms still appear in `rooms[]`.
- A preview with all rooms hidden still returns a config with the Home view.

Web tests:

- `DashboardPreview` renders toggle chips, with Home disabled.
- Clicking a room chip requests the correct room override save.
- Hidden room chips render as inactive and can be toggled back on.
- Heading reflects active generated count vs total available count.
- `ApplyBar` count updates after refreshed preview state.
- Settings store preserves the new field through clone/sanitize/save paths.

Manual validation:

- Analyze a fixture with multiple rooms.
- Hide one room view, verify the chip changes and preview refreshes.
- Apply or export YAML and confirm the hidden room view is absent.
- Start over or re-run analysis and confirm the hidden choice remains.
- Toggle the room back on and confirm the view reappears with existing custom
  name/icon/order settings.

## Risks

The main regression risk is contract drift: if the new setting is accepted in
the web store but not in server validation or storage validation, saves may fail
or persisted rows may fall back to defaults. The implementation should update
all mirrored type and validation surfaces in one change.

A second risk is broken Home-view navigation. Filtering must happen before
Home-view generation so Home does not render a navigation card pointing at a
hidden view path.

## Open Decisions

None. The selected UX is toggle chips, and hidden room-view choices are
persisted in room overrides.
