/**
 * Reproducibly generate placeholder add-on branding (icon.png + logo.png)
 * from a hardcoded color + text config. Re-run when the brand changes.
 *
 * Output paths are committed to git — HA Supervisor needs the PNGs at
 * install time. P1b/P2 swap them for designed assets.
 *
 * Usage:
 *   pnpm generate:addon-assets
 *
 * Implementation: pure-JS PNG via pngjs. No native deps, no canvas
 * rendering — we draw a flat background and a centered glyph by writing
 * RGBA pixels into a buffer.
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const here = dirname(fileURLToPath(import.meta.url))
const addonDir = resolve(here, '../../apps/addon')

// Brand orange from packages/web/src/styles.css (oklch(0.62 0.19 35)
// converted to sRGB ≈ #e0653f).
const BRAND_RGB: [number, number, number] = [0xe0, 0x65, 0x3f]
const WHITE_RGB: [number, number, number] = [0xff, 0xff, 0xff]

interface PngConfig {
  width: number
  height: number
  outPath: string
  /**
   * For each pixel position, return the RGBA color. Pixels outside the
   * image bounds aren't queried.
   */
  shade: (x: number, y: number) => [number, number, number, number]
}

function writePng(cfg: PngConfig): void {
  const png = new PNG({ width: cfg.width, height: cfg.height, colorType: 6 })
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) {
      const idx = (cfg.width * y + x) << 2
      const [r, g, b, a] = cfg.shade(x, y)
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  writeFileSync(cfg.outPath, PNG.sync.write(png))
  console.log(`wrote ${cfg.outPath} (${cfg.width}x${cfg.height})`)
}

/**
 * Stamp an "L" glyph by filling pixels inside a hand-tuned rectangle
 * pattern. Returns true when (x, y) is inside the glyph.
 *
 * Coordinates are normalized 0..1 within the glyph bounding box so the
 * same routine scales for icon (128×128) and logo (250×100).
 */
function isInsideL(nx: number, ny: number, thickness: number): boolean {
  // Vertical stroke: 0..thickness on x, 0..1 on y
  if (nx >= 0 && nx <= thickness && ny >= 0 && ny <= 1) return true
  // Horizontal stroke at the bottom: 0..1 on x, 1-thickness..1 on y
  if (nx >= 0 && nx <= 1 && ny >= 1 - thickness && ny <= 1) return true
  return false
}

// --- icon.png: 128×128 brand-orange square with a centered white "L" ---
{
  const SIZE = 128
  const GLYPH_BOX = 64 // L sits inside a 64×64 box, centered
  const GLYPH_OFFSET = (SIZE - GLYPH_BOX) / 2
  const STROKE_THICKNESS = 0.28 // fraction of the bounding box

  writePng({
    width: SIZE,
    height: SIZE,
    outPath: resolve(addonDir, 'icon.png'),
    shade: (x, y) => {
      const gx = (x - GLYPH_OFFSET) / GLYPH_BOX
      const gy = (y - GLYPH_OFFSET) / GLYPH_BOX
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && isInsideL(gx, gy, STROKE_THICKNESS)) {
        return [...WHITE_RGB, 0xff]
      }
      return [...BRAND_RGB, 0xff]
    },
  })
}

// --- logo.png: 250×100 brand-orange with white "L" + "ovelacer" text ---
// We don't render arbitrary text without a glyph table (out of scope for
// pure-JS), so the logo is just the icon stamp scaled into a rectangle.
// The wordmark lands when we have a real designed asset.
{
  const W = 250
  const H = 100
  const GLYPH_H = 60
  const GLYPH_W = 60
  const OFFSET_X = 30
  const OFFSET_Y = (H - GLYPH_H) / 2
  const STROKE_THICKNESS = 0.28

  writePng({
    width: W,
    height: H,
    outPath: resolve(addonDir, 'logo.png'),
    shade: (x, y) => {
      const gx = (x - OFFSET_X) / GLYPH_W
      const gy = (y - OFFSET_Y) / GLYPH_H
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && isInsideL(gx, gy, STROKE_THICKNESS)) {
        return [...WHITE_RGB, 0xff]
      }
      return [...BRAND_RGB, 0xff]
    },
  })
}
