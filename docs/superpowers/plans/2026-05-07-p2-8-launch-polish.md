# P2-8 — Launch Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the full Lovelacer brand identity (palette, typography, logo) across the SPA, replace HA add-on placeholder branding with the designed assets, and rewrite the repo + add-on READMEs with screenshots and a demo GIF for the alpha launch.

**Architecture:** Three coordinated workstreams in a single branch. (1) Brand wiring in code: rewrite `packages/web/src/styles.css` with the four-ramp BRAND.md palette + self-hosted typography, then sweep every `.vue` file to migrate out-of-brand color classes. (2) Brand assets: drop the lockup/mark SVGs into `packages/web/public/brand/`, author dark + favicon variants, generate PNG exports via `rsvg-convert`, replace `apps/addon/{icon,logo}.png`, retire the placeholder PNG generator script. (3) Documentation: rewrite the repo `README.md` with hero / GIF / gallery / quick-start, refresh `apps/addon/README.md` to drop outdated alpha-1a constraints, bump the add-on version to 0.2.0 with a `CHANGELOG.md` entry summarising Phase 1+2.

**Tech Stack:** Vue 3 + Tailwind v4 (`@theme` blocks), Vitest for tests, `@fontsource` for self-hosted typography, `rsvg-convert` (or `@resvg/resvg-cli`) for SVG→PNG exports. The repo uses pnpm workspaces; commands assume `cwd = repo root` unless noted.

**Source spec:** `docs/superpowers/specs/2026-05-07-p2-8-launch-polish-design.md` (commit `c8056dc`).

---

## File Structure

**Files created:**

- `packages/web/public/brand/lovelacer-mark.svg` — brand mark, light variant (5-tile L)
- `packages/web/public/brand/lovelacer-lockup.svg` — full lockup (mark + wordmark), light
- `packages/web/public/brand/lovelacer-mark-dark.svg` — mark, dark-bg variant
- `packages/web/public/brand/lovelacer-lockup-dark.svg` — lockup, dark-bg variant
- `packages/web/public/brand/lovelacer-favicon.svg` — favicon (mark, optimised for 16-32px)
- `packages/web/public/brand/lovelacer-icon-512.png` — PNG export of mark, 512×512
- `packages/web/public/brand/lovelacer-logo-1024.png` — PNG export of lockup, 1024×400
- `scripts/check-brand-colors.sh` — CI guardrail blocking out-of-brand Tailwind classes
- `docs/screenshots/README.md` — screenshot + demo-GIF capture checklist
- `docs/screenshots/01-hero.png` — main view ready state (manual capture)
- `docs/screenshots/02-onboarding-welcome.png` — wizard welcome step (manual capture)
- `docs/screenshots/03-diff-view.png` — re-analyze diff banner (manual capture)
- `docs/screenshots/04-suggestions.png` — suggestions panel (manual capture)
- `docs/screenshots/05-applied-in-ha.png` — generated dashboard inside HA (manual capture)
- `docs/screenshots/demo.gif` — full happy path (manual capture)

**Files modified:**

- `packages/web/src/styles.css` — replace `@theme` block with brand tokens; add `@fontsource` imports; add `.lovelacer-wordmark` utility
- `packages/web/package.json` — add `@fontsource/inter`, `@fontsource/instrument-serif`, `@fontsource-variable/jetbrains-mono` deps
- `packages/web/index.html` — add `<link rel="icon">` to favicon
- `packages/web/src/App.vue` — header lockup + tagline
- `packages/web/src/components/onboarding/WelcomeStep.vue` — header lockup
- `packages/web/src/components/AnalyzeButton.vue` — `brand-*` → `amber-*`
- `packages/web/src/components/ApplyBar.vue` — `brand|red|green` migration
- `packages/web/src/components/DiffBanner.vue` — `red|green|blue` migration
- `packages/web/src/components/EntityRow.vue` — `green|blue` migration
- `packages/web/src/components/HealthBar.vue` — `green|brand` migration
- `packages/web/src/components/InviteGate.vue` — `brand|red` migration
- `packages/web/src/components/MiscBucket.vue` — `brand` migration
- `packages/web/src/components/OverridesBar.vue` — `brand|red` migration
- `packages/web/src/components/RoomList.vue` — `green|red|blue` migration
- `packages/web/src/components/SettingsModal.vue` — `brand|red` migration
- `packages/web/src/components/SuggestionsPanel.vue` — `brand` migration
- `packages/web/src/components/onboarding/DoneStep.vue` — `brand|green` migration
- `packages/web/src/components/onboarding/PreviewStep.vue` — `brand|red` migration
- `packages/web/src/components/onboarding/ProgressDots.vue` — `brand` migration
- `packages/web/src/__tests__/components/RoomList.test.ts` — update class assertions
- `packages/web/src/__tests__/App.test.ts` — update tagline assertion (if any)
- `packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts` — update heading assertion
- `apps/addon/icon.png` — replace with PNG export (binary)
- `apps/addon/logo.png` — replace with PNG export (binary)
- `apps/addon/README.md` — drop outdated alpha-1a constraints, refresh
- `apps/addon/config.yaml` — bump `version` from `0.0.1` to `0.2.0`
- `apps/addon/CHANGELOG.md` — prepend `0.2.0` entry summarising Phase 1+2
- `README.md` — full rewrite (hero, demo GIF, gallery, quick-start, brand-locked draft)
- `package.json` — add `check:brand` script; remove `generate:addon-assets` script
- `.github/workflows/ci.yml` — add `check:brand` step

**Files deleted:**

- `dev/scripts/generate-addon-assets.ts` — placeholder PNG generator (obsolete; brand assets now ship from designed SVGs)
- `pngjs` and `@types/pngjs` from root `package.json` `devDependencies` (no longer used after the script is deleted)

---

## Task 1: Brand tokens + self-hosted typography in `styles.css`

**Files:**

- Modify: `packages/web/src/styles.css` (full file replacement)
- Modify: `packages/web/package.json` (add `@fontsource` deps)

- [ ] **Step 1: Add `@fontsource` dependencies to `packages/web/package.json`**

Edit `packages/web/package.json` `dependencies` block. Add three packages keeping alphabetical-ish order:

```json
"dependencies": {
  "@fontsource-variable/jetbrains-mono": "^5.1.0",
  "@fontsource/inter": "^5.1.0",
  "@fontsource/instrument-serif": "^5.1.0",
  "@iconify-icons/mdi": "^1.2.48",
  "@iconify/vue": "^4.1.2",
  "pinia": "^2.2.4",
  "vue": "^3.5.10"
}
```

- [ ] **Step 2: Install the new deps**

Run from repo root:

```bash
pnpm install
```

Expected: lockfile updates; three packages added; no errors.

- [ ] **Step 3: Replace `packages/web/src/styles.css` entirely**

Overwrite the whole file:

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
 * Four roles:
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

- [ ] **Step 4: Verify Tailwind picks up the new tokens**

Run from repo root:

```bash
pnpm --filter @lovelacer/web build
```

Expected: build succeeds.

Then verify the generated CSS contains the new color utility classes:

```bash
grep -E "\.bg-(amber|forest|danger|stone)-(25|50|100|300|500|700|900)\b" packages/web/dist/assets/index-*.css | head
```

Expected: at least these classes present in output: `.bg-amber-500`, `.bg-forest-50`, `.bg-danger-50`, `.bg-stone-25`, `.bg-stone-50`. (Tailwind v4 only emits classes that are referenced in source — running this BEFORE the color sweep means only currently-referenced classes appear. The sweep in Task 2 will add the rest.)

If `bg-stone-25` does not appear in output: that's expected if no source references it yet. The `html { background: var(--color-stone-25); }` rule still works because it uses the CSS variable directly, not the utility class.

- [ ] **Step 5: Commit**

```bash
git add packages/web/package.json packages/web/src/styles.css pnpm-lock.yaml
git commit -F - <<'MSGEOF'
feat(web): brand tokens + self-hosted typography in styles.css

Replace the legacy custom `brand-*` palette with the four-ramp BRAND.md
identity (amber + stone + forest + danger). Self-host Inter, Instrument
Serif, and JetBrains Mono Variable via @fontsource — no runtime
dependency on fonts.googleapis.com (HA add-ons may run behind firewalls
that block outbound traffic to non-essential domains).

Add the .lovelacer-wordmark utility class for the italic-r wordmark
treatment. Components migrate to the new palette in the next commit.
MSGEOF
```

---

## Task 2: Color class sweep across components

This task migrates every `.vue` file off the old palette. The migration table is mechanical — apply the same find/replace per file. Component test assertions on color classes update in the same commit so tests stay green throughout.

**Files:** all 16 `.vue` files listed in the per-component sub-steps below, plus `packages/web/src/__tests__/components/RoomList.test.ts`.

**Migration table (apply consistently):**

| Old class                | New class                                          |
| ------------------------ | -------------------------------------------------- |
| `bg-brand-600`           | `bg-amber-500`                                     |
| `bg-brand-700`           | `bg-amber-700`                                     |
| `hover:bg-brand-700`     | `hover:bg-amber-700`                               |
| `text-brand-800`         | `text-amber-700`                                   |
| `focus:border-brand-500` | `focus:border-amber-500`                           |
| `focus:ring-brand-500`   | `focus:ring-amber-500`                             |
| `bg-red-50`              | `bg-danger-50`                                     |
| `bg-red-100`             | `bg-danger-50`                                     |
| `bg-red-600`             | `bg-danger-700`                                    |
| `hover:bg-red-700`       | `hover:bg-danger-700`                              |
| `text-red-700`           | `text-danger-700`                                  |
| `text-red-800`           | `text-danger-700`                                  |
| `text-red-900`           | `text-danger-700`                                  |
| `border-red-200`         | (drop the class — danger fill provides separation) |
| `bg-green-50`            | `bg-forest-50`                                     |
| `bg-green-100`           | `bg-forest-50`                                     |
| `bg-green-600`           | `bg-forest-700`                                    |
| `hover:bg-green-700`     | `hover:bg-forest-700`                              |
| `text-green-600`         | `text-forest-700`                                  |
| `text-green-800`         | `text-forest-700`                                  |
| `text-green-900`         | `text-forest-700`                                  |
| `border-green-200`       | (drop the class — forest fill provides separation) |
| `bg-blue-100`            | `bg-stone-50`                                      |
| `text-blue-800`          | `text-stone-700`                                   |

- [ ] **Step 1: Migrate `packages/web/src/components/AnalyzeButton.vue`**

Apply two substitutions:

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`

Verify with grep:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/AnalyzeButton.vue
```

Expected: no output.

- [ ] **Step 2: Migrate `packages/web/src/components/ApplyBar.vue`**

Substitutions for this file:

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `bg-green-50` → `bg-forest-50`
- `bg-green-600` → `bg-forest-700`
- `hover:bg-green-700` → `hover:bg-forest-700`
- `border-green-200` → drop the class
- `text-green-900` → `text-forest-700`
- `bg-red-50` → `bg-danger-50`
- `bg-red-600` → `bg-danger-700`
- `hover:bg-red-700` → `hover:bg-danger-700`
- `border-red-200` → drop the class
- `text-red-900` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/ApplyBar.vue
```

Expected: no output.

- [ ] **Step 3: Migrate `packages/web/src/components/DiffBanner.vue`**

- `bg-green-100` → `bg-forest-50`
- `text-green-800` → `text-forest-700`
- `bg-red-100` → `bg-danger-50`
- `text-red-800` → `text-danger-700`
- `bg-blue-100` → `bg-stone-50`
- `text-blue-800` → `text-stone-700`

Verify (no output expected):

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/DiffBanner.vue
```

- [ ] **Step 4: Migrate `packages/web/src/components/EntityRow.vue`**

- `bg-green-100` → `bg-forest-50`
- `text-green-800` → `text-forest-700`
- `bg-blue-100` → `bg-stone-50`
- `text-blue-800` → `text-stone-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/EntityRow.vue
```

- [ ] **Step 5: Migrate `packages/web/src/components/HealthBar.vue`**

- `bg-green-100` → `bg-forest-50`
- `text-green-800` → `text-forest-700`
- `text-brand-800` → `text-amber-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/HealthBar.vue
```

- [ ] **Step 6: Migrate `packages/web/src/components/InviteGate.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `focus:border-brand-500` → `focus:border-amber-500`
- `focus:ring-brand-500` → `focus:ring-amber-500`
- `text-red-700` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/InviteGate.vue
```

- [ ] **Step 7: Migrate `packages/web/src/components/MiscBucket.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/MiscBucket.vue
```

- [ ] **Step 8: Migrate `packages/web/src/components/OverridesBar.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `bg-red-50` → `bg-danger-50`
- `bg-red-600` → `bg-danger-700`
- `hover:bg-red-700` → `hover:bg-danger-700`
- `border-red-200` → drop
- `text-red-900` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/OverridesBar.vue
```

- [ ] **Step 9: Migrate `packages/web/src/components/RoomList.vue`**

- `bg-green-100` → `bg-forest-50`
- `text-green-800` → `text-forest-700`
- `bg-red-100` → `bg-danger-50`
- `text-red-800` → `text-danger-700`
- `bg-blue-100` → `bg-stone-50`
- `text-blue-800` → `text-stone-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/RoomList.vue
```

- [ ] **Step 10: Migrate `packages/web/src/components/SettingsModal.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `bg-red-50` → `bg-danger-50`
- `border-red-200` → drop
- `text-red-900` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/SettingsModal.vue
```

- [ ] **Step 11: Migrate `packages/web/src/components/SuggestionsPanel.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/SuggestionsPanel.vue
```

- [ ] **Step 12: Migrate `packages/web/src/components/onboarding/DoneStep.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `bg-green-100` → `bg-forest-50`
- `text-green-600` → `text-forest-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/onboarding/DoneStep.vue
```

- [ ] **Step 13: Migrate `packages/web/src/components/onboarding/PreviewStep.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`
- `bg-red-50` → `bg-danger-50`
- `bg-red-600` → `bg-danger-700`
- `hover:bg-red-700` → `hover:bg-danger-700`
- `border-red-200` → drop
- `text-red-900` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/onboarding/PreviewStep.vue
```

- [ ] **Step 14: Migrate `packages/web/src/components/onboarding/ProgressDots.vue`**

- `bg-brand-600` → `bg-amber-500`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/onboarding/ProgressDots.vue
```

- [ ] **Step 15: Migrate `packages/web/src/components/onboarding/WelcomeStep.vue`**

- `bg-brand-600` → `bg-amber-500`
- `hover:bg-brand-700` → `hover:bg-amber-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/components/onboarding/WelcomeStep.vue
```

- [ ] **Step 16: Migrate `packages/web/src/App.vue` (color classes only — header lockup is Task 6)**

- `bg-red-50` → `bg-danger-50`
- `bg-red-600` → `bg-danger-700`
- `hover:bg-red-700` → `hover:bg-danger-700`
- `border-red-200` → drop
- `text-red-900` → `text-danger-700`

Verify:

```bash
grep -E "(brand|red|blue|green)-" packages/web/src/App.vue
```

- [ ] **Step 17: Update `packages/web/src/__tests__/components/RoomList.test.ts` class assertions**

Find and replace at lines 54-55 and 78-79:

Old:

```ts
expect(pill.classes()).toContain('bg-green-100')
expect(pill.classes()).toContain('text-green-800')
```

New:

```ts
expect(pill.classes()).toContain('bg-forest-50')
expect(pill.classes()).toContain('text-forest-700')
```

Old:

```ts
expect(pill.classes()).toContain('bg-red-100')
expect(pill.classes()).toContain('text-red-800')
```

New:

```ts
expect(pill.classes()).toContain('bg-danger-50')
expect(pill.classes()).toContain('text-danger-700')
```

- [ ] **Step 18: Verify nothing slipped through**

Run from repo root:

```bash
grep -rE "(bg|text|border|ring|focus|hover|from|to|via|fill|stroke):?-?(focus:|hover:)?(bg|text|border|ring|from|to|via|fill|stroke)?-(brand|red|blue|green|gray|yellow|orange|pink|purple|indigo|teal|cyan|sky|emerald|rose|fuchsia|violet|lime|neutral|slate|zinc)-" packages/web/src --include="*.vue" --include="*.ts"
```

Expected: no output.

- [ ] **Step 19: Run full test suite**

```bash
pnpm -r test
```

Expected: all packages green; previously 763 tests now 763 (no new tests added in this task).

- [ ] **Step 20: Run typecheck + lint + format**

```bash
pnpm typecheck && pnpm exec eslint . && pnpm format:check
```

Expected: each command exits 0 with no output beyond progress lines.

- [ ] **Step 21: Commit**

```bash
git add packages/web/src
git commit -F - <<'MSGEOF'
feat(web): sweep all out-of-brand color classes off the palette

Migrate every reference to brand-*, red-*, green-*, blue-* across the 16
.vue files to the four-ramp BRAND.md identity (amber + stone + forest +
danger). Diff "moved" badges (previously bg-blue-100/text-blue-800)
collapse to neutral stone — the brand has no blue ramp and "moved" is
informational, not a warning.

Update RoomList.test.ts class assertions to match the new tokens.
All other component tests assert behaviour or data-testid presence
rather than classes, so no further test churn.
MSGEOF
```

---

## Task 3: CI guardrail to lock the palette

A grep-based pre-commit / CI check that fails when any future PR reintroduces an out-of-brand Tailwind color class. Without this, the brand sweep slowly drifts back to defaults as new components are added.

**Files:**

- Create: `scripts/check-brand-colors.sh`
- Modify: `package.json` (add `check:brand` script)
- Modify: `.github/workflows/ci.yml` (add a new step)

- [ ] **Step 1: Create `scripts/check-brand-colors.sh`**

```bash
#!/usr/bin/env bash
#
# Lock packages/web/src to the four-ramp BRAND.md palette
# (amber + stone + forest + danger). Fails the build if any
# Tailwind built-in palette name leaks back in.
#
# To allow a one-off out-of-brand colour, add a per-line
# "<!-- brand: allow <reason> -->" HTML comment and refine
# this script to skip flagged lines. Strict by default.
#
set -euo pipefail

PATTERN='(bg|text|border|ring|focus|hover|from|to|via|fill|stroke):?-?(focus:|hover:)?(bg|text|border|ring|from|to|via|fill|stroke)?-(brand|red|blue|green|gray|yellow|orange|pink|purple|indigo|teal|cyan|sky|emerald|rose|fuchsia|violet|lime|neutral|slate|zinc)-[0-9/]+'

if grep -rE "${PATTERN}" packages/web/src --include="*.vue" --include="*.ts"; then
  echo
  echo "ERROR: out-of-brand Tailwind color classes detected above."
  echo "P2-8 locked the palette to amber / stone / forest / danger only."
  echo "See docs/BRAND.md for the rules."
  echo
  echo "If you genuinely need an out-of-brand colour, add a per-line"
  echo "'<!-- brand: allow <reason> -->' comment and update this script"
  echo "to skip flagged lines."
  exit 1
fi

echo "brand-color check passed."
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x scripts/check-brand-colors.sh
```

- [ ] **Step 3: Add `check:brand` to root `package.json`**

Edit the `scripts` block. Insert before `clean`:

```json
"scripts": {
  "build": "pnpm -r build",
  "dev": "pnpm -r --parallel --filter='./packages/server' --filter='./packages/web' dev",
  "dev:ha": "docker compose -f dev/ha-stack.yml up -d",
  "dev:ha:down": "docker compose -f dev/ha-stack.yml down",
  "dev:ha:logs": "docker compose -f dev/ha-stack.yml logs -f homeassistant",
  "fixtures:load": "tsx dev/scripts/load-fixture.ts",
  "test": "pnpm -r test && vitest run --passWithNoTests",
  "test:watch": "pnpm -r --parallel test:watch & vitest --passWithNoTests",
  "lint": "eslint . --ext .ts,.vue,.js",
  "lint:fix": "eslint . --ext .ts,.vue,.js --fix",
  "format": "prettier --write \"**/*.{ts,vue,js,json,md,yml,yaml}\"",
  "format:check": "prettier --check \"**/*.{ts,vue,js,json,md,yml,yaml}\"",
  "typecheck": "pnpm -r typecheck && if find tests dev/scripts -name '*.ts' 2>/dev/null | grep -q .; then tsc -b tsconfig.tools.json; fi",
  "check:brand": "bash scripts/check-brand-colors.sh",
  "clean": "pnpm -r exec rm -rf dist node_modules .turbo && rm -rf node_modules"
},
```

(Note: `generate:addon-assets` is removed in Task 4. If you reach this step before Task 4 is run, leave that line alone for now and remove it then.)

- [ ] **Step 4: Verify the guardrail passes against current code**

```bash
pnpm check:brand
```

Expected output: `brand-color check passed.`

- [ ] **Step 5: Verify the guardrail FAILS when a violation is introduced**

Add a temporary out-of-brand class to test the script catches it:

```bash
# Add a known-bad class to a component
sed -i.bak 's|class="text-stone-900"|class="text-stone-900 bg-red-500"|' packages/web/src/App.vue
pnpm check:brand && echo "BUG: should have failed" || echo "GOOD: guardrail caught it"
# Revert
mv packages/web/src/App.vue.bak packages/web/src/App.vue
pnpm check:brand
```

Expected: First `pnpm check:brand` exits 1 and prints the offending line + ERROR message. After revert, exits 0 with `brand-color check passed.`

- [ ] **Step 6: Wire into CI workflow**

Edit `.github/workflows/ci.yml`. Find the existing job that runs `pnpm typecheck` / `pnpm test` / `pnpm format:check` (named `Lint, typecheck, test, build`), and add a new step before the `Test` step:

```yaml
- name: Brand-colour check
  run: pnpm check:brand
```

The full step block (locate by searching for `Format check` or similar):

```yaml
- name: Lint
  run: pnpm lint

- name: Brand-colour check
  run: pnpm check:brand

- name: Format check
  run: pnpm format:check

- name: Typecheck
  run: pnpm typecheck

- name: Test
  run: pnpm -r test
```

(The exact existing step ordering may differ — slot the new step adjacent to other static checks. CI is the same workflow that has been running on PRs through P2-1..P2-7.)

- [ ] **Step 7: Verify CI workflow YAML is still valid**

```bash
pnpm format:check .github/workflows/ci.yml
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-brand-colors.sh package.json .github/workflows/ci.yml
git commit -F - <<'MSGEOF'
chore(ci): add brand-colour guardrail blocking out-of-brand classes

scripts/check-brand-colors.sh greps packages/web/src for any Tailwind
built-in palette name (red/blue/green/gray/yellow/...) and fails if
found. Wired into the existing CI workflow alongside lint + format
checks; exposed as `pnpm check:brand` for local pre-commit use.

Locks in the P2-8 palette sweep — future PRs cannot drift back to the
Tailwind defaults without explicit `<!-- brand: allow <reason> -->`
opt-out (not implemented in this commit; left as future work for
when the first justified violation appears).
MSGEOF
```

---

## Task 4: Brand asset files (SVGs + PNG exports + retire placeholder generator)

This task drops the designed SVGs into `packages/web/public/brand/`, authors the missing dark + favicon variants, generates PNG exports for the HA add-on Supervisor, replaces the legacy placeholder PNGs at `apps/addon/{icon,logo}.png`, and retires the `dev/scripts/generate-addon-assets.ts` placeholder generator (no longer needed now that we have designed assets).

**Files:**

- Create: `packages/web/public/brand/lovelacer-mark.svg`
- Create: `packages/web/public/brand/lovelacer-lockup.svg`
- Create: `packages/web/public/brand/lovelacer-mark-dark.svg`
- Create: `packages/web/public/brand/lovelacer-lockup-dark.svg`
- Create: `packages/web/public/brand/lovelacer-favicon.svg`
- Create: `packages/web/public/brand/lovelacer-icon-512.png` (binary, generated)
- Create: `packages/web/public/brand/lovelacer-logo-1024.png` (binary, generated)
- Modify: `apps/addon/icon.png` (replace with copy of lovelacer-icon-512.png; binary)
- Modify: `apps/addon/logo.png` (replace with copy of lovelacer-logo-1024.png; binary)
- Delete: `dev/scripts/generate-addon-assets.ts`
- Modify: `package.json` (remove `generate:addon-assets` script + `pngjs` deps)
- Modify: `pnpm-lock.yaml` (auto-updated by `pnpm install`)

- [ ] **Step 1: Verify `rsvg-convert` is available; install if not**

```bash
which rsvg-convert || brew install librsvg
rsvg-convert --version
```

Expected: prints a version line. If `brew install` is unavailable (Linux dev), use `apt-get install librsvg2-bin` or fall back to `npx @resvg/resvg-cli` for the export commands later.

- [ ] **Step 2: Create `packages/web/public/brand/lovelacer-mark.svg`**

This is the 5-tile L mark, light variant.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" role="img" aria-label="Lovelacer">
  <title>Lovelacer</title>
  <desc>Lovelacer mark: a five-tile L-shape in honey amber and forest green.</desc>
  <rect x="8"  y="8"   width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="8"  y="52"  width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="8"  y="96"  width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="52" y="96"  width="40" height="40" rx="4" fill="#FBE2A6"/>
  <rect x="96" y="96"  width="40" height="40" rx="4" fill="#7CA84A"/>
</svg>
```

- [ ] **Step 3: Create `packages/web/public/brand/lovelacer-lockup.svg`**

Full lockup (mark + wordmark), light variant. The wordmark is provided as outlined Bézier paths so it doesn't depend on font installation. (Source paths from the brand kit.)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 492 144" role="img" aria-label="Lovelacer">
  <title>Lovelacer</title>
  <desc>Lovelacer logo: a five-tile L-shaped mark in honey amber and forest green, with the lovelacer wordmark, the trailing r set in italic amber.</desc>
  <rect x="8"   y="8"   width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="8"   y="52"  width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="8"   y="96"  width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="52"  y="96"  width="40" height="40" rx="4" fill="#FBE2A6"/>
  <rect x="96"  y="96"  width="40" height="40" rx="4" fill="#7CA84A"/>
  <path d="M199.01 100L181.92 100Q180.77 100 180.77 98.94L180.77 98.94Q180.77 97.98 181.82 97.79L181.82 97.79L183.17 97.60Q185.18 97.31 186.14 96.45Q187.10 95.58 187.10 93.57L187.10 93.57L187.10 38.56Q187.10 36.83 186.58 36.16Q186.05 35.49 184.70 35.39L184.70 35.39L182.50 35.10Q181.44 34.91 181.44 33.95L181.44 33.95Q181.44 32.99 182.50 32.80L182.50 32.80Q185.18 32.22 187.10 31.46Q189.02 30.69 190.27 29.92L190.27 29.92Q191.81 28.96 192.58 28.96L192.58 28.96Q193.63 28.96 193.63 30.50L193.63 30.50L193.63 93.57Q193.63 95.58 194.26 96.40Q194.88 97.22 196.90 97.50L196.90 97.50L199.10 97.79Q200.16 97.98 200.16 98.94L200.16 98.94Q200.16 100 199.01 100L199.01 100ZM220.61 100.86L220.61 100.86Q215.71 100.86 211.82 97.55Q207.94 94.24 205.63 88.48Q203.33 82.72 203.33 75.62L203.33 75.62Q203.33 68.51 205.63 62.85Q207.94 57.18 211.87 53.82Q215.81 50.46 220.61 50.46L220.61 50.46Q225.50 50.46 229.39 53.82Q233.28 57.18 235.58 62.85Q237.89 68.51 237.89 75.62L237.89 75.62Q237.89 82.72 235.63 88.48Q233.38 94.24 229.44 97.55Q225.50 100.86 220.61 100.86ZM220.61 98.46L220.61 98.46Q230.59 98.46 230.59 75.62L230.59 75.62Q230.59 52.86 220.61 52.86L220.61 52.86Q210.62 52.86 210.62 75.62L210.62 75.62Q210.62 98.46 220.61 98.46ZM258.34 100.86L258.34 100.86Q257.47 100.86 257.09 99.81L257.09 99.81L244.32 57.47Q243.65 55.17 243.02 54.50Q242.40 53.82 241.06 53.54L241.06 53.54L239.62 53.25Q238.37 52.96 238.37 52L238.37 52Q238.37 51.04 239.71 51.04L239.71 51.04L255.55 51.04Q256.90 51.04 256.90 52L256.90 52Q256.90 53.06 255.65 53.25L255.65 53.25L254.11 53.44Q251.81 53.73 251.23 54.54Q250.66 55.36 251.23 57.47L251.23 57.47L259.20 85.22Q259.49 86.27 260.16 86.27Q260.83 86.27 261.12 85.22L261.12 85.22L268.90 59.20Q269.66 56.61 269.33 55.31Q268.99 54.02 266.59 53.63L266.59 53.63L264.58 53.25Q263.33 52.96 263.33 52L263.33 52Q263.33 51.04 264.67 51.04L264.67 51.04L276.86 51.04Q278.21 51.04 278.21 52.10L278.21 52.10Q278.21 53.06 277.06 53.44L277.06 53.44L276.19 53.73Q274.75 54.21 273.74 55.46Q272.74 56.70 271.78 59.78L271.78 59.78L259.58 99.81Q259.20 100.86 258.34 100.86ZM294.72 100.86L294.72 100.86Q290.11 100.86 286.46 97.79Q282.82 94.72 280.66 89.10Q278.50 83.49 278.50 76.10L278.50 76.10Q278.50 68.51 280.70 62.75Q282.91 56.99 286.75 53.73Q290.59 50.46 295.30 50.46L295.30 50.46Q300.96 50.46 304.46 55.12Q307.97 59.78 307.97 70.24L307.97 70.24Q307.97 73.41 305.57 73.41L305.57 73.41L287.33 73.41Q285.41 73.41 285.41 75.62L285.41 75.62Q285.41 85.79 288.38 90.88Q291.36 95.97 295.97 95.97L295.97 95.97Q299.62 95.97 301.92 93.38Q304.22 90.78 305.66 84.64L305.66 84.64Q305.95 83.58 306.91 83.58L306.91 83.58Q308.06 83.58 307.78 85.50L307.78 85.50Q306.24 94.05 302.88 97.46Q299.52 100.86 294.72 100.86ZM287.04 71.01L287.04 71.01L296.74 71.01Q301.34 71.01 301.34 66.21L301.34 66.21Q301.34 59.97 299.81 56.42Q298.27 52.86 295.20 52.86L295.20 52.86Q291.46 52.86 288.91 57.18Q286.37 61.50 285.60 69.47L285.60 69.47Q285.41 71.01 287.04 71.01ZM329.38 100L312.29 100Q311.14 100 311.14 98.94L311.14 98.94Q311.14 97.98 312.19 97.79L312.19 97.79L313.54 97.60Q315.55 97.31 316.51 96.45Q317.47 95.58 317.47 93.57L317.47 93.57L317.47 38.56Q317.47 36.83 316.94 36.16Q316.42 35.49 315.07 35.39L315.07 35.39L312.86 35.10Q311.81 34.91 311.81 33.95L311.81 33.95Q311.81 32.99 312.86 32.80L312.86 32.80Q315.55 32.22 317.47 31.46Q319.39 30.69 320.64 29.92L320.64 29.92Q322.18 28.96 322.94 28.96L322.94 28.96Q324 28.96 324 30.50L324 30.50L324 93.57Q324 95.58 324.62 96.40Q325.25 97.22 327.26 97.50L327.26 97.50L329.47 97.79Q330.53 97.98 330.53 98.94L330.53 98.94Q330.53 100 329.38 100L329.38 100ZM343.01 100.86L343.01 100.86Q338.98 100.86 336.38 98.32Q333.79 95.78 333.79 91.55L333.79 91.55Q333.79 87.42 336.38 83.73Q338.98 80.03 343.49 77.06Q348 74.08 353.76 72.26L353.76 72.26Q355.01 71.87 355.01 70.62L355.01 70.62L355.01 61.89Q355.01 57.28 353.57 55.31Q352.13 53.34 349.63 53.34L349.63 53.34Q347.23 53.34 345.26 55.50Q343.30 57.66 342.43 62.75L342.43 62.75Q341.95 65.82 340.37 67.22Q338.78 68.61 337.15 68.61L337.15 68.61Q334.46 68.61 334.46 65.92L334.46 65.92Q334.46 63.14 336.05 60.40Q337.63 57.66 340.22 55.41Q342.82 53.15 345.89 51.81Q348.96 50.46 352.03 50.46L352.03 50.46Q361.54 50.46 361.54 61.50L361.54 61.50L361.54 90.88Q361.54 94.91 363.55 94.91L363.55 94.91Q364.80 94.91 365.86 93.23Q366.91 91.55 366.91 87.52L366.91 87.52Q366.91 85.98 368.16 85.98L368.16 85.98Q369.31 85.98 369.31 87.62L369.31 87.62Q369.31 94.62 366.86 97.74Q364.42 100.86 361.34 100.86L361.34 100.86Q359.04 100.86 357.70 98.99Q356.35 97.12 355.87 94.53L355.87 94.53Q355.78 93.57 355.06 93.52Q354.34 93.47 353.66 94.43L353.66 94.43Q351.36 97.60 348.96 99.23Q346.56 100.86 343.01 100.86ZM345.60 96.45L345.60 96.45Q348.10 96.45 350.21 94.67Q352.32 92.90 353.66 89.92Q355.01 86.94 355.01 83.20L355.01 83.20L355.01 76.19Q355.01 74.37 352.99 75.14L352.99 75.14Q347.14 77.25 343.92 80.94Q340.70 84.64 340.70 89.82L340.70 89.82Q340.70 96.45 345.60 96.45ZM387.07 100.86L387.07 100.86Q382.85 100.86 379.44 98.03Q376.03 95.20 374.02 89.92Q372.00 84.64 372.00 77.34L372.00 77.34Q372.00 69.18 374.45 63.14Q376.90 57.09 381.12 53.78Q385.34 50.46 390.53 50.46L390.53 50.46Q394.94 50.46 397.44 52.19L397.44 52.19Q398.40 52.86 398.40 54.30L398.40 54.30L398.59 66.02Q398.59 67.46 397.44 67.46L397.44 67.46Q396.38 67.46 396.10 66.21L396.10 66.21Q394.75 60.93 393.50 58.05Q392.26 55.17 390.91 54.06Q389.57 52.96 387.94 52.96L387.94 52.96Q386.02 52.96 383.95 55.17Q381.89 57.38 380.50 62.32Q379.10 67.26 379.10 75.33L379.10 75.33Q379.10 85.60 381.74 90.78Q384.38 95.97 388.61 95.97L388.61 95.97Q391.97 95.97 394.22 93.18Q396.48 90.40 398.11 83.10L398.11 83.10Q398.40 82.05 399.26 82.05L399.26 82.05Q400.42 82.05 400.13 83.97L400.13 83.97Q399.07 90.69 397.20 94.38Q395.33 98.08 392.78 99.47Q390.24 100.86 387.07 100.86ZM420.77 100.86L420.77 100.86Q416.16 100.86 412.51 97.79Q408.86 94.72 406.70 89.10Q404.54 83.49 404.54 76.10L404.54 76.10Q404.54 68.51 406.75 62.75Q408.96 56.99 412.80 53.73Q416.64 50.46 421.34 50.46L421.34 50.46Q427.01 50.46 430.51 55.12Q434.02 59.78 434.02 70.24L434.02 70.24Q434.02 73.41 431.62 73.41L431.62 73.41L413.38 73.41Q411.46 73.41 411.46 75.62L411.46 75.62Q411.46 85.79 414.43 90.88Q417.41 95.97 422.02 95.97L422.02 95.97Q425.66 95.97 427.97 93.38Q430.27 90.78 431.71 84.64L431.71 84.64Q432 83.58 432.96 83.58L432.96 83.58Q434.11 83.58 433.82 85.50L433.82 85.50Q432.29 94.05 428.93 97.46Q425.57 100.86 420.77 100.86ZM413.09 71.01L413.09 71.01L422.78 71.01Q427.39 71.01 427.39 66.21L427.39 66.21Q427.39 59.97 425.86 56.42Q424.32 52.86 421.25 52.86L421.25 52.86Q417.50 52.86 414.96 57.18Q412.42 61.50 411.65 69.47L411.65 69.47Q411.46 71.01 413.09 71.01Z" fill="#2C2C2A"/>
  <path d="M450.50 100L446.56 100Q445.22 100 445.50 98.75L445.50 98.75L454.62 60.45Q455.10 58.34 454.77 57.14Q454.43 55.94 452.99 55.94L452.99 55.94Q451.26 55.94 449.20 58.48Q447.14 61.02 444.54 68.13L444.54 68.13Q444.16 69.38 443.20 69.38L443.20 69.38Q441.76 69.38 442.43 67.65L442.43 67.65Q444.54 61.02 446.90 57.28Q449.25 53.54 451.65 52Q454.05 50.46 456.06 50.46L456.06 50.46Q459.23 50.46 460.58 52.82Q461.92 55.17 460.67 60.54L460.67 60.54L459.62 65.06Q459.52 65.73 459.90 65.82Q460.29 65.92 460.58 65.34L460.58 65.34Q464.22 56.99 467.20 53.73Q470.18 50.46 474.02 50.46L474.02 50.46Q476.61 50.46 477.90 51.86Q479.20 53.25 479.20 55.65L479.20 55.65Q479.20 58.05 478.05 59.49Q476.90 60.93 475.07 60.93L475.07 60.93Q473.54 60.93 472.86 60.16Q472.19 59.39 471.86 58.38Q471.52 57.38 471.14 56.61Q470.75 55.84 469.89 55.84L469.89 55.84Q468.45 55.84 466.14 59.49Q463.84 63.14 461.20 69.33Q458.56 75.52 456.11 83.20Q453.66 90.88 451.84 98.94L451.84 98.94Q451.55 100 450.50 100L450.50 100Z" fill="#C76712"/>
</svg>
```

- [ ] **Step 4: Create `packages/web/public/brand/lovelacer-mark-dark.svg`**

Same geometry as the light mark, with tiles re-coloured per BRAND.md's dark-bg row of the §Logo table.

| Position     | Light fill | Dark fill |
| ------------ | ---------- | --------- |
| Top          | `#C76712`  | `#F4B73D` |
| Middle       | `#F4B73D`  | `#C76712` |
| Bottom-left  | `#C76712`  | `#F4B73D` |
| Bottom-mid   | `#FBE2A6`  | `#7A3D08` |
| Bottom-right | `#7CA84A`  | `#7CA84A` |

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" role="img" aria-label="Lovelacer">
  <title>Lovelacer</title>
  <desc>Lovelacer mark, dark-background variant.</desc>
  <rect x="8"  y="8"   width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="8"  y="52"  width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="8"  y="96"  width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="52" y="96"  width="40" height="40" rx="4" fill="#7A3D08"/>
  <rect x="96" y="96"  width="40" height="40" rx="4" fill="#7CA84A"/>
</svg>
```

- [ ] **Step 5: Create `packages/web/public/brand/lovelacer-lockup-dark.svg`**

Dark-mark + wordmark in stone-25 (`#FAF8F4`) + italic-`r` in amber-300 (`#F4B73D`).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 492 144" role="img" aria-label="Lovelacer">
  <title>Lovelacer</title>
  <desc>Lovelacer lockup, dark-background variant.</desc>
  <rect x="8"   y="8"   width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="8"   y="52"  width="40" height="40" rx="4" fill="#C76712"/>
  <rect x="8"   y="96"  width="40" height="40" rx="4" fill="#F4B73D"/>
  <rect x="52"  y="96"  width="40" height="40" rx="4" fill="#7A3D08"/>
  <rect x="96"  y="96"  width="40" height="40" rx="4" fill="#7CA84A"/>
  <path d="M199.01 100L181.92 100Q180.77 100 180.77 98.94L180.77 98.94Q180.77 97.98 181.82 97.79L181.82 97.79L183.17 97.60Q185.18 97.31 186.14 96.45Q187.10 95.58 187.10 93.57L187.10 93.57L187.10 38.56Q187.10 36.83 186.58 36.16Q186.05 35.49 184.70 35.39L184.70 35.39L182.50 35.10Q181.44 34.91 181.44 33.95L181.44 33.95Q181.44 32.99 182.50 32.80L182.50 32.80Q185.18 32.22 187.10 31.46Q189.02 30.69 190.27 29.92L190.27 29.92Q191.81 28.96 192.58 28.96L192.58 28.96Q193.63 28.96 193.63 30.50L193.63 30.50L193.63 93.57Q193.63 95.58 194.26 96.40Q194.88 97.22 196.90 97.50L196.90 97.50L199.10 97.79Q200.16 97.98 200.16 98.94L200.16 98.94Q200.16 100 199.01 100L199.01 100ZM220.61 100.86L220.61 100.86Q215.71 100.86 211.82 97.55Q207.94 94.24 205.63 88.48Q203.33 82.72 203.33 75.62L203.33 75.62Q203.33 68.51 205.63 62.85Q207.94 57.18 211.87 53.82Q215.81 50.46 220.61 50.46L220.61 50.46Q225.50 50.46 229.39 53.82Q233.28 57.18 235.58 62.85Q237.89 68.51 237.89 75.62L237.89 75.62Q237.89 82.72 235.63 88.48Q233.38 94.24 229.44 97.55Q225.50 100.86 220.61 100.86ZM220.61 98.46L220.61 98.46Q230.59 98.46 230.59 75.62L230.59 75.62Q230.59 52.86 220.61 52.86L220.61 52.86Q210.62 52.86 210.62 75.62L210.62 75.62Q210.62 98.46 220.61 98.46ZM258.34 100.86L258.34 100.86Q257.47 100.86 257.09 99.81L257.09 99.81L244.32 57.47Q243.65 55.17 243.02 54.50Q242.40 53.82 241.06 53.54L241.06 53.54L239.62 53.25Q238.37 52.96 238.37 52L238.37 52Q238.37 51.04 239.71 51.04L239.71 51.04L255.55 51.04Q256.90 51.04 256.90 52L256.90 52Q256.90 53.06 255.65 53.25L255.65 53.25L254.11 53.44Q251.81 53.73 251.23 54.54Q250.66 55.36 251.23 57.47L251.23 57.47L259.20 85.22Q259.49 86.27 260.16 86.27Q260.83 86.27 261.12 85.22L261.12 85.22L268.90 59.20Q269.66 56.61 269.33 55.31Q268.99 54.02 266.59 53.63L266.59 53.63L264.58 53.25Q263.33 52.96 263.33 52L263.33 52Q263.33 51.04 264.67 51.04L264.67 51.04L276.86 51.04Q278.21 51.04 278.21 52.10L278.21 52.10Q278.21 53.06 277.06 53.44L277.06 53.44L276.19 53.73Q274.75 54.21 273.74 55.46Q272.74 56.70 271.78 59.78L271.78 59.78L259.58 99.81Q259.20 100.86 258.34 100.86ZM294.72 100.86L294.72 100.86Q290.11 100.86 286.46 97.79Q282.82 94.72 280.66 89.10Q278.50 83.49 278.50 76.10L278.50 76.10Q278.50 68.51 280.70 62.75Q282.91 56.99 286.75 53.73Q290.59 50.46 295.30 50.46L295.30 50.46Q300.96 50.46 304.46 55.12Q307.97 59.78 307.97 70.24L307.97 70.24Q307.97 73.41 305.57 73.41L305.57 73.41L287.33 73.41Q285.41 73.41 285.41 75.62L285.41 75.62Q285.41 85.79 288.38 90.88Q291.36 95.97 295.97 95.97L295.97 95.97Q299.62 95.97 301.92 93.38Q304.22 90.78 305.66 84.64L305.66 84.64Q305.95 83.58 306.91 83.58L306.91 83.58Q308.06 83.58 307.78 85.50L307.78 85.50Q306.24 94.05 302.88 97.46Q299.52 100.86 294.72 100.86ZM287.04 71.01L287.04 71.01L296.74 71.01Q301.34 71.01 301.34 66.21L301.34 66.21Q301.34 59.97 299.81 56.42Q298.27 52.86 295.20 52.86L295.20 52.86Q291.46 52.86 288.91 57.18Q286.37 61.50 285.60 69.47L285.60 69.47Q285.41 71.01 287.04 71.01ZM329.38 100L312.29 100Q311.14 100 311.14 98.94L311.14 98.94Q311.14 97.98 312.19 97.79L312.19 97.79L313.54 97.60Q315.55 97.31 316.51 96.45Q317.47 95.58 317.47 93.57L317.47 93.57L317.47 38.56Q317.47 36.83 316.94 36.16Q316.42 35.49 315.07 35.39L315.07 35.39L312.86 35.10Q311.81 34.91 311.81 33.95L311.81 33.95Q311.81 32.99 312.86 32.80L312.86 32.80Q315.55 32.22 317.47 31.46Q319.39 30.69 320.64 29.92L320.64 29.92Q322.18 28.96 322.94 28.96L322.94 28.96Q324 28.96 324 30.50L324 30.50L324 93.57Q324 95.58 324.62 96.40Q325.25 97.22 327.26 97.50L327.26 97.50L329.47 97.79Q330.53 97.98 330.53 98.94L330.53 98.94Q330.53 100 329.38 100L329.38 100ZM343.01 100.86L343.01 100.86Q338.98 100.86 336.38 98.32Q333.79 95.78 333.79 91.55L333.79 91.55Q333.79 87.42 336.38 83.73Q338.98 80.03 343.49 77.06Q348 74.08 353.76 72.26L353.76 72.26Q355.01 71.87 355.01 70.62L355.01 70.62L355.01 61.89Q355.01 57.28 353.57 55.31Q352.13 53.34 349.63 53.34L349.63 53.34Q347.23 53.34 345.26 55.50Q343.30 57.66 342.43 62.75L342.43 62.75Q341.95 65.82 340.37 67.22Q338.78 68.61 337.15 68.61L337.15 68.61Q334.46 68.61 334.46 65.92L334.46 65.92Q334.46 63.14 336.05 60.40Q337.63 57.66 340.22 55.41Q342.82 53.15 345.89 51.81Q348.96 50.46 352.03 50.46L352.03 50.46Q361.54 50.46 361.54 61.50L361.54 61.50L361.54 90.88Q361.54 94.91 363.55 94.91L363.55 94.91Q364.80 94.91 365.86 93.23Q366.91 91.55 366.91 87.52L366.91 87.52Q366.91 85.98 368.16 85.98L368.16 85.98Q369.31 85.98 369.31 87.62L369.31 87.62Q369.31 94.62 366.86 97.74Q364.42 100.86 361.34 100.86L361.34 100.86Q359.04 100.86 357.70 98.99Q356.35 97.12 355.87 94.53L355.87 94.53Q355.78 93.57 355.06 93.52Q354.34 93.47 353.66 94.43L353.66 94.43Q351.36 97.60 348.96 99.23Q346.56 100.86 343.01 100.86ZM345.60 96.45L345.60 96.45Q348.10 96.45 350.21 94.67Q352.32 92.90 353.66 89.92Q355.01 86.94 355.01 83.20L355.01 83.20L355.01 76.19Q355.01 74.37 352.99 75.14L352.99 75.14Q347.14 77.25 343.92 80.94Q340.70 84.64 340.70 89.82L340.70 89.82Q340.70 96.45 345.60 96.45ZM387.07 100.86L387.07 100.86Q382.85 100.86 379.44 98.03Q376.03 95.20 374.02 89.92Q372.00 84.64 372.00 77.34L372.00 77.34Q372.00 69.18 374.45 63.14Q376.90 57.09 381.12 53.78Q385.34 50.46 390.53 50.46L390.53 50.46Q394.94 50.46 397.44 52.19L397.44 52.19Q398.40 52.86 398.40 54.30L398.40 54.30L398.59 66.02Q398.59 67.46 397.44 67.46L397.44 67.46Q396.38 67.46 396.10 66.21L396.10 66.21Q394.75 60.93 393.50 58.05Q392.26 55.17 390.91 54.06Q389.57 52.96 387.94 52.96L387.94 52.96Q386.02 52.96 383.95 55.17Q381.89 57.38 380.50 62.32Q379.10 67.26 379.10 75.33L379.10 75.33Q379.10 85.60 381.74 90.78Q384.38 95.97 388.61 95.97L388.61 95.97Q391.97 95.97 394.22 93.18Q396.48 90.40 398.11 83.10L398.11 83.10Q398.40 82.05 399.26 82.05L399.26 82.05Q400.42 82.05 400.13 83.97L400.13 83.97Q399.07 90.69 397.20 94.38Q395.33 98.08 392.78 99.47Q390.24 100.86 387.07 100.86ZM420.77 100.86L420.77 100.86Q416.16 100.86 412.51 97.79Q408.86 94.72 406.70 89.10Q404.54 83.49 404.54 76.10L404.54 76.10Q404.54 68.51 406.75 62.75Q408.96 56.99 412.80 53.73Q416.64 50.46 421.34 50.46L421.34 50.46Q427.01 50.46 430.51 55.12Q434.02 59.78 434.02 70.24L434.02 70.24Q434.02 73.41 431.62 73.41L431.62 73.41L413.38 73.41Q411.46 73.41 411.46 75.62L411.46 75.62Q411.46 85.79 414.43 90.88Q417.41 95.97 422.02 95.97L422.02 95.97Q425.66 95.97 427.97 93.38Q430.27 90.78 431.71 84.64L431.71 84.64Q432 83.58 432.96 83.58L432.96 83.58Q434.11 83.58 433.82 85.50L433.82 85.50Q432.29 94.05 428.93 97.46Q425.57 100.86 420.77 100.86ZM413.09 71.01L413.09 71.01L422.78 71.01Q427.39 71.01 427.39 66.21L427.39 66.21Q427.39 59.97 425.86 56.42Q424.32 52.86 421.25 52.86L421.25 52.86Q417.50 52.86 414.96 57.18Q412.42 61.50 411.65 69.47L411.65 69.47Q411.46 71.01 413.09 71.01Z" fill="#FAF8F4"/>
  <path d="M450.50 100L446.56 100Q445.22 100 445.50 98.75L445.50 98.75L454.62 60.45Q455.10 58.34 454.77 57.14Q454.43 55.94 452.99 55.94L452.99 55.94Q451.26 55.94 449.20 58.48Q447.14 61.02 444.54 68.13L444.54 68.13Q444.16 69.38 443.20 69.38L443.20 69.38Q441.76 69.38 442.43 67.65L442.43 67.65Q444.54 61.02 446.90 57.28Q449.25 53.54 451.65 52Q454.05 50.46 456.06 50.46L456.06 50.46Q459.23 50.46 460.58 52.82Q461.92 55.17 460.67 60.54L460.67 60.54L459.62 65.06Q459.52 65.73 459.90 65.82Q460.29 65.92 460.58 65.34L460.58 65.34Q464.22 56.99 467.20 53.73Q470.18 50.46 474.02 50.46L474.02 50.46Q476.61 50.46 477.90 51.86Q479.20 53.25 479.20 55.65L479.20 55.65Q479.20 58.05 478.05 59.49Q476.90 60.93 475.07 60.93L475.07 60.93Q473.54 60.93 472.86 60.16Q472.19 59.39 471.86 58.38Q471.52 57.38 471.14 56.61Q470.75 55.84 469.89 55.84L469.89 55.84Q468.45 55.84 466.14 59.49Q463.84 63.14 461.20 69.33Q458.56 75.52 456.11 83.20Q453.66 90.88 451.84 98.94L451.84 98.94Q451.55 100 450.50 100L450.50 100Z" fill="#F4B73D"/>
</svg>
```

- [ ] **Step 6: Create `packages/web/public/brand/lovelacer-favicon.svg`**

Mark only, optimised for 16-32px rendering: drop `<title>`/`<desc>` (browsers ignore them on favicons), tighten viewBox to 32×32 so it scales cleanly, use `rx="3"` (vs the source's `rx="4"` which disappears at 16px).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="2"  y="2"   width="9" height="9" rx="1" fill="#C76712"/>
  <rect x="2"  y="12"  width="9" height="9" rx="1" fill="#F4B73D"/>
  <rect x="2"  y="22"  width="9" height="9" rx="1" fill="#C76712"/>
  <rect x="12" y="22"  width="9" height="9" rx="1" fill="#FBE2A6"/>
  <rect x="22" y="22"  width="9" height="9" rx="1" fill="#7CA84A"/>
</svg>
```

- [ ] **Step 7: Generate the PNG exports**

```bash
mkdir -p packages/web/public/brand
rsvg-convert -w 512 -h 512 packages/web/public/brand/lovelacer-mark.svg \
  -o packages/web/public/brand/lovelacer-icon-512.png

rsvg-convert -w 1024 -h 400 packages/web/public/brand/lovelacer-lockup.svg \
  -o packages/web/public/brand/lovelacer-logo-1024.png
```

If `rsvg-convert` is unavailable, fall back to:

```bash
npx -y @resvg/resvg-cli -w 512 -h 512 packages/web/public/brand/lovelacer-mark.svg packages/web/public/brand/lovelacer-icon-512.png
npx -y @resvg/resvg-cli -w 1024 -h 400 packages/web/public/brand/lovelacer-lockup.svg packages/web/public/brand/lovelacer-logo-1024.png
```

- [ ] **Step 8: Verify the PNGs render correctly**

```bash
file packages/web/public/brand/lovelacer-icon-512.png
file packages/web/public/brand/lovelacer-logo-1024.png
```

Expected:

```
packages/web/public/brand/lovelacer-icon-512.png:  PNG image data, 512 x 512, 8-bit/color RGBA, non-interlaced
packages/web/public/brand/lovelacer-logo-1024.png: PNG image data, 1024 x 400, 8-bit/color RGBA, non-interlaced
```

Open both files in macOS Preview / a browser to confirm they look right (5-tile L mark + wordmark with italic-r in amber).

- [ ] **Step 9: Replace the HA add-on placeholder PNGs**

```bash
cp packages/web/public/brand/lovelacer-icon-512.png apps/addon/icon.png
cp packages/web/public/brand/lovelacer-logo-1024.png apps/addon/logo.png

file apps/addon/icon.png
file apps/addon/logo.png
```

Expected: each shows `PNG image data, ...x..., 8-bit/color RGBA, non-interlaced`.

- [ ] **Step 10: Delete the obsolete placeholder generator script + dependencies**

The repo previously used `dev/scripts/generate-addon-assets.ts` (driven by the `pngjs` package) to render placeholder add-on icons procedurally. Designed assets supersede it.

Delete the script:

```bash
rm dev/scripts/generate-addon-assets.ts
```

Edit root `package.json` to remove the `generate:addon-assets` script line and the `pngjs` + `@types/pngjs` dev deps. The result `scripts` block:

```json
"scripts": {
  "build": "pnpm -r build",
  "dev": "pnpm -r --parallel --filter='./packages/server' --filter='./packages/web' dev",
  "dev:ha": "docker compose -f dev/ha-stack.yml up -d",
  "dev:ha:down": "docker compose -f dev/ha-stack.yml down",
  "dev:ha:logs": "docker compose -f dev/ha-stack.yml logs -f homeassistant",
  "fixtures:load": "tsx dev/scripts/load-fixture.ts",
  "test": "pnpm -r test && vitest run --passWithNoTests",
  "test:watch": "pnpm -r --parallel test:watch & vitest --passWithNoTests",
  "lint": "eslint . --ext .ts,.vue,.js",
  "lint:fix": "eslint . --ext .ts,.vue,.js --fix",
  "format": "prettier --write \"**/*.{ts,vue,js,json,md,yml,yaml}\"",
  "format:check": "prettier --check \"**/*.{ts,vue,js,json,md,yml,yaml}\"",
  "typecheck": "pnpm -r typecheck && if find tests dev/scripts -name '*.ts' 2>/dev/null | grep -q .; then tsc -b tsconfig.tools.json; fi",
  "check:brand": "bash scripts/check-brand-colors.sh",
  "clean": "pnpm -r exec rm -rf dist node_modules .turbo && rm -rf node_modules"
},
```

Remove `@types/pngjs` and `pngjs` from `devDependencies`. The cleaned-up `devDependencies` block:

```json
"devDependencies": {
  "@types/node": "^22.7.0",
  "@typescript-eslint/eslint-plugin": "^8.8.0",
  "@typescript-eslint/parser": "^8.8.0",
  "eslint": "^9.12.0",
  "eslint-config-prettier": "^9.1.0",
  "eslint-plugin-prettier": "^5.2.1",
  "eslint-plugin-vue": "^10.5.1",
  "lint-staged": "^15.5.2",
  "prettier": "^3.3.3",
  "simple-git-hooks": "^2.13.1",
  "tsx": "^4.21.0",
  "typescript": "^5.6.2",
  "vitest": "^2.1.9",
  "vue-eslint-parser": "^10.4.0",
  "yaml": "^2.8.3"
}
```

(Pre-existing values — preserve any version bumps that already exist; the snippet above shows the already-present dependencies minus the two pngjs entries.)

- [ ] **Step 11: Refresh the lockfile**

```bash
pnpm install
```

Expected: `pngjs` and `@types/pngjs` removed; `pnpm-lock.yaml` updates.

- [ ] **Step 12: Run the full validation chain**

```bash
pnpm typecheck && pnpm exec eslint . && pnpm format:check && pnpm -r test && pnpm -r build && pnpm check:brand
```

Expected: all green. (No tests reference the deleted script; nothing else should break.)

- [ ] **Step 13: Commit**

```bash
git add packages/web/public/brand apps/addon/icon.png apps/addon/logo.png \
  dev/scripts package.json pnpm-lock.yaml
git commit -F - <<'MSGEOF'
feat(brand): designed Lovelacer logo assets + retire placeholder generator

Drop the source SVGs (light + dark variants of the mark and lockup,
plus a 32x32-optimised favicon) into packages/web/public/brand/.
Render PNG exports with rsvg-convert at the dimensions HA Supervisor
expects, then copy to apps/addon/{icon,logo}.png — the listing card
in the HA add-on store now renders the designed branding instead of
the procedurally-drawn orange L placeholder.

Retire dev/scripts/generate-addon-assets.ts (and the pngjs dep) — it
generated the placeholder PNGs procedurally in pure JS for Phase 1
when no designed assets existed yet. P2-8 supersedes it; future
PNG re-renders use rsvg-convert against the SVG sources.
MSGEOF
```

---

## Task 5: Favicon wiring in `index.html`

**Files:**

- Modify: `packages/web/index.html`

- [ ] **Step 1: Add the `<link rel="icon">` line**

Edit `packages/web/index.html`. Replace the current `<head>` block:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lovelacer</title>
</head>
```

with:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/brand/lovelacer-favicon.svg" />
  <title>Lovelacer</title>
</head>
```

- [ ] **Step 2: Verify the favicon resolves at dev time**

```bash
pnpm --filter @lovelacer/web dev
```

Expected: dev server starts on http://localhost:5173. Open the page in a browser. Browser tab shows the 5-tile L favicon. Stop the dev server (Ctrl-C).

- [ ] **Step 3: Verify build picks up the favicon**

```bash
pnpm --filter @lovelacer/web build
ls packages/web/dist/brand/
```

Expected: the 7 brand asset files are copied into `packages/web/dist/brand/` by Vite (it copies `public/` verbatim).

- [ ] **Step 4: Commit**

```bash
git add packages/web/index.html
git commit -F - <<'MSGEOF'
feat(web): wire lovelacer-favicon.svg into index.html

Browser tab now renders the 5-tile L mark instead of the default
Vite icon. Uses the SVG source directly — no separate .ico file.
MSGEOF
```

---

## Task 6: App.vue + WelcomeStep header lockup

**Files:**

- Modify: `packages/web/src/App.vue` (lines 76-91 — header block)
- Modify: `packages/web/src/components/onboarding/WelcomeStep.vue` (lines 12-16 — heading + description)
- Modify: `packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts` (line 42 — heading assertion)

- [ ] **Step 1: Update `WelcomeStep.test.ts` assertion to expect the new heading**

Find this line (around line 42):

```ts
expect(wrapper.text()).toContain('Welcome to Lovelacer')
```

Replace with:

```ts
expect(wrapper.text()).toContain('lovelacer')
expect(wrapper.text()).toContain('Home Assistant dashboards that organize themselves')
```

The wordmark renders the literal text "lovelacer" (with italic-r). The tagline assertion locks in that the lockup is wired correctly.

- [ ] **Step 2: Run the WelcomeStep test to verify it FAILS now**

```bash
pnpm --filter @lovelacer/web exec vitest run src/__tests__/components/onboarding/WelcomeStep.test.ts -t "renders the welcome heading and language picker"
```

Expected: test fails with `expected '...Welcome to Lovelacer...' to contain 'Home Assistant dashboards that organize themselves'`.

- [ ] **Step 3: Replace the WelcomeStep heading block**

Edit `packages/web/src/components/onboarding/WelcomeStep.vue`. Replace lines 11-16 (the existing `<h1>` + `<p>` block):

```vue
  <div data-testid="welcome-step" class="rounded-lg bg-white p-8 shadow-sm">
    <h1 class="text-2xl font-semibold text-stone-900">Welcome to Lovelacer</h1>
    <p class="mt-2 text-stone-600">
      Lovelacer scans your Home Assistant entities and generates a Lovelace dashboard automatically.
      Pick your detection language, then we'll show you a preview.
    </p>
```

with:

```vue
  <div data-testid="welcome-step" class="rounded-lg bg-white p-8 shadow-sm">
    <header class="flex items-center gap-3">
      <img src="/brand/lovelacer-mark.svg" alt="" class="h-10 w-10" aria-hidden="true" />
      <div>
        <h1 class="lovelacer-wordmark text-3xl leading-none">lovelace<i>r</i></h1>
        <p class="mt-1 text-sm text-stone-500">
          Home Assistant dashboards that organize themselves
        </p>
      </div>
    </header>
    <p class="mt-6 text-stone-600">
      Pick your detection language, then we'll show you a preview.
    </p>
```

The first paragraph's "Lovelacer scans your Home Assistant entities..." sentence is dropped — the tagline now does that work, and the remaining sentence is the actionable instruction for this screen.

- [ ] **Step 4: Verify the test now PASSES**

```bash
pnpm --filter @lovelacer/web exec vitest run src/__tests__/components/onboarding/WelcomeStep.test.ts
```

Expected: all WelcomeStep tests pass.

- [ ] **Step 5: Replace the App.vue header**

Edit `packages/web/src/App.vue`. Replace the existing header block (currently around lines 76-91):

```vue
<header class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
        <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
      </div>
      <button
        type="button"
        data-testid="settings-button"
        aria-label="Settings"
        class="rounded p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        @click="openSettings"
      >
        ⚙
      </button>
    </header>
```

with:

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
      <button
        type="button"
        data-testid="settings-button"
        aria-label="Settings"
        class="rounded p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        @click="openSettings"
      >
        ⚙
      </button>
    </header>
```

- [ ] **Step 6: Run the full test suite**

```bash
pnpm -r test
```

Expected: all green. The settings button still has its `data-testid="settings-button"` and `aria-label="Settings"`, so any test asserting button presence keeps working.

- [ ] **Step 7: Run the full verification chain**

```bash
pnpm typecheck && pnpm exec eslint . && pnpm format:check && pnpm check:brand && pnpm -r build
```

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/App.vue \
  packages/web/src/components/onboarding/WelcomeStep.vue \
  packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts
git commit -F - <<'MSGEOF'
feat(web): mark + wordmark lockup in App.vue and WelcomeStep headers

Replace the plain "Lovelacer" h1 + alpha tagline with the BRAND.md
lockup: 5-tile mark on the left, wordmark with italic-r on the right,
brand tagline below ("Home Assistant dashboards that organize themselves").
Same lockup pattern in the onboarding wizard's first step.

The settings button keeps its existing data-testid + aria-label so
existing tests asserting its presence continue to pass.
MSGEOF
```

---

## Task 7: Manual — capture screenshots + demo GIF

This task is **performed manually by the operator** against a real (or fixture) HA instance. The plan provides the exact recipe; the implementer cannot automate the rendering without a running HA backend.

**Files:**

- Create: `docs/screenshots/README.md` (capture checklist)
- Create: `docs/screenshots/01-hero.png` (binary)
- Create: `docs/screenshots/02-onboarding-welcome.png` (binary)
- Create: `docs/screenshots/03-diff-view.png` (binary)
- Create: `docs/screenshots/04-suggestions.png` (binary)
- Create: `docs/screenshots/05-applied-in-ha.png` (binary)
- Create: `docs/screenshots/demo.gif` (binary)

- [ ] **Step 1: Create the capture checklist `docs/screenshots/README.md`**

````markdown
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
- 100% zoom (Cmd-0).
- DevTools closed before each screenshot.

## Per-shot recipe

### 01-hero.png — main view, ready state

- Wizard already completed (onboarding row in SQLite has `completed_at`
  set), invite gate already accepted.
- Click **Analyze**, wait for the preview to render.
- Expand 2 rooms with mixed confidence pills.
- Visible: HealthBar (HA connected), DiffBanner (with non-zero counts),
  SuggestionsPanel (1-2 suggestions visible), RoomList (3-4 rooms with
  at least one expanded), MiscBucket header (collapsed), DashboardPreview,
  ApplyBar.
- Capture full page (Chrome DevTools → Capture full size screenshot).

### 02-onboarding-welcome.png — wizard welcome step

- Fresh install state (clear the onboarding row in SQLite, or use a new
  data dir for the add-on).
- Accept invite, then on the welcome step:
  - Language dropdown set to "Auto (match all)" (the default).
- Capture the **wizard panel only** (1024×640ish bounding box, not the
  full page). DevTools → Element screenshot on the `[data-testid="welcome-step"]`
  div.

### 03-diff-view.png — re-analyze diff

- After applying once, modify the HA fixture (move 2 entities to different
  rooms, add 2 new, remove 1).
- Click **Analyze** again.
- Capture the DiffBanner with non-zero added/moved/removed counts, plus
  one room expanded showing the per-row diff badges.

### 04-suggestions.png — suggestions panel close-up

- Set up an HA fixture with a clearly suggestable pattern (e.g. 12
  unscoped sensors all named "kitchen\_\*" but unassigned).
- Click **Analyze**.
- Capture the SuggestionsPanel close-up (element screenshot on
  `[data-testid="suggestions-panel"]` if present, or the visible region
  containing the panel).

### 05-applied-in-ha.png — generated dashboard inside HA

- Click **Apply**, wait for success.
- Open the HA Lovelace UI (sidebar → Lovelacer — Home).
- Capture the HA browser tab (full page, including HA chrome — sidebar,
  topbar, the rendered dashboard with 3-4 cards).

### demo.gif — full happy path

Recording script (≤45 seconds, ≤2 MB):

1. Page loads → InviteGate visible.
2. Type the invite code → click Accept.
3. Wizard Welcome step → optional: change language → click Continue.
4. Wizard Preview step → wait for analyze → click Apply.
5. Apply success → Done step.
6. Click "Open dashboard" → HA dashboard renders.

Tooling:

- macOS: QuickTime Player → File → New Screen Recording → record at
  1280×800. Trim to <=45s. Convert to GIF:
  ```bash
  ffmpeg -i recording.mov -vf "fps=15,scale=1280:-1:flags=lanczos" \
    -loop 0 demo.gif
  gifsicle -O3 --colors 128 demo.gif > demo-opt.gif && mv demo-opt.gif demo.gif
  ```
````

- Cross-platform: LICEcap (https://www.cockos.com/licecap/) records
  directly to .gif at 15fps at the chosen frame size.

If the file size exceeds 2 MB after `gifsicle -O3`, fall back in this
order: drop fps to 12 → drop frame width to 1024 → trim to 30s → drop
to 96 colours.

## Optimisation

After capture, optimise PNGs to keep the repo lean:

```bash
# install once: brew install oxipng
oxipng -o 4 docs/screenshots/*.png
```

Aim for ≤500 KB per PNG. demo.gif ≤2 MB.

```

- [ ] **Step 2: Capture the 5 PNG screenshots**

This is a **manual step**. Follow the recipe in `docs/screenshots/README.md`. Save the captured PNGs to:

```

docs/screenshots/01-hero.png
docs/screenshots/02-onboarding-welcome.png
docs/screenshots/03-diff-view.png
docs/screenshots/04-suggestions.png
docs/screenshots/05-applied-in-ha.png

````

- [ ] **Step 3: Optimise the PNGs**

```bash
brew install oxipng  # or: cargo install oxipng
oxipng -o 4 docs/screenshots/*.png
ls -lh docs/screenshots/*.png
````

Expected: each file ≤500 KB.

- [ ] **Step 4: Record + convert the demo GIF**

This is a **manual step** following the recipe in `docs/screenshots/README.md`. Result file: `docs/screenshots/demo.gif`.

Verify size:

```bash
ls -lh docs/screenshots/demo.gif
```

Expected: ≤2 MB.

- [ ] **Step 5: Commit**

```bash
git add docs/screenshots
git commit -F - <<'MSGEOF'
docs(screenshots): launch screenshots + demo GIF for README

Five PNG captures showing the product story end-to-end (main view,
onboarding, re-analyze diff, suggestions, generated dashboard inside HA)
plus a 30-45s demo GIF for the README hero block.

Capture checklist at docs/screenshots/README.md documents the source
HA fixture state, viewport size, per-shot expected state, and tooling
recipes (ffmpeg pipeline + LICEcap fallback) for re-shoots.
MSGEOF
```

---

## Task 8: Repo `README.md` rewrite

**Files:**

- Modify: `README.md` (full replacement)

- [ ] **Step 1: Replace `README.md` entirely**

Overwrite the file with:

```markdown
<p align="center">
  <img src="packages/web/public/brand/lovelacer-lockup.svg" width="320" alt="Lovelacer">
</p>

<p align="center">
  <em>Home Assistant dashboards that organize themselves.</em>
</p>

<p align="center">
  Point Lovelacer at your Home Assistant install and get a clean starting dashboard you can actually use — in under five minutes, without writing YAML.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-amber" alt="License: MIT">
  <img src="https://img.shields.io/badge/add--on-0.2.0-amber" alt="Add-on version">
  <a href="https://github.com/Studio81Labs/lovelacer/actions/workflows/ci.yml"><img src="https://github.com/Studio81Labs/lovelacer/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

---

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="Lovelacer end-to-end: analyze, preview, apply." width="720">
</p>

<p align="center"><sub>From zero to a working dashboard in under a minute.</sub></p>

## Why this exists

Home Assistant is the most flexible smart home platform on the market and also the one most likely to leave a new user staring at a wall of `sensor.0x00158d000123abcd_battery` entities with no idea where to start. The official UI auto-generates a dashboard, but it's notoriously bad: every entity dumped into a single view, no grouping, no per-room structure, no opinion. The community workaround is to spend a weekend learning Lovelace YAML, custom cards, and the area/device data model.

Lovelacer does that weekend's work in five minutes — read the entity registry, infer rooms, group sensibly, generate a real dashboard, preview before applying.

## What you get

|                                                                                                        |                                                                                                |
| :----------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/01-hero.png" alt="Main view: rooms detected, dashboard preview, apply bar"> | <img src="docs/screenshots/02-onboarding-welcome.png" alt="First-run wizard: pick a language"> |
|              The main view after Analyze. Confidence pills, dashboard preview, apply bar.              |                  The first-run wizard. Pick a language; the rest auto-fills.                   |
|     <img src="docs/screenshots/03-diff-view.png" alt="Re-analyze diff banner with per-row badges">     |            <img src="docs/screenshots/04-suggestions.png" alt="Suggestions panel">             |
|                   Re-analyze after you add devices. The diff view shows what moved.                    |                     Smart suggestions. Accept improvements with one click.                     |

<p align="center">
  <img src="docs/screenshots/05-applied-in-ha.png" alt="The generated dashboard rendered inside HA's Lovelace UI" width="720">
</p>

<p align="center"><sub>The result. A native HA dashboard. No custom cards required.</sub></p>

## Quick start

1. In Home Assistant, open **Settings → Add-ons → ⋮ → Repositories**, paste `https://github.com/Studio81Labs/lovelacer`, and click **Add**.
2. Find the **Lovelacer** card in the add-on store, click **Install**, then **Start**.
3. Click **Open Web UI** and follow the wizard.

Full instructions and troubleshooting: [`docs/ADDON_INSTALL.md`](./docs/ADDON_INSTALL.md).

## Architecture at a glance
```

┌─────────────────────────────────────────────────────────────┐
│ Home Assistant Core │
│ ┌──────────┐ ┌────────────┐ ┌────────────────────────┐ │
│ │ Entities │ │ Areas │ │ Lovelace Storage API │ │
│ └────┬─────┘ └──────┬─────┘ └───────────┬────────────┘ │
└───────┼───────────────┼────────────────────┼───────────────┘
│ WebSocket API │ │ WS lovelace/\*
▼ ▼ ▲
┌─────────────────────────────────────────────────────────────┐
│ Lovelacer Add-on (Docker) │
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ │ HA Client │→ │ Analyzer + │→ │ Generator │ │
│ │ (ws + rest) │ │ Heuristics │ │ (storage/YAML) │ │
│ └──────────────┘ └──────┬───────┘ └────────┬────────┘ │
│ ▼ ▼ │
│ ┌─────────────────────────────────┐ │
│ │ Fastify API + SQLite (state) │ │
│ └────────────────┬────────────────┘ │
└─────────────────────────────────────┼────────────────────────┘
│ HTTP
▼
┌──────────────┐
│ Vue 3 SPA │
│ (Preview UI) │
└──────────────┘

```

Full breakdown in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Documents

| File                                                             | Purpose                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`docs/PRD.md`](./docs/PRD.md)                                   | Personas, problem, scope, competitive landscape, three-tier monetization, success metrics |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                 | Tech stack, components, storage-mode-vs-YAML-mode decision, HA integration                |
| [`docs/HEURISTICS.md`](./docs/HEURISTICS.md)                     | Room detection chain, multi-language matching, confidence scoring                         |
| [`docs/DASHBOARD_GENERATION.md`](./docs/DASHBOARD_GENERATION.md) | View layout, per-domain card mapping, example outputs                                     |
| [`docs/AI_FEATURES.md`](./docs/AI_FEATURES.md)                   | Tier 2 / Tier 3 AI design, LLM provider abstraction, privacy boundaries                   |
| [`docs/SMART_PANEL_BRIDGE.md`](./docs/SMART_PANEL_BRIDGE.md)     | Strategic relationship to FastyBird Smart Panel — export target, not marketing funnel     |
| [`docs/BRAND.md`](./docs/BRAND.md)                               | Visual identity — palette, typography, logo usage, voice                                  |
| [`docs/ADDON_INSTALL.md`](./docs/ADDON_INSTALL.md)               | HA add-on installation walkthrough + troubleshooting                                      |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md)                           | Phased plan with real tickets and acceptance criteria                                     |

## Decisions locked

- **Name**: Lovelacer. Wordmark sets the trailing **r** in italic amber. Insider portmanteau (Lovelace + agentive _-r_) — appropriate for the HA-native audience.
- **Distribution:** Home Assistant Add-on (Supervisor-managed) as primary channel, standalone Docker as secondary.
- **Apply mode:** Lovelace **storage mode** by default (writes via WebSocket), with YAML export as a feature.
- **Stack:** Node.js + Fastify backend, Vue 3 + Vite frontend, SQLite for local state.
- **i18n:** Multi-language room detection from day one with shipped EN, CS, and DE keyword data.
- **License:** MIT for OSS core. AI features are also MIT but require runtime configuration of an LLM provider.
- **Monetization:** Three tiers — Free/OSS, AI/BYO key (still free, user pays LLM provider), Pro/managed cloud (subscription, future).
- **Privacy:** Tier 2 with Ollama provider = zero external requests, full AI features. Tier 3 cloud handles only entity registry metadata, never sensor states.
- **Visual identity:** Honey amber (`#C76712`) primary, warm stone neutrals, forest green (`#7CA84A`) accent. Instrument Serif (display) + Inter (UI) + JetBrains Mono (code). See [`docs/BRAND.md`](./docs/BRAND.md).

## Decisions still open

- **Tier 3 pricing** — $5/mo, $9/mo, $99 lifetime — needs validation post-Tier-2.
- **Tier 3 build trigger** — what specific metric flips the "build it" switch.
- **Custom card support** — pure-core for MVP; Mushroom/Tile-extras as opt-in later?
- **Default LLM models** — ship with Haiku + GPT-4o-mini + llama3.1:8b as defaults?

## Roadmap

Phase 2 (alpha-ready) ships now. Phase 3 starts after public-alpha feedback. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full plan.

## License

MIT. See [`LICENSE`](./LICENSE).
```

- [ ] **Step 2: Verify all referenced files exist**

```bash
for f in packages/web/public/brand/lovelacer-lockup.svg \
         docs/screenshots/demo.gif \
         docs/screenshots/01-hero.png \
         docs/screenshots/02-onboarding-welcome.png \
         docs/screenshots/03-diff-view.png \
         docs/screenshots/04-suggestions.png \
         docs/screenshots/05-applied-in-ha.png \
         docs/PRD.md docs/ARCHITECTURE.md docs/HEURISTICS.md \
         docs/DASHBOARD_GENERATION.md docs/AI_FEATURES.md \
         docs/SMART_PANEL_BRIDGE.md docs/BRAND.md \
         docs/ADDON_INSTALL.md docs/ROADMAP.md; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: every line is `OK: ...`. If any are MISSING, the README will have broken links.

- [ ] **Step 3: Run prettier on the README**

```bash
pnpm exec prettier --write README.md
```

Expected: file reformatted; idempotent on second run.

- [ ] **Step 4: Verify format check**

```bash
pnpm format:check
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -F - <<'MSGEOF'
docs(readme): launch-ready repo README

Hero block (centred lockup + tagline + one-liner + badges), demo GIF
embed, 5-shot "What you get" gallery, HA Supervisor quick-start, the
brand-locked architecture/decisions sections from the brand kit.

Replaces the placeholder README that pre-dated everything Phase 0/1/2
shipped — the "Status: Early. No code yet." opener was actively
misleading on a public repo.
MSGEOF
```

---

## Task 9: Add-on README + CHANGELOG + version bump

**Files:**

- Modify: `apps/addon/README.md`
- Modify: `apps/addon/CHANGELOG.md`
- Modify: `apps/addon/config.yaml` (version field)

- [ ] **Step 1: Replace `apps/addon/README.md`**

Overwrite the file with:

```markdown
# Lovelacer

Generate a Home Assistant Lovelace dashboard from your existing entities.

## What it does

1. Click **Analyze** — Lovelacer reads your HA entity, device, and area registries and detects rooms with shipped EN, CS, and DE keyword data.
2. Review the preview. Re-run **Analyze** any time; the diff view shows what moved, what was added, and what was removed.
3. Adjust per-entity overrides if needed, accept smart suggestions with one click, then click **Apply**.

The dashboard is a regular HA dashboard — you can edit, copy, or delete it from HA's UI like any other.

## Configuration

| Key                  | Default          | Notes                                                                                                                                                   |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `log_level`          | `info`           | One of `trace, debug, info, warn, error, fatal`. Set `debug` to see why entities did or didn't get classified into a room.                              |
| `dashboard_url_path` | `lovelacer-home` | The `url_path` segment HA uses for the generated dashboard. Lower-case alphanumeric + hyphens. Change if you want a different URL or a second instance. |

## Logs

The add-on writes Pino-formatted JSON to stdout. View them in **Settings → Add-ons → Lovelacer → Logs**.

## Privacy + scope

Lovelacer reads your HA registries and writes a single Lovelace dashboard back. It doesn't:

- Send any data outside your HA instance.
- Modify your existing automations, scripts, or other dashboards.

All add-on state (overrides, applied snapshots, settings, onboarding completion) lives in the add-on's `/data` volume — nothing leaves the HA host.

## Status

Phase 2 alpha. Multi-language room detection uses shipped EN / CS / DE keyword data; Settings exposes Auto / EN / CS, with DE participating through Auto. Re-analyze diff view shows what changed since the last apply. Per-entity overrides + smart suggestions panel. Settings UI for language and dashboard sections. Onboarding wizard for first-run.

The single honest constraint: custom Lovelace cards (Mushroom, Tile-extras) are not generated — pure HA core cards only.

## Source + reporting bugs

- Source: <https://github.com/Studio81Labs/lovelacer>
- Bug reports: <https://github.com/Studio81Labs/lovelacer/issues>
- Architecture + design docs: see `docs/` in the source repo.
```

- [ ] **Step 2: Replace `apps/addon/CHANGELOG.md`**

Overwrite with:

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
- Brand identity: new logo, full visual identity, Inter + Instrument Serif typography, self-hosted fonts.

### Phase 1b (already shipped, summarised)

- Multi-language room detection: EN, CS, and DE keyword data.
- Per-entity overrides: drag rooms manually, mark entities hidden.
- Invite-code gate for closed alpha.
- HA add-on packaging with multi-arch images (aarch64, amd64, armv7).

### Phase 1a (already shipped, summarised)

- Initial analyze + apply flow against a single HA instance.
- HA storage-mode dashboard generation.
- WebSocket connection with retry/backoff.
```

- [ ] **Step 3: Bump add-on version**

Edit `apps/addon/config.yaml` line 2:

Old:

```yaml
version: '0.0.1'
```

New:

```yaml
version: '0.2.0'
```

- [ ] **Step 4: Run prettier**

```bash
pnpm exec prettier --write apps/addon/README.md apps/addon/CHANGELOG.md apps/addon/config.yaml
pnpm format:check
```

Expected: format-check passes.

- [ ] **Step 5: Commit**

```bash
git add apps/addon/README.md apps/addon/CHANGELOG.md apps/addon/config.yaml
git commit -F - <<'MSGEOF'
docs(addon): refresh README + CHANGELOG and bump version to 0.2.0

The previous Phase-1a-alpha disclaimer block listed constraints
(Czech-only detection, no overrides, no diff) that all shipped in
Phase 1b/2. Replaces with a current-state status block calling out
the one honest remaining limitation: pure HA core cards, no Mushroom
or Tile-extras integration.

CHANGELOG entry summarises Phases 1a, 1b, and 2 so a fresh user reading
the add-on store listing sees what they're getting. Version bumps
0.0.1 → 0.2.0; HA Supervisor renders an "Update available" banner the
next time a Phase-1 install pulls the new image.
MSGEOF
```

---

## Task 10: Visual verification pass

A pure verification task — no code changes unless something needs fixing. The implementer/operator runs the app locally, walks through every screen, and confirms the brand sweep didn't break anything visually.

**No files modified** unless an issue is found.

- [ ] **Step 1: Start the dev environment**

Two terminals:

```bash
# terminal 1
pnpm --filter @lovelacer/server dev

# terminal 2
pnpm --filter @lovelacer/web dev
```

Open http://localhost:5173 in a Chrome browser with DevTools Network panel open.

- [ ] **Step 2: Verify fonts load locally (no Google Fonts requests)**

In DevTools Network panel, filter by "fonts.googleapis.com". Reload the page.
Expected: zero matching requests. Filter by `.woff2` — should see Inter, Instrument Serif, JetBrains Mono served from `localhost:5173`.

- [ ] **Step 3: Verify favicon renders**

Browser tab shows the 5-tile L mark instead of the default Vite icon.

- [ ] **Step 4: Walk every screen, confirm brand colours**

For each screen, look for any leftover non-brand colours (bright red, neon green, default Tailwind blue):

- **InviteGate** (clear `invite_accepted` row first if needed) — primary button is brand amber, error states use danger ramp.
- **App.vue main view** — header lockup with italic-r in amber, settings button visible, tagline text correct.
- **AnalyzeButton + HealthBar** — primary button amber, "connected" pill forest, "disconnected" pill stone-neutral.
- **DiffBanner** — "added" pill forest, "removed" pill danger, "moved" pills neutral stone.
- **RoomList** — confidence pills (green→forest, red→danger), per-row diff badges match.
- **EntityRow** — manual indicator amber-tinted, override dropdown styling.
- **MiscBucket** — bulk-assign primary button amber.
- **OverridesBar** — pending-changes banner danger fill, save button amber.
- **SuggestionsPanel** — accept buttons amber.
- **SettingsModal** — primary save button amber, error states danger.
- **Onboarding wizard (clear `onboarding.completed_at` first)** — Welcome lockup, Preview step's Apply button amber, Done step's success indicator forest.

- [ ] **Step 5: Verify HA add-on listing renders correctly (manual, requires HA dev instance)**

If a dev HA instance is available:

1. Add the local repo as a custom add-on repository.
2. The Lovelacer card in the listing should show:
   - The new `apps/addon/logo.png` banner (designed lockup, not the placeholder L).
   - The `apps/addon/icon.png` in the listing thumbnail (designed mark, not the placeholder L).
   - The new description text from `apps/addon/README.md` (no "Phase 1a alpha" callouts).
   - Version `0.2.0`.

If no dev HA is available, this step is deferred until release ops re-render the listing in production.

- [ ] **Step 6: Run the final all-clear**

```bash
pnpm typecheck && pnpm exec eslint . && pnpm format:check && pnpm check:brand && pnpm -r test && pnpm -r build
```

Expected: every command exits 0.

- [ ] **Step 7: No commit unless something needed fixing**

If steps 2-6 surfaced an issue (a missed colour class, a broken image path, a missing favicon), fix it and commit. Otherwise the previous task's commit is the last commit on this branch.

If a fix was needed, commit:

```bash
git add <fixed files>
git commit -F - <<'MSGEOF'
fix(<area>): visual-verification fixup

<one-paragraph description of what was wrong + how it was fixed>
MSGEOF
```

---

## Final verification

After all 10 tasks complete, run the full CI parity locally before merging:

```bash
pnpm typecheck
pnpm exec eslint .
pnpm format:check
pnpm check:brand
pnpm -r test
pnpm -r build
```

All six must exit 0.

Then push the branch + open the PR. Bugbot may flag findings — handle per the established Phase 2 pattern: investigate, fix in a separate commit, reply on the comment thread referencing the fix SHA.

---

## Spec coverage check

| Spec section                                   | Plan task                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| §1 Scope (in-scope items)                      | Tasks 1-10 cover every listed item                                                                       |
| §1 Scope (out-of-scope)                        | Plan does not include hassio-addons submission, automated SVG→PNG script, project rename, dark-mode UI   |
| §2 Brand tokens                                | Task 1                                                                                                   |
| §3 Color migration table                       | Task 2 (per-file steps + final verification)                                                             |
| §4 CI guardrail                                | Task 3                                                                                                   |
| §5 File layout                                 | Task 4                                                                                                   |
| §5 Dark variants                               | Task 4 (steps 4-5)                                                                                       |
| §5 Favicon optimisation                        | Task 4 (step 6)                                                                                          |
| §5 PNG generation                              | Task 4 (steps 7-9)                                                                                       |
| §5 App.vue + WelcomeStep lockup                | Task 6                                                                                                   |
| §6 Repo README                                 | Task 8                                                                                                   |
| §6 Add-on README + CHANGELOG                   | Task 9                                                                                                   |
| §6 Version bump                                | Task 9 (step 3)                                                                                          |
| §6 Screenshot directory                        | Task 7                                                                                                   |
| §7 Build sequence (10 tasks)                   | Tasks 1-10 in same order                                                                                 |
| §8 Verification                                | Each task's verify steps + Task 10 (visual pass) + final all-clear                                       |
| §9 Risks (stone-25, GIF size, border-red drop) | Addressed in Task 1 step 4 (stone-25 verify), Task 7 GIF fallback, Task 2 migration table (border drops) |
| §10 Tests fallout                              | Task 2 step 17 (RoomList class assertions) + Task 6 step 1 (WelcomeStep heading assertion)               |
