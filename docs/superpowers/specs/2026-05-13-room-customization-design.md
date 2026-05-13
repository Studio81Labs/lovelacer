# Room Customization Design

## Goal

Let users override a room's display name and icon when Lovelacer's detected room metadata is not what they want. Let users also choose whether the room name appears on generated room cards. The customization should apply consistently in Lovelacer's review UI and in the generated Home Assistant dashboard.

## Approach

Persist optional room-level metadata in settings, next to the existing `roomOrder` preference:

```ts
roomOverrides?: Record<string, {
  name?: string
  icon?: string
  showNameOnCard?: boolean
}>
```

Keys are room ids from the analysis output. Missing fields keep the detected or canonical defaults. Empty override entries are removed before saving so legacy settings and untouched rooms keep today's behavior.

This stays in settings because room customization is a display preference for generated dashboard output, not an entity assignment override. It also reuses the existing settings GET/PUT route, SQLite row, frontend settings store, and preview-refresh flow.

## UX

`RoomList` adds an inline edit button on each room summary row. Opening it expands a compact form below the summary with:

- a name input prefilled from the current effective room name;
- an icon input prefilled from the current effective room icon;
- a toggle for showing the room name on generated room cards;
- Reset and Save actions.

The room row uses effective metadata immediately after save. Reset removes that room's customization and returns to the detected/canonical defaults. Editing is disabled in read-only contexts, matching entity override controls.

## Data Flow

1. Settings load from `/api/settings` with optional `roomOverrides`.
2. Server analysis applies effective room metadata to each `AnalyzedRoom` so Lovelacer's UI receives the same display name and icon that generation will use.
3. `App.vue` passes settings-backed room customization actions into `RoomList`.
4. Saving a room edit writes the updated settings through `/api/settings`.
5. After save, the app refreshes preview so `RoomList`, `DashboardPreview`, generated room views, and generated home room cards all agree.

## Generator Behavior

The generator accepts room display overrides when building room views and home sections. Room view title and icon use the effective room metadata. Home room cards use the effective name unless `showNameOnCard === false`, in which case the generated card omits the explicit room label and lets Home Assistant render its default card naming.

Path generation remains based on canonical room id for this feature. Renaming "Kitchen" to "Breakfast nook" changes visible labels, not the Lovelace view path, which avoids breaking existing navigation and snapshots.

## Error Handling

The settings route rejects malformed `roomOverrides` with `400 invalid_body`. The storage layer treats malformed persisted rows as invalid settings and falls back to `DEFAULT_SETTINGS`, matching current settings behavior.

If saving a room edit fails, the settings store keeps the user's pending edit in dirty state and surfaces the existing settings error. The preview remains on the last successfully saved metadata.

## Testing

Tests cover:

- shared/web settings types include optional `roomOverrides`;
- settings storage accepts legacy rows without `roomOverrides`;
- settings storage and route round-trip valid room overrides;
- route and storage reject malformed room override payloads;
- server analysis emits effective room display names and icons;
- generator applies custom names and icons to room views and home room cards;
- generator omits explicit room-card names when `showNameOnCard` is false;
- `RoomList` opens inline editing, saves a room override, resets it, and hides editing in read-only mode.
