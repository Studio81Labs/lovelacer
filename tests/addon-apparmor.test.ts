import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Home Assistant add-on AppArmor profile', () => {
  it('allows the official Node runtime copied into /usr/local/bin', () => {
    const profile = readFileSync(resolve('apps/addon/apparmor.txt'), 'utf8')

    expect(profile).toMatch(/\/usr\/local\/bin\/node\s+ix,/)
  })

  it('allows SQLite to lock files in /data', () => {
    const profile = readFileSync(resolve('apps/addon/apparmor.txt'), 'utf8')

    expect(profile).toMatch(/\/data\/\*\*\s+[a-z]*k[a-z]*,/)
  })
})
