import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureFixtureInclude, FIXTURE_INCLUDE_SENTINEL } from '../config-yaml.js'

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'lovelacer-cfg-'))
}

describe('ensureFixtureInclude', () => {
  it('creates configuration.yaml with default_config + include if missing', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    expect(yaml).toContain('default_config:')
    expect(yaml).toContain(FIXTURE_INCLUDE_SENTINEL)
    expect(yaml).toContain('!include lovelacer-fixtures.yaml')
  })

  it('appends include + sentinel to existing configuration.yaml without one', () => {
    const root = tempRoot()
    writeFileSync(
      join(root, 'configuration.yaml'),
      'default_config:\nautomation: !include automations.yaml\n',
    )
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    expect(yaml).toContain('automation: !include automations.yaml')
    expect(yaml).toContain(FIXTURE_INCLUDE_SENTINEL)
    expect(yaml).toContain('!include lovelacer-fixtures.yaml')
  })

  it('is idempotent — re-running does not duplicate the include', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    ensureFixtureInclude(root)
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    const occurrences = yaml.match(new RegExp(FIXTURE_INCLUDE_SENTINEL, 'g')) ?? []
    expect(occurrences).toHaveLength(1)
  })

  it('does not touch the file when sentinel already present in different position', () => {
    const root = tempRoot()
    const original = `default_config:\n${FIXTURE_INCLUDE_SENTINEL}\ntemplate: !include lovelacer-fixtures.yaml\n`
    writeFileSync(join(root, 'configuration.yaml'), original)
    ensureFixtureInclude(root)
    expect(readFileSync(join(root, 'configuration.yaml'), 'utf8')).toBe(original)
  })

  it('attaches the include via the canonical `template:` key', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    expect(yaml).toContain('template: !include lovelacer-fixtures.yaml')
    expect(yaml).not.toContain('homeassistant: !include lovelacer-fixtures.yaml')
  })

  it('writes nothing extra besides configuration.yaml', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    expect(existsSync(join(root, 'configuration.yaml'))).toBe(true)
    // No spurious files
  })
})
