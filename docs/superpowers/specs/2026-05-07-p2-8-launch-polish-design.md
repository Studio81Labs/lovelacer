# P2-8 — Launch Polish (Brand, Assets, README) · Design

**Status:** Approved · **Date:** 2026-05-07 · **Ticket:** P2-8 (Phase 2, sized M after expansion from S)

The final polish pass before alpha launch. Three workstreams ship together:

1. Wire `docs/BRAND.md`'s color + typography tokens into the live SPA, sweeping all out-of-brand classes.
2. Drop the Lovelacer logo / wordmark / favicon assets in place; replace HA add-on placeholder PNGs.
3. Rewrite repo + add-on READMEs with screenshots, a demo GIF, and a quick-start.

The acceptance criteria from `docs/ROADMAP.md`:

> **AC:** Add-on store listing renders with banner; README has 4+ screenshots; demo GIF in README.

This spec covers code, assets, and documentation. The implementation plan derived from this spec lists 10 tasks; two of them (capturing screenshots and recording the demo GIF) are manual steps performed against a real HA instance.

## 1. Scope

### In scope

- Replace `packages/web/src/styles.css`'s `brand-*` `@theme` block with the four-ramp BRAND.md palette (amber + stone + forest + danger) and the three typography tokens (Instrument Serif + Inter + JetBrains Mono).
- Add the `.lovelacer-wordmark` utility class.
- Self-host fonts via `@fontsource` packages (no Google Fonts CDN dependency at runtime — HA add-ons must work offline).
- Sweep every `.vue` file in `packages/web/src/` for out-of-brand color classes (`brand-*`, `red-*`, `green-*`, `blue-*`) and migrate to brand tokens per the mapping in §3.
- Add a CI guardrail that fails when out-of-brand color classes are reintroduced.
- Drop the brand SVG sources into `packages/web/public/brand/` and author missing dark + favicon variants.
- Generate PNG exports of the mark + lockup for HA add-on Supervisor (`apps/addon/icon.png`, `apps/addon/logo.png`).
- Wire the favicon into `packages/web/index.html`.
- Replace the `<h1>Lovelacer</h1>` headers in `App.vue` and `WelcomeStep.vue` with the mark + wordmark lockup.
- Rewrite the repo `README.md` using the brand-locked draft, extended with a hero block, demo GIF embed, 5-shot "What you get" gallery, and HA Supervisor quick-start section.
- Refresh `apps/addon/README.md` to drop outdated "Phase 1a alpha" constraints (Czech-only, no overrides, no diff — all shipped in Phase 1b/2).
- Bump `apps/addon/config.yaml` `version` from `0.0.1` to `0.2.0` with a `CHANGELOG.md` entry summarising Phase 1+2.
- Add `docs/screenshots/` directory holding the 5 PNGs + `demo.gif` + a capture-checklist `README.md`.

### Out of scope

- Submitting the add-on to the Home Assistant Community Add-ons collection (https://github.com/hassio-addons/repository). Separate review process; deferred to Phase 3.
- A `packages/web/scripts/export-brand.ts` automated SVG→PNG pipeline. PNGs are committed as one-time exports; BRAND.md's reference to the script is aspirational and tracked as a follow-up.
- Project rename (Lovelacer → Roomly). Locked: name stays Lovelacer per BRAND.md §Name.
- Dark-mode theming of the SPA itself. The dark-variant SVGs are authored so the asset set is complete, but no UI consumes them yet.
- Re-organisation of `docs/`. Existing files (ARCHITECTURE.md, PRD.md, etc.) stay where they are.

## 2. Brand tokens (`packages/web/src/styles.css`)

Full replacement of the existing `@theme` block. The new file:

```css
@import 'tailwindcss';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/instrument-serif/400.css';
@import '@fontsource/instrument-serif/400-italic.css';
@import '@fontsource-variable/jetbrains-mono';

/*
 * Lovelacer brand tokens — Tailwind v4 @theme.
 * Source of truth: docs/BRAND.md
 *
 * Three roles:
 *   amber  → primary (brand, action, focus)
 *   stone  → neutrals (surfaces, text, borders)
 *   forest → accent (success, status, secondary data)
 *   danger → semantic (errors only)
 *
 * Use the named scale (amber-500, stone-900, forest-700) — never raw hex.
 * If you find yourself reaching for a color outside these four ramps,
 * stop and check whether you actually need a new color or whether one of
 * these would do.
 */
@theme {
  /* ─── Primary · Amber ─── */
  --color-amber-50: #fff4d9;
  --color-amber-100: #fbe2a6;
  --color-amber-300: #f4b73d;
  --color-amber-500: #c76712;
  --color-amber-700: #7a3d08;
  --color-amber-900: #3d1e04;

  /* ─── Neutral · Stone ─── */
  --color-stone-25: #faf8f4;
  --color-stone-50: #f1efe8;
  --color-stone-200: #d3d1c7;
  --color-stone-500: #888780;
  --color-stone-700: #444441;
  --color-stone-900: #2c2c2a;

  /* ─── Accent · Forest ─── */
  --color-forest-50: #e8f0dd;
  --color-forest-300: #7ca84a;
  --color-forest-700: #3f6b1a;
  --color-forest-900: #1f3a0c;

  /* ─── Semantic · Danger ─── */
  --color-danger-50: #fcebeb;
  --color-danger-700: #791f1f;

  /* ─── Typography ─── */
  --font-display: 'Instrument Serif', 'Times New Roman', Georgia, serif;
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace;
}

html {
  font-family: var(--font-sans);
  background: var(--color-stone-25);
  color: var(--color-stone-900);
}

/*
 * Wordmark utility — wraps the trailing italic-r so we don't have to
 * remember the markup every time. Use as:
 *   <span class="lovelacer-wordmark">lovelace<i>r</i></span>
 */
.lovelacer-wordmark {
  font-family: var(--font-display);
  font-weight: 400;
  color: var(--color-stone-900);
}
.lovelacer-wordmark > i {
  font-style: italic;
  color: var(--color-amber-500);
}
```

### Why self-host fonts

HA add-ons run in the user's home network. Some users (deliberately) firewall outbound traffic to non-essential domains, including `fonts.googleapis.com`. A runtime CDN dependency creates a real correctness gap for the alpha audience.

`@fontsource` packages bundle the WOFF2 files at build time and serve them via the same Vite static asset pipeline as the rest of the app. No runtime DNS resolution required.

The variable-weight package for JetBrains Mono cuts download size vs. shipping two separate weight files.

### Stone-25 viability

Tailwind v4 generates `bg-stone-25` from a custom `--color-stone-25` token without needing extra config. The plan task verifies this by running `pnpm --filter web build` and grepping the output CSS for `.bg-stone-25 {`. If the class isn't generated for any reason, the fallback is the explicit `html { background: var(--color-stone-25); }` rule above (already in the spec) — the only place stone-25 is used is the page background.

## 3. Color class migration

Sweep every file under `packages/web/src/` matching `**/*.vue`. Apply the table below verbatim:

| Old class | New class | Notes |
|---|---|---|
| `bg-brand-600`, `bg-brand-700` | `bg-amber-500`, `bg-amber-700` | Legacy `brand-*` retired entirely. |
| `text-brand-800` | `text-amber-700` | Brand has no `-800`. |
| `bg-red-50`, `bg-red-100` | `bg-danger-50` | |
| `bg-red-600`, `bg-red-700` | `bg-danger-700` | Brand has no `-600`. |
| `text-red-700`, `text-red-800`, `text-red-900` | `text-danger-700` | |
| `border-red-200`, `border-red-300` | `border-danger-700` (or remove) | Spec doesn't define danger border tokens; use 700 with low opacity if needed, or drop the explicit border. |
| `bg-green-50`, `bg-green-100` | `bg-forest-50` | |
| `bg-green-600`, `bg-green-700` | `bg-forest-700` | |
| `text-green-600`, `text-green-800`, `text-green-900` | `text-forest-700` | |
| `bg-blue-100` (diff "moved" badges) | `bg-stone-50` | Brand has no blue. Moved-in/moved-out is informational; neutral fits better than amber (warning) or forest (success). |
| `text-blue-800` (diff "moved" badges) | `text-stone-700` | Same reasoning. |

**Hover variants migrate alongside their base** — `hover:bg-red-700` → `hover:bg-danger-700`, etc. Same for `focus:ring-*`.

**Components touched** (estimated from current grep output, may grow during the actual sweep):

- `App.vue` — error banner, settings button, header
- `AnalyzeButton.vue` — primary CTA
- `ApplyBar.vue` — apply button + result banner
- `DiffBanner.vue` — added/moved/removed pills
- `DashboardPreview.vue` — preview frame
- `EntityRow.vue` — diff badges, override dropdown, manual indicator
- `HealthBar.vue` — connection status pill
- `InviteGate.vue` — error states
- `MiscBucket.vue` — bulk action bar
- `OverridesBar.vue` — pending changes banner
- `RemovedEntitiesPanel.vue` — danger-toned panel
- `RoomList.vue` — confidence pills, diff badges
- `SettingsModal.vue` — modal chrome, save button states
- `SuggestionsPanel.vue` — suggestion cards, accept/dismiss buttons
- `onboarding/WelcomeStep.vue`, `PreviewStep.vue`, `DoneStep.vue` — wizard chrome
- `onboarding/ProgressDots.vue` — step indicator

**Test fallout.** Component tests that assert specific class names (e.g., `expect(wrapper.classes()).toContain('bg-red-50')`) need updating to the new class. Most existing tests assert `data-testid` presence or behaviour rather than classes; fallout estimated at <10 test lines total.

## 4. CI guardrail

After the sweep lands, prevent regression with a one-liner pre-commit and CI grep:

```bash
# scripts/check-brand-colors.sh
#!/usr/bin/env bash
set -euo pipefail
if grep -rE "(bg|text|border|ring|from|to|via|fill|stroke|outline)-(brand|red|blue|green|gray|yellow|orange|pink|purple|indigo|teal|cyan|sky|emerald|rose|fuchsia|violet|lime|neutral|slate|zinc)-" packages/web/src --include="*.vue"; then
  echo
  echo "ERROR: out-of-brand Tailwind color classes detected above."
  echo "P2-8 locked the palette to amber / stone / forest / danger only."
  echo "See docs/BRAND.md."
  exit 1
fi
```

Wired into the existing CI workflow as a step alongside `eslint`, and exposed as `pnpm check:brand` in the root `package.json`. The grep intentionally lists every Tailwind built-in palette name explicitly so a new palette name (say `Tailwind v5 adds "amber-pink"`) doesn't slip through.

**Escape hatch.** A future contributor with a real reason to use an out-of-brand colour can add a per-line `<!-- brand: allow <reason> -->` HTML comment and refine the grep to skip flagged lines. Not implementing the escape hatch in P2-8 — keep it strict until the first justified violation appears.

## 5. Brand assets

### File layout

```
packages/web/public/brand/
  lovelacer-mark.svg          ← from your kit (light variant)
  lovelacer-lockup.svg        ← from your kit (light variant)
  lovelacer-mark-dark.svg     ← NEW; tile colors flip per BRAND.md §Logo table
  lovelacer-lockup-dark.svg   ← NEW; mark dark variant + wordmark in stone-25
  lovelacer-favicon.svg       ← NEW; mark only, optimised for 16-32px

apps/addon/
  icon.png                    ← copy of lovelacer-icon-512.png renamed (HA Supervisor convention)
  logo.png                    ← copy of lovelacer-logo-1024.png renamed (HA Supervisor convention)

packages/web/index.html
  + <link rel="icon" type="image/svg+xml" href="/brand/lovelacer-favicon.svg" />
```

### Dark variants

`lovelacer-mark-dark.svg` uses the dark-bg colour ordering from BRAND.md:

| Position | Light bg | Dark bg |
|---|---|---|
| Top | `#C76712` (amber-500) | `#F4B73D` (amber-300) |
| Middle | `#F4B73D` | `#C76712` |
| Bottom-left | `#C76712` | `#F4B73D` |
| Bottom-mid | `#FBE2A6` (amber-100) | `#7A3D08` (amber-700) |
| Bottom-right | `#7CA84A` (forest-300) | `#7CA84A` (unchanged) |

The lockup-dark variant uses the dark-mark + the wordmark in `#FAF8F4` (stone-25) with the italic-`r` in `#F4B73D` (amber-300).

### Favicon optimisation

`lovelacer-favicon.svg` strips the `lovelacer-mark.svg` source down for small-pixel rendering: drop the `<title>` / `<desc>` attributes (browsers don't read them on favicons), tighten viewBox, increase the corner radius from `rx="4"` (10% of 40px tile) to `rx="3"` so it doesn't disappear at 16px. Tile fills unchanged.

### PNG generation

One-time using `rsvg-convert` (ships with `librsvg` on macOS via Homebrew, on most Linux distros natively):

```bash
# from repo root
rsvg-convert -w 512 -h 512 packages/web/public/brand/lovelacer-mark.svg \
  -o packages/web/public/brand/lovelacer-icon-512.png

rsvg-convert -w 1024 -h 400 packages/web/public/brand/lovelacer-lockup.svg \
  -o packages/web/public/brand/lovelacer-logo-1024.png

cp packages/web/public/brand/lovelacer-icon-512.png apps/addon/icon.png
cp packages/web/public/brand/lovelacer-logo-1024.png apps/addon/logo.png
```

If `rsvg-convert` isn't available, the alternative is `npx @resvg/resvg-cli` — same flags, same output. The plan documents both.

### App.vue + WelcomeStep header swap

Replace the existing plain `<h1>Lovelacer</h1>` headers with the mark + wordmark lockup using the utility class.

**App.vue** (current):
```vue
<header class="flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
    <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
  </div>
  <button type="button" data-testid="settings-button" ...>⚙</button>
</header>
```

**App.vue** (new):
```vue
<header class="flex items-center justify-between gap-3">
  <div class="flex items-center gap-3">
    <img src="/brand/lovelacer-mark.svg" alt="" class="h-10 w-10" aria-hidden="true" />
    <div>
      <h1 class="lovelacer-wordmark text-3xl leading-none">lovelace<i>r</i></h1>
      <p class="mt-1 text-sm text-stone-500">
        Home Assistant dashboards that organize themselves
      </p>
    </div>
  </div>
  <button type="button" data-testid="settings-button" ...>⚙</button>
</header>
```

Same lockup pattern in `WelcomeStep.vue`'s heading.

The settings button keeps its existing `data-testid` and `aria-label`. Tests asserting button presence continue to pass.

**Test updates.** Tests asserting the tagline text "Home Assistant dashboard generator · alpha" become "Home Assistant dashboards that organize themselves". Tests asserting `<h1>` text content "Lovelacer" continue to match — the rendered text from `<h1>lovelace<i>r</i></h1>` is still `lovelacer` for `wrapper.text()`, and existing tests use case-insensitive matching.

## 6. Documentation

### Repo `README.md` structure

Replaces the current outdated README ("no code yet") with the brand-locked draft, extended with launch sections.

```
1. Hero block
   - Centred <img src="packages/web/public/brand/lovelacer-lockup.svg" width="320">
   - Tagline below: "Home Assistant dashboards that organize themselves."
   - One-liner: existing draft line ("Point Lovelacer at your Home Assistant install...")
   - Three GitHub badges row: License (MIT) · Add-on version (0.2.0) · CI status

2. Demo GIF
   - <img src="docs/screenshots/demo.gif" alt="..." width="720"> centred
   - Caption: "From zero to a dashboard in under a minute."

3. Why this exists
   - Verbatim from your draft (the wall-of-entities paragraph + "does that weekend's work in five minutes")

4. What you get  ← NEW (gallery)
   - 2-column GitHub-friendly Markdown table:
     | <img src="docs/screenshots/01-hero.png" alt="..."> | <img src="docs/screenshots/02-onboarding-welcome.png" alt="..."> |
     | Caption: "The main view after Analyze. Confidence pills, dashboard preview, apply bar." | Caption: "The first-run wizard. Pick a language, the rest auto-fills." |
     | <img src="docs/screenshots/03-diff-view.png" alt="..."> | <img src="docs/screenshots/04-suggestions.png" alt="..."> |
     | Caption: "Re-analyze after you add devices. Diff shows what moves." | Caption: "Suggestions panel. Accept smart improvements with one click." |
     | <img src="docs/screenshots/05-applied-in-ha.png" alt="..." colspan=2> | |
     | Caption: "The result. A native HA dashboard. No custom cards." | |

5. Quick start  ← NEW
   - 3-step ordered list, mirroring docs/ADDON_INSTALL.md condensed:
     1. In HA: **Settings → Add-ons → ⋮ → Repositories** → add `https://github.com/Studio81Labs/lovelacer`
     2. Find the **Lovelacer** card → click **Install**
     3. Click **Open Web UI** → follow the wizard
   - Footer line: "Full instructions and troubleshooting: [`docs/ADDON_INSTALL.md`](./docs/ADDON_INSTALL.md)."

6. Architecture at a glance
   - Verbatim diagram from your draft

7. Documents
   - Verbatim table from your draft (already references BRAND.md)

8. Decisions locked
   - Verbatim from your draft

9. Decisions still open
   - Verbatim from your draft (Tier 3 pricing, custom cards, default LLMs)

10. Roadmap
    - "Phase 2 (alpha-ready) ships now. Phase 3 starts after public-alpha feedback."
    - Link to docs/ROADMAP.md

11. License
    - MIT one-liner; no separate CONTRIBUTING.md (out of scope for P2-8).
```

### Add-on `apps/addon/README.md` rewrite

Refreshed to reflect what shipped. Same structure as today; refreshed content.

```
1. Title: Lovelacer (unchanged)

2. One-liner: "Generate a Home Assistant Lovelace dashboard from your existing entities." (unchanged)

3. What it does — refreshed:
   1. Click **Analyze** — Lovelacer reads HA registries, detects rooms across 8 languages.
   2. Review the preview. Re-run Analyze any time; the diff view shows what moved.
   3. Adjust per-entity overrides, accept smart suggestions, then click **Apply**.

4. Configuration table — keep current (log_level + dashboard_url_path).

5. Logs — keep current.

6. Privacy + scope — refreshed:
   - Drop "doesn't persist anything yet" (Phase 2 added SQLite for overrides, snapshots, settings, onboarding state).
   - Add: "All state lives in the add-on's `/data` volume; nothing leaves your HA instance."
   - Keep: "Doesn't modify other dashboards or automations."

7. Status — REPLACE existing alpha-1a section entirely:
   "Phase 2 alpha. Multi-language room detection (EN / CS / DE / ES / FR / IT / PL / NL).
   Re-analyze diff view. Per-entity overrides + smart suggestions. Settings UI for
   language and dashboard sections. Onboarding wizard for first-run.
   The single honest constraint: custom Lovelace cards (Mushroom, Tile-extras) are
   not generated — pure HA core cards only."

8. Source + reporting bugs — keep current.
```

### `apps/addon/CHANGELOG.md` entry

```markdown
## 0.2.0 — 2026-05-07

### Phase 2 (Polish & Release)

- Re-analyze diff view: see what changes when you re-run Analyze.
- YAML export: save the generated dashboard as YAML alongside storage-mode apply.
- Floor-aware grouping: rooms group by floor when areas have a floor assigned.
- Bulk-assign for the Misc bucket: select multiple unscoped entities and assign in one click.
- Suggestions panel: smart improvements with one-click accept.
- Settings screen: configure language and which dashboard sections appear.
- Onboarding wizard: first-run flow walks new users through analyze → preview → apply.
- Brand identity: new logo, full visual identity, Inter + Instrument Serif typography.

### Phase 1b (already shipped, summarised)

- Multi-language room detection: EN, CS, DE, ES, FR, IT, PL, NL.
- Per-entity overrides: drag rooms manually, mark entities hidden.
- Invite-code gate for closed alpha.
- HA add-on packaging with multi-arch images (aarch64, amd64, armv7).

### Phase 1a (already shipped, summarised)

- Initial analyze + apply flow against a single HA instance.
- HA storage-mode dashboard generation.
- WebSocket connection with retry/backoff.
```

### `apps/addon/config.yaml` version bump

```yaml
version: '0.2.0'  # was '0.0.1'
```

### `docs/screenshots/` directory

```
docs/screenshots/
  README.md                      ← capture checklist (re-shoot recipe)
  01-hero.png                    ← full ready-state main view
  02-onboarding-welcome.png      ← language picker
  03-diff-view.png               ← diff banner + room expanded with badges
  04-suggestions.png             ← suggestions panel close-up
  05-applied-in-ha.png           ← actual generated dashboard inside HA
  demo.gif                       ← full happy path, ~30-45s
```

The `docs/screenshots/README.md` capture checklist documents:

- **Source HA fixture state** required for repeatable shots:
  - Entity count: 50–200 (small enough to fit in screenshots, large enough to show variety).
  - At least 3 areas with assigned entities + 1 unscoped batch (for the Misc bucket).
  - At least 1 binary_sensor + 1 climate + 1 light per assigned area.
  - Diff fixture: clone the HA registry, modify ~5 entities (move 2, add 2, remove 1), re-run Analyze.
- **Browser viewport:** 1280×800. Chrome DevTools device toolbar set to "Responsive" with that resolution.
- **Per-screenshot expected state:** precise (which rooms expanded, which suggestions visible, scroll position).
- **Demo GIF script** (≤45s, looped, ≤2MB):
  1. Load page → InviteGate visible (skipped if dev mode pre-accepts).
  2. Wizard Welcome step → click language picker → click Continue.
  3. Wizard Preview step → wait for analyze → click Apply.
  4. Apply success → Done step.
  5. Click "Open dashboard" → HA dashboard renders.
  - Tooling: macOS QuickTime screen recording → `ffmpeg -i in.mov -vf "fps=15,scale=1280:-1" -loop 0 demo.gif` → `gifsicle -O3 demo.gif`. Or LICEcap directly to GIF.
- **PNG optimisation:** `oxipng -o 4 docs/screenshots/*.png` after capture; aim <500 KB per shot.

The capture step is performed manually by the implementer/operator; the plan provides the recipe but the actual rendering requires a real HA instance.

## 7. Build sequence

10 tasks, ordered for incremental commits:

1. **Brand tokens in `styles.css`.** Replace existing block. Add `@fontsource` deps. Add `.lovelacer-wordmark` utility. Verify `pnpm --filter web build` picks up tokens (output CSS contains `.bg-amber-500 { … }`, `.bg-forest-50 { … }`, `.bg-danger-50 { … }`).
2. **Color class sweep.** Apply migration table across `.vue` files. Update component test class assertions. `pnpm -r test`, `pnpm typecheck` clean.
3. **CI guardrail.** Add `scripts/check-brand-colors.sh` + wire into CI workflow. Verify it fails when re-introducing `bg-red-50` (test by adding-then-reverting).
4. **Brand asset files.** Drop the two source SVGs. Author dark + favicon variants. Generate PNG exports via `rsvg-convert`. Replace `apps/addon/{icon,logo}.png`.
5. **Favicon wiring.** Add `<link rel="icon" type="image/svg+xml" href="/brand/lovelacer-favicon.svg">` to `packages/web/index.html`. Verify in dev (`pnpm --filter web dev` → check browser tab).
6. **App.vue + WelcomeStep header lockup.** Apply the new lockup markup from §5. Update tagline-text test assertions.
7. **Manual: capture screenshots + demo GIF.** Operator runs the app against a real HA instance, follows the checklist in `docs/screenshots/README.md`. Commits the binary assets.
8. **Repo `README.md` rewrite.** Drop in the brand-locked draft + extend with hero, GIF embed, gallery, quick-start. Verify image paths resolve (open the file's GitHub preview locally via `gh repo view --web` or push and check a draft PR).
9. **Add-on `apps/addon/README.md` + `CHANGELOG.md` + `config.yaml` version bump.** Refresh per §6.
10. **Visual verification pass.** Manual: walk through every screen of the running app. Confirm no leftover Tailwind defaults peek through. Confirm fonts load locally (no network requests to `fonts.googleapis.com` in DevTools Network tab). Confirm favicon renders. No commit unless something needs fixing.

## 8. Verification

### Per-task

| Task | Verification |
|---|---|
| Tokens / styles.css | `pnpm --filter web build` succeeds; output CSS contains `.bg-amber-500`, `.bg-forest-50`, `.bg-danger-50`, `.bg-stone-25`. No network requests to `fonts.googleapis.com` in DevTools Network panel during dev. |
| Color sweep | `pnpm -r test`, `pnpm typecheck` (with `vue-tsc`), `pnpm exec eslint .`, `pnpm format:check`, `pnpm -r build` all pass. |
| CI guardrail | `pnpm check:brand` exits 0 against the migrated code. Manually add `bg-red-50` to a `.vue` file, run `pnpm check:brand` → exits 1 with a usable error. Revert. |
| Brand assets | Open generated PNGs in Preview / image viewer — render correctly. `apps/addon/icon.png` and `logo.png` are non-empty PNG files with the expected dimensions (`file` command shows `512 x 512` and `1024 x 400ish`). |
| Favicon | Open `pnpm --filter web dev`, browser tab shows the L-mark favicon. |
| App.vue lockup | Manual visual check: header shows the mark + wordmark with italic-`r` in amber. |
| Screenshots / GIF | Files committed to `docs/screenshots/`, total size <5 MB. PNGs ≤500 KB each. demo.gif ≤2 MB. |
| Repo README | GitHub renders correctly (push branch, open PR, scroll the README preview). All `<img>` tags resolve. |
| Add-on README | Render preview via HA Supervisor: add the local repo branch as a custom add-on repo on a dev HA, confirm the listing card shows the new banner + the refreshed description. |
| Config + CHANGELOG | `apps/addon/config.yaml` version is `0.2.0`. `CHANGELOG.md` has the new entry at the top. |

### Cross-cutting

- All workspace tests pass (`pnpm -r test`).
- Typecheck passes with `vue-tsc` (`pnpm typecheck`).
- ESLint passes (`pnpm exec eslint .`).
- Prettier formatted (`pnpm format:check`).
- Build succeeds (`pnpm -r build`).
- `pnpm check:brand` (the new guardrail) passes.
- Visual smoke test: manually walk through every screen of the running app, confirm no leftover non-brand colours peek through.

## 9. Risks and edge cases

### Tailwind v4 may not generate `bg-stone-25`

Mitigation: the `styles.css` already includes an explicit `html { background: var(--color-stone-25); }` rule for the page background. If `bg-stone-25` doesn't generate, the page background still works; any component using `bg-stone-25` would need to fall back to an inline `style="background: var(--color-stone-25)"` or use `bg-stone-50`. The only place stone-25 is referenced in the current code is the page background, so this is a low-impact risk.

### Wordmark utility uses `<i>` for italic-`r`

`<i>` is technically semantic in HTML5 (alternative voice / mood), so screen readers may add inflection when reading it. Acceptable for a brand mark. If accessibility audit later flags it, swap to `<span class="italic-r">` and move the styling there. Not blocking.

### "Disconnected" health pill colour

Currently neutral grey (`bg-stone-50`). After the brand sweep, `bg-stone-50` resolves to the brand stone (`#f1efe8`), slightly warmer. Not a regression — visually it remains a muted neutral.

### `border-red-200` in some components

Brand spec doesn't define danger border tokens (only fill `danger-50` and text `danger-700`). The migration drops the explicit border or uses `border-danger-700` with low Tailwind opacity (`border-danger-700/20`). Plan picks per-component during the sweep — usually dropping the border is fine since the danger fill already provides visual separation.

### Demo GIF file size

Hard ceiling: 2 MB. If the ~45s recording exceeds that even after `gifsicle -O3`, fall back options (in order): drop fps to 12, drop dimension to 1024, trim to 30s, drop to 8 colours. Document the fallback in the capture checklist.

### Existing PR / branch screenshots

Old README/PR descriptions will reference paths that no longer exist (`apps/addon/icon.png` is replaced, not moved). No action needed — historical PRs are read-only and link rot is acceptable.

## 10. Tests

### What changes

| Area | Test files affected | Change |
|---|---|---|
| App.vue tagline | `packages/web/src/__tests__/App.test.ts` | Update assertion strings from "Home Assistant dashboard generator · alpha" → "Home Assistant dashboards that organize themselves" |
| WelcomeStep header | `packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts` | Same tagline update if asserted |
| Class assertions | Various component tests | Update any `expect(wrapper.classes()).toContain('bg-red-50')` to the migrated class |
| Brand guardrail | New: `scripts/check-brand-colors.sh` | No unit test; smoke-tested manually in Task 3 verification |

### What does not change

- Behaviour tests (`data-testid` queries, store interactions, emit assertions) continue to work — none of those touch CSS classes.
- The existing brand-classes tests in components don't get more strict; the guardrail script provides regression protection at the repo level instead.

## 11. Open questions

1. **Self-hosted JetBrains Mono variable font weight axis.** `@fontsource-variable/jetbrains-mono` ships a single variable-font WOFF2 covering 100–800 weight. The brand only uses 400 + 500. Variable font is ~80 KB, two-weight static fonts would be ~50 KB combined. Variable wins on flexibility but is slightly heavier. **Decision: ship variable.** Future weight changes don't need new asset commits.

2. **Where does the demo GIF live?** Two options: `docs/screenshots/demo.gif` (alongside PNGs) vs. `assets/demo.gif` (separate). **Decision: `docs/screenshots/demo.gif`.** One directory for all launch-shot binaries; simpler README references.

3. **Should the screenshot capture be automated?** Vue Test Utils + happy-dom + Puppeteer screenshot capture against a mock HA fixture is technically possible. **Decision: defer to a Phase-3 ticket.** Manual capture for the alpha launch is acceptable; automating it requires a real HA fixture or a meaningful mock, both of which are project-level investments rather than launch-polish tasks.

---

_Source of truth for P2-8 implementation. The plan derived from this spec lives at `docs/superpowers/plans/2026-05-07-p2-8-launch-polish.md`._
