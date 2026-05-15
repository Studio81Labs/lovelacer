import { describe, expect, it } from 'vitest'
import { resolveConfig } from 'vite'
import { resolve } from 'node:path'

describe('web Vite build configuration', () => {
  it('allows the intentionally lazy-loaded offline MDI picker chunk', async () => {
    const configFile = resolve('vite.config.ts')
    const config = await resolveConfig({ configFile }, 'build')

    expect(config.build.chunkSizeWarningLimit).toBe(3000)
  })
})
