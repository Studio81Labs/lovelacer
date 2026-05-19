import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('theme CSS', () => {
  it('overrides white surface utility variants in dark mode', () => {
    const css = readFileSync(resolve('src/styles.css'), 'utf8')

    expect(css).toContain("html[data-theme='dark'] .bg-white\\/95")
    expect(css).toContain("html[data-theme='dark'] .odd\\:bg-white:nth-child(odd)")
    expect(css).toContain("html[data-theme='dark'] .hover\\:bg-white:hover")
  })

  it('overrides light border and divider utility variants in dark mode', () => {
    const css = readFileSync(resolve('src/styles.css'), 'utf8')

    expect(css).toContain("html[data-theme='dark'] .border-stone-100")
    expect(css).toContain("html[data-theme='dark'] .border-stone-200")
    expect(css).toContain("html[data-theme='dark'] .divide-stone-100")
  })

  it('keeps primary buttons legible on the dark amber surface', () => {
    const css = readFileSync(resolve('src/styles.css'), 'utf8')

    expect(css).toContain("html[data-theme='dark'] .ll-btn-primary")
    expect(css).toContain('color: var(--color-amber-50)')
  })
})
