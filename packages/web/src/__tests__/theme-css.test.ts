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
})
