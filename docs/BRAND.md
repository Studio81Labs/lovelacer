# Brand — Lovelacer

**Status:** Locked v1 · **Last updated:** 2026-05-07

The visual identity for Lovelacer. Short, opinionated, prescriptive. If a question isn't answered here, default to whatever respects warmth, clarity, and the HA insider audience.

## Name

**Lovelacer.** One word, capitalized as a proper noun.

The name is a portmanteau of _Lovelace_ (the original name for HA's dashboard system, after Ada Lovelace) and the _-r_ agentive suffix — the thing that _does_ Lovelace work for you. It is intentionally HA-insider; for the audience this product targets, the reference lands within seconds. It is not positioned as a general dashboard tool.

In the wordmark, the trailing **r** is set in italic and accented in honey amber. This is a non-negotiable detail of the brand. The italicized _r_ is the visual hook.

## Voice

- **Confident, not loud.** "Generates a clean dashboard in five minutes" — not "Revolutionizes your smart home setup."
- **Direct, not chatty.** Skip emoji, marketing exclamation marks, and "✨ AI-powered ✨" framing.
- **Warm, not cute.** "Lovelacer" already carries enough whimsy in the name. Copy should be plain.
- **Czech-friendly translations.** Documentation supports EN+CS from day one. Avoid puns that don't survive translation.

### Taglines

- **Primary**: _Home Assistant dashboards that organize themselves._
- **Secondary**: _A clean starting dashboard you can actually use._
- **One-liner for the Add-on Store**: _Point Lovelacer at your Home Assistant install and get a clean room-based dashboard in under five minutes._

## Color system

Three roles. Don't add a fourth without a real reason.

### Primary · Honey amber

The brand color. Wordmark accent, primary action buttons, focus states, key data highlights.

| Token       | Hex       | OKLCH                 | Use                                  |
| ----------- | --------- | --------------------- | ------------------------------------ |
| `amber-50`  | `#FFF4D9` | `oklch(0.96 0.06 88)` | Lightest fill — info pills, hover bg |
| `amber-100` | `#FBE2A6` | `oklch(0.91 0.10 86)` | Soft fill                            |
| `amber-300` | `#F4B73D` | `oklch(0.81 0.16 80)` | **Wordmark accent · brand hue**      |
| `amber-500` | `#C76712` | `oklch(0.62 0.16 50)` | **Primary action button · links**    |
| `amber-700` | `#7A3D08` | `oklch(0.42 0.11 48)` | Text on amber-50 fills               |
| `amber-900` | `#3D1E04` | `oklch(0.25 0.07 45)` | Strongest brand text                 |

**Contrast notes:**

- White text on `amber-500` = 4.62:1 (passes WCAG AA for large/UI text)
- `amber-700` text on `amber-50` = 7.85:1 (passes AAA)
- Never put white text on `amber-300` — fails contrast. `amber-300` is for fills with dark text only.

### Neutral · Stone

Surfaces, body text, borders. Warm-tinted gray that grounds the amber without competing.

| Token       | Hex       | OKLCH                  | Use                       |
| ----------- | --------- | ---------------------- | ------------------------- |
| `stone-25`  | `#FAF8F4` | `oklch(0.98 0.005 90)` | Page background           |
| `stone-50`  | `#F1EFE8` | `oklch(0.94 0.008 90)` | Card surface · hover bg   |
| `stone-200` | `#D3D1C7` | `oklch(0.83 0.008 90)` | Borders · dividers        |
| `stone-500` | `#888780` | `oklch(0.58 0.006 90)` | Muted text · placeholders |
| `stone-700` | `#444441` | `oklch(0.34 0.003 90)` | Secondary text            |
| `stone-900` | `#2C2C2A` | `oklch(0.24 0.003 90)` | **Primary body text**     |

### Accent · Forest

Status, success states, secondary data points. Used sparingly — when you see forest green, it should mean something.

| Token        | Hex       | OKLCH                  | Use                              |
| ------------ | --------- | ---------------------- | -------------------------------- |
| `forest-50`  | `#E8F0DD` | `oklch(0.94 0.04 125)` | Success pill bg                  |
| `forest-300` | `#7CA84A` | `oklch(0.66 0.13 130)` | Charts · data accent             |
| `forest-700` | `#3F6B1A` | `oklch(0.45 0.13 130)` | Success text · "high confidence" |
| `forest-900` | `#1F3A0C` | `oklch(0.27 0.08 130)` | Strongest success text           |

### Semantic

For genuine errors and warnings — not for "ooh attention."

| Token         | Hex       | Use                                         |
| ------------- | --------- | ------------------------------------------- |
| `danger-50`   | `#FCEBEB` | Error fill                                  |
| `danger-700`  | `#791F1F` | Error text                                  |
| `warning-50`  | `#FFF4D9` | (Reuses amber-50 — no separate warning hue) |
| `warning-700` | `#7A3D08` | (Reuses amber-700)                          |

We deliberately collapse "warning" into the amber primary — we already have a warm hue, no need for a second one.

## Typography

Three families. No exceptions, no fallbacks beyond what's listed.

### Instrument Serif — Display

Used for: the wordmark, h1–h2 headings on marketing pages, the welcome message in the generated overview view, occasional editorial pull-quotes in docs.

```
Instrument Serif (Google Fonts) → 400 regular, 400 italic
Fallbacks: "Times New Roman", Georgia, serif
```

The italic cut carries the personality. Use it for the wordmark _r_, for editorial emphasis in marketing copy, for the occasional pull-quote. Don't italicize entire paragraphs — the cut is too distinct for sustained reading.

### Inter — UI

Used for: literally everything that isn't a heading or code. Body, buttons, form fields, table cells, navigation, inline UI.

```
Inter (Google Fonts) → 400 regular, 500 medium
Fallbacks: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
```

Two weights only. **Never use 600 or 700** in product UI — it reads as heavy and Bootstrap-y against Inter's geometry. Headings inside the app use Inter 500, not the serif.

### JetBrains Mono — Code

Used for: entity IDs, code snippets, YAML examples, terminal output, technical data fields.

```
JetBrains Mono (Google Fonts) → 400 regular, 500 medium
Fallbacks: ui-monospace, "SF Mono", Menlo, monospace
```

### Type scale

| Role                   | Family                  | Size             | Weight | Line height |
| ---------------------- | ----------------------- | ---------------- | ------ | ----------- |
| Display (marketing h1) | Instrument Serif        | 56px / 3.5rem    | 400    | 1.05        |
| Display italic accent  | Instrument Serif italic | 56px / 3.5rem    | 400    | 1.05        |
| h1 (in-app)            | Inter                   | 24px / 1.5rem    | 500    | 1.3         |
| h2 (in-app)            | Inter                   | 20px / 1.25rem   | 500    | 1.35        |
| h3 (in-app)            | Inter                   | 16px / 1rem      | 500    | 1.4         |
| Body                   | Inter                   | 14px / 0.875rem  | 400    | 1.55        |
| Small / meta           | Inter                   | 12px / 0.75rem   | 400    | 1.5         |
| Code                   | JetBrains Mono          | 13px / 0.8125rem | 400    | 1.5         |

## Logo

**The logo is the tile-mark plus the italic-r wordmark, locked.** Don't redraw, don't substitute fonts, don't add taglines underneath.

### The mark

Five rounded squares (10% corner radius) arranged in an "L":

```
[ ]
[ ]
[ ][ ][ ]
```

Each tile represents a detected room. The colors run amber → light amber → amber → cream → forest, reading from top to bottom-right. The forest tile is always the bottom-right (the "high confidence" accent visually). This is the rhythm:

| Position     | Color (light bg)       | Color (dark bg)        |
| ------------ | ---------------------- | ---------------------- |
| Top          | `amber-500` `#C76712`  | `amber-300` `#F4B73D`  |
| Middle       | `amber-300` `#F4B73D`  | `amber-500` `#C76712`  |
| Bottom-left  | `amber-500` `#C76712`  | `amber-300` `#F4B73D`  |
| Bottom-mid   | `amber-100` `#FBE2A6`  | `amber-700` `#7A3D08`  |
| Bottom-right | `forest-300` `#7CA84A` | `forest-300` `#7CA84A` |

The mark scales from 16px (favicon) to any size. Below 12px the tiles merge visually; don't use the mark below 16px.

### The wordmark

`lovelace` set in Instrument Serif 400, lowercase, no kerning adjustments. The trailing `r` is set in Instrument Serif **italic** 400, in `amber-500` on light backgrounds, `amber-300` on dark.

### The lockup

Mark sits flush left, wordmark to the right. Vertical alignment: the mark's top edge aligns with the wordmark's cap height; bottom edge aligns with the baseline. Gap between mark and wordmark is the height of one tile (1×).

Do not stack the mark above the wordmark. Do not center the wordmark relative to the mark. Do not put the wordmark below.

### Don'ts

- Don't change the wordmark font, even to a "similar" serif.
- Don't add a tagline directly under the wordmark in the locked logo. Taglines live in marketing layouts, not in the mark.
- Don't recolor individual tiles for cute reasons (holiday themes, A/B tests). The forest tile is the only non-amber tile, always.
- Don't use the mark on a colored background that conflicts with the tile colors. Use it on stone-25, stone-50, white, or stone-900.
- Don't compress, italicize, or stretch the wordmark. The italic-r is the only italic.
- Don't substitute the mark for an emoji or a Material icon.

## Logo files

Files live in `packages/web/public/brand/` and are mirrored to `apps/addon/` for the HA Add-on Store listing:

- `lovelacer-mark.svg` — mark only, light variant
- `lovelacer-mark-dark.svg` — mark only, dark variant
- `lovelacer-lockup.svg` — full lockup (mark + wordmark), light
- `lovelacer-lockup-dark.svg` — full lockup, dark
- `lovelacer-favicon.svg` — 16/24/32px optimized mark
- `lovelacer-icon-512.png` — Add-on Store icon, 512×512 (mirrored to `apps/addon/icon.png`)
- `lovelacer-logo-1024.png` — Add-on Store banner logo, 1024×400 (mirrored to `apps/addon/logo.png`)

PNG exports are generated one-time from SVG sources via `rsvg-convert`. Re-render when the SVGs change:

```bash
rsvg-convert -w 512  -h 512 packages/web/public/brand/lovelacer-mark.svg   -o packages/web/public/brand/lovelacer-icon-512.png
rsvg-convert -w 1024 -h 400 packages/web/public/brand/lovelacer-lockup.svg -o packages/web/public/brand/lovelacer-logo-1024.png
cp packages/web/public/brand/lovelacer-icon-512.png  apps/addon/icon.png
cp packages/web/public/brand/lovelacer-logo-1024.png apps/addon/logo.png
```

## Application examples

### In-app — confidence pill

```html
<span class="rounded-full bg-forest-50 px-3 py-0.5 text-xs font-medium text-forest-700">
  9 confirmed
</span>
```

### In-app — primary button

```html
<button
  class="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium
                text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-300"
>
  Apply dashboard
</button>
```

### In-app — review-needed pill

```html
<span class="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-700">
  3 to review
</span>
```

## Open questions

1. Animated favicon when analysis is running — tiles pulsing in sequence? Defer until v1.0 polish phase.
2. Holiday themes? **No.** The brand stays consistent year-round.
3. Czech wordmark variant? The wordmark is the wordmark in any locale — "lovelacer" reads the same in Czech. UI strings localize; the brand doesn't.

---

_This document is the source of truth for visual decisions. If something here looks wrong in practice, fix the document, then fix the implementation. Don't let drift happen silently._
