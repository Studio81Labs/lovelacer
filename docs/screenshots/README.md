# Lovelacer screenshots — capture checklist

This directory holds the public-facing screenshots and demo GIF used in
`README.md`. Re-shoot any of them when the UI changes meaningfully.

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

## Per-shot recipe

### `01-hero.png` — main view, ready state

- Wizard already completed (onboarding row in SQLite has `completed_at`
  set), invite gate already accepted.
- Click **Analyze**, wait for the preview to render.
- Expand 2 rooms with mixed confidence pills.
- Visible: the new mark + wordmark header, HealthBar (HA connected),
  DiffBanner (with non-zero counts), SuggestionsPanel (1–2 suggestions
  visible), RoomList (3–4 rooms with at least one expanded), MiscBucket
  header (collapsed), DashboardPreview, ApplyBar.
- Capture full page (Chrome DevTools → Capture full size screenshot).

### `02-onboarding-welcome.png` — wizard welcome step

- Fresh install state (clear the onboarding row in SQLite, or use a new
  `/data` volume for the add-on).
- Accept the invite, then on the welcome step:
  - Language dropdown set to **Auto (match all)** (the default).
- Capture the **wizard panel only** (~1024×640 bounding box, not the
  full page). DevTools → Element screenshot on the
  `[data-testid="welcome-step"]` div.

### `03-diff-view.png` — re-analyze diff

- After applying once, modify the HA fixture (move 2 entities to
  different rooms, add 2 new, remove 1).
- Click **Analyze** again.
- Capture the DiffBanner with non-zero added / moved / removed counts,
  plus one room expanded showing the per-row diff badges.

### `04-suggestions.png` — suggestions panel close-up

- Set up an HA fixture with a clearly suggestable pattern (e.g. 12
  unscoped sensors all named `kitchen_*` but unassigned).
- Click **Analyze**.
- Capture the SuggestionsPanel close-up (element screenshot on
  `[data-testid="suggestions-panel"]` if present, or the visible region
  containing the panel).

### `05-applied-in-ha.png` — generated dashboard inside HA

- Click **Apply**, wait for success.
- Open the HA Lovelace UI (sidebar → **Lovelacer — Home**).
- Capture the HA browser tab (full page, including HA chrome — sidebar,
  topbar, the rendered dashboard with 3–4 cards).

### `demo.gif` — full happy path

Recording script (≤45 seconds, ≤2 MB):

1. Page loads → InviteGate visible.
2. Type the invite code → click **Accept**.
3. Wizard Welcome step → optional: change language → click **Continue**.
4. Wizard Preview step → wait for analyze → click **Apply**.
5. Apply success → Done step.
6. Click **Open dashboard** → HA dashboard renders.

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

## Status

The README and add-on listing already reference the filenames listed in
this checklist; commit the captured binaries here when they're ready and
the references resolve automatically. Until they exist, the
`<img src="docs/screenshots/...">` tags in `README.md` show as broken
images on GitHub — that's expected for the alpha pre-capture state.
