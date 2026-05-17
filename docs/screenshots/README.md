# Lovelacer screenshots — capture spec

This directory holds the public-facing screenshots and demo GIF used by
the repository README. Re-shoot any of them when the UI changes
meaningfully.

## Public surfaces

| Surface                 | Current screenshot usage                                                                                                           | Notes                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `README.md`        | Required: `demo.gif`, `01-hero.png`, `02-onboarding-welcome.png`, `03-diff-view.png`, `04-suggestions.png`, `05-applied-in-ha.png` | GitHub renders these paths directly from this directory. Missing files appear as broken images.                                                 |
| `apps/addon/README.md`  | None today                                                                                                                         | The add-on store copy is text-only for now. If screenshots are added later, reuse the same capture set unless the store needs a different crop. |
| Docs site (`apps/docs`) | None today; hero uses the logo                                                                                                     | Future docs pages can reuse these files, but do not add new screenshot names without updating this spec.                                        |
| Release checklist       | Tracks screenshot freshness                                                                                                        | Use this spec as the checklist source of truth before release.                                                                                  |

## Required files

| File                        | README role           | Shot type                  | Target size        |
| --------------------------- | --------------------- | -------------------------- | ------------------ |
| `demo.gif`                  | Hero motion demo      | Full happy path recording  | ≤2 MB, ≤45 seconds |
| `01-hero.png`               | Primary product proof | Main app ready state       | ≤500 KB            |
| `02-onboarding-welcome.png` | First-run setup       | Wizard panel crop          | ≤500 KB            |
| `03-diff-view.png`          | Re-analysis proof     | Diff banner + changed rows | ≤500 KB            |
| `04-suggestions.png`        | Suggestions proof     | Suggestions panel crop     | ≤500 KB            |
| `05-applied-in-ha.png`      | End result proof      | Native HA dashboard        | ≤500 KB            |

Do not rename these files without updating every `<img>` reference in
`README.md`.

## Source HA fixture

A repeatable shoot needs a known HA fixture state. Recommended:

- 50–200 entities (small enough to fit in a viewport, large enough to
  show variety).
- At least 3 areas with assigned entities + 1 unscoped batch
  (drives the Misc bucket shot).
- Per assigned area: 1 binary_sensor + 1 climate + 1 light + 1 sensor.
- Diff fixture: clone the HA registry, modify ~5 entities (move 2,
  add 2, remove 1), re-run Analyze.

Use `pnpm fixtures:load` against a dev HA instance, or shoot against a
real HA install if available.

## Browser viewport

- Chrome DevTools device toolbar set to **Responsive** at **1280 × 800**.
- 100% zoom (Cmd-0 / Ctrl-0).
- DevTools closed before each screenshot.
- Use the default light theme for both Lovelacer and Home Assistant.
- Avoid browser UI, terminal windows, personal entity names, access
  tokens, IP addresses, and notification drawers in the capture area.

## Per-shot recipe

### `01-hero.png` — main view, ready state

- Wizard already completed (onboarding row in SQLite has `completed_at`
  set).
- Click **Analyze**, wait for the preview to render.
- Expand 2 rooms with mixed confidence pills.
- Visible: the new mark + wordmark header, HealthBar (HA connected),
  DiffBanner (with non-zero counts), SuggestionsPanel (1–2 suggestions
  visible), RoomList (3–4 rooms with at least one expanded), MiscBucket
  header (collapsed), DashboardPreview, ApplyBar.
- Capture full page (Chrome DevTools → Capture full size screenshot).
- This is the most important still image. If the page is too tall, keep
  the top of the app, room list, dashboard preview, and apply bar visible;
  it is okay if lower panels require scrolling.

### `02-onboarding-welcome.png` — wizard welcome step

- Fresh install state (clear the onboarding row in SQLite, or use a new
  `/data` volume for the add-on).
- On the welcome step, leave the language dropdown set to **Auto (match
  all)** (the default).
- Capture the **wizard panel only** (~1024×640 bounding box, not the
  full page). DevTools → Element screenshot on the
  `[data-testid="welcome-step"]` div.
- Keep this crop quiet and focused; it should show first-run polish, not
  the surrounding app chrome.

### `03-diff-view.png` — re-analyze diff

- After applying once, modify the HA fixture (move 2 entities to
  different rooms, add 2 new, remove 1).
- Click **Analyze** again.
- Capture the DiffBanner with non-zero added / moved / removed counts,
  plus one room expanded showing the per-row diff badges.
- Crop to the top half of the ready state if needed. The diff banner and
  changed entity badges are the essential elements.

### `04-suggestions.png` — suggestions panel close-up

- Set up an HA fixture with a clearly suggestable pattern (e.g. 12
  unscoped sensors all named `kitchen_*` but unassigned).
- Click **Analyze**.
- Capture the SuggestionsPanel close-up (element screenshot on
  `[data-testid="suggestions-panel"]` if present, or the visible region
  containing the panel).
- Include at least one suggestion with an obvious action button. Avoid
  capturing a panel with every suggestion already dismissed.

### `05-applied-in-ha.png` — generated dashboard inside HA

- Click **Apply**, wait for success.
- Open the HA Lovelace UI (sidebar → **Lovelacer — Home**).
- Capture the HA browser tab (full page, including HA chrome — sidebar,
  topbar, the rendered dashboard with 3–4 cards).
- Use an HA instance with non-sensitive display names. If shooting a real
  home, rename rooms/entities or use a fixture before capture.

### `demo.gif` — full happy path

Recording script (≤45 seconds, ≤2 MB):

1. Fresh install page loads → Wizard Welcome step visible.
2. Optional: change language → click **Continue**.
3. Wizard Preview step → wait for analyze → click **Apply**.
4. Apply success → Done step.
5. Click **Open dashboard** → HA dashboard renders.

Tooling:

- macOS: QuickTime Player → File → New Screen Recording → record at
  1280×800. Trim to ≤45s. Convert to GIF:

  ```bash
  ffmpeg -i recording.mov -vf "fps=15,scale=1280:-1:flags=lanczos" \
    -loop 0 demo.gif
  gifsicle -O3 --colors 128 demo.gif > demo-opt.gif && mv demo-opt.gif demo.gif
  ```

- Cross-platform: [LICEcap](https://www.cockos.com/licecap/) records
  directly to `.gif` at 15 fps at the chosen frame size.

If the file size exceeds 2 MB after `gifsicle -O3`, fall back in this
order: drop fps to 12 → drop frame width to 1024 → trim to 30s → drop to
96 colours.

## Optimisation

After capture, optimise PNGs to keep the repo lean:

```bash
brew install oxipng    # one-time setup
oxipng -o 4 docs/screenshots/*.png
```

Aim for ≤500 KB per PNG. `demo.gif` ≤2 MB.

## Post-capture checks

Run these before committing binaries:

```bash
test -f docs/screenshots/demo.gif
test -f docs/screenshots/01-hero.png
test -f docs/screenshots/02-onboarding-welcome.png
test -f docs/screenshots/03-diff-view.png
test -f docs/screenshots/04-suggestions.png
test -f docs/screenshots/05-applied-in-ha.png
ls -lh docs/screenshots/demo.gif docs/screenshots/*.png
pnpm format:check
```

Open `README.md` on GitHub or in a Markdown preview and verify:

- No broken image icons.
- The GIF loops and stays readable.
- The two-column screenshot table remains balanced.
- Alt text still describes the visible UI accurately.

## Status

The root README already references the filenames listed in this spec;
commit the captured binaries here when they are ready and the references
resolve automatically. Until they exist, the image tags pointing at
`docs/screenshots/...` in `README.md` show as broken images on GitHub —
that is expected for the alpha pre-capture state.
