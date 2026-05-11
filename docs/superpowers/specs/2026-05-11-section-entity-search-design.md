# Section Entity Search Design

## Context

Large Home Assistant installs can produce long entity lists even after Lovelacer groups entities into rooms. The review screen currently separates entities into rooms, unassigned entities, administrative entities, and hidden entities, but each list must be scanned manually.

## Goal

Add live search/filter controls so users can quickly find an entity within each review section.

## Scope

- Add per-section search to:
  - Rooms
  - Entities not assigned to any room
  - Administrative entities
  - Hidden entities
- Match search text case-insensitively against both `entity_id` and friendly name.
- Filter dynamically as the user types.
- Preserve existing assignment, hide, bulk-select, and unhide behavior for visible rows.
- Show a compact empty state when a non-empty search has no matches.

## Non-Goals

- No server-side search or API contract change.
- No fuzzy matching, highlighting, keyboard command palette, or cross-section global search.
- No changes to Home Assistant entity grouping logic.

## UX

Each section owns its own search query. Clearing one search affects only that section.

Rooms use one search input above the room list. When the query is empty, the list behaves exactly as it does today. When the query is non-empty, each room keeps only matching assignments and rooms with zero matching assignments are hidden. Room summary metadata reflects the filtered room rows: the visible entity count uses the filtered assignment count while the underlying room data remains unchanged.

Unassigned, administrative, and hidden sections place a compact search input below the section summary and description/bulk controls where applicable. Their row lists render only matching entities.

The search uses clear placeholder text and accessible labels through existing i18n patterns.

## Component Design

Add a small local filtering helper in the web package for normalizing query text and testing entity rows. Components can call it with `entityId` plus friendly-name text.

`RoomList.vue`:
- Keep `searchQuery` as local state.
- Build `filteredRooms` from `props.rooms`.
- For each room, filter `assignments` by `entityId` and the fallback friendly name derived from `entityId`.
- Render `filteredRooms` instead of `rooms`.
- Keep diff and row override props unchanged.

`MiscBucket.vue`:
- Keep `searchQuery` as local state.
- Compute `filteredMisc` before the read-only cap.
- Bulk select operates on the filtered list so "Select all" means all currently visible matches.
- Reset selection when the source `misc` prop changes as today.

`AdministrativeEntitiesPanel.vue`:
- Keep `searchQuery` as local state.
- Render only filtered administrative entities.

`HiddenEntitiesPanel.vue`:
- Keep `searchQuery` as local state.
- Filter the computed hidden entries before rendering.

## Data Flow

Filtering is entirely client-side. It reads already-loaded preview data and override store state, then controls only what rows are rendered. It does not mutate preview data.

## Error Handling

There are no new network or persistence errors. Empty filtered results render a local empty state. Existing override save errors remain handled by the overrides store and existing bars.

## Testing

Add focused component tests for:

- Rooms: search by entity ID hides non-matching rooms and rows.
- Rooms: search by fallback friendly name works.
- Misc bucket: search filters rows, and bulk select operates on filtered rows.
- Administrative panel: search filters by friendly name/entity ID.
- Hidden panel: search filters hidden override rows, including fallback entries without server metadata.

Run the relevant web component test files and the full web test suite if practical.
