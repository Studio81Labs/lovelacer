# Room Drag Order Design

## Goal

Let users define their preferred room order instead of relying on the current server-side alphabetical sort. The order should survive reloads and re-analysis, and new rooms should still appear predictably.

## Approach

Persist an optional `roomOrder: string[]` field in settings. The frontend will order the analyzed room list by this array first, then append any rooms not present in the saved preference sorted by their current display name. A missing or empty `roomOrder` keeps current behavior.

The room list will expose drag handles on room summary rows. Dragging a room emits the new room-id order to the parent app. `App.vue` writes the order through the existing settings store and saves it through `/api/settings`, reusing the current settings persistence path instead of adding a new API surface.

## UX

Each room row gets a small drag handle button at the start of the summary row. The whole row remains expandable through the existing `<details>` summary behavior. While the section search box is active, drag handles are disabled because the list is filtered and reordering a partial list would be ambiguous.

## Data Flow

1. `settings.roomOrder` loads from `/api/settings`.
2. `App.vue` passes `settings.effective.roomOrder` into `RoomList`.
3. `RoomList` renders rooms in preferred order plus any unknown rooms at the end.
4. On drag reorder, `RoomList` emits the full room-id order currently visible in the unfiltered room list.
5. `App.vue` calls a new `settings.setRoomOrder(ids)` helper and `settings.saveAndReanalyze()`.

## Error Handling

Invalid persisted rows with non-string `roomOrder` values are rejected by `SettingsStore` and fall back to defaults, matching existing settings behavior. The API route rejects invalid PUT bodies with `400 invalid_body`.

If saving the order fails, the settings store surfaces its existing error state. The UI keeps the server-provided order until the next successful save.

## Testing

Tests cover:

- shared/web settings types include optional `roomOrder`;
- settings storage accepts legacy rows without `roomOrder`;
- settings storage and route round-trip valid `roomOrder`;
- route rejects malformed `roomOrder`;
- `RoomList` orders rooms by preference and appends unknown rooms alphabetically;
- `RoomList` emits a new order after drag/drop;
- search disables drag ordering.
